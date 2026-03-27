# src/ai/bluqq_rag.py — Existing PostgreSQL DB se (same as orchestrator)

from src.config.database import query


# ─────────────────────────────────────────────
# RAG STATS
# ─────────────────────────────────────────────

def get_rag_stats() -> dict:
    try:
        services = query("SELECT COUNT(*) as count FROM services WHERE is_active = TRUE", fetch="one")
        faqs     = query("SELECT COUNT(*) as count FROM service_faqs", fetch="one")
        modules  = query("SELECT COUNT(*) as count FROM service_modules", fetch="one")

        total = (services["count"] if services else 0) + \
                (faqs["count"]     if faqs     else 0) + \
                (modules["count"]  if modules  else 0)

        return {
            "total_chunks": total,
            "files":        ["services", "service_faqs", "service_modules", "service_policies"],
            "source":       "postgresql"
        }
    except Exception as e:
        print(f"[RAG] Stats error: {e}")
        return {"total_chunks": 0, "files": [], "source": "postgresql"}


# ─────────────────────────────────────────────
# MAIN CONTEXT FETCH — Priya ke liye
# ─────────────────────────────────────────────

def get_rag_context(query_text: str, top_k: int = 3, org_id: str = None) -> str:
    """
    Existing DB tables se Priya ka context fetch karo.
    Same tables jo WhatsApp AI use karta hai.
    """
    try:
        msg   = query_text.lower().strip()
        parts = []

        # ── Intent detect karo ────────────────────────────────
        is_pricing   = any(w in msg for w in ["price", "cost", "how much", "rate", "fees", "pricing", "kitna", "paisa", "budget", "quote", "package"])
        is_timeline  = any(w in msg for w in ["how long", "timeline", "when", "days", "weeks", "kab", "delivery", "time lagega"])
        is_features  = any(w in msg for w in ["feature", "include", "does it", "can it", "integrate", "capability"])
        is_objection = any(w in msg for w in ["expensive", "costly", "too much", "cant afford", "mehenga", "cheaper", "discount"])
        is_faq       = any(w in msg for w in ["how", "what", "refund", "policy", "support", "guarantee"])
        is_service   = any(w in msg for w in ["service", "build", "make", "develop", "create", "offer", "trading", "dashboard", "ai", "scraping"])

        # ── Services fetch karo ───────────────────────────────
        if org_id:
            services = query(
                "SELECT name, description FROM services WHERE org_id = %s AND is_active = TRUE LIMIT %s",
                (org_id, top_k), fetch="all"
            )
        else:
            services = query(
                "SELECT name, description FROM services WHERE is_active = TRUE LIMIT %s",
                (top_k,), fetch="all"
            )

        if services:
            for s in services:
                parts.append(f"[SERVICE] {s['name']}: {s.get('description', '')}")

        # ── Pricing fetch karo ────────────────────────────────
        if is_pricing:
            if org_id:
                rows = query(
                    """SELECT sm.module_type, sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.org_id = %s AND sm.module_type = 'pricing'
                       LIMIT %s""",
                    (org_id, top_k), fetch="all"
                )
            else:
                rows = query(
                    """SELECT sm.module_type, sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.module_type = 'pricing'
                       LIMIT %s""",
                    (top_k,), fetch="all"
                )
            if rows:
                for r in rows:
                    parts.append(f"[PRICING] {r['service_name']}: {r['content']}")

        # ── Timeline fetch karo ───────────────────────────────
        elif is_timeline:
            if org_id:
                rows = query(
                    """SELECT sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.org_id = %s AND sm.module_type = 'timeline'
                       LIMIT %s""",
                    (org_id, top_k), fetch="all"
                )
            else:
                rows = query(
                    """SELECT sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.module_type = 'timeline'
                       LIMIT %s""",
                    (top_k,), fetch="all"
                )
            if rows:
                for r in rows:
                    parts.append(f"[TIMELINE] {r['service_name']}: {r['content']}")

        # ── Features fetch karo ───────────────────────────────
        elif is_features:
            if org_id:
                rows = query(
                    """SELECT sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.org_id = %s AND sm.module_type = 'features'
                       LIMIT %s""",
                    (org_id, top_k), fetch="all"
                )
            else:
                rows = query(
                    """SELECT sm.content, s.name as service_name
                       FROM service_modules sm
                       JOIN services s ON s.id = sm.service_id
                       WHERE sm.module_type = 'features'
                       LIMIT %s""",
                    (top_k,), fetch="all"
                )
            if rows:
                for r in rows:
                    parts.append(f"[FEATURES] {r['service_name']}: {r['content']}")

        # ── Objection handling ────────────────────────────────
        if is_objection:
            if org_id:
                rows = query(
                    """SELECT objection_type, approved_reply
                       FROM objection_playbooks
                       WHERE org_id = %s
                       LIMIT %s""",
                    (org_id, top_k), fetch="all"
                )
            else:
                rows = query(
                    "SELECT objection_type, approved_reply FROM objection_playbooks LIMIT %s",
                    (top_k,), fetch="all"
                )
            if rows:
                for r in rows:
                    parts.append(f"[OBJECTION] {r['objection_type']}: {r['approved_reply']}")

        # ── FAQs fetch karo ───────────────────────────────────
        if is_faq:
            if org_id:
                rows = query(
                    """SELECT question, answer FROM service_faqs
                       WHERE org_id = %s LIMIT %s""",
                    (org_id, top_k), fetch="all"
                )
            else:
                rows = query(
                    "SELECT question, answer FROM service_faqs LIMIT %s",
                    (top_k,), fetch="all"
                )
            if rows:
                for r in rows:
                    parts.append(f"[FAQ] Q: {r['question']} | A: {r['answer']}")

        # ── Policies ──────────────────────────────────────────
        if org_id:
            policies = query(
                "SELECT rule_text FROM service_policies WHERE org_id = %s LIMIT 3",
                (org_id,), fetch="all"
            )
        else:
            policies = query(
                "SELECT rule_text FROM service_policies LIMIT 3",
                fetch="all"
            )
        if policies:
            for p in policies:
                parts.append(f"[POLICY] {p['rule_text']}")

        if not parts:
            return ""

        context = "\n".join(parts)
        print(f"[RAG] ✅ {len(parts)} chunks fetched from DB")
        return context

    except Exception as e:
        print(f"[RAG] ❌ DB error: {e}")
        import traceback
        traceback.print_exc()
        return ""


# ─────────────────────────────────────────────
# INIT — Startup check
# ─────────────────────────────────────────────

def init_rag():
    try:
        s = query("SELECT COUNT(*) as count FROM services WHERE is_active = TRUE", fetch="one")
        f = query("SELECT COUNT(*) as count FROM service_faqs",                    fetch="one")
        m = query("SELECT COUNT(*) as count FROM service_modules",                 fetch="one")

        print(f"[RAG] ✅ DB connected!")
        print(f"[RAG]    Services : {s['count'] if s else 0}")
        print(f"[RAG]    FAQs     : {f['count'] if f else 0}")
        print(f"[RAG]    Modules  : {m['count'] if m else 0}")

    except Exception as e:
        print(f"[RAG] ❌ DB connection failed: {e}")
        import traceback
        traceback.print_exc()