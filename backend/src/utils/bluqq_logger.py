"""
BluQQ Structured Logger
────────────────────────
Professional logging with:
- Timestamps on every line
- Color coded console output
- Rotating log files (auto cleanup)
- Structured JSON logs for analytics
- Per-session log files
"""

import os
import json
import logging
import logging.handlers
from datetime import datetime
from pathlib import Path

os.makedirs("logs", exist_ok=True)
os.makedirs("logs/sessions", exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# COLOR FORMATTER — Console mein colors
# ─────────────────────────────────────────────────────────────────────────────

class ColorFormatter(logging.Formatter):
    """Console pe color-coded logs."""

    COLORS = {
        "DEBUG":    "\033[36m",   # Cyan
        "INFO":     "\033[32m",   # Green
        "WARNING":  "\033[33m",   # Yellow
        "ERROR":    "\033[31m",   # Red
        "CRITICAL": "\033[35m",   # Magenta
    }
    RESET = "\033[0m"
    BOLD  = "\033[1m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET
        bold  = self.BOLD

        # Timestamp
        ts = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")

        # Level badge
        level = f"{color}{bold}{record.levelname:<8}{reset}"

        # Message
        msg = record.getMessage()

        # Special icons for common patterns
        if "📞" in msg or "CALL STARTED" in msg:
            icon = "📞"
        elif "✅" in msg:
            icon = "✅"
        elif "❌" in msg or "Error" in msg or "error" in msg:
            icon = "❌"
        elif "⚡" in msg or "latency" in msg.lower():
            icon = "⚡"
        elif "🛑" in msg or "Barge" in msg:
            icon = "🛑"
        elif "[RAG]" in msg:
            icon = "🔍"
        elif "[CRM]" in msg:
            icon = "👤"
        elif "[Tool]" in msg:
            icon = "🔧"
        elif "[Transfer]" in msg:
            icon = "🔀"
        elif "[Calendar]" in msg:
            icon = "📅"
        elif "[Retry]" in msg:
            icon = "🔄"
        elif "[State]" in msg:
            icon = "⚙"
        elif "[Transcript]" in msg:
            icon = "📄"
        elif "WARNING" in record.levelname:
            icon = "⚠"
        else:
            icon = " "

        return f"{color}{ts}{reset} {level} {icon}  {msg}"


# ─────────────────────────────────────────────────────────────────────────────
# JSON FORMATTER — Log file ke liye structured JSON
# ─────────────────────────────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """JSON structured logs — analytics ke liye."""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            "message":   record.getMessage(),
            "module":    record.module,
            "line":      record.lineno,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────────────────────
# PLAIN FORMATTER — Simple text file ke liye
# ─────────────────────────────────────────────────────────────────────────────

class PlainFormatter(logging.Formatter):
    """Plain text logs — notepad mein padhne ke liye."""

    def format(self, record):
        ts  = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        return f"{ts} | {record.levelname:<8} | {record.getMessage()}"


# ─────────────────────────────────────────────────────────────────────────────
# LOGGER SETUP
# ─────────────────────────────────────────────────────────────────────────────

def setup_logger(name: str = "bluqq") -> logging.Logger:
    """
    Main logger setup karo.
    3 handlers:
    1. Console   — color coded, real-time
    2. Main log  — plain text, rotating (10MB, 5 backups)
    3. JSON log  — structured JSON for analytics
    """
    logger = logging.getLogger(name)

    # Already setup hai?
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # ── Handler 1: Console ────────────────────────────────────────────────────
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(ColorFormatter())

    # ── Handler 2: Main log file — rotating ───────────────────────────────────
    # 10MB per file, 5 backup files = max 50MB
    main_handler = logging.handlers.RotatingFileHandler(
        filename    = "logs/bluqq_calls.log",
        maxBytes    = 10 * 1024 * 1024,   # 10 MB
        backupCount = 5,
        encoding    = "utf-8"
    )
    main_handler.setLevel(logging.INFO)
    main_handler.setFormatter(PlainFormatter())

    # ── Handler 3: JSON log file ───────────────────────────────────────────────
    json_handler = logging.handlers.RotatingFileHandler(
        filename    = "logs/bluqq_structured.jsonl",
        maxBytes    = 10 * 1024 * 1024,
        backupCount = 3,
        encoding    = "utf-8"
    )
    json_handler.setLevel(logging.INFO)
    json_handler.setFormatter(JSONFormatter())

    logger.addHandler(console_handler)
    logger.addHandler(main_handler)
    logger.addHandler(json_handler)

    return logger


# ─────────────────────────────────────────────────────────────────────────────
# PER-SESSION LOGGER — Har call ka alag log file
# ─────────────────────────────────────────────────────────────────────────────

def get_session_logger(session_id: str) -> logging.Logger:
    """
    Har call ke liye alag log file.
    logs/sessions/20250320_143022.log
    """
    name   = f"bluqq.session.{session_id}"
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # Session-specific file handler
    handler = logging.FileHandler(
        filename = f"logs/sessions/{session_id}.log",
        encoding = "utf-8"
    )
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(PlainFormatter())
    logger.addHandler(handler)

    # Parent logger ko bhi propagate karo
    logger.propagate = True
    return logger


def close_session_logger(session_id: str):
    """Session khatam hone ke baad handler close karo."""
    name   = f"bluqq.session.{session_id}"
    logger = logging.getLogger(name)
    for handler in logger.handlers[:]:
        handler.close()
        logger.removeHandler(handler)


# ─────────────────────────────────────────────────────────────────────────────
# CALL EVENT LOGGER — Structured call events
# ─────────────────────────────────────────────────────────────────────────────

class CallLogger:
    """
    Call ke dauran structured events log karo.
    Har event timestamp ke saath save hota hai.
    """

    def __init__(self, session_id: str):
        self.session_id  = session_id
        self.log         = get_session_logger(session_id)
        self.main_log    = logging.getLogger("bluqq")
        self.events      = []
        self.start_time  = datetime.now()

    def _event(self, event_type: str, data: dict = None, level: str = "INFO"):
        entry = {
            "timestamp":  datetime.now().isoformat(),
            "session_id": self.session_id,
            "event":      event_type,
            "data":       data or {}
        }
        self.events.append(entry)

        msg = f"[{self.session_id}] {event_type}"
        if data:
            data_str = " | ".join(f"{k}={v}" for k, v in data.items()
                                  if v is not None and str(v).strip())
            if data_str:
                msg += f" — {data_str}"

        getattr(self.log, level.lower())(msg)
        getattr(self.main_log, level.lower())(msg)

    # ── Convenience methods ───────────────────────────────────────────────────

    def call_started(self, caller_phone: str = "", redis: bool = False, rag_chunks: int = 0):
        self._event("CALL_STARTED", {
            "phone":      caller_phone,
            "redis":      "yes" if redis else "no",
            "rag_chunks": rag_chunks
        })

    def call_ended(self, duration: str, turns: int, errors: int):
        self._event("CALL_ENDED", {
            "duration": duration,
            "turns":    turns,
            "errors":   errors
        })

    def caller_spoke(self, text: str):
        self._event("CALLER_SPOKE", {"text": text[:100]})

    def ai_spoke(self, text: str, latency_ms: int = 0):
        self._event("AI_SPOKE", {
            "text":       text[:100],
            "latency_ms": latency_ms if latency_ms else None
        })

    def state_changed(self, from_state: str, to_state: str, reason: str = ""):
        icons = {"IDLE": "⏸", "LISTENING": "👂", "PROCESSING": "🧠", "SPEAKING": "🔊"}
        icon  = icons.get(to_state, "→")
        self._event("STATE_CHANGE", {
            "from":   from_state,
            "to":     f"{icon} {to_state}",
            "reason": reason
        })

    def tool_called(self, tool_name: str, args: dict = None):
        self._event("TOOL_CALLED", {
            "tool": tool_name,
            "args": str(args)[:80] if args else ""
        })

    def tool_result(self, tool_name: str, status: str):
        self._event("TOOL_RESULT", {"tool": tool_name, "status": status})

    def barge_in(self, count: int):
        self._event("BARGE_IN", {"count": count}, level="WARNING")

    def crm_lookup(self, phone: str, found: bool, name: str = ""):
        self._event("CRM_LOOKUP", {
            "phone":  phone,
            "found":  "yes" if found else "no",
            "name":   name if found else ""
        })

    def rag_search(self, query: str, found: bool):
        self._event("RAG_SEARCH", {
            "query": query[:60],
            "found": "yes" if found else "no"
        })

    def transfer_initiated(self, reason: str):
        self._event("TRANSFER_INITIATED", {"reason": reason}, level="WARNING")

    def error_occurred(self, source: str, error_type: str, message: str):
        self._event("ERROR", {
            "source":  source,
            "type":    error_type,
            "message": message[:100]
        }, level="ERROR")

    def retry_attempt(self, service: str, attempt: int, max_attempts: int):
        self._event("RETRY", {
            "service": service,
            "attempt": f"{attempt}/{max_attempts}"
        }, level="WARNING")

    def booking_created(self, name: str, time: str, calendar: bool):
        self._event("BOOKING_CREATED", {
            "name":     name,
            "time":     time,
            "calendar": "google" if calendar else "local"
        })

    def lead_submitted(self, name: str, service: str):
        self._event("LEAD_SUBMITTED", {"name": name, "service": service})

    def save_event_log(self):
        """Call khatam hone pe events ko JSON file mein save karo."""
        fname = f"logs/sessions/{self.session_id}_events.json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump({
                "session_id": self.session_id,
                "start_time": self.start_time.isoformat(),
                "end_time":   datetime.now().isoformat(),
                "total_events": len(self.events),
                "events":     self.events
            }, f, indent=2, ensure_ascii=False)
        self.main_log.info(f"[Logger] Events saved → {fname}")
        return fname

    def print_summary(self):
        """Call ka log summary print karo."""
        self.main_log.info("─" * 55)
        self.main_log.info(f"  Session log  : logs/sessions/{self.session_id}.log")
        self.main_log.info(f"  Events log   : logs/sessions/{self.session_id}_events.json")
        self.main_log.info(f"  Main log     : logs/bluqq_calls.log")
        self.main_log.info(f"  JSON log     : logs/bluqq_structured.jsonl")
        self.main_log.info(f"  Total events : {len(self.events)}")
        self.main_log.info("─" * 55)


