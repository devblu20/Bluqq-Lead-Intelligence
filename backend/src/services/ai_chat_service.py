"""
ai_chat_service.py  —  BluQQ
Fixed for actual stack:
- psycopg2 sync query (no await)
- get_settings() instead of settings
- orchestrate() signature: org_id, lead_id, platform, message, service_interest
- %s placeholders (not $1/$2)
- generate_reply is async only for OpenAI call
"""

import logging
from typing import Optional

from openai import OpenAI

from src.config.database import query
from src.config.settings import get_settings
from src.services.retrieval.orchestrator import orchestrate

logger = logging.getLogger(__name__)
settings = get_settings()
client = OpenAI(api_key=settings.OPENAI_API_KEY)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _detect_lead_tone(messages: list[dict]) -> str:
    inbound = [m["message"] for m in messages if m.get("direction") == "inbound"][-5:]
    if not inbound:
        return "professional and friendly"

    combined = " ".join(inbound).lower()
    avg_len = len(combined) / max(len(inbound), 1)

    has_emoji = any(ord(c) > 127 for c in combined)
    is_casual = any(w in combined for w in ["hey", "hi", "thanks", "cool", "ok", "okay", "lol", "ya", "yep", "haan", "bhai"])
    is_formal = any(w in combined for w in ["kindly", "regards", "please", "sir", "ma'am", "would like", "request"])
    is_brief  = avg_len < 40

    if is_formal:
        return "formal and respectful — use complete sentences"
    if is_casual and has_emoji:
        return "warm and conversational — match their energy"
    if is_casual:
        return "friendly and approachable — keep it natural"
    if is_brief:
        return "concise and direct — lead prefers short messages"
    return "professional yet personable — clear and helpful"


def _detect_conversation_stage(messages: list[dict], ai_context: Optional[dict]) -> str:
    if ai_context and ai_context.get("handoff_triggered"):
        return "handoff_pending"

    msg_count    = len(messages)
    inbound_msgs = [m for m in messages if m.get("direction") == "inbound"]
    last_inbound = inbound_msgs[-1]["message"].lower() if inbound_msgs else ""

    objection_signals = ["expensive", "costly", "not sure", "maybe later", "think about", "budget", "afford", "mehenga"]
    buying_signals    = ["how do i start", "next step", "sign up", "proceed", "demo", "call", "schedule", "when can", "proceed"]

    if any(s in last_inbound for s in buying_signals):
        return "ready_to_convert"
    if any(s in last_inbound for s in objection_signals):
        return "handling_objection"
    if msg_count <= 2:
        return "cold_opening"
    if msg_count <= 6:
        return "building_rapport"
    return "engaged_nurturing"


STAGE_INSTRUCTIONS = {
    "cold_opening": (
        "This is an early interaction. Focus on building rapport before selling. "
        "Ask one open question to understand their situation. Do NOT pitch yet."
    ),
    "building_rapport": (
        "You're gaining trust. Acknowledge what they've shared, relate it to their pain points, "
        "and gently introduce how you can help. One clear value statement is enough."
    ),
    "engaged_nurturing": (
        "The lead is engaged. Go deeper — share relevant proof points or answer their "
        "specific question thoroughly. Aim to qualify them further."
    ),
    "handling_objection": (
        "The lead has shown hesitation. Acknowledge it empathetically first. "
        "Do NOT dismiss or hard-sell. Use the objection playbook if relevant."
    ),
    "ready_to_convert": (
        "The lead is showing strong buying intent. Make the next step crystal clear and easy. "
        "Be confident and direct — this is a closing moment."
    ),
    "handoff_pending": (
        "A human team member should be taking over soon. Keep this reply brief and reassuring. "
        "Let the lead know someone from the team will be in touch. Do NOT make new promises."
    ),
}


# ─────────────────────────────────────────────
# CALL SUGGESTION RULES
# ─────────────────────────────────────────────

