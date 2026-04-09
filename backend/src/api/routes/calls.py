import os
import traceback
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from twilio.rest import Client
from src.config.settings import get_settings
from src.config.database import query as db_query
from src.middleware.auth_middleware import get_current_user

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
    if phone.startswith("+"):                       return phone
    if phone.startswith("00"):                      return "+" + phone[2:]
    if phone.startswith("0"):                       return "+91" + phone[1:]
    if phone.startswith("91") and len(phone) == 12: return "+" + phone
    if len(phone) == 10:                            return "+91" + phone
    return "+" + phone


# ── DB se Twilio credentials lo — org specific ────────────────

def get_twilio_from_db(org_id: str) -> dict:
    """
    Specific org ka Twilio config DB se lo.
    Koi .env fallback nahi.
    """
    try:
        result = db_query(
            """SELECT
                twilio_account_sid,
                twilio_auth_token,
                twilio_phone_number,
                org_id
               FROM channels
               WHERE org_id  = %s
               AND platform  = 'twilio'
               AND is_active = TRUE
               ORDER BY created_at DESC
               LIMIT 1""",
            (org_id,),
            fetch="one"
        )

        if not result:
            raise HTTPException(
                503,
                "Twilio not configured — go to Settings → Channels and add your Twilio credentials"
            )
        if not result.get("twilio_account_sid"):
            raise HTTPException(503, "Twilio Account SID missing — update in Settings → Channels")
        if not result.get("twilio_auth_token"):
            raise HTTPException(503, "Twilio Auth Token missing — update in Settings → Channels")
        if not result.get("twilio_phone_number"):
            raise HTTPException(503, "Twilio Phone Number missing — update in Settings → Channels")

        print(f"[Twilio] ✅ DB se liya — {result['twilio_phone_number']} | org: {org_id}")
        return dict(result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Twilio DB] ❌ Error: {e}")
        raise HTTPException(503, "Could not fetch Twilio credentials — check Settings → Channels")


# ── Twilio Config — GET ───────────────────────────────────────

