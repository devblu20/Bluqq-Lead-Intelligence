# src/services/retrieval/orchestrator.py

from src.config.database import query


# ─────────────────────────────────────────────
# INTENT DETECTION
# ─────────────────────────────────────────────

def detect_intent(message: str) -> str:
    msg = message.lower().strip()

    if any(w in msg for w in ['not interested', 'no thanks', 'dont want', 'not needed', 'band karo', 'mat karo', 'nahi chahiye']):
        return 'not_interested'

    if any(w in msg for w in ['expensive', 'costly', 'too much', 'cant afford', 'cannot afford', 'budget nahi', 'mehenga', 'cheaper', 'discount', 'negotiate']):
        return 'objection_budget'

    if any(w in msg for w in ['not now', 'later', 'not ready', 'busy', 'abhi nahi', 'baad mein', 'next month', 'some other time']):
        return 'objection_timing'

    if any(w in msg for w in ['proof', 'guarantee', 'case study', 'example', 'reference', 'trust', 'worked before', 'results', 'show results']):
        return 'objection_trust'

    if any(w in msg for w in ['book', 'call', 'meeting', 'schedule', 'appointment', 'connect', 'zoom', 'available', 'slot', 'time de do', 'baat karte']):
        return 'book_call'

    if any(w in msg for w in ['demo', 'show me', 'dikhao', 'dekh sakte', 'see it']):
        return 'ask_demo'

    if any(w in msg for w in ['price', 'cost', 'charge', 'fee', 'how much', 'rate', 'pricing', 'kitna', 'paisa', 'budget', 'quote', 'package', 'plan']):
        return 'ask_pricing'

    if any(w in msg for w in ['how long', 'timeline', 'when', 'days', 'weeks', 'kitne din', 'kab', 'delivery', 'time lagega']):
        return 'ask_timeline'

    if any(w in msg for w in ['feature', 'include', 'does it', 'can it', 'integrate', 'work with', 'support', 'capability']):
        return 'ask_features'

    if any(w in msg for w in ['how does', 'what is', 'tell me', 'explain', 'works', 'kya hai', 'batao', 'samjhao']):
        return 'ask_about_service'

    if any(w in msg for w in ['yes', 'sure', 'okay', 'ok', 'haan', 'bilkul', 'sounds good', 'interested', 'proceed']):
        return 'positive_signal'

    if any(w in msg for w in ['hi', 'hello', 'hey', 'hii', 'good morning', 'good afternoon', 'namaste']):
        return 'greeting'

    # "can we chat now?" and similar → book_call
    if any(w in msg for w in ['now', 'abhi', 'chat now', 'talk now', 'free now']):
        return 'book_call'

    return 'unclear'


# ─────────────────────────────────────────────
# SERVICE MATCHING
# ─────────────────────────────────────────────

def find_service(org_id: str, service_interest: str = None) -> dict:
    if service_interest:
        result = query(
            """SELECT * FROM services
               WHERE org_id = %s AND is_active = TRUE
               AND LOWER(name) LIKE LOWER(%s)
               LIMIT 1""",
            (org_id, f"%{service_interest}%"), fetch="one"
        )
        if result:
            return dict(result)

    result = query(
        "SELECT * FROM services WHERE org_id = %s AND is_active = TRUE LIMIT 1",
        (org_id,), fetch="one"
    )
    return dict(result) if result else None


# ─────────────────────────────────────────────
# KNOWLEDGE FETCHING
# ─────────────────────────────────────────────

