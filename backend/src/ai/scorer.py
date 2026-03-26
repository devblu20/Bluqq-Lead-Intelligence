import re


def _score_rules(lead: dict) -> tuple[int, list[str]]:
    """
    Pure business rules scoring.
    Returns (score, list of reasons for transparency).
    """
    score   = 0
    reasons = []

    # ── 1. Contact Completeness (0–30 pts) ──────────────
    if lead.get("phone"):
        score += 15
        reasons.append("✓ Phone number provided (+15)")
    else:
        reasons.append("✗ No phone number (0)")

    if lead.get("company"):
        score += 10
        reasons.append("✓ Company name provided (+10)")
    else:
        reasons.append("✗ No company name (0)")

    email = (lead.get("email") or "").strip().lower()
    if email:
        free_domains = {
            "gmail.com", "yahoo.com", "hotmail.com",
            "outlook.com", "icloud.com", "live.com",
            "protonmail.com", "aol.com", "msn.com"
        }
        domain = email.split("@")[-1] if "@" in email else ""
        if domain and domain not in free_domains:
            score += 10
            reasons.append(f"✓ Business email ({domain}) (+10)")
        else:
            score += 3
            reasons.append("~ Free email provider (+3)")
    else:
        reasons.append("✗ No email provided (0)")

    # ── 2. Source Quality (0–15 pts) ────────────────────
    source_map = {
        "LinkedIn": (15, "✓ LinkedIn — high intent source (+15)"),
        "Upwork":   (12, "✓ Upwork — ready-to-hire signal (+12)"),
        "Website":  ( 8, "~ Website — organic interest (+8)"),
        "Email":    ( 6, "~ Email outreach (+6)"),
        "Manual":   ( 3, "~ Manually entered lead (+3)"),
    }
    src_score, src_reason = source_map.get(
        lead.get("source", "Manual"),
        (3, "~ Unknown source (+3)")
    )
    score += src_score
    reasons.append(src_reason)

    # ── 3. Service Interest Clarity (0–10 pts) ──────────
    service = (lead.get("service_interest") or "").strip().lower()
    high_value = {
        "ai automation", "chatbot", "workflow automation",
        "crm integration", "custom software", "data analytics"
    }
    if service:
        if any(h in service for h in high_value):
            score += 10
            reasons.append(f"✓ High-value service interest: {service} (+10)")
        else:
            score += 5
            reasons.append(f"~ General service interest: {service} (+5)")
    else:
        reasons.append("✗ No service interest specified (0)")

    # ── 4. Message Quality Signals (0–25 pts) ───────────
    message = (lead.get("message") or "").lower()
    msg_score = 0

    # Buying intent signals
    demo_signals = [
        "demo", "call", "meeting", "schedule",
        "book", "appointment", "talk"
    ]
    pricing_signals = [
        "price", "pricing", "cost", "budget",
        "quote", "proposal", "how much"
    ]
    urgency_signals = [
        "asap", "urgent", "immediately", "this week",
        "this month", "soon", "quickly", "right away"
    ]
    timeline_signals = [
        "by", "deadline", "launch", "go live",
        "quarter", "q1", "q2", "q3", "q4"
    ]
    clarity_signals = [
        "we need", "we want", "looking for", "require",
        "our team", "our company", "our business",
        "we are", "we have"
    ]

    if any(s in message for s in demo_signals):
        msg_score += 8
        reasons.append("✓ Requested demo/call/meeting (+8)")

    if any(s in message for s in pricing_signals):
        msg_score += 7
        reasons.append("✓ Mentioned pricing/budget (+7)")

    if any(s in message for s in urgency_signals):
        msg_score += 5
        reasons.append("✓ Urgency language detected (+5)")

    if any(s in message for s in timeline_signals):
        msg_score += 4
        reasons.append("✓ Timeline signal detected (+4)")

    if any(s in message for s in clarity_signals):
        msg_score += 3
        reasons.append("✓ Clear business context (+3)")

    # Message length — longer = more context = more serious
    word_count = len(message.split())
    if word_count >= 50:
        msg_score += 3
        reasons.append(f"✓ Detailed message ({word_count} words) (+3)")
    elif word_count >= 20:
        msg_score += 1
        reasons.append(f"~ Moderate message length ({word_count} words) (+1)")
    else:
        reasons.append(f"✗ Short message ({word_count} words) (0)")

    # Cap message score at 25
    msg_score = min(25, msg_score)
    score += msg_score

    return score, reasons