CALL_SUGGEST_TRIGGERS = {
    "lead_asked": [
        # English — full phrases
        "can we connect", "can we talk", "can we call", "let's connect", "let's talk",
        "call me", "schedule a call", "book a call", "want to speak", "want to connect",
        "phone call", "video call", "hop on a call", "get on a call",
        "zoom", "google meet", "teams call",
        # English — short/casual (the ones being missed!)
        "connect", "schedule", "schedule a", "schedule call",
        "call with", "call with you", "call with your",
        "speak with", "speak to", "talk to", "talk with",
        # Hindi/Hinglish
        "baat karte", "baat karo", "time de do", "call karo", "call krte",
        "milte", "connect karo", "schedule karo",
    ],
    "budget_discussion": [
        "how much does it cost", "how much", "pricing", "price", "cost",
        "expensive", "affordable", "discount", "what are your rates", "fee", "kitna",
        "can we negotiate", "charges",
    ],
    "high_urgency": [
        "urgent", "asap", "immediately", "this week", "by tomorrow", "deadline",
        "need it done fast", "as soon as possible", "going live", "client is waiting",
    ],
    "complex_requirement": [
        "multiple services", "full solution", "end to end", "enterprise",
        "custom solution", "large scale", "entire company", "white label", "partnership",
    ],
    "ready_to_buy": [
        "ready to start", "want to proceed", "let's go ahead", "send me the contract",
        "send proposal", "ready to sign", "move forward", "next steps", "proceed",
    ],
}

ALL_CALL_TRIGGERS = list(CALL_SUGGEST_TRIGGERS.items())

# These are SHORT single words/phrases that only count as call triggers
# when the PREVIOUS AI message was already asking about a call
# e.g. lead says "evening" after AI asked "morning or evening?"
CALL_CONTEXT_FOLLOWUP = [
    "morning", "evening", "afternoon", "night", "anytime",
    "tomorrow", "today", "now", "later", "weekend", "monday",
    "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "subah", "shaam", "raat", "dopahar", "kal", "aaj",
    "6pm", "7pm", "8pm", "9am", "10am", "11am", "12pm",
]

# If the last AI message was asking about timing, and lead replies with time,
# this is a SCHEDULING CONFIRMATION — not a new trigger
TIMING_QUESTION_SIGNALS = [
    "when works best", "what time", "morning or evening", "evening or morning",
    "kab free", "subah ya shaam", "shaam ya subah",
    "what's a good time", "when are you free", "best time for you",
    "convenient time", "when can we", "good time for you",
    "when works", "works for you", "free for a call",
    # exact phrases AI sends
    "morning or evening?", "our team will reach out", "our team will connect",
]


def _last_ai_message(messages: list[dict]) -> str:
    """Get the last outbound (AI) message text."""
    # DB may store direction as 'outbound' or AI messages marked is_automated=True
    outbound = [
        m for m in messages
        if m.get("direction") == "outbound" or m.get("is_automated") == True
    ]
    last_msg = outbound[-1]["message"].lower() if outbound else ""
    print(f"[TIMING DEBUG] last AI message: {last_msg[:100]}")
    return last_msg


