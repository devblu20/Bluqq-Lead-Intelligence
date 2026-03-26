"""
bluqq_router.py  →  backend/src/ai/bluqq_router.py
───────────────────────────────────────────────────
BluQQ Voice Agent ka complete REST API router.
main.py mein sirf 2 lines se mount hota hai:

    from src.ai.bluqq_router import router as voice_router
    app.include_router(voice_router, prefix="/api/voice", tags=["Voice Agent"])
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Path as FPath
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

# ── BluQQ Voice Agent modules (backend/src/ai/ mein hain) ─────
try:
    from src.ai.bluqq_rag        import get_rag_context, get_rag_stats
    from src.services.bluqq_calendar   import create_consultation_event, get_available_slots, get_calendar_stats, calendar_ok
    from src.services.bluqq_transfer   import initiate_transfer, get_transfer_stats
    from src.utils.bluqq_transcript import get_transcript_stats
    from src.utils.bluqq_latency    import get_latency_analytics
    from src.services.bluqq_analytics  import get_full_analytics, get_overview, get_daily_volume, get_top_tools
    from src.utils.bluqq_logger     import get_log_stats
    _MODULES_AVAILABLE = True
except ImportError:
    _MODULES_AVAILABLE = False

# ── Redis ─────────────────────────────────────────────────────
try:
    import redis as redis_sync
    _REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
    _rdb = redis_sync.from_url(_REDIS_URL, decode_responses=True)
    _rdb.ping()
except Exception:
    _rdb = None


def _redis_ok() -> bool:
    try:
        if _rdb:
            _rdb.ping()
            return True
    except Exception:
        pass
    return False


# ── File paths (backend/ ke relative) ────────────────────────
BASE_DIR        = Path(__file__).resolve().parents[2]  # backend/
SESSIONS_DIR    = BASE_DIR / "sessions"
LEADS_DIR       = BASE_DIR / "leads"
TRANSCRIPTS_DIR = BASE_DIR / "transcripts"
CRM_FILE        = BASE_DIR / "crm_contacts.json"
LOGS_DIR        = BASE_DIR / "logs"


def _read_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _crm_load() -> dict:
    if CRM_FILE.exists():
        return _read_json(CRM_FILE)
    return {}


def _crm_save(db: dict):
    _write_json(CRM_FILE, db)


def _normalize_phone(phone: str) -> str:
    return phone.replace(" ", "").replace("-", "")


def _crm_lookup(phone: str) -> dict | None:
    db  = _crm_load()
    key = _normalize_phone(phone)
    return db.get(key) or db.get(key.lstrip("+"))


def _session_files() -> list[Path]:
    if not SESSIONS_DIR.exists():
        return []
    return sorted(SESSIONS_DIR.glob("*.json"))


# ── Pydantic Models ───────────────────────────────────────────

class CRMContactCreate(BaseModel):
    phone:     str       = Field(...,  examples=["+911234567890"])
    name:      str       = Field("Unknown", examples=["Rahul Sharma"])
    email:     str       = Field("",   examples=["rahul@example.com"])
    interests: list[str] = Field(default_factory=list, examples=[["trading bots"]])
    notes:     str       = Field("",   examples=["Interested in algo trading"])


class CRMContactUpdate(BaseModel):
    name:      str | None       = Field(None, examples=["Rahul Sharma"])
    email:     str | None       = Field(None, examples=["rahul@example.com"])
    interests: list[str] | None = Field(None, examples=[["AI automation"]])
    notes:     str | None       = Field(None, examples=["Follow up next week"])


class BookConsultationRequest(BaseModel):
    name:           str = Field(..., examples=["Rahul Sharma"])
    email:          str = Field("",  examples=["rahul@example.com"])
    phone:          str = Field("",  examples=["+911234567890"])
    topic:          str = Field(..., examples=["Trading bot inquiry"])
    preferred_time: str = Field(..., examples=["tomorrow 3pm"])


class TransferRequest(BaseModel):
    session_id:   str = Field(..., examples=["20240101_120000"])
    caller_phone: str = Field("",  examples=["+911234567890"])
    reason:       str = Field("Caller requested human agent")


class RAGSearchRequest(BaseModel):
    query: str = Field(..., examples=["What is the pricing for trading bots?"])
    top_k: int = Field(3, ge=1, le=10)


# ── Router ────────────────────────────────────────────────────

router = APIRouter()


# ════════════════════════════════════════════════════════════════
# HEALTH
# ════════════════════════════════════════════════════════════════

@router.get("/health", summary="Voice agent health check")
async def health() -> dict:
    """Saare BluQQ voice agent subsystems ka live status."""
    base: dict[str, Any] = {
        "status":       "ok",
        "service":      "BluQQ AI Voice Agent",
        "timestamp":    datetime.now().isoformat(),
        "redis":        "connected" if _redis_ok() else "not connected",
        "crm_contacts": len(_crm_load()),
    }
    if _MODULES_AVAILABLE:
        cal = get_calendar_stats()
        base.update({
            "rag_chunks":  get_rag_stats()["total_chunks"],
            "rag_files":   get_rag_stats()["files"],
            "calendar":    "connected" if cal["connected"] else "not connected",
            "transfer":    get_transfer_stats(),
            "transcripts": get_transcript_stats(),
            "log_stats":   get_log_stats(),
        })
    return base


# ════════════════════════════════════════════════════════════════
# CALLS
# ════════════════════════════════════════════════════════════════

@router.get("/calls", summary="List all call sessions")
async def list_calls(
    page:  int = Query(1,   ge=1,        description="Page number"),
    limit: int = Query(20,  ge=1, le=100, description="Results per page"),
    phone: str = Query("",               description="Filter by caller phone"),
) -> dict:
    files    = list(reversed(_session_files()))
    sessions = []

    for f in files:
        try:
            s  = _read_json(f)
            cp = s.get("caller_phone", "")
            if phone and _normalize_phone(phone) not in _normalize_phone(cp):
                continue
            d   = s.get("duration",     {})
            tm  = s.get("turn_manager", {})
            sessions.append({
                "session_id":   s.get("session_id"),
                "caller_name":  s.get("caller_name",  "Unknown"),
                "caller_phone": cp,
                "date":         s.get("call_start",   "")[:10],
                "time":         s.get("call_start",   "")[11:19],
                "call_start":   s.get("call_start"),
                "call_end":     s.get("call_end"),
                "duration":     d.get("total_duration_formatted", "00:00"),
                "duration_sec": d.get("total_duration_seconds",   0),
                "turns":        tm.get("total_turns",    0),
                "barge_ins":    tm.get("barge_in_count", 0),
                "avg_latency":  f"{d.get('latency_ms', {}).get('avg', 0)}ms",
                "tools_used":   [t["tool"] for t in s.get("tools_used", [])],
                "status":       s.get("status", "completed"),
            })
        except Exception:
            continue

    total = len(sessions)
    start = (page - 1) * limit
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "sessions": sessions[start: start + limit]
    }


@router.get("/calls/{session_id}", summary="Single call detail")
async def get_call(session_id: str = FPath(...)) -> dict:
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Session nahi mila: {session_id}")
    return _read_json(path)


# ════════════════════════════════════════════════════════════════
# TRANSCRIPTS
# ════════════════════════════════════════════════════════════════

@router.get("/transcripts", summary="List all transcripts")
async def list_transcripts() -> dict:
    stats = get_transcript_stats() if _MODULES_AVAILABLE else {}
    files = []
    if TRANSCRIPTS_DIR.exists():
        for f in sorted(TRANSCRIPTS_DIR.glob("*.json")):
            if "summary" not in f.name:
                sid = f.stem
                files.append({
                    "session_id": sid,
                    "json": str(TRANSCRIPTS_DIR / f"{sid}.json"),
                    "txt":  str(TRANSCRIPTS_DIR / f"{sid}.txt"),
                    "csv":  str(TRANSCRIPTS_DIR / f"{sid}.csv"),
                })
    return {"stats": stats, "files": files}


@router.get("/transcripts/{session_id}/txt", response_class=PlainTextResponse)
async def get_transcript_txt(session_id: str):
    path = TRANSCRIPTS_DIR / f"{session_id}.txt"
    if not path.exists():
        return PlainTextResponse("Not found", status_code=404)
    return path.read_text(encoding="utf-8")


@router.get("/transcripts/{session_id}/json")
async def get_transcript_json(session_id: str) -> dict:
    path = TRANSCRIPTS_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(404, "Transcript nahi mila")
    return _read_json(path)


# ════════════════════════════════════════════════════════════════
# CRM
# ════════════════════════════════════════════════════════════════

@router.get("/crm", summary="All CRM contacts")
async def list_crm() -> dict:
    db = _crm_load()
    return {"total_contacts": len(db), "contacts": list(db.values())}


@router.get("/crm/{phone}", summary="Single CRM contact")
async def get_crm_contact(phone: str) -> dict:
    record = _crm_lookup(phone)
    if not record:
        raise HTTPException(404, "Contact nahi mila")
    return record


@router.post("/crm", summary="Create/update CRM contact", status_code=201)
async def upsert_crm_contact(body: CRMContactCreate) -> dict:
    db  = _crm_load()
    key = _normalize_phone(body.phone)
    if key in db:
        db[key].update({k: v for k, v in body.model_dump().items() if v})
        db[key]["last_contact"] = datetime.now().isoformat()
    else:
        db[key] = {
            **body.model_dump(),
            "phone":         key,
            "first_contact": datetime.now().isoformat(),
            "last_contact":  datetime.now().isoformat(),
            "total_calls":   0,
            "sessions":      []
        }
    _crm_save(db)
    return {"status": "success", "contact": db[key]}


@router.patch("/crm/{phone}", summary="Partial update CRM contact")
async def update_crm_contact(phone: str, body: CRMContactUpdate) -> dict:
    db  = _crm_load()
    key = _normalize_phone(phone)
    if key not in db:
        raise HTTPException(404, "Contact nahi mila")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    db[key].update(updates)
    db[key]["last_contact"] = datetime.now().isoformat()
    _crm_save(db)
    return {"status": "updated", "contact": db[key]}


@router.delete("/crm/{phone}", summary="Delete CRM contact")
async def delete_crm_contact(phone: str) -> dict:
    db  = _crm_load()
    key = _normalize_phone(phone)
    if key not in db:
        raise HTTPException(404, "Contact nahi mila")
    del db[key]
    _crm_save(db)
    return {"status": "deleted", "phone": key}


# ════════════════════════════════════════════════════════════════
# ANALYTICS
# ════════════════════════════════════════════════════════════════

@router.get("/analytics", summary="Full analytics report")
async def analytics() -> dict:
    if _MODULES_AVAILABLE:
        return get_full_analytics()
    return _compute_fallback_analytics()


@router.get("/analytics/overview", summary="Top-level KPIs")
async def analytics_overview() -> dict:
    if _MODULES_AVAILABLE:
        return get_overview()
    return _compute_fallback_analytics()


@router.get("/analytics/volume", summary="Daily call volume")
async def analytics_volume(days: int = Query(7, ge=1, le=90)) -> dict:
    if _MODULES_AVAILABLE:
        return {"days": days, "data": get_daily_volume(days)}
    return _fallback_daily_volume(days)


@router.get("/analytics/tools", summary="Tool usage frequency")
async def analytics_tools() -> dict:
    if _MODULES_AVAILABLE:
        return {"tools": get_top_tools()}
    return _fallback_top_tools()


@router.get("/analytics/latency", summary="Latency stats")
async def latency_analytics() -> dict:
    if _MODULES_AVAILABLE:
        return get_latency_analytics()
    return _fallback_latency()


@router.get("/analytics/latency/{session_id}", summary="Per-session latency")
async def session_latency_detail(session_id: str = FPath(...)) -> dict:
    path = LOGS_DIR / "latency" / f"{session_id}_latency.json"
    if not path.exists():
        raise HTTPException(404, f"Latency report nahi mila: {session_id}")
    return _read_json(path)


# ════════════════════════════════════════════════════════════════
# CALENDAR
# ════════════════════════════════════════════════════════════════

@router.get("/calendar/slots", summary="Available consultation slots")
async def available_slots(days_ahead: int = Query(7, ge=1, le=30)) -> dict:
    if not _MODULES_AVAILABLE:
        raise HTTPException(503, "Calendar module available nahi hai")
    slots = get_available_slots(days_ahead)
    return {"days_ahead": days_ahead, "available": len(slots) > 0, "slots": slots}


@router.post("/calendar/book", summary="Book consultation", status_code=201)
async def book_consultation(body: BookConsultationRequest) -> dict:
    if not _MODULES_AVAILABLE:
        raise HTTPException(503, "Calendar module available nahi hai")
    return create_consultation_event(
        name=body.name, email=body.email, phone=body.phone,
        topic=body.topic, preferred_time=body.preferred_time, duration_mins=30,
    )


# ════════════════════════════════════════════════════════════════
# RAG — Knowledge Base
# ════════════════════════════════════════════════════════════════

@router.get("/rag/stats", summary="Knowledge base stats")
async def rag_stats() -> dict:
    if not _MODULES_AVAILABLE:
        raise HTTPException(503, "RAG module available nahi hai")
    return get_rag_stats()


@router.post("/rag/search", summary="Search knowledge base")
async def rag_search(body: RAGSearchRequest) -> dict:
    if not _MODULES_AVAILABLE:
        raise HTTPException(503, "RAG module available nahi hai")
    context = get_rag_context(body.query, top_k=body.top_k)
    return {"query": body.query, "top_k": body.top_k, "context": context, "found": bool(context)}


# ════════════════════════════════════════════════════════════════
# LEADS
# ════════════════════════════════════════════════════════════════

@router.get("/leads", summary="Voice agent se captured leads")
async def list_voice_leads(
    page:  int = Query(1,  ge=1),
    limit: int = Query(20, ge=1, le=200),
) -> dict:
    leads = []
    if LEADS_DIR.exists():
        for f in sorted(LEADS_DIR.glob("*.json"), reverse=True):
            try:
                leads.append(_read_json(f))
            except Exception:
                continue

    if _redis_ok():
        try:
            raw         = _rdb.lrange("bluqq:leads", 0, -1)
            redis_leads = [json.loads(r) for r in raw]
            existing_ids = {l.get("session_id") for l in leads}
            for rl in redis_leads:
                if rl.get("session_id") not in existing_ids:
                    leads.append(rl)
        except Exception:
            pass

    total = len(leads)
    start = (page - 1) * limit
    return {
        "total": total, "page": page, "limit": limit,
        "pages": (total + limit - 1) // limit,
        "leads": leads[start: start + limit]
    }


# ════════════════════════════════════════════════════════════════
# Fallback analytics (modules ke bina bhi kaam karta hai)
# ════════════════════════════════════════════════════════════════

def _compute_fallback_analytics() -> dict:
    files = _session_files()
    total = len(files)
    durations, latencies = [], []
    for f in files:
        try:
            s = _read_json(f)
            d = s.get("duration", {})
            durations.append(d.get("total_duration_seconds", 0))
            lat = d.get("latency_ms", {}).get("avg", 0)
            if lat: latencies.append(lat)
        except Exception:
            continue
    return {
        "total_calls":    total,
        "avg_duration":   round(sum(durations) / total, 1) if total else 0,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 0) if latencies else 0,
        "crm_contacts":   len(_crm_load()),
    }


def _fallback_daily_volume(days: int) -> dict:
    from collections import defaultdict
    counts: dict = defaultdict(int)
    for f in _session_files():
        try:
            s    = _read_json(f)
            date = s.get("call_start", "")[:10]
            if date: counts[date] += 1
        except Exception:
            continue
    sorted_dates = sorted(counts.items())[-days:]
    return {"days": days, "data": [{"date": d, "calls": c} for d, c in sorted_dates]}


def _fallback_top_tools() -> dict:
    from collections import Counter
    counter: Counter = Counter()
    for f in _session_files():
        try:
            s = _read_json(f)
            for t in s.get("tools_used", []):
                counter[t["tool"]] += 1
        except Exception:
            continue
    return {"tools": [{"tool": k, "count": v} for k, v in counter.most_common()]}


def _fallback_latency() -> dict:
    all_lat = []
    for f in _session_files():
        try:
            s   = _read_json(f)
            lat = s.get("duration", {}).get("latency_ms", {}).get("all", [])
            all_lat.extend(lat)
        except Exception:
            continue
    if not all_lat:
        return {"avg": 0, "min": 0, "max": 0, "samples": 0}
    return {
        "avg":     round(sum(all_lat) / len(all_lat)),
        "min":     min(all_lat),
        "max":     max(all_lat),
        "samples": len(all_lat),
    }