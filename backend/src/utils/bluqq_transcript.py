"""
BluQQ Transcript Manager
─────────────────────────
Har call ka transcript save karta hai:
- JSON file (machine readable)
- TXT file (human readable)
- CSV file (Excel mein open karo)
"""

import os
import csv
import json
import logging
from datetime import datetime

log = logging.getLogger("bluqq")

os.makedirs("transcripts", exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# SAVE FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def save_transcript_json(session_id: str, session_data: dict):
    """Poora session data JSON mein save karo."""
    fname = f"transcripts/{session_id}.json"
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(session_data, f, indent=2, ensure_ascii=False)
    log.info(f"[Transcript] JSON saved → {fname}")
    return fname


def save_transcript_txt(session_id: str, session_data: dict):
    """
    Human-readable TXT format mein save karo.
    Koi bhi notepad mein khol sakta hai.
    """
    fname    = f"transcripts/{session_id}.txt"
    duration = session_data.get("duration", {})
    tm       = session_data.get("turn_manager", {})
    errors   = session_data.get("errors", {})

    with open(fname, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("  BLUQQ AI PHONE CALL TRANSCRIPT\n")
        f.write("=" * 60 + "\n\n")

        # Call info
        f.write(f"Session ID   : {session_data.get('session_id')}\n")
        f.write(f"Caller Name  : {session_data.get('caller_name', 'Unknown')}\n")
        f.write(f"Caller Phone : {session_data.get('caller_phone', 'Unknown')}\n")
        f.write(f"Date         : {session_data.get('call_start', '')[:10]}\n")
        f.write(f"Time         : {session_data.get('call_start', '')[11:19]}\n")
        f.write(f"Duration     : {duration.get('total_duration_formatted', '00:00')}\n")
        f.write(f"Total Turns  : {tm.get('total_turns', 0)}\n")
        f.write(f"Barge-ins    : {tm.get('barge_in_count', 0)}\n")
        f.write(f"Avg Latency  : {duration.get('latency_ms', {}).get('avg', 0)}ms\n")
        f.write(f"Errors       : {errors.get('total_errors', 0)}\n")

        # Tools used
        tools = session_data.get("tools_used", [])
        if tools:
            f.write(f"Tools Used   : {', '.join(t['tool'] for t in tools)}\n")

        f.write("\n" + "-" * 60 + "\n")
        f.write("  CONVERSATION\n")
        f.write("-" * 60 + "\n\n")

        # Transcript
        for turn in session_data.get("transcript", []):
            role = turn.get("role", "")
            text = turn.get("text", "")
            ts   = turn.get("timestamp", "")[11:19]

            if role == "caller":
                f.write(f"[{ts}] CALLER : {text}\n\n")
            elif role == "ai":
                f.write(f"[{ts}] AI     : {text}\n\n")
            elif role == "system":
                f.write(f"[{ts}] SYSTEM : {text}\n\n")

        f.write("-" * 60 + "\n")
        f.write("  END OF TRANSCRIPT\n")
        f.write("=" * 60 + "\n")

    log.info(f"[Transcript] TXT saved → {fname}")
    return fname


def save_transcript_csv(session_id: str, session_data: dict):
    """
    CSV format mein save karo — Excel mein open karo.
    Ek row = ek turn.
    """
    fname = f"transcripts/{session_id}.csv"

    with open(fname, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            "Session ID", "Caller Name", "Caller Phone",
            "Date", "Time", "Turn #", "Role", "Message", "Timestamp"
        ])

        session_id_val  = session_data.get("session_id", "")
        caller_name     = session_data.get("caller_name", "Unknown")
        caller_phone    = session_data.get("caller_phone", "Unknown")
        date            = session_data.get("call_start", "")[:10]
        time_val        = session_data.get("call_start", "")[11:19]

        turn_num = 0
        for turn in session_data.get("transcript", []):
            role = turn.get("role", "")
            if role in ("caller", "ai"):
                turn_num += 1

            writer.writerow([
                session_id_val,
                caller_name,
                caller_phone,
                date,
                time_val,
                turn_num if role in ("caller", "ai") else "",
                role.upper(),
                turn.get("text", ""),
                turn.get("timestamp", "")[11:19]
            ])

    log.info(f"[Transcript] CSV saved → {fname}")
    return fname


def save_all_formats(session_id: str, session_data: dict) -> dict:
    """
    Teeno formats mein save karo ek baar mein.
    Call khatam hone pe ye function use karo.
    """
    files = {
        "json": save_transcript_json(session_id, session_data),
        "txt":  save_transcript_txt(session_id, session_data),
        "csv":  save_transcript_csv(session_id, session_data),
    }
    log.info(f"[Transcript] All 3 formats saved for session {session_id}")
    return files


# ─────────────────────────────────────────────────────────────────────────────
# MASTER CSV — Saari calls ek file mein
# ─────────────────────────────────────────────────────────────────────────────

MASTER_CSV = "transcripts/all_calls_summary.csv"


def update_master_csv(session_data: dict):
    """
    Master summary CSV update karo —
    saari calls ka overview ek jagah.
    """
    file_exists = os.path.exists(MASTER_CSV)
    duration    = session_data.get("duration", {})
    tm          = session_data.get("turn_manager", {})
    errors      = session_data.get("errors", {})
    tools       = session_data.get("tools_used", [])

    with open(MASTER_CSV, "a", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        # Header — sirf pehli baar
        if not file_exists:
            writer.writerow([
                "Session ID", "Date", "Time",
                "Caller Name", "Caller Phone",
                "Duration", "Turns", "Barge-ins",
                "Avg Latency (ms)", "Tools Used",
                "Total Errors", "Status"
            ])

        writer.writerow([
            session_data.get("session_id", ""),
            session_data.get("call_start", "")[:10],
            session_data.get("call_start", "")[11:19],
            session_data.get("caller_name", "Unknown"),
            session_data.get("caller_phone", "Unknown"),
            duration.get("total_duration_formatted", "00:00"),
            tm.get("total_turns", 0),
            tm.get("barge_in_count", 0),
            duration.get("latency_ms", {}).get("avg", 0),
            ", ".join(t["tool"] for t in tools),
            errors.get("total_errors", 0),
            session_data.get("status", "completed")
        ])

    log.info(f"[Transcript] Master CSV updated → {MASTER_CSV}")


def get_transcript_stats() -> dict:
    """Transcript folder ka summary."""
    if not os.path.exists("transcripts"):
        return {"total": 0, "formats": []}

    files  = os.listdir("transcripts")
    jsons  = [f for f in files if f.endswith(".json") and f != "all_calls_summary.csv"]
    txts   = [f for f in files if f.endswith(".txt")]
    csvs   = [f for f in files if f.endswith(".csv")]

    return {
        "total_sessions": len(jsons),
        "json_files":     len(jsons),
        "txt_files":      len(txts),
        "csv_files":      len(csvs),
        "master_csv":     os.path.exists(MASTER_CSV),
        "folder":         os.path.abspath("transcripts")
    }


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)

    # Test
    test_session = {
        "session_id":   "20250320_143022",
        "call_start":   "2025-03-20T14:30:22",
        "call_end":     "2025-03-20T14:32:05",
        "caller_name":  "Rahul Sharma",
        "caller_phone": "+919876543210",
        "status":       "completed",
        "duration": {
            "total_duration_formatted": "01:43",
            "latency_ms": {"avg": 342}
        },
        "turn_manager": {"total_turns": 6, "barge_in_count": 1},
        "errors":       {"total_errors": 0},
        "tools_used":   [{"tool": "get_pricing"}],
        "transcript": [
            {"role": "caller", "text": "Hello, what services do you offer?",
             "timestamp": "2025-03-20T14:30:25"},
            {"role": "ai", "text": "Welcome to BluQQ! We offer trading tools, dashboards, and more.",
             "timestamp": "2025-03-20T14:30:27"},
            {"role": "caller", "text": "What is the price for a dashboard?",
             "timestamp": "2025-03-20T14:30:40"},
            {"role": "system", "text": "[Tool: get_pricing]",
             "timestamp": "2025-03-20T14:30:41"},
            {"role": "ai", "text": "Dashboards start from $800 to $3000 depending on complexity.",
             "timestamp": "2025-03-20T14:30:43"},
        ]
    }

    files = save_all_formats("20250320_143022", test_session)
    update_master_csv(test_session)

    print("\nFiles created:")
    for fmt, path in files.items():
        print(f"  {fmt.upper()}: {path}")

    print(f"\nStats: {get_transcript_stats()}")