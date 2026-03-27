import os
import asyncio
import json
import traceback
from datetime import datetime

from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """
    Jis Twilio number pe call aayi — us number se org dhundho.
    channels table mein Twilio number stored hoga.
    """
    try:
        # Option 1 — channels table mein dhundho
        result = db_query(
            """SELECT c.org_id, o.name as org_name
               FROM channels c
               JOIN organisations o ON o.id = c.org_id
               WHERE c.phone_number_id = %s OR c.phone_number = %s
               AND c.is_active = TRUE
               LIMIT 1""",
            (twilio_number, twilio_number),
            fetch="one"
        )
        if result:
            return dict(result)

        # Option 2 — organisations table mein directly dhundho
        result = db_query(
            """SELECT id as org_id, name as org_name
               FROM organisations
               WHERE is_active = TRUE
               LIMIT 1""",
            fetch="one"
        )
        return dict(result) if result else None

    except Exception as e:
        log.error(f"[Org] DB error: {e}")
        return None


def get_org_prompt(org_id: str) -> str:
    """
    org_ai_config table se AI ka system prompt fetch karo.
    WhatsApp AI same table use karta hai.
    """
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
            return result["system_prompt"]
    except Exception as e:
        log.warning(f"[Org Prompt] DB error: {e}")

    # Default prompt fallback
    return DEFAULT_SYSTEM_PROMPT


def get_lead_by_phone(phone: str, org_id: str) -> dict | None:
    """Caller ka existing lead record dhundho."""
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
# DEFAULT SYSTEM PROMPT — fallback
# ─────────────────────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are Priya, a friendly AI assistant.

LANGUAGE: ENGLISH ONLY.

SPEAKING STYLE:
- Warm, friendly, natural
- Maximum 2 complete sentences per response
- Always end with a short question
- NEVER stop mid-sentence

GREETING: "Hi, this is Priya! How can I help you today?"

GOODBYE: If caller says bye/goodbye — respond warmly and STOP.
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

    # ── Search Knowledge Base ─────────────────────────────────
    if tool_name == "search_knowledge_base":
        context = get_rag_context(
            args.get("query", ""),
            top_k=3,
            org_id=org_id
        )
        return {"status": "found", "context": context} if context else \
               {"status": "not_found", "message": "Please contact us at info@bluqq.com"}

    # ── Submit Lead ───────────────────────────────────────────
    elif tool_name == "submit_lead":
        try:
            # DB mein save karo
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

    # ── Book Consultation ─────────────────────────────────────
    elif tool_name == "book_consultation":
        try:
            result = create_consultation_event(
                name=args.get("name", "Unknown"),
                email=args.get("email", ""),
                phone=caller_phone or "",
                topic=args.get("topic", "General"),
                preferred_time=args.get("preferred_time", "tomorrow 11am"),
                duration_mins=30
            )
            return result
        except Exception as e:
            log.error(f"[Booking] Error: {e}")
            return {"status": "success", "message": "Consultation request noted! We'll confirm shortly."}

    # ── Transfer to Human ─────────────────────────────────────
    elif tool_name == "transfer_to_human":
        try:
            result = await initiate_transfer(
                call_sid=session_id,
                session_id=session_id,
                caller_phone=caller_phone or "",
                reason=args.get("reason", ""),
                transcript=[]
            )
            return result
        except Exception as e:
            log.error(f"[Transfer] Error: {e}")
            return {"status": "error", "message": "Transfer unavailable right now."}

    return {"status": "error", "message": "Unknown tool"}


# ─────────────────────────────────────────────────────────────
# TWILIO WEBHOOK — /incoming-call
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
        fallback = """<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, a technical error occurred. Please try again.</Say></Response>"""
        return Response(content=fallback, media_type="text/xml")


