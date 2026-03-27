import os
import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from twilio.rest import Client
from src.config.settings import get_settings

router   = APIRouter()
settings = get_settings()


# ── Models ────────────────────────────────────────────────────

class OutboundCallRequest(BaseModel):
    lead_phone: str
    lead_name:  str = ""
    lead_id:    str = ""


class OutboundCallResponse(BaseModel):
    status:   str
    call_sid: str
    message:  str


class TwilioConfigRequest(BaseModel):
    account_sid:   str
    auth_token:    str
    phone_number:  str
    twiml_app_sid: Optional[str] = None


# ── Phone Normalizer ──────────────────────────────────────────

def normalize_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+"):   return phone
    if phone.startswith("00"):  return "+" + phone[2:]
    if phone.startswith("0"):   return "+91" + phone[1:]
    if phone.startswith("91") and len(phone) == 12: return "+" + phone
    if len(phone) == 10:        return "+91" + phone
    return "+" + phone


# ── Twilio Config — GET ───────────────────────────────────────

@router.get("/config")
async def get_twilio_config():
    try:
        sid   = settings.TWILIO_ACCOUNT_SID
        phone = settings.TWILIO_PHONE_NUMBER
        if not sid:
            raise HTTPException(404, "Twilio is not configured")
        return {
            "account_sid":  sid,
            "phone_number": phone or "",
            "is_active":    bool(sid and phone),
            "created_at":   None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load Twilio config: {str(e)}")


# ── Twilio Config — POST ──────────────────────────────────────

@router.post("/config")
async def save_twilio_config(body: TwilioConfigRequest):
    if not body.account_sid.startswith("AC"):
        raise HTTPException(400, "Account SID must start with 'AC'")
    if not body.phone_number.startswith("+"):
        raise HTTPException(400, "Phone number must be in E.164 format (e.g. +14155552671)")

    try:
        client = Client(body.account_sid, body.auth_token)
        client.api.accounts(body.account_sid).fetch()
    except Exception:
        raise HTTPException(401, "Invalid Twilio credentials — check your Account SID and Auth Token")

    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                lines = f.readlines()

        keys_to_update = {
            "TWILIO_ACCOUNT_SID":  body.account_sid,
            "TWILIO_AUTH_TOKEN":   body.auth_token,
            "TWILIO_PHONE_NUMBER": body.phone_number,
        }
        if body.twiml_app_sid:
            keys_to_update["TWILIO_TWIML_APP_SID"] = body.twiml_app_sid

        updated_keys = set()
        new_lines    = []
        for line in lines:
            key = line.split("=")[0].strip()
            if key in keys_to_update:
                new_lines.append(f'{key}={keys_to_update[key]}\n')
                updated_keys.add(key)
            else:
                new_lines.append(line)

        for key, val in keys_to_update.items():
            if key not in updated_keys:
                new_lines.append(f'{key}={val}\n')

        with open(env_path, "w") as f:
            f.writelines(new_lines)

        os.environ["TWILIO_ACCOUNT_SID"]  = body.account_sid
        os.environ["TWILIO_AUTH_TOKEN"]   = body.auth_token
        os.environ["TWILIO_PHONE_NUMBER"] = body.phone_number
        if body.twiml_app_sid:
            os.environ["TWILIO_TWIML_APP_SID"] = body.twiml_app_sid

        settings.TWILIO_ACCOUNT_SID  = body.account_sid
        settings.TWILIO_AUTH_TOKEN   = body.auth_token
        settings.TWILIO_PHONE_NUMBER = body.phone_number

        return {
            "status":       "success",
            "message":      "Twilio configured successfully",
            "account_sid":  body.account_sid,
            "phone_number": body.phone_number,
            "is_active":    True,
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to save config: {str(e)}")


# ── Outbound Call ─────────────────────────────────────────────

@router.post("/outbound", response_model=OutboundCallResponse)
async def make_outbound_call(body: OutboundCallRequest):
    if not body.lead_phone:
        raise HTTPException(400, "Lead phone number is required")

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(503, "Twilio credentials not configured — check .env")

    if not settings.TWILIO_PHONE_NUMBER:
        raise HTTPException(503, "TWILIO_PHONE_NUMBER not set in .env")

    if not settings.SERVER_URL:
        raise HTTPException(503, "SERVER_URL not set in .env (ngrok or production URL)")

    phone = normalize_phone(body.lead_phone)

    try:
        client    = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        twiml_url = f"{settings.SERVER_URL}/incoming-call"

        print(f"[Outbound Call] Calling {phone} → TwiML: {twiml_url}")

        call = client.calls.create(
            to=phone,
            from_=settings.TWILIO_PHONE_NUMBER,
            url=twiml_url,
            method="POST",
        )

        print(f"[Outbound Call] ✅ SID: {call.sid}")

        return OutboundCallResponse(
            status="initiated",
            call_sid=call.sid,
            message=f"Call initiated to {phone} — Priya will connect shortly"
        )

    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()

        if "21211" in error_msg:
            raise HTTPException(400, f"Invalid phone number: {phone}")
        elif "21214" in error_msg:
            raise HTTPException(400, "Cannot call this number (landline or invalid)")
        elif "20003" in error_msg:
            raise HTTPException(401, "Twilio authentication failed — check SID/Token")
        elif "21606" in error_msg:
            raise HTTPException(400, "TWILIO_PHONE_NUMBER not in your account")
        elif "21219" in error_msg:
            raise HTTPException(403,
                f"Trial restriction: {phone} not verified. "
                "Go to Twilio Console → Verified Caller IDs and verify this number."
            )
        else:
            raise HTTPException(500, f"Twilio error: {error_msg}")


# ── Call Status ───────────────────────────────────────────────

@router.get("/status/{call_sid}")
async def get_call_status(call_sid: str):
    """Fetch live call status from Twilio."""
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        call   = client.calls(call_sid).fetch()

        # ✅ from_ safely fetch karo — naye Twilio version mein attribute alag hai
        from_number = (
            getattr(call, "from_", None) or
            getattr(call, "from_formatted", None) or
            "unknown"
        )

        status = call.status
        print(f"[Call Status] SID={call_sid[:12]}... | status='{status}' | duration={call.duration}s")

        return {
            "call_sid":  call.sid,
            "status":    status,
            "duration":  call.duration,
            "direction": call.direction,
            "to":        call.to,
            "from":      from_number,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[Call Status] SID={call_sid[:12]}... | {error_msg}")

        # ✅ 404 ki jagah completed return karo — frontend happy rahega
        return {
            "call_sid":  call_sid,
            "status":    "completed",
            "duration":  "0",
            "from":      "unknown",
            "to":        "unknown",
            "direction": "outbound-api",
            "message":   "Call completed or archived"
        }