@router.get("/config")
async def get_twilio_config(
    user: dict = Depends(get_current_user)
):
    """Current user ke org ka Twilio config DB se lo."""
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(401, "org_id not found in token")

    try:
        result = db_query(
            """SELECT
                twilio_phone_number,
                twilio_account_sid,
                is_active,
                created_at
               FROM channels
               WHERE org_id  = %s
               AND platform  = 'twilio'
               AND is_active = TRUE
               ORDER BY created_at DESC
               LIMIT 1""",
            (org_id,),
            fetch="one"
        )

        if not result:
            raise HTTPException(
                404,
                "Twilio not configured — add credentials in Settings → Channels"
            )

        return {
            "account_sid":  result["twilio_account_sid"],
            "phone_number": result["twilio_phone_number"],
            "is_active":    result["is_active"],
            "created_at":   str(result["created_at"]) if result["created_at"] else None,
            "source":       "database"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load config: {str(e)}")


# ── Twilio Config — POST ──────────────────────────────────────

@router.post("/config")
async def save_twilio_config(
    body: TwilioConfigRequest,
    user: dict = Depends(get_current_user)
):
    """Current user ke org ka Twilio config DB mein save karo."""

    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(401, "org_id not found in token")

    # ── Validation ────────────────────────────────────────────
    if not body.account_sid.startswith("AC"):
        raise HTTPException(400, "Account SID must start with 'AC'")
    if not body.phone_number.startswith("+"):
        raise HTTPException(400, "Phone number must be in E.164 format (e.g. +14155552671)")

    # ── Twilio se verify karo ─────────────────────────────────
    try:
        client = Client(body.account_sid, body.auth_token)
        client.api.accounts(body.account_sid).fetch()
    except Exception:
        raise HTTPException(401, "Invalid Twilio credentials — check Account SID and Auth Token")

    try:
        # ── Existing check karo ───────────────────────────────
        existing = db_query(
            """SELECT id FROM channels
               WHERE org_id = %s AND platform = 'twilio'
               LIMIT 1""",
            (org_id,),
            fetch="one"
        )

        if existing:
            # ── Update ────────────────────────────────────────
            db_query(
                """UPDATE channels SET
                     twilio_phone_number = %s,
                     twilio_account_sid  = %s,
                     twilio_auth_token   = %s,
                     access_token        = %s,
                     phone_number_id     = %s,
                     account_name        = 'Twilio — AI Calling',
                     is_active           = TRUE
                   WHERE org_id = %s AND platform = 'twilio'""",
                (
                    body.phone_number,
                    body.account_sid,
                    body.auth_token,
                    body.auth_token,    # access_token NOT NULL
                    body.phone_number,  # phone_number_id NOT NULL
                    org_id
                ),
                fetch="none"
            )
            print(f"[Twilio Config] ✅ Updated — org: {org_id}")
        else:
            # ── Insert ────────────────────────────────────────
            db_query(
                """INSERT INTO channels
                   (org_id, platform, account_name,
                    phone_number_id, access_token,
                    twilio_phone_number, twilio_account_sid,
                    twilio_auth_token, is_active, created_at)
                   VALUES (%s, 'twilio', 'Twilio — AI Calling',
                           %s, %s, %s, %s, %s, TRUE, NOW())""",
                (
                    org_id,
                    body.phone_number,  # phone_number_id
                    body.auth_token,    # access_token
                    body.phone_number,  # twilio_phone_number
                    body.account_sid,   # twilio_account_sid
                    body.auth_token,    # twilio_auth_token
                ),
                fetch="none"
            )
            print(f"[Twilio Config] ✅ Inserted — org: {org_id}")

        return {
            "status":       "success",
            "message":      "Twilio configured successfully",
            "account_sid":  body.account_sid,
            "phone_number": body.phone_number,
            "is_active":    True,
            "source":       "database"
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Failed to save config: {str(e)}")


# ── Outbound Call ─────────────────────────────────────────────

@router.post("/outbound", response_model=OutboundCallResponse)
async def make_outbound_call(
    body: OutboundCallRequest,
    user: dict = Depends(get_current_user)
):
    if not body.lead_phone:
        raise HTTPException(400, "Lead phone number is required")

    if not settings.SERVER_URL:
        raise HTTPException(503, "SERVER_URL not set in .env")

    # ── Token se org_id lo ────────────────────────────────────
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(401, "org_id not found in token")

    # ── Us org ka Twilio DB se lo — no fallback ───────────────
    creds = get_twilio_from_db(org_id)
    phone = normalize_phone(body.lead_phone)

    try:
        client    = Client(creds["account_sid"], creds["auth_token"])
        twiml_url = f"{settings.SERVER_URL}/incoming-call"

        print(f"[Outbound Call] org_id: {org_id}")
        print(f"[Outbound Call] From  : {creds['phone_number']}")
        print(f"[Outbound Call] To    : {phone}")
        print(f"[Outbound Call] TwiML : {twiml_url}")

        call = client.calls.create(
            to=phone,
            from_=creds["phone_number"],
            url=twiml_url,
            method="POST",
        )

        print(f"[Outbound Call] ✅ SID: {call.sid}")

        return OutboundCallResponse(
            status="initiated",
            call_sid=call.sid,
            message=f"Call initiated to {phone} — Priya will connect shortly"
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()

        if "21211" in error_msg:
            raise HTTPException(400, f"Invalid phone number: {phone}")
        elif "21214" in error_msg:
            raise HTTPException(400, "Cannot call this number (landline or invalid)")
        elif "20003" in error_msg:
            raise HTTPException(401, "Twilio auth failed — update in Settings → Channels")
        elif "21606" in error_msg:
            raise HTTPException(400, "Phone number not in your Twilio account")
        elif "21219" in error_msg:
            raise HTTPException(403,
                f"Trial restriction: {phone} not verified. "
                "Twilio Console → Verified Caller IDs."
            )
        else:
            raise HTTPException(500, f"Twilio error: {error_msg}")


# ── Call Status ───────────────────────────────────────────────

@router.get("/status/{call_sid}")
async def get_call_status(
    call_sid: str,
    user: dict = Depends(get_current_user)
):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(401, "org_id not found in token")

    try:
        creds  = get_twilio_from_db(org_id)
        client = Client(creds["account_sid"], creds["auth_token"])
        call   = client.calls(call_sid).fetch()

        from_number = (
            getattr(call, "from_", None) or
            getattr(call, "from_formatted", None) or
            "unknown"
        )

        print(f"[Call Status] SID={call_sid[:12]}... | status='{call.status}'")

        return {
            "call_sid":  call.sid,
            "status":    call.status,
            "duration":  call.duration,
            "direction": call.direction,
            "to":        call.to,
            "from":      from_number,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Call Status] {str(e)}")
        return {
            "call_sid":  call_sid,
            "status":    "completed",
            "duration":  "0",
            "from":      "unknown",
            "to":        "unknown",
            "direction": "outbound-api",
            "message":   "Call completed or archived"
        }