def _should_suggest_call(
    inbound_message: str,
    stage: str,
    lead: dict,
    messages: list[dict] = None,
) -> tuple[bool, str]:
    msg_lower = inbound_message.lower().strip()
    messages  = messages or []
    last_ai   = _last_ai_message(messages)

    print(f"[TIMING DEBUG] inbound: '{msg_lower}' | last_ai has timing: {any(sig in last_ai for sig in TIMING_QUESTION_SIGNALS)}")

    # ── TIMING REPLY DETECTION ──
    # Conditions:
    # 1. Last AI message asked about time/availability
    # 2. Lead reply is short (≤4 words)
    # 3. Reply contains a time-related word
    ai_asked_timing = any(sig in last_ai for sig in TIMING_QUESTION_SIGNALS)
    word_count      = len(msg_lower.split())
    has_time_word   = any(t in msg_lower for t in CALL_CONTEXT_FOLLOWUP)

    print(f"[TIMING DEBUG] ai_asked_timing={ai_asked_timing} word_count={word_count} has_time_word={has_time_word}")

    if ai_asked_timing and word_count <= 4 and has_time_word:
        print(f"[TIMING DEBUG] → TIMING_CONFIRMED: {inbound_message.strip()}")
        return True, f"TIMING_CONFIRMED:{inbound_message.strip()}"

    # ── NORMAL CALL TRIGGER CHECK ──
    reason_map = {
        "lead_asked":          "The lead has explicitly asked to connect or speak.",
        "budget_discussion":   "The lead is asking about pricing — needs a human discussion.",
        "high_urgency":        "The lead has an urgent timeline — a quick call saves time.",
        "complex_requirement": "Complex requirement — needs a proper discovery call.",
        "ready_to_buy":        "Lead is ready to move forward — close it with a personal touch.",
    }
    for trigger_type, phrases in ALL_CALL_TRIGGERS:
        if any(phrase in msg_lower for phrase in phrases):
            print(f"[TIMING DEBUG] → CALL TRIGGER: {trigger_type}")
            return True, reason_map.get(trigger_type, "A call is appropriate here.")

    if lead.get("urgency") == "high" and stage == "ready_to_convert":
        return True, "High urgency lead ready to convert."

    print(f"[TIMING DEBUG] → no call trigger")
    return False, ""


# ─────────────────────────────────────────────
# DB FETCHERS  (sync — psycopg2)
# ─────────────────────────────────────────────

def _fetch_lead_full_context(lead_id: str, org_id: str) -> dict:
    row = query(
        """
        SELECT
            l.id, l.name, l.email, l.phone, l.company, l.source,
            l.service_interest, l.score, l.priority, l.status, l.message,
            a.summary, a.intent, a.urgency, a.qualification_label,
            a.recommended_action, a.confidence
        FROM leads l
        LEFT JOIN lead_ai_analysis a ON a.lead_id = l.id AND a.org_id = l.org_id
        WHERE l.id = %s AND l.org_id = %s
        LIMIT 1
        """,
        (lead_id, org_id), fetch="one"
    )
    return dict(row) if row else {}


def _fetch_ai_context(lead_id: str, org_id: str) -> Optional[dict]:
    row = query(
        "SELECT context_snapshot, msg_count FROM ai_context WHERE lead_id = %s AND org_id = %s",
        (lead_id, org_id), fetch="one"
    )
    return dict(row) if row else None


def _fetch_org_ai_config(org_id: str) -> dict:
    row = query(
        "SELECT system_prompt, tone, language, max_auto_replies FROM org_ai_config WHERE org_id = %s",
        (org_id,), fetch="one"
    )
    return dict(row) if row else {}


def _fetch_recent_conversations(lead_id: str, org_id: str, limit: int = 12) -> list[dict]:
    rows = query(
        """
        SELECT direction, message, is_automated, created_at
        FROM conversations
        WHERE lead_id = %s AND org_id = %s
        ORDER BY id ASC
        LIMIT %s
        """,
        (lead_id, org_id, limit), fetch="all"
    )
    return [dict(r) for r in rows] if rows else []


# ─────────────────────────────────────────────
# PROMPT BUILDERS
# ─────────────────────────────────────────────

def _build_lead_profile_block(lead: dict) -> str:
    parts = ["LEAD PROFILE:"]
    if lead.get("name"):              parts.append(f"  Name: {lead['name']}")
    if lead.get("company"):           parts.append(f"  Company: {lead['company']}")
    if lead.get("service_interest"):  parts.append(f"  Interested in: {lead['service_interest']}")
    if lead.get("source"):            parts.append(f"  Source: {lead['source']}")
    if lead.get("score"):             parts.append(f"  Lead score: {lead['score']}/100 ({lead.get('priority','?')} priority)")
    if lead.get("status"):            parts.append(f"  Status: {lead['status']}")
    if lead.get("message"):           parts.append(f"  Initial enquiry: \"{lead['message']}\"")
    if lead.get("summary"):
        parts.append("\nAI ANALYSIS:")
        parts.append(f"  Summary: {lead['summary']}")
    if lead.get("intent"):            parts.append(f"  Intent: {lead['intent']}")
    if lead.get("urgency"):           parts.append(f"  Urgency: {lead['urgency']}")
    if lead.get("qualification_label"): parts.append(f"  Qualification: {lead['qualification_label']}")
    if lead.get("recommended_action"):  parts.append(f"  Recommended action: {lead['recommended_action']}")
    return "\n".join(parts)


