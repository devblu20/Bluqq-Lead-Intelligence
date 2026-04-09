"""
BluQQ Analytics Module
───────────────────────
Saari calls ka analytics:
- Call volume trends
- Latency trends  
- Top intents / topics
- Lead & booking conversion
- Agent transfer rate
- Per-caller history
"""

import os
import json
import logging
from datetime import datetime, timedelta
from collections import defaultdict

log = logging.getLogger("bluqq")


# ─────────────────────────────────────────────────────────────────────────────
# DATA LOADER
# ─────────────────────────────────────────────────────────────────────────────

def load_all_sessions() -> list:
    sessions = []
    for folder in ["sessions", "transcripts"]:
        if not os.path.exists(folder):
            continue
        for fname in os.listdir(folder):
            if not fname.endswith(".json"):
                continue
            try:
                with open(f"{folder}/{fname}", encoding="utf-8") as f:
                    data = json.load(f)
                if "session_id" in data and data not in sessions:
                    sessions.append(data)
            except Exception:
                continue
    # Deduplicate by session_id
    seen = set()
    unique = []
    for s in sessions:
        sid = s.get("session_id")
        if sid and sid not in seen:
            seen.add(sid)
            unique.append(s)
    return unique


def load_leads() -> list:
    leads = []
    if not os.path.exists("leads"):
        return leads
    for fname in os.listdir("leads"):
        if fname.endswith(".json"):
            try:
                with open(f"leads/{fname}", encoding="utf-8") as f:
                    leads.append(json.load(f))
            except Exception:
                continue
    return leads


def load_bookings() -> list:
    bookings = []
    if not os.path.exists("bookings"):
        return bookings
    for fname in os.listdir("bookings"):
        if fname.endswith(".json"):
            try:
                with open(f"bookings/{fname}", encoding="utf-8") as f:
                    bookings.append(json.load(f))
            except Exception:
                continue
    return bookings


def load_transfers() -> list:
    transfers = []
    if not os.path.exists("transfers"):
        return transfers
    for fname in os.listdir("transfers"):
        if fname.endswith(".json"):
            try:
                with open(f"transfers/{fname}", encoding="utf-8") as f:
                    transfers.append(json.load(f))
            except Exception:
                continue
    return transfers


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def get_overview() -> dict:
    """High-level summary of all calls."""
    sessions  = load_all_sessions()
    leads     = load_leads()
    bookings  = load_bookings()
    transfers = load_transfers()

    if not sessions:
        return {"message": "No data yet — make some calls first!"}

    # Duration stats
    durations = [
        s.get("duration", {}).get("total_duration_seconds", 0)
        for s in sessions
    ]
    avg_dur = int(sum(durations) / len(durations)) if durations else 0

    # Latency stats
    all_e2e = []
    for s in sessions:
        lat = s.get("latency", {})
        all_e2e.extend(lat.get("e2e_all", []))
    avg_lat = int(sum(all_e2e) / len(all_e2e)) if all_e2e else 0

    # Turn stats
    turns = [s.get("total_turns", 0) for s in sessions]
    avg_turns = round(sum(turns) / len(turns), 1) if turns else 0

    # Barge-in rate
    barge_ins = sum(
        s.get("turn_manager", {}).get("barge_in_count", 0)
        for s in sessions
    )

    # Error rate
    total_errors = sum(
        s.get("errors", {}).get("total_errors", 0)
        for s in sessions
    )

    return {
        "total_calls":         len(sessions),
        "total_leads":         len(leads),
        "total_bookings":      len(bookings),
        "total_transfers":     len(transfers),
        "avg_duration_sec":    avg_dur,
        "avg_duration_fmt":    f"{avg_dur//60:02d}:{avg_dur%60:02d}",
        "avg_turns_per_call":  avg_turns,
        "avg_e2e_latency_ms":  avg_lat,
        "total_barge_ins":     barge_ins,
        "total_errors":        total_errors,
        "conversion_rate":     f"{round(len(leads)/len(sessions)*100)}%" if sessions else "0%",
        "transfer_rate":       f"{round(len(transfers)/len(sessions)*100)}%" if sessions else "0%",
    }