# ─────────────────────────────────────────────────────────────
# PRIYA AI — /media-stream
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

            # ── Initial session — default prompt se start karo ─
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

            # ── Twilio → OpenAI ───────────────────────────────
            async def caller_to_ai():
                nonlocal stream_sid, caller_phone, org_id, org_name, ws_connected

                async for raw in twilio_ws.iter_text():
                    msg = json.loads(raw)

                    # ── Call start — org resolve karo ─────────
                    if msg["event"] == "start":
                        stream_sid   = msg["start"]["streamSid"]
                        custom       = msg["start"].get("customParameters", {})
                        caller_phone = custom.get("from", "") or msg["start"].get("from", "")
                        to_number    = custom.get("to", "") or settings.TWILIO_PHONE_NUMBER

                        log.info(f"📞 Stream   : {stream_sid}")
                        log.info(f"📞 Caller   : {caller_phone or 'Unknown'}")
                        log.info(f"📞 To Number: {to_number}")

                        # ── Org dhundho Twilio number se ──────
                        org = get_org_by_twilio_number(to_number)
                        if org:
                            org_id   = str(org["org_id"])
                            org_name = org.get("org_name", "BluQQ")
                            log.info(f"🏢 Org: {org_name} ({org_id})")

                            # ── DB se org ka custom prompt lo ─
                            custom_prompt = get_org_prompt(org_id)

                            # ── Existing lead check karo ──────
                            lead_context = ""
                            if caller_phone:
                                lead = get_lead_by_phone(caller_phone, org_id)
                                if lead:
                                    lead_context = f"\n\nCALLER INFO: Name: {lead.get('name')}, Status: {lead.get('status')}, Notes: {lead.get('notes','')}"
                                    log.info(f"[Lead] Found existing: {lead.get('name')}")

                            # ── OpenAI session update karo ────
                            await openai_conn.session.update(session={
                                "instructions": custom_prompt + lead_context
                            })
                            log.info(f"✅ Org prompt loaded for: {org_name}")
                        else:
                            log.warning("⚠ No org found — using default prompt")

                    # ── Audio Twilio → OpenAI ─────────────────
                    elif msg["event"] == "media":
                        await openai_conn.input_audio_buffer.append(
                            audio=msg["media"]["payload"]
                        )

                    # ── Call end ──────────────────────────────
                    elif msg["event"] == "stop":
                        log.info("📞 Call ended by Twilio")
                        ws_connected = False
                        break

            # ── OpenAI → Twilio ───────────────────────────────
            async def ai_to_caller():
                async for event in openai_conn:

                    # ── Audio bhejo caller ko ─────────────────
                    if event.type == "response.audio.delta":
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event":     "media",
                                "streamSid": stream_sid,
                                "media":     {"payload": event.delta},
                            }))

                    # ── Barge-in — caller bole toh AI band ────
                    elif event.type == "input_speech_started":
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event":     "clear",
                                "streamSid": stream_sid
                            }))
                            try:
                                await openai_conn.response.cancel()
                            except Exception:
                                pass

                    # ── Caller transcript ─────────────────────
                    elif event.type == "conversation.item.input_audio_transcription.completed":
                        text = event.transcript
                        log.info(f"Caller : {text}")
                        transcript.append({
                            "role": "caller", "text": text,
                            "timestamp": datetime.now().isoformat()
                        })

                    # ── AI transcript ─────────────────────────
                    elif event.type == "response.audio_transcript.done":
                        text = event.transcript
                        log.info(f"Priya  : {text}")
                        transcript.append({
                            "role": "ai", "text": text,
                            "timestamp": datetime.now().isoformat()
                        })

                    # ── Tool call ─────────────────────────────
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

                    # ── Error ─────────────────────────────────
                    elif event.type == "error":
                        log.error(f"OpenAI Error: {event.error}")

            # ── Dono tasks parallel chalao ────────────────────
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
        # ── Session save karo ─────────────────────────────────
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
        log.info(f"  Org     : {org_name} ({org_id})")
        log.info(f"  Caller  : {caller_phone}")
        log.info(f"  Turns   : {len([t for t in transcript if t['role'] == 'caller'])}")
        log.info(f"  Tools   : {tools_used}")
        log.info("─" * 55)


# ─────────────────────────────────────────────────────────────
# HEALTH CHECK
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