def _build_conversation_block(messages: list[dict]) -> str:
    if not messages:
        return "CONVERSATION HISTORY:\n  (No messages yet)"
    lines = ["CONVERSATION HISTORY (oldest → newest):"]
    for m in messages:
        role = "Lead" if m["direction"] == "inbound" else "You (AI)"
        ts = ""
        if m.get("created_at"):
            try:
                ts = f" [{m['created_at'].strftime('%d %b %H:%M')}]"
            except Exception:
                pass
        lines.append(f"  [{role}]{ts}: {m['message']}")
    return "\n".join(lines)


def _build_knowledge_block(retrieved: dict) -> str:
    """Convert orchestrate() result into a clean text block for the prompt."""
    knowledge = retrieved.get("knowledge", {})
    service   = retrieved.get("service")
    lines     = []

    if service:
        lines.append(f"SERVICE: {service.get('name','')}")
        if service.get("one_line"):    lines.append(f"  {service['one_line']}")
        if service.get("description"): lines.append(f"  {service['description']}")

    if knowledge.get("overview"):
        lines.append(f"\nOVERVIEW:\n  {knowledge['overview']}")
    if knowledge.get("pricing"):
        lines.append(f"\nPRICING:\n  {knowledge['pricing']}")
    if knowledge.get("timeline"):
        lines.append(f"\nTIMELINE:\n  {knowledge['timeline']}")
    if knowledge.get("features"):
        lines.append(f"\nFEATURES:\n  {knowledge['features']}")

    if knowledge.get("faqs"):
        lines.append("\nRELEVANT FAQs:")
        for faq in knowledge["faqs"]:
            lines.append(f"  Q: {faq['question']}")
            lines.append(f"  A: {faq['answer']}")

    if knowledge.get("policies"):
        lines.append("\nRULES YOU MUST FOLLOW:")
        for p in knowledge["policies"]:
            lines.append(f"  - {p}")

    if knowledge.get("objection_reply"):
        lines.append(f"\nOBJECTION PLAYBOOK:\n  {knowledge['objection_reply']}")

    if knowledge.get("next_question"):
        lines.append(f"\nNEXT QUALIFICATION QUESTION TO ASK:\n  {knowledge['next_question']}")

    return "\n".join(lines)


