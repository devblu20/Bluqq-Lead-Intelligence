from fastapi import APIRouter, Request, HTTPException
from src.config.database import query
from src.services.message_service import save_conversation
import json

router = APIRouter()


def find_org_by_phone_id(phone_number_id: str) -> dict:
    result = query(
        """
        SELECT c.*, o.id as organisation_id
        FROM channels c
        JOIN organisations o ON o.id = c.org_id
        WHERE c.phone_number_id = %s AND c.is_active = TRUE
        LIMIT 1
        """,
        (phone_number_id,), fetch="one"
    )
    return dict(result) if result else None


def find_lead_by_phone(phone: str, org_id: str) -> dict:
    cleaned = ''.join(filter(str.isdigit, phone))
    result = query(
        """
        SELECT * FROM leads
        WHERE org_id = %s AND (
            phone = %s OR
            phone = %s OR
            phone = '+' || %s
        )
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (org_id, cleaned, '+' + cleaned, cleaned),
        fetch="one"
    )
    return dict(result) if result else None


@router.get("/whatsapp")
async def verify_webhook(request: Request):
    params    = dict(request.query_params)
    mode      = params.get("hub.mode")
    token     = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    VERIFY_TOKEN = "bluqq_webhook_2026"

    if mode == "subscribe" and token == VERIFY_TOKEN:
        print("[WEBHOOK] Verified successfully")
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def receive_whatsapp(request: Request):
    import threading

    body = await request.json()
    print(f"[WEBHOOK] Received: {json.dumps(body)[:200]}")

    try:
        entry           = body.get("entry", [{}])[0]
        changes         = entry.get("changes", [{}])[0]
        value           = changes.get("value", {})
        phone_number_id = value.get("metadata", {}).get("phone_number_id")
        messages        = value.get("messages", [])

        if not messages or not phone_number_id:
            return {"status": "ok"}

        msg      = messages[0]
        msg_type = msg.get("type")

        if msg_type != "text":
            return {"status": "ok"}

        from_number      = msg.get("from")
        incoming_message = msg.get("text", {}).get("body", "")
        meta_msg_id      = msg.get("id")

        print(f"[WEBHOOK] From: {from_number} — Message: {incoming_message[:60]}")

        # Find org
        channel = find_org_by_phone_id(phone_number_id)
        if not channel:
            print(f"[WEBHOOK] No org found for phone_number_id: {phone_number_id}")
            return {"status": "ok"}

        org_id = str(channel["org_id"])

        # Find lead
        lead = find_lead_by_phone(from_number, org_id)
        if not lead:
            print(f"[WEBHOOK] No lead found for phone: {from_number} in org: {org_id}")
            return {"status": "ok"}

        lead_id   = str(lead["id"])
        lead_name = lead.get("name", "unknown")

        print(f"[WEBHOOK] Lead matched: {lead_name} (id: {lead_id}) | org: {org_id}")

        # Save inbound message
        save_conversation(
            org_id=org_id,
            lead_id=lead_id,
            platform="whatsapp",
            direction="inbound",
            message=incoming_message,
            meta_msg_id=meta_msg_id
        )

        print(f"[WEBHOOK] Saved inbound message for lead: {lead_name}")

        # ── AUTO REPLY — only if we've spoken to this lead before ──
        # If no outbound message exists, skip auto-reply.
        # The team must send the first message manually from the dashboard.
        prior_outbound = query(
            """
            SELECT 1 FROM conversations
            WHERE lead_id = %s AND org_id = %s AND direction = 'outbound'
            LIMIT 1
            """,
            (lead_id, org_id), fetch="one"
        )

        if not prior_outbound:
            print(f"[WEBHOOK] No prior outbound for {lead_name} — skipping auto-reply (manual first message required)")
            return {"status": "ok"}

        # ── AUTO REPLY in background thread ──────────────
        # generate_reply is fully sync — no asyncio.run() needed
        def auto_reply(
            _org_id=org_id,
            _lead_id=lead_id,
            _lead_name=lead_name,
            _message=incoming_message
        ):
            try:
                import asyncio
                from src.services.ai_chat_service import generate_reply
                from src.services.message_service import send_message_to_lead

                print(f"[AI CHAT] Generating reply for lead: {_lead_name} (id: {_lead_id})")

                # generate_reply is sync — call directly, no await
                reply = generate_reply(
                    org_id=_org_id,
                    lead_id=_lead_id,
                    inbound_message=_message,
                    platform="whatsapp"
                )

                if reply:
                    print(f"[AI CHAT] Sending to {_lead_name}: {reply[:80]}...")
                    # send_message_to_lead is async — use asyncio.run for just this call
                    asyncio.run(send_message_to_lead(
                        org_id=_org_id,
                        lead_id=_lead_id,
                        platform="whatsapp",
                        message=reply
                    ))
                else:
                    print(f"[AI CHAT] No reply generated for {_lead_name}")

            except Exception as e:
                print(f"[WEBHOOK] Auto reply failed for {_lead_name}: {e}")
                import traceback
                traceback.print_exc()

        threading.Thread(target=auto_reply, daemon=True).start()

    except Exception as e:
        print(f"[WEBHOOK] Error: {e}")
        import traceback
        traceback.print_exc()

    return {"status": "ok"}