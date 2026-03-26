import os
import asyncio
import base64
import json
import logging
import logging.handlers
import time
from datetime import datetime
from enum import Enum
from dotenv import load_dotenv

import redis as redis_sync
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import Response
import uvicorn
from openai import AsyncOpenAI

from bluqq_rag        import init_rag, get_rag_context, get_rag_stats
from bluqq_calendar   import create_consultation_event, get_available_slots, get_calendar_stats, calendar_ok
from bluqq_transfer   import initiate_transfer, should_transfer, get_transfer_stats
from bluqq_transcript import save_all_formats, update_master_csv, get_transcript_stats
from bluqq_latency    import LatencyTracker as LatTracker, get_latency_analytics
from bluqq_analytics  import get_full_analytics, get_overview, get_daily_volume, get_top_tools
from bluqq_logger     import setup_logger, CallLogger, close_session_logger, get_log_stats
from bluqq_retry      import (
    ErrorTracker, safe_openai_update, safe_openai_send_audio,
    safe_twilio_send, safe_tool_execute,
    cb_openai, cb_redis, cb_twilio, cb_calendar
)

load_dotenv()

app    = FastAPI(
    title="BluQQ AI Phone Assistant",
    description="Priya — AI Voice Assistant with full REST API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
SERVER_URL = os.environ["SERVER_URL"]

log = setup_logger("bluqq")

# ─────────────────────────────────────────────────────────────────────────────
# ✅ NEW: Mount BluQQ REST API Router
# ─────────────────────────────────────────────────────────────────────────────
from bluqq_router import router as bluqq_router
app.include_router(bluqq_router, prefix="/bluqq", tags=["BluQQ API"])
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# AUDIO — g711_ulaw direct, NO conversion (Barts pattern)
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# CRM — In-memory cache
# ─────────────────────────────────────────────────────────────────────────────

CRM_FILE = "crm_contacts.json"

_crm_cache: dict = {}
_cache_dirty: bool = False
_crm_lock = asyncio.Lock()

def crm_load() -> dict:
    global _crm_cache
    if not _crm_cache and os.path.exists(CRM_FILE):
        with open(CRM_FILE, encoding="utf-8") as f:
            _crm_cache = json.load(f)
        log.info(f"[CRM] Loaded {len(_crm_cache)} contacts into memory cache")
    return _crm_cache

def crm_save(db: dict):
    global _crm_cache, _cache_dirty
    _crm_cache = db
    with open(CRM_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

async def crm_save_async(db: dict):
    global _crm_cache
    async with _crm_lock:
        _crm_cache = db
        with open(CRM_FILE, "w", encoding="utf-8") as f:
            json.dump(db, f, indent=2, ensure_ascii=False)

def crm_lookup(phone: str) -> dict | None:
    db         = crm_load()
    normalized = phone.replace(" ", "").replace("-", "")
    for key in [normalized, normalized.lstrip("+")]:
        if key in db:
            log.info(f"[CRM] Caller found: {db[key].get('name')} ({key})")
            return db[key]
    log.info(f"[CRM] New caller: {phone}")
    return None

async def crm_create_or_update(phone: str, data: dict) -> dict:
    db  = crm_load()
    key = phone.replace(" ", "").replace("-", "")
    if key in db:
        existing = db[key]
        existing.update({k: v for k, v in data.items() if v})
        existing["last_contact"] = datetime.now().isoformat()
        existing["total_calls"]  = existing.get("total_calls", 0) + 1
        db[key] = existing
        log.info(f"[CRM] Updated: {existing.get('name')} — calls: {existing['total_calls']}")
    else:
        db[key] = {
            "phone":         key,
            "name":          data.get("name", "Unknown"),
            "email":         data.get("email", ""),
            "interests":     data.get("interests", []),
            "notes":         data.get("notes", ""),
            "first_contact": datetime.now().isoformat(),
            "last_contact":  datetime.now().isoformat(),
            "total_calls":   1,
            "sessions":      []
        }
        log.info(f"[CRM] New contact: {db[key]['name']}")
    await crm_save_async(db)
    return db[key]

async def crm_add_session(phone: str, session_id: str, summary: str):
    db  = crm_load()
    key = phone.replace(" ", "").replace("-", "")
    if key not in db: return
    sessions = db[key].get("sessions", [])
    sessions.append({
        "session_id": session_id,
        "date":       datetime.now().strftime("%Y-%m-%d"),
        "summary":    summary
    })
    db[key]["sessions"] = sessions[-20:]
    await crm_save_async(db)

def crm_build_context(caller: dict) -> str:
    if not caller: return ""
    parts = ["\n\n--- CALLER CONTEXT ---"]
    parts.append(f"Name: {caller.get('name', 'Unknown')}")
    if caller.get("email"):
        parts.append(f"Email: {caller['email']}")
    if caller.get("interests"):
        parts.append(f"Previous interests: {', '.join(caller['interests'])}")
    if caller.get("total_calls", 0) > 1:
        parts.append(f"Returning caller — {caller['total_calls']} total calls")
        sessions = caller.get("sessions", [])
        if sessions:
            last = sessions[-1]
            parts.append(f"Last call ({last['date']}): {last['summary']}")
    if caller.get("notes"):
        parts.append(f"Notes: {caller['notes']}")
    parts.append("\nGreet caller by name. Reference previous interests naturally.")
    parts.append("--- END CONTEXT ---")
    return "\n".join(parts)

# ─────────────────────────────────────────────────────────────────────────────
# DURATION TRACKER
# ─────────────────────────────────────────────────────────────────────────────

class DurationTracker:
    def __init__(self):
        self.call_start_time       = time.time()
        self.call_end_time         = None
        self.listening_start       = None
        self.processing_start      = None
        self.speaking_start        = None
        self.total_listening_time  = 0.0
        self.total_processing_time = 0.0
        self.total_speaking_time   = 0.0
        self.latencies             = []
        self._speech_ended_at      = None

    def start_listening(self):
        self.listening_start  = time.time()
        self._speech_ended_at = None

    def stop_listening(self):
        if self.listening_start:
            self.total_listening_time += time.time() - self.listening_start
            self._speech_ended_at      = time.time()
            self.listening_start       = None

    def start_processing(self):
        self.processing_start = time.time()

    def stop_processing(self):
        if self.processing_start:
            self.total_processing_time += time.time() - self.processing_start
            self.processing_start       = None

    def start_speaking(self):
        self.speaking_start = time.time()
        if self._speech_ended_at:
            latency_ms = int((time.time() - self._speech_ended_at) * 1000)
            self.latencies.append(latency_ms)
            log.info(f"⚡ Response latency: {latency_ms}ms")

    def stop_speaking(self):
        if self.speaking_start:
            self.total_speaking_time += time.time() - self.speaking_start
            self.speaking_start       = None

    def end_call(self):
        self.call_end_time = time.time()
        self.stop_listening()
        self.stop_processing()
        self.stop_speaking()

    def total_duration(self) -> float:
        end = self.call_end_time or time.time()
        return round(end - self.call_start_time, 2)

    def avg_latency(self) -> int:
        return int(sum(self.latencies) / len(self.latencies)) if self.latencies else 0

    def _fmt(self, s: float) -> str:
        m = int(s // 60); sec = int(s % 60)
        return f"{m:02d}:{sec:02d}"

    def _pct(self, part: float, total: float) -> int:
        return int((part / total) * 100) if total else 0

    def summary(self) -> dict:
        total = self.total_duration()
        return {
            "total_duration_seconds":   total,
            "total_duration_formatted": self._fmt(total),
            "listening_seconds":        round(self.total_listening_time, 2),
            "processing_seconds":       round(self.total_processing_time, 2),
            "speaking_seconds":         round(self.total_speaking_time, 2),
            "idle_seconds":             round(max(0, total - self.total_listening_time
                                                         - self.total_processing_time
                                                         - self.total_speaking_time), 2),
            "latency_ms": {
                "avg": self.avg_latency(),
                "min": min(self.latencies) if self.latencies else 0,
                "max": max(self.latencies) if self.latencies else 0,
                "all": self.latencies
            }
        }

    def print_report(self):
        s     = self.summary()
        total = s["total_duration_seconds"]
        log.info("─" * 50)
        log.info("  DURATION REPORT")
        log.info("─" * 50)
        log.info(f"  Total call time   : {s['total_duration_formatted']}")
        log.info(f"  Caller speaking   : {s['listening_seconds']}s ({self._pct(s['listening_seconds'], total)}%)")
        log.info(f"  AI thinking       : {s['processing_seconds']}s ({self._pct(s['processing_seconds'], total)}%)")
        log.info(f"  AI speaking       : {s['speaking_seconds']}s ({self._pct(s['speaking_seconds'], total)}%)")
        if self.latencies:
            log.info("─" * 50)
            log.info(f"  Avg latency       : {s['latency_ms']['avg']}ms")
            log.info(f"  Fastest response  : {s['latency_ms']['min']}ms")
            log.info(f"  Slowest response  : {s['latency_ms']['max']}ms")
        log.info("─" * 50)

# ─────────────────────────────────────────────────────────────────────────────
# STATE MACHINE
# ─────────────────────────────────────────────────────────────────────────────

class CallState(Enum):
    IDLE       = "IDLE"
    LISTENING  = "LISTENING"
    PROCESSING = "PROCESSING"
    SPEAKING   = "SPEAKING"

class TurnManager:
    def __init__(self, session_id: str, dt: DurationTracker):
        self.state          = CallState.IDLE
        self.session_id     = session_id
        self.state_history  = []
        self.turn_count     = 0
        self.barge_in_count = 0
        self.dt             = dt

    def transition(self, new_state: CallState, reason: str = ""):
        old = self.state
        if old == CallState.LISTENING:    self.dt.stop_listening()
        elif old == CallState.PROCESSING: self.dt.stop_processing()
        elif old == CallState.SPEAKING:   self.dt.stop_speaking()
        if new_state == CallState.LISTENING:    self.dt.start_listening();  self.turn_count += 1
        elif new_state == CallState.PROCESSING: self.dt.start_processing()
        elif new_state == CallState.SPEAKING:   self.dt.start_speaking()
        self.state = new_state
        self.state_history.append({
            "from": old.value, "to": new_state.value,
            "reason": reason, "timestamp": datetime.now().isoformat()
        })
        icons = {
            CallState.IDLE:       "⏸",
            CallState.LISTENING:  "👂",
            CallState.PROCESSING: "🧠",
            CallState.SPEAKING:   "🔊"
        }
        log.info(f"[State] {old.value:10} → {new_state.value:10}  {icons.get(new_state, '')}  {reason}")

    def handle_barge_in(self) -> bool:
        if self.state == CallState.SPEAKING:
            self.barge_in_count += 1
            self.transition(CallState.LISTENING, f"barge-in #{self.barge_in_count}")
            return True
        elif self.state in (CallState.IDLE, CallState.PROCESSING):
            self.transition(CallState.LISTENING, "caller started speaking")
            return False
        return False

    def summary(self) -> dict:
        return {
            "total_turns":    self.turn_count,
            "barge_in_count": self.barge_in_count,
            "state_history":  self.state_history,
            "final_state":    self.state.value
        }

# ─────────────────────────────────────────────────────────────────────────────
# REDIS
# ─────────────────────────────────────────────────────────────────────────────

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
try:
    rdb = redis_sync.from_url(REDIS_URL, decode_responses=True)
    rdb.ping()
except Exception:
    rdb = None

def redis_ok() -> bool:
    try:
        if rdb: rdb.ping(); return True
    except Exception: pass
    return False

def session_key(sid):   return f"bluqq:session:{sid}"
def active_calls_key(): return "bluqq:active_calls"

def redis_start_call(sid, call_start):
    if not redis_ok(): return
    rdb.sadd(active_calls_key(), sid)
    rdb.setex(session_key(sid), 7200, json.dumps({
        "session_id": sid, "call_start": call_start,
        "status": "active", "transcript": []
    }))

def redis_update_transcript(sid, role, text):
    if not redis_ok(): return
    key = session_key(sid)
    raw = rdb.get(key)
    if not raw: return
    data = json.loads(raw)
    data["transcript"].append({
        "role": role, "text": text,
        "timestamp": datetime.now().isoformat()
    })
    rdb.setex(key, 7200, json.dumps(data, ensure_ascii=False))

def redis_save_session(session_data):
    if not redis_ok(): return
    try:
        rdb.setex(
            session_key(session_data["session_id"]),
            604800,
            json.dumps(session_data, ensure_ascii=False)
        )
        rdb.srem(active_calls_key(), session_data["session_id"])
    except Exception as e:
        log.warning(f"Redis save failed: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """You are Priya, a friendly assistant at BluQQ Technologies.

LANGUAGE RULE: ENGLISH ONLY. Never Hindi. Never any other language. Always English.

IDENTITY: You are Priya, a warm conversational assistant.
Speak naturally like a real person — friendly, casual, helpful.
If directly asked "are you an AI/bot?", say:
"I'm an AI assistant for BluQQ, but I'm here to help just like a human would! What can I do for you?"

SPEAKING STYLE:
- Warm, friendly, natural — like a real Indian girl on a phone call
- Use natural words: "Sure!", "Absolutely!", "Great question!"
- ALWAYS complete your sentence fully before stopping
- Maximum 2 complete sentences per response
- Always end with a short question

IMPORTANT: Never stop mid-sentence. Always finish what you are saying completely.

GREETING: "Hi, this is Priya from BluQQ! How can I help you today?"

SERVICES: Trading bots, dashboards, AI tools, data pipelines, web scraping, real estate tech.
PRICING: Trading bots $500-5000, Dashboards $800-3000, AI tools $1500-6000. Free consultation always.

OUT OF SCOPE: "That's outside my area! Can I help with our tech services?"

GOODBYE HANDLING: If caller says "bye", "goodbye", "thank you bye", "have a good one", "see you",
"good day" — respond with ONLY a warm goodbye like:
"Thank you for calling BluQQ! Have a great day!" and STOP. Do not continue the conversation.
Do NOT ask more questions after a goodbye. The call is ending.
"""

# ─────────────────────────────────────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function", "name": "search_knowledge_base",
        "description": "Search BluQQ knowledge base for accurate answers about services, pricing, FAQs, refund policy, timelines.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Question to search for"}},
            "required": ["query"]
        }
    },
    {
        "type": "function", "name": "submit_lead",
        "description": "Save caller contact details to BluQQ sales team.",
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
        "type": "function", "name": "get_pricing",
        "description": "Get pricing for BluQQ services.",
        "parameters": {
            "type": "object",
            "properties": {"service_name": {"type": "string"}},
            "required": ["service_name"]
        }
    },
    {
        "type": "function", "name": "get_service_info",
        "description": "Get detailed info about a BluQQ service.",
        "parameters": {
            "type": "object",
            "properties": {"service_name": {"type": "string"}},
            "required": ["service_name"]
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
        "type": "function", "name": "transfer_to_human",
        "description": "Transfer caller to live agent when they ask for human or are frustrated.",
        "parameters": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"]
        }
    },
    {
        "type": "function", "name": "search_available_slots",
        "description": "Get available consultation time slots from calendar.",
        "parameters": {
            "type": "object",
            "properties": {"days_ahead": {"type": "integer"}}
        }
    },
    {
        "type": "function", "name": "update_crm",
        "description": "Update caller record when you learn name, email, or interests.",
        "parameters": {
            "type": "object",
            "properties": {
                "name":      {"type": "string"},
                "email":     {"type": "string"},
                "interests": {"type": "array", "items": {"type": "string"}},
                "notes":     {"type": "string"}
            }
        }
    },
    {
        "type": "function", "name": "lookup_caller",
        "description": "Look up caller info from CRM by phone number.",
        "parameters": {
            "type": "object",
            "properties": {"phone": {"type": "string"}},
            "required": ["phone"]
        }
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# TOOL EXECUTION
# ─────────────────────────────────────────────────────────────────────────────

async def execute_tool(tool_name: str, args: dict,
                       session_id: str, caller_phone: str) -> dict:
    log.info(f"[Tool] {tool_name}({str(args)[:80]})")

    if tool_name == "search_knowledge_base":
        query   = args.get("query", "")
        context = get_rag_context(query, top_k=2)
        if context: return {"status": "found", "context": context}
        return {"status": "not_found", "message": "No info found. Contact info@bluqq.com"}

    elif tool_name == "submit_lead":
        lead = {
            "timestamp":        datetime.now().isoformat(), "session_id": session_id,
            "name":             args.get("name", "Unknown"), "email": args.get("email", ""),
            "phone":            caller_phone or args.get("phone", ""),
            "service_interest": args.get("service_interest", "General"),
            "source":           "Phone Call — BluQQ AI"
        }
        os.makedirs("leads", exist_ok=True)
        fname = f"leads/lead_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(fname, "w") as f: json.dump(lead, f, indent=2)
        if redis_ok():
            rdb.lpush("bluqq:leads", json.dumps(lead))
            rdb.expire("bluqq:leads", 2592000)
        if caller_phone:
            await crm_create_or_update(caller_phone, {
                "name": args.get("name"), "email": args.get("email"),
                "interests": [args.get("service_interest", "")]
            })
        return {"status": "success", "message": f"Got it! We'll contact {args.get('name')} within 24 hours."}

    elif tool_name == "get_pricing":
        query   = f"pricing cost for {args.get('service_name', '')}"
        context = get_rag_context(query, top_k=2)
        if context: return {"status": "success", "pricing": context}
        service = args.get("service_name", "").lower()
        db = {
            "trading tools": "Trading tools start from $500 to $5000.",
            "dashboard":     "Dashboards are priced from $800 to $3000.",
            "data pipeline": "Pipelines start from $1000 to $5000 plus.",
            "web scraping":  "Scraping engines from $300 to $2000.",
            "ai automation": "AI automation from $1500 based on complexity.",
            "real estate":   "Real estate platforms from $2000 to $8000.",
            "general":       "Projects start from $300 to $10000. Free consultation included."
        }
        matched = db["general"]
        for k in db:
            if k in service or service in k: matched = db[k]; break
        return {"status": "success", "pricing": matched}

    elif tool_name == "get_service_info":
        query   = f"BluQQ {args.get('service_name', '')} service"
        context = get_rag_context(query, top_k=2)
        if context: return {"status": "success", "info": context}
        service = args.get("service_name", "").lower()
        db = {
            "trading":     "Custom Python trading tools, backtesting, live bots for Zerodha and Binance.",
            "dashboard":   "Real-time dashboards using FastAPI, WebSockets, React, Plotly.",
            "pipeline":    "High-throughput data pipelines from NSE, BSE, crypto exchanges.",
            "real estate": "AI-powered platforms with automated valuation and property search.",
            "ai":          "Intelligent agents automating workflows, reducing manual work 80 percent.",
            "scraping":    "Financial scrapers using Scrapy, Selenium, Playwright.",
        }
        matched = "BluQQ specializes in AI, financial technology, and real estate technology."
        for k in db:
            if k in service or service in k: matched = db[k]; break
        return {"status": "success", "info": matched}

    elif tool_name == "book_consultation":
        result = create_consultation_event(
            name=args.get("name", "Unknown"), email=args.get("email", ""),
            phone=caller_phone or "", topic=args.get("topic", "General consultation"),
            preferred_time=args.get("preferred_time", "tomorrow 11am"), duration_mins=30
        )
        if redis_ok():
            rdb.lpush("bluqq:bookings", json.dumps({
                "timestamp": datetime.now().isoformat(), "session_id": session_id,
                "name": args.get("name"), "phone": caller_phone,
                "topic": args.get("topic"), "start_time": result.get("start_time")
            }))
            rdb.expire("bluqq:bookings", 2592000)
        return result

    elif tool_name == "search_available_slots":
        slots = get_available_slots(args.get("days_ahead", 7))
        if slots:
            return {"status": "success", "slots": slots,
                    "message": f"Available: {', '.join(slots[:3])}. Which works for you?"}
        return {"status": "success", "message": "Email info@bluqq.com to schedule."}

    elif tool_name == "update_crm":
        if not caller_phone: return {"status": "error", "message": "No phone available"}
        record = await crm_create_or_update(caller_phone, {
            "name": args.get("name", ""), "email": args.get("email", ""),
            "interests": args.get("interests", []), "notes": args.get("notes", "")
        })
        return {"status": "success", "message": f"Updated {record.get('name')}"}

    elif tool_name == "lookup_caller":
        phone  = args.get("phone", caller_phone)
        record = crm_lookup(phone)
        if record:
            return {"status": "found", "name": record.get("name"),
                    "email": record.get("email"), "interests": record.get("interests", []),
                    "total_calls": record.get("total_calls", 1)}
        return {"status": "not_found", "message": "No record found"}

    elif tool_name == "transfer_to_human":
        result = await initiate_transfer(
            call_sid=session_id, session_id=session_id,
            caller_phone=caller_phone or "", reason=args.get("reason", ""),
            transcript=[]
        )
        return result

    return {"status": "error", "message": "Unknown tool"}

# ─────────────────────────────────────────────────────────────────────────────
# TWILIO ROUTES (keep at root — Twilio needs these exact paths)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/incoming-call")
async def incoming_call(request: Request):
    host = SERVER_URL.replace("https://", "")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://{host}/media-stream" />
  </Connect>
</Response>"""
    return Response(content=twiml, media_type="text/xml")

@app.websocket("/media-stream")
async def media_stream(twilio_ws: WebSocket):
    await twilio_ws.accept()

    session_id         = datetime.now().strftime("%Y%m%d_%H%M%S")
    call_start         = datetime.now().isoformat()
    transcript         = []
    tools_used         = []
    stream_sid         = None
    caller_phone       = None
    caller_data        = None
    transfer_initiated = False
    ws_connected       = True
    error_tracker      = ErrorTracker(session_id)
    call_log           = CallLogger(session_id)
    lat                = LatTracker(session_id)
    dt                 = DurationTracker()
    tm                 = TurnManager(session_id, dt)

    log.info("=" * 55)
    log.info(f"📞 CALL STARTED — Session: {session_id}")
    log.info(f"   Redis : {'✅ Connected' if redis_ok() else '❌ File fallback'}")
    log.info(f"   RAG   : {get_rag_stats()['total_chunks']} chunks loaded")
    log.info("=" * 55)

    call_log.call_started(caller_phone="", redis=redis_ok(),
                          rag_chunks=get_rag_stats()["total_chunks"])

    if redis_ok(): redis_start_call(session_id, call_start)

    async with client.beta.realtime.connect(
        model="gpt-4o-realtime-preview"
    ) as openai_conn:

        session_cfg = {
            "modalities":   ["text", "audio"],
            "instructions": BASE_SYSTEM_PROMPT,
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
            "tools":                      TOOLS,
            "tool_choice":                "auto",
        }
        ok = await safe_openai_update(openai_conn, session_cfg, error_tracker)
        if not ok:
            log.error("Failed to configure OpenAI session")
            return

        log.info("✅ AI ready! Audio: g711_ulaw (crystal clear)\n")

        async def caller_to_ai():
            nonlocal stream_sid, caller_phone, caller_data

            async for raw_msg in twilio_ws.iter_text():
                msg = json.loads(raw_msg)

                if msg["event"] == "start":
                    stream_sid    = msg["start"]["streamSid"]
                    custom_params = msg["start"].get("customParameters", {})
                    caller_phone  = custom_params.get("from", "")
                    if not caller_phone:
                        caller_phone = msg["start"].get("from", "")

                    log.info(f"Stream ID    : {stream_sid}")
                    log.info(f"Caller phone : {caller_phone or 'Unknown'}")

                    if caller_phone:
                        caller_data = crm_lookup(caller_phone)
                        if caller_data:
                            call_log.crm_lookup(caller_phone, found=True,
                                                name=caller_data.get("name",""))
                            crm_context    = crm_build_context(caller_data)
                            updated_prompt = BASE_SYSTEM_PROMPT + crm_context
                            await safe_openai_update(openai_conn,
                                {"instructions": updated_prompt}, error_tracker)
                            log.info(f"[CRM] Context injected: {caller_data.get('name')}")
                        else:
                            call_log.crm_lookup(caller_phone, found=False)
                            caller_data = await crm_create_or_update(caller_phone,
                                {"name": "Unknown", "interests": []})

                elif msg["event"] == "media":
                    if tm.state != CallState.SPEAKING:
                        try:
                            await openai_conn.input_audio_buffer.append(
                                audio=msg["media"]["payload"]
                            )
                        except Exception as e:
                            log.warning(f"[Audio] Buffer append failed: {e}")

                elif msg["event"] == "stop":
                    log.info("📞 Call end")
                    ws_connected = False
                    break

        async def ai_to_caller():
            nonlocal transfer_initiated
            tool_call_buffer = {}

            async for event in openai_conn:

                if event.type == "input_speech_started":
                    was_speaking = (tm.state == CallState.SPEAKING)
                    if was_speaking:
                        tm.barge_in_count += 1
                        tm.transition(CallState.LISTENING, f"barge-in #{tm.barge_in_count}")
                        lat.turn_start(tm.turn_count)
                        if stream_sid and ws_connected:
                            await safe_twilio_send(twilio_ws, json.dumps({
                                "event": "clear", "streamSid": stream_sid
                            }), error_tracker)
                            try:
                                await openai_conn.response.cancel()
                                log.info(f"🛑 Barge-in #{tm.barge_in_count} — OpenAI cancelled")
                            except Exception as e:
                                log.warning(f"[Barge-in] Cancel failed: {e}")
                            call_log.barge_in(tm.barge_in_count)
                    elif tm.state != CallState.LISTENING:
                        tm.transition(CallState.LISTENING, "caller started speaking")
                        lat.turn_start(tm.turn_count)

                elif event.type == "input_speech_stopped":
                    lat.speech_ended(tm.turn_count)
                    if tm.state == CallState.LISTENING:
                        tm.transition(CallState.PROCESSING, "caller stopped speaking")

                elif event.type == "conversation.item.input_audio_transcription.delta":
                    print(f"\rCaller: {event.delta}...", end="", flush=True)

                elif event.type == "conversation.item.input_audio_transcription.completed":
                    text       = event.transcript
                    confidence = getattr(event, "confidence", 1.0)

                    if confidence < 0.6:
                        log.warning(f"⚠ Low confidence ({confidence:.2f}): '{text}' — asking to repeat")
                        await openai_conn.conversation.item.create(item={
                            "type":    "message",
                            "role":    "user",
                            "content": [{"type": "input_text",
                                         "text": "[unclear audio — ask caller to repeat politely]"}]
                        })
                        await openai_conn.response.create()
                        continue

                    print(f"\rCaller: {text}          ")
                    log.info(f"Caller said: {text}")
                    transcript.append({"role": "caller", "text": text,
                                       "timestamp": datetime.now().isoformat()})
                    redis_update_transcript(session_id, "caller", text)
                    lat.transcript_ready(tm.turn_count, text)

                    if not transfer_initiated and should_transfer(text):
                        transfer_initiated = True
                        log.info("[Transfer] Auto-trigger")
                        result = await initiate_transfer(
                            call_sid=session_id, session_id=session_id,
                            caller_phone=caller_phone or "",
                            reason="Caller requested human agent",
                            transcript=transcript, stream_sid=stream_sid
                        )
                        transcript.append({"role": "system",
                                           "text": f"[Transfer: {result.get('status')}]",
                                           "timestamp": datetime.now().isoformat()})

                elif event.type == "response.audio.delta":
                    if tm.state != CallState.SPEAKING:
                        lat.llm_first_token(tm.turn_count)
                        lat.tts_first_audio(tm.turn_count)
                        tm.transition(CallState.SPEAKING, "AI response started")
                    if tm.state == CallState.SPEAKING and stream_sid and ws_connected:
                        payload = event.delta
                        await safe_twilio_send(twilio_ws, json.dumps({
                            "event":     "media",
                            "streamSid": stream_sid,
                            "media":     {"payload": payload},
                        }), error_tracker)

                elif event.type == "response.audio_transcript.delta":
                    print(f"\rAI    : {event.delta}...", end="", flush=True)

                elif event.type == "response.audio_transcript.done":
                    text = event.transcript
                    print(f"\rAI    : {text}          \n")
                    log.info(f"AI said: {text}")
                    transcript.append({"role": "ai", "text": text,
                                       "timestamp": datetime.now().isoformat()})
                    redis_update_transcript(session_id, "ai", text)
                    lat.turn_end(tm.turn_count)
                    tm.transition(CallState.IDLE, "AI response complete")

                    if not transfer_initiated and should_transfer(text):
                        transfer_initiated = True
                        log.info("[Transfer] AI triggered transfer")

                elif event.type == "response.done":
                    if tm.state == CallState.SPEAKING:
                        tm.transition(CallState.IDLE, "response.done")

                elif event.type == "response.function_call_arguments.delta":
                    call_id = event.call_id
                    if call_id not in tool_call_buffer:
                        tool_call_buffer[call_id] = {"name": "", "args": ""}
                    if hasattr(event, "name") and event.name:
                        tool_call_buffer[call_id]["name"] = event.name
                    tool_call_buffer[call_id]["args"] += event.delta

                elif event.type == "response.function_call_arguments.done":
                    call_id   = event.call_id
                    tool_name = event.name
                    args      = json.loads(event.arguments)
                    tm.transition(CallState.PROCESSING, f"tool: {tool_name}")
                    tools_used.append({"tool": tool_name, "args": args,
                                       "timestamp": datetime.now().isoformat()})
                    call_log.tool_called(tool_name, args)
                    result = await safe_tool_execute(
                        execute_tool, tool_name, args, session_id, caller_phone or "",
                        tracker=error_tracker
                    )
                    call_log.tool_result(tool_name, result.get("status", "unknown"))
                    log.info(f"[Tool Result] {str(result)[:100]}")
                    transcript.append({"role": "system",
                                       "text": f"[Tool: {tool_name} → {result}]",
                                       "timestamp": datetime.now().isoformat()})
                    await openai_conn.conversation.item.create(item={
                        "type": "function_call_output", "call_id": call_id,
                        "output": json.dumps(result)
                    })
                    await openai_conn.response.create()
                    tool_call_buffer.pop(call_id, None)

                elif event.type == "error":
                    log.error(f"API Error: {event.error}")
                    if tm.state == CallState.SPEAKING:
                        tm.transition(CallState.IDLE, "error")

        tasks = [
            asyncio.create_task(caller_to_ai(), name="caller_to_ai"),
            asyncio.create_task(ai_to_caller(), name="ai_to_caller"),
        ]
        try:
            await asyncio.wait_for(asyncio.gather(*tasks), timeout=1800)
        except asyncio.TimeoutError:
            log.warning(f"⏱ Call timeout (30min): {session_id}")
            for t in tasks: t.cancel()
        finally:
            for t in tasks: t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

            dt.end_call()
            lat.call_ended()
            duration_summary = dt.summary()

            ai_turns     = [t["text"] for t in transcript if t["role"] == "ai"]
            call_summary = ai_turns[-1][:100] if ai_turns else "General inquiry"
            if caller_phone: await crm_add_session(caller_phone, session_id, call_summary)

            err_summary  = error_tracker.summary()
            session_data = {
                "session_id":    session_id,
                "call_start":    call_start,
                "call_end":      datetime.now().isoformat(),
                "caller_phone":  caller_phone or "Unknown",
                "caller_name":   (caller_data or {}).get("name", "Unknown"),
                "duration":      duration_summary,
                "total_turns":   tm.turn_count,
                "tools_used":    tools_used,
                "transcript":    transcript,
                "turn_manager":  tm.summary(),
                "errors":        err_summary,
                "latency":       lat.summary(),
                "status":        "completed"
            }

            os.makedirs("sessions", exist_ok=True)
            with open(f"sessions/session_{session_id}.json", "w", encoding="utf-8") as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)

            transcript_files = save_all_formats(session_id, session_data)
            update_master_csv(session_data)
            log.info(f"[Transcript] TXT: {transcript_files['txt']}")

            redis_save_session(session_data)

            lat_report = lat.save_report()
            lat.print_report()

            call_log.call_ended(
                duration=duration_summary.get("total_duration_formatted", "00:00"),
                turns=tm.turn_count, errors=error_tracker.error_count
            )
            call_log.save_event_log()
            call_log.print_summary()
            close_session_logger(session_id)

            log.info("\n")
            dt.print_report()
            log.info("─" * 55)
            log.info("  CALL SUMMARY")
            log.info("─" * 55)
            log.info(f"  Caller     : {session_data['caller_name']} ({caller_phone})")
            log.info(f"  Duration   : {duration_summary['total_duration_formatted']}")
            log.info(f"  Turns      : {tm.turn_count}")
            log.info(f"  Barge-ins  : {tm.barge_in_count}")
            log.info(f"  Tools used : {len(tools_used)}")
            log.info(f"  Avg latency: {duration_summary['latency_ms']['avg']}ms")
            log.info(f"  Errors     : {error_tracker.error_count}")
            log.info("─" * 55)
            for turn in transcript:
                if turn["role"] == "system": continue
                role = "Caller" if turn["role"] == "caller" else "AI    "
                ts   = turn["timestamp"][11:19]
                log.info(f"  [{ts}] {role}: {turn['text']}")
            log.info("=" * 55 + "\n")

# ─────────────────────────────────────────────────────────────────────────────
# LEGACY ROUTES (kept for backward compatibility)
# These are now also available under /bluqq/... with better features
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/sessions", tags=["Legacy"])
async def get_sessions():
    sessions = []
    if os.path.exists("sessions"):
        for fname in sorted(os.listdir("sessions")):
            if fname.endswith(".json"):
                with open(f"sessions/{fname}", encoding="utf-8") as f:
                    s = json.load(f)
                d  = s.get("duration", {}); tm2 = s.get("turn_manager", {})
                sessions.append({
                    "session_id":   s.get("session_id"),
                    "caller_name":  s.get("caller_name", "Unknown"),
                    "caller_phone": s.get("caller_phone", "Unknown"),
                    "date":         s.get("call_start", "")[:10],
                    "time":         s.get("call_start", "")[11:19],
                    "duration":     d.get("total_duration_formatted", "00:00"),
                    "turns":        tm2.get("total_turns", 0),
                    "barge_ins":    tm2.get("barge_in_count", 0),
                    "avg_latency":  f"{d.get('latency_ms', {}).get('avg', 0)}ms",
                    "tools_used":   [t["tool"] for t in s.get("tools_used", [])],
                })
    return {"total": len(sessions), "sessions": sessions}

@app.get("/crm", tags=["Legacy"])
async def get_crm():
    db = crm_load()
    return {"total_contacts": len(db), "contacts": list(db.values())}

@app.get("/crm/{phone}", tags=["Legacy"])
async def get_crm_contact(phone: str):
    record = crm_lookup(phone)
    return record if record else {"error": "Not found"}

@app.post("/crm", tags=["Legacy"])
async def add_crm_contact(data: dict):
    phone = data.get("phone")
    if not phone: return {"error": "Phone required"}
    return {"status": "success", "contact": await crm_create_or_update(phone, data)}

@app.get("/rag/search", tags=["Legacy"])
async def rag_search(q: str):
    from bluqq_rag import rag
    return {"query": q, "results": rag.search(q, top_k=3)}

@app.get("/rag/stats", tags=["Legacy"])
async def rag_stats():
    return get_rag_stats()

@app.get("/latency", tags=["Legacy"])
async def latency_analytics():
    return get_latency_analytics()

@app.get("/latency/{session_id}", tags=["Legacy"])
async def session_latency(session_id: str):
    fname = f"logs/latency/{session_id}_latency.json"
    if not os.path.exists(fname): return {"error": "Not found"}
    with open(fname, encoding="utf-8") as f: return json.load(f)

@app.get("/transcripts", tags=["Legacy"])
async def list_transcripts():
    stats = get_transcript_stats(); files = []
    if os.path.exists("transcripts"):
        for fname in sorted(os.listdir("transcripts")):
            if fname.endswith(".json") and "summary" not in fname:
                sid = fname.replace(".json", "")
                files.append({"session_id": sid,
                              "json": f"transcripts/{sid}.json",
                              "txt":  f"transcripts/{sid}.txt",
                              "csv":  f"transcripts/{sid}.csv"})
    return {"stats": stats, "files": files}

@app.get("/transcripts/{session_id}/txt", tags=["Legacy"])
async def get_transcript_txt(session_id: str):
    from fastapi.responses import PlainTextResponse
    fname = f"transcripts/{session_id}.txt"
    if not os.path.exists(fname): return PlainTextResponse("Not found", status_code=404)
    with open(fname, encoding="utf-8") as f: return PlainTextResponse(f.read())

@app.get("/transcripts/{session_id}/json", tags=["Legacy"])
async def get_transcript_json(session_id: str):
    fname = f"transcripts/{session_id}.json"
    if not os.path.exists(fname): return {"error": "Not found"}
    with open(fname, encoding="utf-8") as f: return json.load(f)

@app.get("/transfers", tags=["Legacy"])
async def get_transfers():
    transfers = []
    if os.path.exists("transfers"):
        for fname in sorted(os.listdir("transfers")):
            if fname.endswith(".json"):
                with open(f"transfers/{fname}", encoding="utf-8") as f:
                    transfers.append(json.load(f))
    return {"total": len(transfers), "transfers": transfers}

@app.get("/analytics", tags=["Legacy"])
async def analytics():
    return get_full_analytics()

@app.get("/analytics/overview", tags=["Legacy"])
async def analytics_overview():
    return get_overview()

@app.get("/analytics/volume", tags=["Legacy"])
async def analytics_volume(days: int = 7):
    return {"days": days, "data": get_daily_volume(days)}

@app.get("/analytics/tools", tags=["Legacy"])
async def analytics_tools():
    return {"tools": get_top_tools()}

@app.get("/recording/{session_id}", tags=["Legacy"])
async def get_recording(session_id: str):
    result = {}
    for folder in ["transcripts", "sessions"]:
        fname = f"{folder}/{session_id}.json"
        if os.path.exists(fname):
            with open(fname, encoding="utf-8") as f: result["session"] = json.load(f); break
    for path, key in [(f"transcripts/{session_id}.txt", "transcript_txt"),
                      (f"logs/latency/{session_id}_latency.json", "latency"),
                      (f"logs/sessions/{session_id}_events.json", "events")]:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                result[key] = f.read() if path.endswith(".txt") else json.load(f)
    return result if result else {"error": f"No recording for session: {session_id}"}

@app.get("/dashboard", tags=["Legacy"])
async def dashboard():
    from fastapi.responses import FileResponse
    if os.path.exists("dashboard.html"):
        return FileResponse("dashboard.html", media_type="text/html")
    return {"error": "dashboard.html not found"}

@app.get("/health", tags=["Legacy"])
async def health():
    cal = get_calendar_stats()
    return {
        "status":       "ok",
        "service":      "BluQQ AI Phone Assistant",
        "voice":        "shimmer",
        "audio_format": "g711_ulaw (crystal clear)",
        "redis":        "connected" if redis_ok() else "not connected",
        "crm_contacts": len(crm_load()),
        "rag_chunks":   get_rag_stats()["total_chunks"],
        "rag_files":    get_rag_stats()["files"],
        "calendar":     "connected" if cal["connected"] else "not connected",
        "transfer":     get_transfer_stats(),
        "transcripts":  get_transcript_stats(),
        "log_stats":    get_log_stats(),
    }

# ─────────────────────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_rag()
    redis_status = "✅ Connected"  if redis_ok()    else "❌ File fallback"
    cal_status   = "✅ Connected"  if calendar_ok() else "⚠ File fallback"
    ts           = get_transfer_stats()
    agent_status = "✅ Configured" if ts["agent_configured"] else "⚠ Add AGENT_PHONE_NUMBER"
    log.info("─" * 55)
    log.info("  BluQQ AI Phone Server v2.0")
    log.info("─" * 55)
    log.info(f"  Redis     : {redis_status}")
    log.info(f"  CRM       : {len(crm_load())} contacts")
    log.info(f"  RAG       : {get_rag_stats()['total_chunks']} chunks from {len(get_rag_stats()['files'])} files")
    log.info(f"  Calendar  : {cal_status}")
    log.info(f"  Transfer  : {agent_status}")
    log.info(f"  Voice     : shimmer | Audio: g711_ulaw (crystal clear)")
    log.info(f"  Logs      : logs/bluqq_calls.log")
    log.info("─" * 55)
    log.info(f"  📡 REST API : http://localhost:3000/bluqq/")
    log.info(f"  📚 Swagger  : http://localhost:3000/docs")
    log.info(f"  📞 Twilio   : http://localhost:3000/incoming-call")
    log.info("─" * 55)
    uvicorn.run(app, host="0.0.0.0", port=3000)