def _build_system_prompt(
    org_config: dict,
    lead: dict,
    retrieved: dict,
    messages: list[dict],
    stage: str,
    tone_instruction: str,
    ai_context: Optional[dict],
    call_suggestion: tuple[bool, str] = (False, ""),
) -> str:
    base_prompt       = org_config.get("system_prompt") or "You are a friendly sales person chatting on WhatsApp."
    language          = org_config.get("language") or "English"
    stage_instruction = STAGE_INSTRUCTIONS.get(stage, "")
    lead_profile      = _build_lead_profile_block(lead)
    knowledge_block   = _build_knowledge_block(retrieved)
    conv_history      = _build_conversation_block(messages)
    lead_first_name   = (lead.get("name") or "there").split()[0]

    memory_note = ""
    if ai_context and ai_context.get("context_snapshot"):
        memory_note = f"\nPREVIOUS SESSION MEMORY:\n{ai_context['context_snapshot']}\n"

    should_call, call_reason = call_suggestion
    if should_call and call_reason.startswith("TIMING_CONFIRMED:"):
        confirmed_time = call_reason.split("TIMING_CONFIRMED:")[1].strip()
        call_rule = f"""
THE LEAD CONFIRMED THEIR AVAILABLE TIME: "{confirmed_time}"
YOUR ONLY JOB: Write 2 sentences confirming this.
  Sentence 1: Acknowledge the time. Example: "Perfect, noted for {confirmed_time}!"
  Sentence 2: Confirm team will call. Example: "Our team will connect with you this {confirmed_time}."
DO NOT: ask any question, mention features, say anything else.
EXAMPLE REPLY: "Perfect, {confirmed_time} it is! Our team will connect with you then."
"""
    elif should_call:
        call_rule = f"""
THE LEAD WANTS TO CONNECT / SCHEDULE A CALL.
YOUR ONLY JOB: Write 2-3 sentences doing exactly this:
  Sentence 1: Acknowledge warmly. Example: "Of course, happy to connect!"
  Sentence 2: Ask their preferred time. Example: "When works best for you — morning or evening?"
  Sentence 3: Reassure. Example: "Our team will reach out to you soon."
DO NOT: talk about features, ask about their project, ignore the call request.
DO NOT: answer any other question in this reply — the call request is the ONLY priority.
EXAMPLE REPLY: "Sure, let's get you connected! When's a good time — morning or evening? Our team will reach out to you soon."
"""
    else:
        call_rule = """
DO NOT suggest a call or meeting in this reply.
Answer their question directly. Stay in the chat.
"""

    prompt = f"""{base_prompt}

You are a real human sales team member replying on WhatsApp. Not a bot.
The lead's name is {lead_first_name}. Always respond in {language}.

HOW TO WRITE — follow every rule:

RULE 1 — SHORT: Max 2-3 sentences. Period.
RULE 2 — NO LISTS EVER: Never use bullet points, dashes, or numbered lists.
  BAD:  "Features:\n• AI scoring\n• WhatsApp automation"
  GOOD: "It does AI scoring and WhatsApp automation automatically."
RULE 3 — NO FORMATTING: No bold, no asterisks, no headers. Plain text only.
RULE 4 — CASUAL: Like a friend texting. Not a company email.
  BAD:  "I understand your concern and would like to address it."
  GOOD: "Makes sense — let me explain how that works."
RULE 5 — NO FILLER OPENERS: Never start with "Great!", "Sure!", "Absolutely!", "Of course!", "I get that", "I understand".
RULE 6 — DON'T START WITH "I": Start with their name, a fact, or a direct answer.
RULE 7 — SPECIFIC: Use real facts from knowledge base. Never say "we have great solutions".
RULE 8 — ONE ENDING: Finish with ONE question OR one next step. Not both. Not three.

CONVERSATION STAGE: {stage.upper().replace('_', ' ')}
{stage_instruction}

{lead_profile}
{memory_note}
{knowledge_block}
{conv_history}

════════════════════════════════
FINAL INSTRUCTION — THIS OVERRIDES EVERYTHING ABOVE:
{call_rule}
Write your reply NOW. Follow the FINAL INSTRUCTION above. Short. Casual. Human. Zero lists.
════════════════════════════════
"""
    return prompt.strip()


# ─────────────────────────────────────────────
# CONTEXT SNAPSHOT UPDATER  (sync)
# ─────────────────────────────────────────────

def _update_ai_context(lead_id: str, org_id: str, lead: dict, messages: list[dict], stage: str):
    if not messages:
        return

    inbound_msgs = [m["message"] for m in messages if m["direction"] == "inbound"]
    topics = ", ".join(inbound_msgs[-3:]) if inbound_msgs else "nothing yet"

    snapshot = (
        f"Lead {lead.get('name','Unknown')} from {lead.get('company','unknown company')} "
        f"is interested in {lead.get('service_interest','our services')}. "
        f"Stage: {stage}. Recent topics: {topics}. "
        f"Score: {lead.get('score','N/A')}, priority: {lead.get('priority','N/A')}."
    )

    existing = query(
        "SELECT id FROM ai_context WHERE lead_id = %s AND org_id = %s",
        (lead_id, org_id), fetch="one"
    )

    if existing:
        query(
            """
            UPDATE ai_context
            SET context_snapshot = %s, msg_count = %s, last_msg_at = NOW(), updated_at = NOW()
            WHERE lead_id = %s AND org_id = %s
            """,
            (snapshot, len(messages), lead_id, org_id), fetch="none"
        )
    else:
        query(
            """
            INSERT INTO ai_context (org_id, lead_id, context_snapshot, msg_count, last_msg_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            """,
            (org_id, lead_id, snapshot, len(messages)), fetch="none"
        )


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────

