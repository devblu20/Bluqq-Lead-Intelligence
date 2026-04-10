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
    NOTE: Auto WhatsApp message DISABLED — first message must be sent manually from dashboard.
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

    # Step 6 REMOVED — Auto WhatsApp message disabled.
    # First message must be sent MANUALLY from the dashboard.
    # When agent clicks "Send" on dashboard → conversation starts.
    # After that, AI auto-replies to all inbound messages automatically.

    return dict(saved_analysis)