def get_daily_volume(days: int = 7) -> list:
    """Last N days mein kitni calls aaye."""
    sessions = load_all_sessions()
    counts   = defaultdict(int)

    for s in sessions:
        date = s.get("call_start", "")[:10]
        if date:
            counts[date] += 1

    # Last N days fill karo
    result = []
    for i in range(days - 1, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        result.append({"date": date, "calls": counts.get(date, 0)})

    return result


def get_top_tools() -> list:
    """Kaunse tools sabse zyada use hue."""
    sessions   = load_all_sessions()
    tool_count = defaultdict(int)

    for s in sessions:
        for t in s.get("tools_used", []):
            tool_count[t.get("tool", "")] += 1

    return sorted(
        [{"tool": k, "count": v} for k, v in tool_count.items()],
        key=lambda x: x["count"],
        reverse=True
    )


def get_caller_insights() -> list:
    """Top callers — sabse zyada calls karne wale."""
    sessions     = load_all_sessions()
    caller_data  = defaultdict(lambda: {
        "calls": 0, "total_duration": 0, "name": "Unknown"
    })

    for s in sessions:
        phone = s.get("caller_phone", "Unknown")
        if phone and phone != "Unknown":
            caller_data[phone]["calls"]          += 1
            caller_data[phone]["total_duration"] += s.get("duration", {}).get(
                "total_duration_seconds", 0
            )
            if s.get("caller_name") and s["caller_name"] != "Unknown":
                caller_data[phone]["name"] = s["caller_name"]

    result = []
    for phone, data in caller_data.items():
        avg_dur = int(data["total_duration"] / data["calls"]) if data["calls"] else 0
        result.append({
            "phone":        phone,
            "name":         data["name"],
            "total_calls":  data["calls"],
            "avg_duration": f"{avg_dur//60:02d}:{avg_dur%60:02d}",
        })

    return sorted(result, key=lambda x: x["total_calls"], reverse=True)[:10]


def get_latency_trend(days: int = 7) -> list:
    """Last N days ka latency trend."""
    sessions = load_all_sessions()
    daily    = defaultdict(list)

    for s in sessions:
        date = s.get("call_start", "")[:10]
        e2e  = s.get("latency", {}).get("e2e_avg_ms", 0)
        if date and e2e:
            daily[date].append(e2e)

    result = []
    for i in range(days - 1, -1, -1):
        date    = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        vals    = daily.get(date, [])
        avg_lat = int(sum(vals) / len(vals)) if vals else 0
        result.append({"date": date, "avg_e2e_ms": avg_lat})

    return result


def get_quality_distribution() -> dict:
    """E2E latency quality distribution."""
    sessions = load_all_sessions()
    dist     = {"excellent": 0, "good": 0, "acceptable": 0, "slow": 0}

    for s in sessions:
        e2e = s.get("latency", {}).get("e2e_avg_ms", 0)
        if e2e < 500:    dist["excellent"]  += 1
        elif e2e < 800:  dist["good"]       += 1
        elif e2e < 1200: dist["acceptable"] += 1
        elif e2e > 0:    dist["slow"]       += 1

    return dist


def get_full_analytics() -> dict:
    """Poora analytics — ek API call mein sab."""
    return {
        "generated_at":        datetime.now().isoformat(),
        "overview":            get_overview(),
        "daily_volume_7d":     get_daily_volume(7),
        "latency_trend_7d":    get_latency_trend(7),
        "quality_distribution":get_quality_distribution(),
        "top_tools":           get_top_tools(),
        "top_callers":         get_caller_insights(),
    }


if __name__ == "__main__":
    import json
    print("Analytics Test\n" + "─" * 40)
    result = get_full_analytics()
    print(json.dumps(result, indent=2))