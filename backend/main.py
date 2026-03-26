import os
import asyncio
import json
import base64
import traceback
from datetime import datetime

from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

# ── BLUQQ CRM/Sales Routes ────────────────────────────────────
from src.api.routes import auth, leads, messages, webhooks
from src.api.routes import calls
from src.ai.bluqq_router import router as voice_router
from src.ai.bluqq_rag import init_rag, get_rag_context, get_rag_stats
from src.services.bluqq_analytics  import get_full_analytics, get_overview, get_daily_volume, get_top_tools
from src.services.bluqq_calendar   import create_consultation_event, get_available_slots, calendar_ok
from src.services.bluqq_transfer   import initiate_transfer, should_transfer
from src.utils.bluqq_transcript    import save_all_formats, update_master_csv
from src.utils.bluqq_latency       import LatencyTracker as LatTracker
from src.utils.bluqq_logger        import setup_logger, CallLogger, close_session_logger
from src.utils.bluqq_retry         import (
    ErrorTracker, safe_openai_update, safe_openai_send_audio,
    safe_twilio_send, safe_tool_execute
)
from src.config.settings import get_settings

settings = get_settings()

# ── OpenAI Client ─────────────────────────────────────────────
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
log = setup_logger("bluqq")

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

# ── CRM Routes ────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(leads.router,    prefix="/api/leads",    tags=["Leads"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(calls.router,    prefix="/api/calls",    tags=["Calls"])
app.include_router(voice_router,    prefix="/api/voice",    tags=["Voice"])

# ── Priya System Prompt ───────────────────────────────────────
BASE_SYSTEM_PROMPT = """You are Priya, a friendly assistant at BluQQ Technologies.

LANGUAGE RULE: ENGLISH ONLY. Never Hindi. Always English.

IDENTITY: Warm, conversational AI assistant.
If asked "are you an AI?": "I'm an AI assistant for BluQQ, but I'm here to help just like a human would!"

SPEAKING STYLE:
- Warm, friendly, natural
- Maximum 2 complete sentences per response
- Always end with a short question
- NEVER stop mid-sentence

GREETING: "Hi, this is Priya from BluQQ! How can I help you today?"

SERVICES: Trading bots, dashboards, AI tools, data pipelines, web scraping, real estate tech.
PRICING: Trading bots $500-5000, Dashboards $800-3000, AI tools $1500-6000.

GOODBYE: If caller says bye/goodbye/thank you — respond warmly and STOP.
"""

TOOLS = [
    {
        "type": "function", "name": "search_knowledge_base",
        "description": "Search BluQQ knowledge base for services, pricing, FAQs.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"]
        }
    },
    {
        "type": "function", "name": "book_consultation",
        "description": "Book a free consultation with BluQQ team.",
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
        "type": "function", "name": "submit_lead",
        "description": "Save caller contact info to BluQQ sales team.",
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
        "type": "function", "name": "transfer_to_human",
        "description": "Transfer caller to live agent.",
        "parameters": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"]
        }
    },
]

async def execute_tool(tool_name: str, args: dict, session_id: str, caller_phone: str) -> dict:
    log.info(f"[Tool] {tool_name}({str(args)[:80]})")

    if tool_name == "search_knowledge_base":
        context = get_rag_context(args.get("query", ""), top_k=2)
        return {"status": "found", "context": context} if context else \
               {"status": "not_found", "message": "Contact info@bluqq.com"}

    elif tool_name == "submit_lead":
        os.makedirs("leads", exist_ok=True)
        lead = {
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id,
            "name": args.get("name", "Unknown"),
            "email": args.get("email", ""),
            "phone": caller_phone or args.get("phone", ""),
            "service_interest": args.get("service_interest", "General"),
            "source": "Phone Call — BluQQ AI"
        }
        fname = f"leads/lead_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(fname, "w") as f:
            json.dump(lead, f, indent=2)
        return {"status": "success", "message": f"Got it! We'll contact {args.get('name')} within 24 hours."}

    elif tool_name == "book_consultation":
        result = create_consultation_event(
            name=args.get("name", "Unknown"),
            email=args.get("email", ""),
            phone=caller_phone or "",
            topic=args.get("topic", "General"),
            preferred_time=args.get("preferred_time", "tomorrow 11am"),
            duration_mins=30
        )
        return result

    elif tool_name == "transfer_to_human":
        result = await initiate_transfer(
            call_sid=session_id, session_id=session_id,
            caller_phone=caller_phone or "",
            reason=args.get("reason", ""),
            transcript=[]
        )
        return result

    return {"status": "error", "message": "Unknown tool"}


# ── Twilio Webhook ────────────────────────────────────────────
@app.post("/incoming-call")
async def incoming_call(request: Request):
    ngrok_url = settings.SERVER_URL.replace("https://", "").replace("http://", "")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://{ngrok_url}/media-stream" />
  </Connect>