def _ai_adjustment(ai_result: dict) -> tuple[int, list[str]]:
    """
    AI provides an adjustment on top of rule score (-10 to +20).
    AI interprets context that rules can't — tone, specificity,
    implied urgency, credibility signals.
    """
    adjustment = 0
    reasons    = []

    # Qualification label adjustment
    qual_map = {
        "Qualified": (+20, "🤖 AI: Lead is Qualified (+20)"),
        "Potential": (+ 8, "🤖 AI: Lead shows Potential (+8)"),
        "Weak":      (- 5, "🤖 AI: Weak lead signal (-5)"),
        "Spam":      (-10, "🤖 AI: Spam/irrelevant (-10)"),
    }
    qual = ai_result.get("qualification_label", "Potential")
    adj, reason = qual_map.get(qual, (0, "🤖 AI: Neutral assessment (0)"))
    adjustment += adj
    reasons.append(reason)

    # Urgency adjustment
    urgency_map = {
        "high":   (+8, "🤖 AI: High urgency detected (+8)"),
        "medium": (+4, "🤖 AI: Medium urgency (+4)"),
        "low":    ( 0, "🤖 AI: Low urgency (0)"),
    }
    urg = ai_result.get("urgency", "low")
    adj, reason = urgency_map.get(urg, (0, ""))
    adjustment += adj
    if reason:
        reasons.append(reason)

    # Intent adjustment
    intent_map = {
        "purchase":   (+7, "🤖 AI: Purchase intent (+7)"),
        "explore":    (+3, "🤖 AI: Exploring options (+3)"),
        "comparison": (+2, "🤖 AI: Comparing vendors (+2)"),
        "unclear":    ( 0, "🤖 AI: Unclear intent (0)"),
    }
    intent = ai_result.get("intent", "unclear")
    adj, reason = intent_map.get(intent, (0, ""))
    adjustment += adj
    if reason:
        reasons.append(reason)

    return adjustment, reasons


def score_lead(lead: dict, ai_result: dict) -> dict:
    """
    Hybrid scoring:
    - Business rules:  up to 80 pts (transparent, deterministic)
    - AI adjustment:   -10 to +35 pts (contextual interpretation)
    - Final score:     0–100

    Priority bands:
    - High:   75–100
    - Medium: 50–74
    - Low:    0–49
    """

    # Step 1 — Run business rules
    rule_score, rule_reasons = _score_rules(lead)

    # Step 2 — Get AI adjustment
    ai_adj, ai_reasons = _ai_adjustment(ai_result)

    # Step 3 — Combine
    raw_score    = rule_score + ai_adj
    final_score  = min(100, max(0, raw_score))

    # Step 4 — Priority band
    if final_score >= 75:
        priority = "High"
    elif final_score >= 50:
        priority = "Medium"
    else:
        priority = "Low"

    # Step 5 — Build transparent breakdown
    breakdown = {
        "rule_score":    rule_score,
        "ai_adjustment": ai_adj,
        "final_score":   final_score,
        "rule_reasons":  rule_reasons,
        "ai_reasons":    ai_reasons,
        "qualification": ai_result.get("qualification_label"),
        "urgency":       ai_result.get("urgency"),
        "intent":        ai_result.get("intent"),
    }

    print(f"\n[SCORER] Lead: {lead.get('name')}")
    print(f"[SCORER] Rule score: {rule_score} | AI adj: {ai_adj:+d} | Final: {final_score} → {priority}")
    for r in rule_reasons + ai_reasons:
        print(f"[SCORER]   {r}")

    return {
        "score":     final_score,
        "priority":  priority,
        "breakdown": breakdown
    }