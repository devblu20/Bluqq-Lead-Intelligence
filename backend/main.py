import os
import asyncio
import json
import traceback
from datetime import datetime

from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI

from src.api.routes import auth, leads, messages, webhooks
from src.api.routes import calls
from src.ai.bluqq_router import router as voice_router
from src.ai.bluqq_rag import init_rag, get_rag_context, get_rag_stats
from src.services.bluqq_calendar import create_consultation_event, get_available_slots
from src.services.bluqq_transfer import initiate_transfer
from src.utils.bluqq_logger import setup_logger
from src.config.settings import get_settings
from src.config.database import query as db_query


settings      = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
log           = setup_logger("bluqq")

app = FastAPI(
    title="BluQQ API",
    description="AI Sales + Voice Assistant",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ─── CORS FIX ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://bluqq.com",
        "https://www.bluqq.com",
        "https://bluqq-lead-intelligence.vercel.app",
        "https://bluqq-lead-intelligence-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Existing BluQQ routes ────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(leads.router,    prefix="/api/leads",    tags=["Leads"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(calls.router,    prefix="/api/calls",    tags=["Calls"])
app.include_router(voice_router,    prefix="/api/voice",    tags=["Voice"])



# ─────────────────────────────────────────────────────────────
# ORG RESOLVER — Twilio number se org dhundho
# ─────────────────────────────────────────────────────────────

def get_org_by_twilio_number(twilio_number: str) -> dict | None:
    try:
        result = db_query(
            """SELECT c.org_id, o.name as org_name
               FROM channels c
               JOIN organisations o ON o.id = c.org_id
               WHERE c.platform = 'twilio'
               AND c.twilio_phone_number = %s
               AND c.is_active = TRUE
               LIMIT 1""",
            (twilio_number,),
            fetch="one"
        )
        if result:
            log.info(f"[Org] ✅ Found via channels table: {twilio_number}")
            return dict(result)

        if twilio_number == settings.TWILIO_PHONE_NUMBER or not twilio_number:
            log.info(f"[Org] Matching via .env TWILIO_PHONE_NUMBER")
            result = db_query(
                """SELECT id as org_id, name as org_name
                   FROM organisations
                   WHERE is_active = TRUE
                   ORDER BY created_at ASC
                   LIMIT 1""",
                fetch="one"
            )
            if result:
                org = dict(result)
                log.info(f"[Org] ✅ Found via .env fallback: {org['org_name']}")
                return org

        result = db_query(
            """SELECT id as org_id, name as org_name
               FROM organisations
               WHERE is_active = TRUE
               ORDER BY created_at ASC
               LIMIT 1""",
            fetch="one"
        )
        if result:
            log.warning(f"[Org] ⚠ Using first active org as fallback")
            return dict(result)

        return None

    except Exception as e:
        log.error(f"[Org] DB error: {e}")
        traceback.print_exc()
        return {
            "org_id":   None,
            "org_name": "BluQQ"
        }


# ─────────────────────────────────────────────────────────────
# ORG PROMPT FETCHER
# ─────────────────────────────────────────────────────────────

def get_org_prompt(org_id: str) -> str:
    try:
        result = db_query(
            """SELECT system_prompt, ai_name, tone
               FROM org_ai_config
               WHERE org_id = %s
               LIMIT 1""",
            (org_id,),
            fetch="one"
        )
        if result and result.get("system_prompt"):
            log.info(f"[Prompt] ✅ Custom prompt loaded from org_ai_config")
            return result["system_prompt"]
        else:
            log.warning(f"[Prompt] No custom prompt found — using default")
    except Exception as e:
        log.warning(f"[Prompt] DB error: {e}")

    return DEFAULT_SYSTEM_PROMPT


# ─────────────────────────────────────────────────────────────
# LEAD LOOKUP
# ─────────────────────────────────────────────────────────────

def get_lead_by_phone(phone: str, org_id: str) -> dict | None:
    try:
        result = db_query(
            """SELECT id, name, email, status, notes
               FROM leads
               WHERE phone = %s AND org_id = %s
               LIMIT 1""",
            (phone, org_id),
            fetch="one"
        )
        return dict(result) if result else None
    except Exception as e:
        log.warning(f"[Lead Lookup] error: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# DEFAULT SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are Priya, a friendly AI sales assistant.

LANGUAGE: ENGLISH ONLY.

SPEAKING STYLE:
- Warm, friendly, natural
- Maximum 2 complete sentences per response
- Always end with a short question
- NEVER stop mid-sentence

GREETING: "Hi, this is Priya! How can I help you today?"

GOODBYE: If caller says bye/goodbye/thank you — respond warmly and STOP.
"""


# ─────────────────────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function", "name": "search_knowledge_base",
        "description": "Search knowledge base for services, pricing, FAQs, policies.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"]
        }
    },
    {
        "type": "function", "name": "submit_lead",
        "description": "Save caller contact info.",
        "parameters": {
            "type": "object",
            "properties": {
                "name":             {"type": "string"},
                "email":            {"type": "string"},
                "phone":            {"type": "string"},
                "service_interest": {"type": "string"}
            },
            "required": ["name", "service_interest"]
        }
    },
    {
        "type": "function", "name": "book_consultation",
        "description": "Book a free consultation.",
        "parameters": {
            "type": "object",
            "properties": {
                "name":           {"type": "string"},
                "email":          {"type": "string"},
                "preferred_time": {"type": "string"},
                "topic":          {"type": "string"}
            },
            "required": ["name", "preferred_time", "topic"]
        }
    },
    {
        "type": "function", "name": "transfer_to_human",
        "description": "Transfer caller to live agent.",
        "parameters": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"]
        }
    },
]


# ─────────────────────────────────────────────────────────────
# TOOL EXECUTOR
# ─────────────────────────────────────────────────────────────

async def execute_tool(
    tool_name: str, args: dict,
    session_id: str, caller_phone: str,
    org_id: str = None
) -> dict:
    log.info(f"[Tool] {tool_name}({str(args)[:80]})")

    if tool_name == "search_knowledge_base":
        context = get_rag_context(
            args.get("query", ""),
            top_k=3,
            org_id=org_id
        )
        return {"status": "found", "context": context} if context else \
               {"status": "not_found", "message": "Please contact us at info@bluqq.com"}

    elif tool_name == "submit_lead":
        try:
            db_query(
                """INSERT INTO leads
                   (name, phone, email, status, source, notes, org_id, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                   ON CONFLICT (phone, org_id)
                   DO UPDATE SET
                     name   = EXCLUDED.name,
                     status = 'contacted',
                     notes  = EXCLUDED.notes""",
                (
                    args.get("name", "Unknown"),
                    caller_phone or args.get("phone", ""),
                    args.get("email", ""),
                    "new",
                    "Phone Call — Priya AI",
                    f"Interested in: {args.get('service_interest', 'General')}",
                    org_id
                ),
                fetch="none"
            )
            log.info(f"[Lead] ✅ Saved to DB: {args.get('name')}")
        except Exception as e:
            log.error(f"[Lead] DB save failed: {e} — saving to file")
            os.makedirs("leads", exist_ok=True)
            lead = {
                "timestamp":        datetime.now().isoformat(),
                "session_id":       session_id,
                "org_id":           org_id,
                "name":             args.get("name", "Unknown"),
                "email":            args.get("email", ""),
                "phone":            caller_phone or args.get("phone", ""),
                "service_interest": args.get("service_interest", "General"),
                "source":           "Phone Call — Priya AI"
            }
            with open(f"leads/lead_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
                json.dump(lead, f, indent=2)

        return {"status": "success", "message": f"Got it! We'll contact {args.get('name')} within 24 hours."}

    elif tool_name == "book_consultation":
        try:
            return create_consultation_event(
                name=args.get("name", "Unknown"),
                email=args.get("email", ""),
                phone=caller_phone or "",
                topic=args.get("topic", "General"),
                preferred_time=args.get("preferred_time", "tomorrow 11am"),
                duration_mins=30
            )
        except Exception as e:
            log.error(f"[Booking] Error: {e}")
            return {"status": "success", "message": "Consultation noted! We'll confirm shortly."}

    elif tool_name == "transfer_to_human":
        try:
            return await initiate_transfer(
                call_sid=session_id, session_id=session_id,
                caller_phone=caller_phone or "",
                reason=args.get("reason", ""),
                transcript=[]
            )
        except Exception as e:
            log.error(f"[Transfer] Error: {e}")
            return {"status": "error", "message": "Transfer unavailable right now."}

    return {"status": "error", "message": "Unknown tool"}


# ─────────────────────────────────────────────────────────────
# TWILIO WEBHOOK
# ─────────────────────────────────────────────────────────────

@app.post("/incoming-call")
async def incoming_call(request: Request):
    try:
        ngrok_url = settings.SERVER_URL.replace("https://", "").replace("http://", "")
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://{ngrok_url}/media-stream" />
  </Connect>
</Response>"""
        log.info(f"[Incoming Call] ✅ TwiML → wss://{ngrok_url}/media-stream")
        return Response(content=twiml, media_type="text/xml")
    except Exception as e:
        log.error(f"[Incoming Call] ❌ {e}")
        return Response(
            content="""<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, a technical error occurred. Please try again.</Say></Response>""",
            media_type="text/xml"
        )


# ─────────────────────────────────────────────────────────────
# PRIYA AI — MEDIA STREAM
# ─────────────────────────────────────────────────────────────

@app.websocket("/media-stream")
async def media_stream(twilio_ws: WebSocket):
    await twilio_ws.accept()

    session_id   = datetime.now().strftime("%Y%m%d_%H%M%S")
    transcript   = []
    tools_used   = []
    stream_sid   = None
    caller_phone = None
    org_id       = None
    org_name     = None
    ws_connected = True

    log.info("=" * 55)
    log.info(f"📞 CALL STARTED — Session: {session_id}")
    log.info("=" * 55)

    try:
        async with openai_client.beta.realtime.connect(
            model="gpt-4o-realtime-preview"
        ) as openai_conn:

            await openai_conn.session.update(session={
                "modalities":   ["text", "audio"],
                "instructions": DEFAULT_SYSTEM_PROMPT,
                "turn_detection": {
                    "type":                "server_vad",
                    "threshold":           0.75,
                    "prefix_padding_ms":   300,
                    "silence_duration_ms": 600
                },
                "voice":                      "shimmer",
                "input_audio_format":         "g711_ulaw",
                "output_audio_format":        "g711_ulaw",
                "input_audio_transcription":  {"model": "whisper-1"},
                "temperature":                0.7,
                "max_response_output_tokens": 200,
                "tools":       TOOLS,
                "tool_choice": "auto",
            })

            log.info("✅ Priya AI ready!")

            async def caller_to_ai():
                nonlocal stream_sid, caller_phone, org_id, org_name, ws_connected

                async for raw in twilio_ws.iter_text():
                    msg = json.loads(raw)

                    if msg["event"] == "start":
                        stream_sid   = msg["start"]["streamSid"]
                        custom       = msg["start"].get("customParameters", {})
                        caller_phone = custom.get("from", "") or msg["start"].get("from", "")

                        to_number = (
                            custom.get("to", "") or
                            msg["start"].get("to", "") or
                            settings.TWILIO_PHONE_NUMBER
                        )

                        log.info(f"📞 Stream   : {stream_sid}")
                        log.info(f"📞 Caller   : {caller_phone or 'Unknown'}")
                        log.info(f"📞 To Number: {to_number}")

                        org = get_org_by_twilio_number(to_number)

                        if org:
                            org_id   = str(org["org_id"]) if org.get("org_id") else None
                            org_name = org.get("org_name", "BluQQ")
                            log.info(f"🏢 Org: {org_name} ({org_id})")

                            final_prompt = DEFAULT_SYSTEM_PROMPT
                            if org_id:
                                final_prompt = get_org_prompt(org_id)

                                if caller_phone:
                                    lead = get_lead_by_phone(caller_phone, org_id)
                                    if lead:
                                        final_prompt += (
                                            f"\n\nCALLER INFO:"
                                            f"\n- Name: {lead.get('name', 'Unknown')}"
                                            f"\n- Status: {lead.get('status', 'new')}"
                                            f"\n- Notes: {lead.get('notes', '')}"
                                            f"\nGreet them by name and reference their history naturally."
                                        )
                                        log.info(f"[Lead] ✅ Existing lead: {lead.get('name')}")

                            await openai_conn.session.update(session={
                                "instructions": final_prompt
                            })
                            log.info(f"✅ Prompt updated for: {org_name}")
                        else:
                            log.warning("⚠ No org found — default prompt used")

                    elif msg["event"] == "media":
                        await openai_conn.input_audio_buffer.append(
                            audio=msg["media"]["payload"]
                        )

                    elif msg["event"] == "stop":
                        log.info("📞 Call ended")
                        ws_connected = False
                        break

            async def ai_to_caller():
                async for event in openai_conn:

                    if event.type == "response.audio.delta":
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event":     "media",
                                "streamSid": stream_sid,
                                "media":     {"payload": event.delta},
                            }))

                    elif event.type == "input_speech_started":
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event": "clear", "streamSid": stream_sid
                            }))
                            try:
                                await openai_conn.response.cancel()
                            except Exception:
                                pass

                    elif event.type == "conversation.item.input_audio_transcription.completed":
                        text = event.transcript
                        log.info(f"Caller : {text}")
                        transcript.append({
                            "role": "caller", "text": text,
                            "timestamp": datetime.now().isoformat()
                        })

                    elif event.type == "response.audio_transcript.done":
                        text = event.transcript
                        log.info(f"Priya  : {text}")
                        transcript.append({
                            "role": "ai", "text": text,
                            "timestamp": datetime.now().isoformat()
                        })

                    elif event.type == "response.function_call_arguments.done":
                        tool_name = event.name
                        args      = json.loads(event.arguments)
                        tools_used.append(tool_name)
                        result = await execute_tool(
                            tool_name, args,
                            session_id, caller_phone or "",
                            org_id=org_id
                        )
                        log.info(f"[Tool Result] {str(result)[:100]}")
                        await openai_conn.conversation.item.create(item={
                            "type":    "function_call_output",
                            "call_id": event.call_id,
                            "output":  json.dumps(result)
                        })
                        await openai_conn.response.create()

                    elif event.type == "error":
                        log.error(f"OpenAI Error: {event.error}")

            tasks = [
                asyncio.create_task(caller_to_ai(), name="caller_to_ai"),
                asyncio.create_task(ai_to_caller(), name="ai_to_caller"),
            ]
            try:
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=1800)
            except asyncio.TimeoutError:
                log.warning("⏱ Call timeout 30 min")
            finally:
                for t in tasks:
                    t.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)

    except WebSocketDisconnect:
        log.info("[Media Stream] Twilio disconnected")
    except Exception as e:
        log.error(f"[Media Stream] ❌ Error: {e}")
        traceback.print_exc()
    finally:
        os.makedirs("sessions", exist_ok=True)
        session_data = {
            "session_id":   session_id,
            "org_id":       org_id,
            "org_name":     org_name,
            "caller_phone": caller_phone or "Unknown",
            "call_end":     datetime.now().isoformat(),
            "transcript":   transcript,
            "tools_used":   tools_used,
        }
        with open(f"sessions/session_{session_id}.json", "w", encoding="utf-8") as f:
            json.dump(session_data, f, indent=2, ensure_ascii=False)

        log.info("─" * 55)
        log.info(f"  Org    : {org_name} ({org_id})")
        log.info(f"  Caller : {caller_phone}")
        log.info(f"  Turns  : {len([t for t in transcript if t['role'] == 'caller'])}")
        log.info(f"  Tools  : {tools_used}")
        log.info("─" * 55)


# ─────────────────────────────────────────────────────────────
# HEALTH + ROOT
# ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "BluQQ API running", "version": "2.0.0"}

@app.get("/")
def root():
    return {"message": "Welcome to BluQQ API. Visit /docs"}


# ─────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    try:
        init_rag()
        log.info("✅ RAG loaded from DB")
    except Exception as e:
        log.warning(f"RAG init failed: {e}")