def fetch_knowledge(service_id: str, org_id: str, intent: str) -> dict:
    knowledge = {'faqs': [], 'policies': []}

    # Always fetch overview
    overview = query(
        "SELECT content FROM service_modules WHERE service_id = %s AND org_id = %s AND module_type = 'overview' LIMIT 1",
        (service_id, org_id), fetch="one"
    )
    if overview:
        knowledge['overview'] = overview['content']

    # Intent-specific modules
    if intent == 'ask_pricing':
        row = query(
            "SELECT content FROM service_modules WHERE service_id = %s AND org_id = %s AND module_type = 'pricing' LIMIT 1",
            (service_id, org_id), fetch="one"
        )
        if row:
            knowledge['pricing'] = row['content']

    elif intent == 'ask_timeline':
        row = query(
            "SELECT content FROM service_modules WHERE service_id = %s AND org_id = %s AND module_type = 'timeline' LIMIT 1",
            (service_id, org_id), fetch="one"
        )
        if row:
            knowledge['timeline'] = row['content']

    elif intent in ('ask_features', 'ask_about_service', 'ask_demo'):
        row = query(
            "SELECT content FROM service_modules WHERE service_id = %s AND org_id = %s AND module_type = 'features' LIMIT 1",
            (service_id, org_id), fetch="one"
        )
        if row:
            knowledge['features'] = row['content']

    # FAQs — intent-matched first, then general
    faqs = query(
        """SELECT question, answer FROM service_faqs
           WHERE service_id = %s AND org_id = %s
           AND (intent_tag = %s OR intent_tag IS NULL)
           LIMIT 3""",
        (service_id, org_id, intent), fetch="all"
    )
    knowledge['faqs'] = [dict(f) for f in faqs] if faqs else []

    # Policies — always included
    policies = query(
        "SELECT rule_text FROM service_policies WHERE service_id = %s AND org_id = %s",
        (service_id, org_id), fetch="all"
    )
    knowledge['policies'] = [p['rule_text'] for p in policies] if policies else []

    # Objection reply
    if intent in ('objection_budget', 'objection_trust', 'objection_timing', 'not_interested'):
        obj = query(
            """SELECT approved_reply FROM objection_playbooks
               WHERE service_id = %s AND org_id = %s AND objection_type = %s LIMIT 1""",
            (service_id, org_id, intent), fetch="one"
        )
        if obj:
            knowledge['objection_reply'] = obj['approved_reply']

    # Next qualification question
    qual = query(
        """SELECT question FROM qualification_questions
           WHERE service_id = %s AND org_id = %s AND is_required = TRUE
           ORDER BY ask_order ASC LIMIT 1""",
        (service_id, org_id), fetch="one"
    )
    if qual:
        knowledge['next_question'] = qual['question']

    return knowledge


# ─────────────────────────────────────────────
# CONVERSATION STATE
# ─────────────────────────────────────────────

def get_or_create_state(org_id: str, lead_id: str, platform: str) -> dict:
    result = query(
        "SELECT * FROM conversation_state WHERE org_id = %s AND lead_id = %s AND platform = %s",
        (org_id, lead_id, platform), fetch="one"
    )
    if result:
        return dict(result)

    result = query(
        "INSERT INTO conversation_state (org_id, lead_id, platform) VALUES (%s, %s, %s) RETURNING *",
        (org_id, lead_id, platform), fetch="one"
    )
    return dict(result)


def update_state(org_id: str, lead_id: str, platform: str,
                 intent: str, service_id: str = None):
    stage_map = {
        'greeting':         'greeting',
        'ask_about_service':'presenting',
        'ask_features':     'presenting',
        'ask_pricing':      'presenting',
        'ask_timeline':     'presenting',
        'ask_demo':         'presenting',
        'positive_signal':  'presenting',
        'unclear':          'qualifying',
        'objection_budget': 'objection',
        'objection_trust':  'objection',
        'objection_timing': 'objection',
        'book_call':        'booking',
        'not_interested':   'closed',
    }
    stage = stage_map.get(intent, 'qualifying')

    query(
        """UPDATE conversation_state SET
             stage               = %s,
             detected_intent     = %s,
             detected_service_id = COALESCE(%s::uuid, detected_service_id),
             last_updated        = NOW()
           WHERE org_id = %s AND lead_id = %s AND platform = %s""",
        (stage, intent, service_id, org_id, lead_id, platform),
        fetch="none"
    )


# ─────────────────────────────────────────────
# MAIN — called by ai_chat_service.py
# ─────────────────────────────────────────────

def orchestrate(org_id: str, lead_id: str, platform: str,
                message: str, service_interest: str = None) -> dict:

    intent     = detect_intent(message)
    print(f"[RETRIEVAL] Intent: {intent}")

    service    = find_service(org_id, service_interest)
    service_id = str(service['id']) if service else None
    print(f"[RETRIEVAL] Service: {service['name'] if service else 'None'}")

    state = get_or_create_state(org_id, lead_id, platform)

    knowledge = {}
    if service_id:
        knowledge = fetch_knowledge(service_id, org_id, intent)

    update_state(org_id, lead_id, platform, intent, service_id)

    return {
        "intent":    intent,
        "service":   service,
        "state":     state,
        "knowledge": knowledge,
    }