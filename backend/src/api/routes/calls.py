import os
import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from twilio.rest import Client
from src.config.settings import get_settings

router   = APIRouter()
settings = get_settings()


class OutboundCallRequest(BaseModel):
    lead_phone: str
    lead_name:  str = ""
    lead_id:    str = ""


class OutboundCallResponse(BaseModel):
    status:   str
    call_sid: str
    message:  str


def normalize_phone(phone: str) -> str:
    """
    Phone number ko E.164 format mein convert karo.
    +918871832955  →  +918871832955  ✅
    918871832955   →  +918871832955  ✅
    08871832955    →  +918871832955  ✅
    8871832955     →  +918871832955  ✅
    """
    phone = phone.strip().replace(" ", "").replace("-", "")

    if phone.startswith("+"):
        return phone                        # Already correct

    if phone.startswith("00"):
        return "+" + phone[2:]              # 0091... → +91...

    if phone.startswith("0"):
        return "+91" + phone[1:]            # 08871... → +918871...

    if phone.startswith("91") and len(phone) == 12:
        return "+" + phone                  # 918871... → +918871...

    if len(phone) == 10:
        return "+91" + phone                # 8871832955 → +918871832955

    return "+" + phone                      # Fallback


@router.post("/outbound", response_model=OutboundCallResponse)
async def make_outbound_call(body: OutboundCallRequest):
    """
    Twilio se lead ke phone pe outbound call karo.
    Call connect hone par Priya (AI) /incoming-call pe handle karegi.
    """

    # ── Validation ─────────────────────────────────────────────
    if not body.lead_phone:
        raise HTTPException(400, "Lead phone number required hai")

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(503, "Twilio credentials configure nahi hain — .env check karo")

    if not settings.TWILIO_PHONE_NUMBER:
        raise HTTPException(503, "TWILIO_PHONE_NUMBER .env mein set karo")

    if not settings.SERVER_URL:
        raise HTTPException(503, "SERVER_URL .env mein set karo (ngrok ya production URL)")

    # ── Number normalize karo ───────────────────────────────────
    phone = normalize_phone(body.lead_phone)

    # ── Twilio call initiate karo ───────────────────────────────
    try:
        client    = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        twiml_url = f"{settings.SERVER_URL}/incoming-call"

        call = client.calls.create(
            to=phone,
            from_=settings.TWILIO_PHONE_NUMBER,
            url=twiml_url,
            method="POST",
        )

        return OutboundCallResponse(
            status="initiated",
            call_sid=call.sid,
            message=f"Call initiated to {phone} — Priya connect karegi"
        )

    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()

        # ── Twilio error codes — samajhne layak messages ────────
        if "21211" in error_msg:
            raise HTTPException(400, f"Invalid phone number format: {phone}")
        elif "21214" in error_msg:
            raise HTTPException(400, "Is number pe call nahi ho sakti (landline/invalid)")
        elif "20003" in error_msg:
            raise HTTPException(401, "Twilio authentication failed — SID/Token check karo")
        elif "21606" in error_msg:
            raise HTTPException(400, "TWILIO_PHONE_NUMBER aapke account mein nahi hai")
        elif "21219" in error_msg:
            raise HTTPException(403, (
                f"Trial account restriction: {phone} verified nahi hai. "
                "Twilio Console → Phone Numbers → Verified Caller IDs pe jaake number verify karo."
            ))
        else:
            raise HTTPException(500, f"Twilio error: {error_msg}")


@router.get("/status/{call_sid}")
async def get_call_status(call_sid: str):
    """Twilio se live call status check karo."""
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        call   = client.calls(call_sid).fetch()
        return {
            "call_sid":  call.sid,
            "status":    call.status,
            "duration":  call.duration,
            "direction": call.direction,
            "to":        call.to,
            "from":      call.from_,
        }
    except Exception as e:
        raise HTTPException(404, f"Call nahi mila: {str(e)}")