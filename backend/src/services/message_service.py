from fastapi import HTTPException
from src.config.database import query


def get_channel(org_id: str, platform: str) -> dict:
    result = query(
        "SELECT * FROM channels WHERE org_id = %s AND platform = %s AND is_active = TRUE LIMIT 1",
        (org_id, platform), fetch="one"
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"No {platform} channel connected. Go to Settings → Connect {platform} first."
        )
    return dict(result)


def save_conversation(org_id, lead_id, platform, direction, message,
                      ai_generated=False, meta_msg_id=None):
    result = query(
        """
        INSERT INTO conversations
            (org_id, lead_id, platform, direction, message, ai_generated, meta_msg_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
        """,
        (org_id, lead_id, platform, direction, message, ai_generated, meta_msg_id),
        fetch="one"
    )
    return dict(result)


def get_conversations(org_id: str, lead_id: str) -> list:
    results = query(
        "SELECT * FROM conversations WHERE org_id = %s AND lead_id = %s ORDER BY created_at ASC",
        (org_id, lead_id), fetch="all"
    )
    return [dict(r) for r in results] if results else []


async def send_message_to_lead(org_id, lead_id, platform, message, use_template=False):
    lead = query(
        "SELECT * FROM leads WHERE id = %s AND org_id = %s",
        (lead_id, org_id), fetch="one"
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = dict(lead)

    channel     = get_channel(org_id, platform)
    meta_msg_id = None

    # ── DEBUG: print what we are sending to Meta ──
    print(f"[WHATSAPP DEBUG] platform     : {platform}")
    print(f"[WHATSAPP DEBUG] phone        : {lead.get('phone')}")
    print(f"[WHATSAPP DEBUG] phone_num_id : {channel.get('phone_number_id')}")
    print(f"[WHATSAPP DEBUG] token_prefix : {str(channel.get('access_token', ''))[:20]}...")
    print(f"[WHATSAPP DEBUG] message      : {message[:60]}")

    if platform == "whatsapp":
        phone = lead.get("phone")
        if not phone:
            raise HTTPException(
                status_code=400,
                detail="Lead has no phone number. Add it to the lead first."
            )
        from src.services.whatsapp_service import (
            send_whatsapp_message, send_whatsapp_template
        )
        try:
            if use_template:
                result = await send_whatsapp_template(
                    phone_number_id=channel["phone_number_id"],
                    access_token=channel["access_token"],
                    to_phone=phone
                )
            else:
                result = await send_whatsapp_message(
                    phone_number_id=channel["phone_number_id"],
                    access_token=channel["access_token"],
                    to_phone=phone,
                    message=message
                )

            # ── DEBUG: print full Meta response ──
            print(f"[META RESPONSE] {result}")
            meta_msg_id = result.get("messages", [{}])[0].get("id")

        except Exception as e:
            # ── DEBUG: print full error from Meta ──
            print(f"[META ERROR] {str(e)}")
            raise HTTPException(
                status_code=400,
                detail=f"Meta API error: {str(e)}"
            )

    saved = save_conversation(
        org_id=org_id, lead_id=lead_id, platform=platform,
        direction="outbound", message=message, meta_msg_id=meta_msg_id
    )

    query(
        "UPDATE leads SET status = 'contacted' WHERE id = %s AND org_id = %s",
        (lead_id, org_id),
        fetch="none"
    )

    import json
    query(
        "INSERT INTO lead_events (lead_id, event_type, event_data) VALUES (%s, %s, %s)",
        (lead_id, f"{platform}_message_sent", json.dumps({"preview": message[:60]})),
        fetch="none"
    )

    return {
        "success":      True,
        "platform":     platform,
        "meta_msg_id":  meta_msg_id,
        "conversation": saved
    }
