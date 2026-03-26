"""
BluQQ Calendar API
──────────────────
Google Calendar integration for booking consultations.
Real events create karta hai with email invites.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("bluqq")

# ─────────────────────────────────────────────────────────────────────────────
# GOOGLE CALENDAR SETUP
# ─────────────────────────────────────────────────────────────────────────────

CREDENTIALS_FILE = os.environ.get("GOOGLE_CREDENTIALS_FILE", "google_credentials.json")
CALENDAR_ID      = os.environ.get("GOOGLE_CALENDAR_ID", "primary")
TEAM_EMAIL       = os.environ.get("BLUQQ_TEAM_EMAIL", "team@bluqq.com")
TIMEZONE         = "Asia/Kolkata"   # IST

_calendar_service = None


def get_calendar_service():
    """Google Calendar service initialize karo — ek baar."""
    global _calendar_service
    if _calendar_service:
        return _calendar_service

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        if not os.path.exists(CREDENTIALS_FILE):
            log.warning(f"[Calendar] Credentials file not found: {CREDENTIALS_FILE}")
            return None

        credentials = service_account.Credentials.from_service_account_file(
            CREDENTIALS_FILE,
            scopes=["https://www.googleapis.com/auth/calendar"]
        )
        _calendar_service = build("calendar", "v3", credentials=credentials)
        log.info("[Calendar] ✅ Google Calendar connected")
        return _calendar_service

    except Exception as e:
        log.warning(f"[Calendar] ⚠ Could not connect: {e}")
        return None


def calendar_ok() -> bool:
    """Calendar connected hai ya nahi."""
    return get_calendar_service() is not None


# ─────────────────────────────────────────────────────────────────────────────
# TIME PARSER — Natural language → datetime
# ─────────────────────────────────────────────────────────────────────────────

def parse_preferred_time(time_str: str) -> datetime | None:
    """
    Natural language time string ko datetime mein convert karo.
    Examples:
      "tomorrow 3pm"     → datetime
      "Monday morning"   → datetime
      "next week"        → datetime
      "2025-03-25 10:00" → datetime
    """
    now = datetime.now()

    try:
        # Pehle direct parse try karo
        return date_parser.parse(time_str, fuzzy=True, default=now)
    except Exception:
        pass

    # Manual keywords handle karo
    time_lower = time_str.lower().strip()

    if "tomorrow" in time_lower:
        base = now + timedelta(days=1)
        if "morning" in time_lower:   return base.replace(hour=10, minute=0)
        if "afternoon" in time_lower: return base.replace(hour=14, minute=0)
        if "evening" in time_lower:   return base.replace(hour=17, minute=0)
        return base.replace(hour=11, minute=0)

    if "next week" in time_lower:
        base = now + timedelta(weeks=1)
        return base.replace(hour=11, minute=0)

    if "monday" in time_lower:
        days_ahead = (0 - now.weekday()) % 7 or 7
        base = now + timedelta(days=days_ahead)
        if "morning" in time_lower:   return base.replace(hour=10, minute=0)
        if "afternoon" in time_lower: return base.replace(hour=14, minute=0)
        return base.replace(hour=11, minute=0)

    if "tuesday" in time_lower:
        days_ahead = (1 - now.weekday()) % 7 or 7
        return (now + timedelta(days=days_ahead)).replace(hour=11, minute=0)

    if "wednesday" in time_lower:
        days_ahead = (2 - now.weekday()) % 7 or 7
        return (now + timedelta(days=days_ahead)).replace(hour=11, minute=0)

    if "thursday" in time_lower:
        days_ahead = (3 - now.weekday()) % 7 or 7
        return (now + timedelta(days=days_ahead)).replace(hour=11, minute=0)

    if "friday" in time_lower:
        days_ahead = (4 - now.weekday()) % 7 or 7
        return (now + timedelta(days=days_ahead)).replace(hour=11, minute=0)

    # Default: kal 11am
    return (now + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)


# ─────────────────────────────────────────────────────────────────────────────
# CALENDAR FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def create_consultation_event(
    name:           str,
    email:          str,
    phone:          str,
    topic:          str,
    preferred_time: str,
    duration_mins:  int = 30
) -> dict:
    """
    Google Calendar mein consultation event banao.
    Caller aur BluQQ team dono ko invite bhejo.
    Returns event details dict.
    """
    service = get_calendar_service()

    # Time parse karo
    start_dt = parse_preferred_time(preferred_time)
    if not start_dt:
        start_dt = datetime.now() + timedelta(days=1)
        start_dt = start_dt.replace(hour=11, minute=0, second=0, microsecond=0)

    end_dt = start_dt + timedelta(minutes=duration_mins)

    # Event data
    event = {
        "summary": f"BluQQ Consultation — {name}",
        "description": (
            f"Free consultation call with BluQQ team.\n\n"
            f"Client: {name}\n"
            f"Phone: {phone}\n"
            f"Email: {email}\n"
            f"Topic: {topic}\n\n"
            f"Booked via BluQQ AI Voice Assistant."
        ),
        "start": {
            "dateTime": start_dt.isoformat(),
            "timeZone": TIMEZONE,
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": TIMEZONE,
        },
        "attendees": [
            {"email": TEAM_EMAIL,  "displayName": "BluQQ Team"},
        ],
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email",  "minutes": 60},
                {"method": "popup",  "minutes": 15},
            ]
        },
        "conferenceData": {
            "createRequest": {
                "requestId":             f"bluqq-{name}-{start_dt.strftime('%Y%m%d%H%M')}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"}
            }
        }
    }

    # Caller ka email hai toh usse bhi invite karo
    if email and "@" in email:
        event["attendees"].append({
            "email":       email,
            "displayName": name
        })

    if not service:
        # Calendar nahi hai — sirf file mein save karo
        log.warning("[Calendar] No service — saving to file only")
        return _save_booking_locally(name, email, phone, topic, start_dt, end_dt)

    try:
        created = service.events().insert(
            calendarId     = CALENDAR_ID,
            body           = event,
            sendUpdates    = "all",       # Email invites bhejo
            conferenceDataVersion = 1     # Meet link generate karo
        ).execute()

        meet_link = (
            created.get("conferenceData", {})
                   .get("entryPoints", [{}])[0]
                   .get("uri", "")
        )

        result = {
            "status":       "success",
            "event_id":     created.get("id"),
            "event_link":   created.get("htmlLink"),
            "meet_link":    meet_link,
            "start_time":   start_dt.strftime("%A, %B %d at %I:%M %p IST"),
            "end_time":     end_dt.strftime("%I:%M %p IST"),
            "duration_mins": duration_mins,
            "attendees":    [a["email"] for a in event["attendees"]],
            "message": (
                f"Consultation booked for {start_dt.strftime('%A, %B %d at %I:%M %p IST')}. "
                f"A calendar invite has been sent to {email}. "
                f"{'Google Meet link: ' + meet_link if meet_link else ''}"
            )
        }

        log.info(f"[Calendar] ✅ Event created: {result['event_link']}")
        log.info(f"[Calendar]    Time: {result['start_time']}")
        if meet_link:
            log.info(f"[Calendar]    Meet: {meet_link}")

        # Local file mein bhi save karo backup ke liye
        _save_booking_locally(name, email, phone, topic, start_dt, end_dt, result)
        return result

    except Exception as e:
        log.error(f"[Calendar] ❌ Error creating event: {e}")
        return _save_booking_locally(name, email, phone, topic, start_dt, end_dt)


def get_available_slots(days_ahead: int = 7) -> list:
    """
    Agle N din ke available slots dekho.
    Returns list of available time slots.
    """
    service = get_calendar_service()
    if not service:
        # Default slots return karo
        return _default_slots(days_ahead)

    try:
        now      = datetime.now()
        end_time = now + timedelta(days=days_ahead)

        # Busy times fetch karo
        body = {
            "timeMin": now.isoformat() + "Z",
            "timeMax": end_time.isoformat() + "Z",
            "timeZone": TIMEZONE,
            "items": [{"id": CALENDAR_ID}]
        }
        result    = service.freebusy().query(body=body).execute()
        busy_list = result.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])

        # Available slots generate karo (9am-6pm, weekdays)
        slots     = []
        check_day = now + timedelta(days=1)

        while check_day <= end_time and len(slots) < 5:
            if check_day.weekday() < 5:  # Monday-Friday
                for hour in [10, 11, 14, 15, 16]:
                    slot_start = check_day.replace(
                        hour=hour, minute=0, second=0, microsecond=0
                    )
                    slot_end = slot_start + timedelta(minutes=30)

                    # Check karo ki busy nahi hai
                    is_busy = False
                    for busy in busy_list:
                        busy_start = date_parser.parse(busy["start"]).replace(tzinfo=None)
                        busy_end   = date_parser.parse(busy["end"]).replace(tzinfo=None)
                        if slot_start < busy_end and slot_end > busy_start:
                            is_busy = True
                            break

                    if not is_busy:
                        slots.append(slot_start.strftime("%A, %B %d at %I:%M %p IST"))
                        if len(slots) >= 5:
                            break

            check_day += timedelta(days=1)

        return slots if slots else _default_slots(days_ahead)

    except Exception as e:
        log.error(f"[Calendar] Error fetching slots: {e}")
        return _default_slots(days_ahead)


def _default_slots(days_ahead: int = 7) -> list:
    """Calendar nahi hai toh default slots return karo."""
    slots = []
    now   = datetime.now()
    day   = now + timedelta(days=1)
    while len(slots) < 5:
        if day.weekday() < 5:
            slots.append(day.replace(hour=11, minute=0).strftime("%A, %B %d at 11:00 AM IST"))
            slots.append(day.replace(hour=14, minute=0).strftime("%A, %B %d at 02:00 PM IST"))
        day += timedelta(days=1)
    return slots[:5]


def _save_booking_locally(
    name, email, phone, topic,
    start_dt, end_dt,
    extra_data: dict = None
) -> dict:
    """Fallback — local file mein save karo."""
    booking = {
        "timestamp":    datetime.now().isoformat(),
        "name":         name,
        "email":        email,
        "phone":        phone,
        "topic":        topic,
        "start_time":   start_dt.isoformat(),
        "end_time":     end_dt.isoformat(),
        "status":       "pending_confirmation",
        "calendar":     "local_only"
    }
    if extra_data:
        booking.update(extra_data)

    os.makedirs("bookings", exist_ok=True)
    fname = f"bookings/booking_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(fname, "w") as f:
        json.dump(booking, f, indent=2)

    log.info(f"[Calendar] Booking saved locally → {fname}")
    return {
        "status":     "success",
        "start_time": start_dt.strftime("%A, %B %d at %I:%M %p IST"),
        "message": (
            f"Consultation scheduled for {start_dt.strftime('%A, %B %d at %I:%M %p IST')}. "
            f"BluQQ team will confirm within 2 hours."
        )
    }


def cancel_event(event_id: str) -> dict:
    """Event cancel karo."""
    service = get_calendar_service()
    if not service:
        return {"status": "error", "message": "Calendar not connected"}
    try:
        service.events().delete(
            calendarId  = CALENDAR_ID,
            eventId     = event_id,
            sendUpdates = "all"
        ).execute()
        log.info(f"[Calendar] Event cancelled: {event_id}")
        return {"status": "success", "message": "Consultation cancelled. Attendees notified."}
    except Exception as e:
        log.error(f"[Calendar] Cancel error: {e}")
        return {"status": "error", "message": str(e)}


def get_calendar_stats() -> dict:
    return {
        "connected":  calendar_ok(),
        "calendar_id": CALENDAR_ID,
        "team_email":  TEAM_EMAIL,
        "timezone":    TIMEZONE
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test — seedha chalao
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Calendar Test\n" + "─" * 40)
    print(f"Connected: {calendar_ok()}")
    print(f"\nAvailable slots:")
    for slot in get_available_slots():
        print(f"  → {slot}")

    print(f"\nTest booking:")
    result = create_consultation_event(
        name           = "Test User",
        email          = "test@example.com",
        phone          = "+919876543210",
        topic          = "Trading tools inquiry",
        preferred_time = "tomorrow 11am"
    )
    print(json.dumps(result, indent=2))