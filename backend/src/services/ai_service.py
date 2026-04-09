import json
from src.ai.analyzer import analyze_lead_with_ai
from src.ai.scorer   import score_lead
from src.config.database import query
from src.models.lead import update_lead, create_lead_event


def run_analysis_and_score(lead: dict) -> dict:
    """
    Full pipeline:
    1. GPT-4 analysis
    2. Hybrid scoring (rules + AI)
    3. Save to DB
    4. Update lead score + priority
    5. Log event
    6. Auto send first WhatsApp message if High priority
    """
    lead_id = str(lead["id"])

    # Step 1 — AI Analysis
    ai_result = analyze_lead_with_ai(lead)

    # Step 2 — Hybrid Scoring
    scoring = score_lead(lead, ai_result)

    # Step 3 — Save analysis to DB
    saved_analysis = query(
        """
        INSERT INTO lead_ai_analysis (
            lead_id, summary, intent, urgency,
            qualification_label, recommended_action,
            confidence, raw_ai_response
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (lead_id)
        DO UPDATE SET
            summary             = EXCLUDED.summary,
            intent              = EXCLUDED.intent,
            urgency             = EXCLUDED.urgency,
            qualification_label = EXCLUDED.qualification_label,
            recommended_action  = EXCLUDED.recommended_action,
            confidence          = EXCLUDED.confidence,
            raw_ai_response     = EXCLUDED.raw_ai_response,
            analyzed_at         = NOW()
        RETURNING *
        """,
        (
            lead_id,
            ai_result["summary"],
            ai_result["intent"],
            ai_result["urgency"],
            ai_result["qualification_label"],
            ai_result["recommended_action"],
            ai_result["confidence"],
            json.dumps({
                "ai_analysis":     ai_result["raw_ai_response"],
                "score_breakdown": scoring["breakdown"]
            })
        ),
        fetch="one"
    )

    # Step 4 — Update lead
    update_lead(lead_id, {
        "score":    scoring["score"],
        "priority": scoring["priority"]
    })

    # Step 5 — Log event
    create_lead_event(
        lead_id=lead_id,
        event_type="ai_analyzed",
        event_data={
            "score":      scoring["score"],
            "priority":   scoring["priority"],
            "rule_score": scoring["breakdown"]["rule_score"],
            "ai_adj":     scoring["breakdown"]["ai_adjustment"],
        }
    )

    # ── Step 6 — Auto send first WhatsApp message if High priority ──
    priority = scoring["priority"]
    org_id   = lead.get("org_id")
    phone    = lead.get("phone")

    if priority == "High" and org_id and phone:
        try:
            # Check if this org has auto_send_first enabled
            config = query(
                "SELECT auto_send_first FROM org_ai_config WHERE org_id = %s",
                (org_id,), fetch="one"
            )

            if config and config.get("auto_send_first"):
                print(f"[AI CHAT] Auto send enabled — drafting first message for {lead.get('name')}")

                from src.services.ai_chat_service import generate_first_message
                from src.services.message_service import send_message_to_lead
                import asyncio

                # Generate personalised first message
                first_msg = generate_first_message(org_id, lead_id)

                if first_msg:
                    print(f"[AI CHAT] Sending: {first_msg[:60]}...")
                    asyncio.run(
                        send_message_to_lead(
                            org_id=org_id,
                            lead_id=lead_id,
                            platform="whatsapp",
                            message=first_msg
                        )
                    )
                    print(f"[AI CHAT] First message sent to {lead.get('name')}")
            else:
                print(f"[AI CHAT] Auto send disabled for org {org_id} — skipping")

        except Exception as e:
            # Never crash the scoring pipeline because of messaging
            print(f"[AI CHAT] Auto first message failed: {e}")
            import traceback
            traceback.print_exc()

    return dict(saved_analysis)