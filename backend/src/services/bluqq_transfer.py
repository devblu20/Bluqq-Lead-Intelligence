"""
BluQQ Human Transfer Module
────────────────────────────
Caller ko live agent se connect karta hai.
Twilio Conference API use karta hai.
"""

import os
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("bluqq")

AGENT_PHONE    = os.environ.get("AGENT_PHONE_NUMBER", "")
TWILIO_SID     = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN   = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM    = os.environ.get("TWILIO_PHONE_NUMBER", "")
SERVER_URL     = os.environ.get("SERVER_URL", "")

_twilio_client = None


def get_twilio_client():
    global _twilio_client
    if _twilio_client:
        return _twilio_client
    try:
        from twilio.rest import Client
        _twilio_client = Client(TWILIO_SID, TWILIO_TOKEN)
        log.info("[Transfer] ✅ Twilio client ready")
        return _twilio_client
    except Exception as e:
        log.warning(f"[Transfer] ⚠ Twilio client failed: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFER TRIGGER DETECTION
# ─────────────────────────────────────────────────────────────────────────────

TRANSFER_PHRASES = [
    "transfer to human",
    "talk to a person",
    "talk to someone",
    "speak to an agent",
    "speak to a human",
    "real person",
    "live agent",
    "human agent",
    "connect me to",
    "i want to speak",
    "let me speak",
    "give me your number",
    "this is not helpful",
    "you are not helping",
    "useless",
    "manager",
    "supervisor",
    "escalate",
    "frustrated",
    "not satisfied",
    "TRANSFER_TO_HUMAN",
]


def should_transfer(text: str) -> bool:
    """
    Check karo ki caller ya AI ne transfer phrase use kiya.
    Returns True agar transfer karna chahiye.
    """
    text_lower = text.lower()
    for phrase in TRANSFER_PHRASES:
        if phrase.lower() in text_lower:
            log.info(f"[Transfer] Trigger detected: '{phrase}' in: {text[:60]}")
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFER EXECUTION
# ─────────────────────────────────────────────────────────────────────────────

def create_conference_twiml(conf_name: str, hold_music: bool = True) -> str:
    """Caller ke liye conference TwiML banao."""
    hold = f'<Play loop="10">https://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP.mp3</Play>' if hold_music else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you to a BluQQ team member.</Say>
  <Dial>
    <Conference
      waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.sounds.music"
      waitMethod="GET"
      beep="false"
      startConferenceOnEnter="false"
      endConferenceOnExit="true"
      record="record-from-start"
    >{conf_name}</Conference>
  </Dial>
</Response>"""


def agent_conference_twiml(conf_name: str) -> str:
    """Agent ke liye conference TwiML banao."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to the caller now.</Say>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="true"
    >{conf_name}</Conference>
  </Dial>
</Response>"""


async def initiate_transfer(
    call_sid:     str,
    session_id:   str,
    caller_phone: str,
    reason:       str,
    transcript:   list,
    stream_sid:   str = None
) -> dict:
    """
    Human transfer shuru karo.
    1. Conference room banao
    2. Agent ko call karo
    3. Caller ko conference mein daldo
    Returns transfer result.
    """
    conf_name = f"bluqq-transfer-{session_id}"

    log.info(f"[Transfer] Initiating transfer — reason: {reason}")
    log.info(f"[Transfer] Conference: {conf_name}")
    log.info(f"[Transfer] Agent: {AGENT_PHONE or 'Not configured'}")

    # Transfer log save karo
    transfer_log = {
        "timestamp":    datetime.now().isoformat(),
        "session_id":   session_id,
        "caller_phone": caller_phone,
        "reason":       reason,
        "conf_name":    conf_name,
        "agent_phone":  AGENT_PHONE,
        "last_transcript": transcript[-5:] if transcript else []
    }
    os.makedirs("transfers", exist_ok=True)
    fname = f"transfers/transfer_{session_id}.json"
    with open(fname, "w") as f:
        json.dump(transfer_log, f, indent=2, ensure_ascii=False)
    log.info(f"[Transfer] Log saved → {fname}")

    # Twilio available hai?
    client = get_twilio_client()

    if not client or not AGENT_PHONE:
        log.warning("[Transfer] No Twilio client or agent phone — fallback mode")
        return {
            "status":   "fallback",
            "message":  (
                "I understand you need further assistance. "
                "Please call us directly at our office number, "
                "or we will have a team member call you back within 15 minutes."
            ),
            "conf_name": conf_name
        }

    try:
        # Agent ko outbound call karo
        agent_call = client.calls.create(
            to   = AGENT_PHONE,
            from_= TWILIO_FROM,
            twiml= agent_conference_twiml(conf_name),
        )
        log.info(f"[Transfer] Agent call initiated: {agent_call.sid}")

        # Call summary banao agent ke liye
        recent_turns = [
            f"{t['role'].upper()}: {t['text']}"
            for t in transcript[-3:]
            if t["role"] in ("caller", "ai")
        ]
        summary = " | ".join(recent_turns)

        return {
            "status":        "success",
            "conf_name":     conf_name,
            "agent_call_sid": agent_call.sid,
            "message": (
                "Please hold for just a moment. "
                "I am connecting you to a BluQQ team member right now. "
                "They will be with you shortly."
            ),
            "twiml_for_caller": create_conference_twiml(conf_name),
            "summary":          summary
        }

    except Exception as e:
        log.error(f"[Transfer] Error: {e}")
        return {
            "status":  "error",
            "message": (
                "I apologize for the inconvenience. "
                "Please call us directly at info@bluqq.com "
                "or we will call you back within 15 minutes."
            )
        }


def get_transfer_stats() -> dict:
    """Transfer statistics."""
    total = 0
    if os.path.exists("transfers"):
        total = len([f for f in os.listdir("transfers") if f.endswith(".json")])
    return {
        "total_transfers": total,
        "agent_configured": bool(AGENT_PHONE),
        "agent_phone": AGENT_PHONE or "Not set"
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Transfer Module Test\n" + "─" * 40)
    print(f"Agent configured: {bool(AGENT_PHONE)}")
    print(f"Agent phone: {AGENT_PHONE or 'Not set — add AGENT_PHONE_NUMBER to .env'}")

    test_phrases = [
        "I want to talk to a real person",
        "This is not helpful at all",
        "Can I speak to a manager?",
        "TRANSFER_TO_HUMAN",
        "What is the pricing for dashboard?",  # Should NOT trigger
    ]
    print("\nTrigger detection test:")
    for phrase in test_phrases:
        result = should_transfer(phrase)
        print(f"  {'🔴 TRANSFER' if result else '🟢 NO transfer'}: {phrase}")