</Response>"""
    log.info(f"[Incoming Call] ✅ TwiML sent → wss://{ngrok_url}/media-stream")
    return Response(content=twiml, media_type="text/xml")


# ── Priya AI — Media Stream ───────────────────────────────────
@app.websocket("/media-stream")
async def media_stream(twilio_ws: WebSocket):
    await twilio_ws.accept()

    session_id   = datetime.now().strftime("%Y%m%d_%H%M%S")
    transcript   = []
    tools_used   = []
    stream_sid   = None
    caller_phone = None
    ws_connected = True

    log.info("=" * 50)
    log.info(f"📞 CALL STARTED — Session: {session_id}")
    log.info("=" * 50)

    try:
        async with openai_client.beta.realtime.connect(
            model="gpt-4o-realtime-preview"
        ) as openai_conn:

            # ── OpenAI Session Configure ──────────────────────
            await openai_conn.session.update(session={
                "modalities":   ["text", "audio"],
                "instructions": BASE_SYSTEM_PROMPT,
                "turn_detection": {
                    "type":                "server_vad",
                    "threshold":           0.75,
                    "prefix_padding_ms":   300,
                    "silence_duration_ms": 600
                },
                "voice":                     "shimmer",
                "input_audio_format":        "g711_ulaw",
                "output_audio_format":       "g711_ulaw",
                "input_audio_transcription": {"model": "whisper-1"},
                "temperature":               0.7,
                "max_response_output_tokens": 200,
                "tools":       TOOLS,
                "tool_choice": "auto",
            })

            log.info("✅ Priya AI ready!\n")

            # ── Twilio → OpenAI ───────────────────────────────
            async def caller_to_ai():
                nonlocal stream_sid, caller_phone, ws_connected
                async for raw in twilio_ws.iter_text():
                    msg = json.loads(raw)

                    if msg["event"] == "start":
                        stream_sid   = msg["start"]["streamSid"]
                        caller_phone = msg["start"].get("customParameters", {}).get("from", "")
                        log.info(f"📞 Stream: {stream_sid} | Caller: {caller_phone or 'Unknown'}")

                    elif msg["event"] == "media":
                        await openai_conn.input_audio_buffer.append(
                            audio=msg["media"]["payload"]
                        )

                    elif msg["event"] == "stop":
                        log.info("📞 Call ended by Twilio")
                        ws_connected = False
                        break

            # ── OpenAI → Twilio ───────────────────────────────
            async def ai_to_caller():
                tool_buffer = {}
                async for event in openai_conn:

                    if event.type == "response.audio.delta":
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event":     "media",
                                "streamSid": stream_sid,
                                "media":     {"payload": event.delta},
                            }))

                    elif event.type == "input_speech_started":
                        # Barge-in — caller interrupt kare toh AI band ho
                        if stream_sid and ws_connected:
                            await twilio_ws.send_text(json.dumps({
                                "event":     "clear",
                                "streamSid": stream_sid
                            }))
                            try:
                                await openai_conn.response.cancel()
                            except Exception:
                                pass

                    elif event.type == "conversation.item.input_audio_transcription.completed":
                        text = event.transcript
                        log.info(f"Caller: {text}")
                        transcript.append({"role": "caller", "text": text,
                                           "timestamp": datetime.now().isoformat()})

                    elif event.type == "response.audio_transcript.done":
                        text = event.transcript
                        log.info(f"Priya : {text}")
                        transcript.append({"role": "ai", "text": text,
                                           "timestamp": datetime.now().isoformat()})

                    elif event.type == "response.function_call_arguments.done":
                        tool_name = event.name
                        args      = json.loads(event.arguments)
                        tools_used.append(tool_name)
                        result = await execute_tool(tool_name, args, session_id, caller_phone or "")
                        log.info(f"[Tool Result] {str(result)[:100]}")
                        await openai_conn.conversation.item.create(item={
                            "type":    "function_call_output",
                            "call_id": event.call_id,
                            "output":  json.dumps(result)
                        })
                        await openai_conn.response.create()

                    elif event.type == "error":
                        log.error(f"OpenAI Error: {event.error}")

            # ── Dono tasks ek saath chalao ────────────────────
            tasks = [
                asyncio.create_task(caller_to_ai(), name="caller_to_ai"),
                asyncio.create_task(ai_to_caller(), name="ai_to_caller"),
            ]
            try:
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=1800)
            except asyncio.TimeoutError:
                log.warning("⏱ Call timeout (30 min)")
            finally:
                for t in tasks:
                    t.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)

    except WebSocketDisconnect:
        log.info("[Media Stream] Twilio disconnected")
    except Exception as e:
        log.error(f"[Media Stream] Error: {e}")
        traceback.print_exc()
    finally:
        # ── Call summary save karo ────────────────────────────
        os.makedirs("sessions", exist_ok=True)
        session_data = {
            "session_id":   session_id,
            "caller_phone": caller_phone or "Unknown",
            "call_end":     datetime.now().isoformat(),
            "transcript":   transcript,
            "tools_used":   tools_used,
        }
        with open(f"sessions/session_{session_id}.json", "w", encoding="utf-8") as f:
            json.dump(session_data, f, indent=2, ensure_ascii=False)

        log.info("─" * 50)
        log.info(f"  Caller  : {caller_phone}")
        log.info(f"  Turns   : {len([t for t in transcript if t['role'] == 'caller'])}")
        log.info(f"  Tools   : {tools_used}")
        log.info("─" * 50)


# ── Health Check ──────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "BluQQ API running", "version": "2.0.0"}


@app.get("/")
def root():
    return {"message": "Welcome to BluQQ API. Visit /docs"}


# ── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    try:
        init_rag()
        log.info("✅ RAG loaded")
    except Exception as e:
        log.warning(f"RAG init failed: {e}")