def get_log_stats() -> dict:
    """Log files ka summary."""
    stats = {
        "main_log":     os.path.exists("logs/bluqq_calls.log"),
        "json_log":     os.path.exists("logs/bluqq_structured.jsonl"),
        "session_logs": 0,
        "log_folder":   os.path.abspath("logs")
    }
    if os.path.exists("logs/sessions"):
        stats["session_logs"] = len([
            f for f in os.listdir("logs/sessions")
            if f.endswith(".log")
        ])
    if os.path.exists("logs/bluqq_calls.log"):
        size = os.path.getsize("logs/bluqq_calls.log")
        stats["main_log_size"] = f"{size // 1024}KB"
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Initialize — import karte hi setup ho jaata hai
# ─────────────────────────────────────────────────────────────────────────────

log = setup_logger("bluqq")


if __name__ == "__main__":
    print("Logger Test\n" + "─" * 40)
    test_log = setup_logger("bluqq")

    test_log.info("Server starting...")
    test_log.info("✅ Redis connected")
    test_log.warning("⚠ Calendar not configured")
    test_log.error("❌ Simulated error for testing")

    # Session logger test
    call_log = CallLogger("TEST_SESSION")
    call_log.call_started("+919876543210", redis=True, rag_chunks=34)
    call_log.crm_lookup("+919876543210", found=True, name="Rahul Sharma")
    call_log.state_changed("IDLE", "LISTENING", "caller started speaking")
    call_log.caller_spoke("Hello what services do you offer")
    call_log.state_changed("LISTENING", "PROCESSING", "caller stopped")
    call_log.rag_search("services offered by BluQQ", found=True)
    call_log.state_changed("PROCESSING", "SPEAKING", "AI response started")
    call_log.ai_spoke("BluQQ offers trading tools...", latency_ms=342)
    call_log.state_changed("SPEAKING", "IDLE", "response complete")
    call_log.barge_in(1)
    call_log.tool_called("get_pricing", {"service_name": "dashboard"})
    call_log.tool_result("get_pricing", "success")
    call_log.lead_submitted("Rahul Sharma", "dashboard")
    call_log.call_ended("01:43", turns=6, errors=0)
    call_log.save_event_log()
    call_log.print_summary()
    close_session_logger("TEST_SESSION")

    print(f"\nLog stats: {get_log_stats()}")