def generate_reply(
    org_id: str,
    lead_id: str,
    inbound_message: str,
    platform: str = "whatsapp",
) -> str:
    """
    Generate a contextual, personalised reply to a lead's inbound WhatsApp message.
    Fully synchronous — uses psycopg2 query() and sync OpenAI client.
    Called via asyncio.run() from the webhook background thread.
    """
    try:
        # 1. Fetch all context (sync)
        lead       = _fetch_lead_full_context(lead_id, org_id)
        org_config = _fetch_org_ai_config(org_id)
        messages   = _fetch_recent_conversations(lead_id, org_id, limit=20)
        ai_context = _fetch_ai_context(lead_id, org_id)

        if not lead:
            logger.warning(f"generate_reply: lead {lead_id} not found in org {org_id}")
            return "Thanks for your message! Our team will get back to you shortly."

        # 2. Stage + tone detection
        stage            = _detect_conversation_stage(messages, ai_context)
        tone_instruction = _detect_lead_tone(messages)
        call_suggestion  = _should_suggest_call(inbound_message, stage, lead, messages)

        # 3. Retrieval (sync orchestrate)
        retrieved = orchestrate(
            org_id=org_id,
            lead_id=lead_id,
            platform=platform,
            message=inbound_message,
            service_interest=lead.get("service_interest"),
        )

        # 4. Build prompt
        system_prompt = _build_system_prompt(
            org_config=org_config,
            lead=lead,
            retrieved=retrieved,
            messages=messages,
            stage=stage,
            tone_instruction=tone_instruction,
            ai_context=ai_context,
            call_suggestion=call_suggestion,
        )

        # 5. Call OpenAI (sync client)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": inbound_message},
            ],
            max_tokens=300,
            temperature=0.65,
        )

        reply = response.choices[0].message.content.strip()

        # 6. Save memory snapshot
        _update_ai_context(lead_id, org_id, lead, messages, stage)

        logger.info(f"generate_reply: lead={lead_id} stage={stage}")
        return reply

    except Exception as e:
        logger.error(f"generate_reply error: lead={lead_id} — {e}", exc_info=True)
        return "Thanks for reaching out! Our team will follow up with you shortly."


def generate_first_message(lead_id: str, org_id: str) -> str:
    """
    Generate the opening WhatsApp message for a high-scoring lead.
    Sync version to match the rest of the stack.
    """
    lead       = _fetch_lead_full_context(lead_id, org_id)
    org_config = _fetch_org_ai_config(org_id)

    if not lead:
        return "Hi! Thanks for reaching out. How can we help you today?"

    retrieved = orchestrate(
        org_id=org_id,
        lead_id=lead_id,
        platform="whatsapp",
        message=lead.get("service_interest") or lead.get("message") or "",
        service_interest=lead.get("service_interest"),
    )

    service_name   = lead.get("service_interest") or "our services"
    lead_name      = lead.get("name", "").split()[0] if lead.get("name") else ""
    company        = f" at {lead['company']}" if lead.get("company") else ""
    initial_msg    = lead.get("message", "")
    reference_line = f'They mentioned: "{initial_msg[:100]}". ' if initial_msg else ""
    knowledge_block = _build_knowledge_block(retrieved)

    system = f"""{org_config.get('system_prompt', 'You are a helpful sales assistant.')}

Write the very first WhatsApp message to this lead. Rules:
- Feel personal and human — NOT a template blast
- Reference their specific interest in {service_name}
- Warm but not pushy
- End with ONE open question
- Under 100 words

{knowledge_block}
"""
    user_msg = (
        f"Write opening message for {lead_name or 'this lead'}{company}, "
        f"interested in {service_name}. {reference_line}"
        f"Score: {lead.get('score','N/A')}/100, priority: {lead.get('priority','Unknown')}."
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ],
        max_tokens=200,
        temperature=0.75,
    )

    return response.choices[0].message.content.strip()