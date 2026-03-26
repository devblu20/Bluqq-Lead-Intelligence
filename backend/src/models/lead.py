from src.config.database import query
from typing import Optional
import math


def get_all_leads(
    org_id: str,
    page: int = 1,
    per_page: int = 10,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None
) -> dict:
    offset     = (page - 1) * per_page
    conditions = ["org_id = %s"]
    params     = [org_id]

    if status:
        conditions.append("status = %s")
        params.append(status)
    if priority:
        conditions.append("priority = %s")
        params.append(priority)
    if source:
        conditions.append("source = %s")
        params.append(source)

    where = "WHERE " + " AND ".join(conditions)

    count_result = query(
        f"SELECT COUNT(*) as total FROM leads {where}",
        tuple(params), fetch="one"
    )
    total = count_result["total"] if count_result else 0

    params.extend([per_page, offset])
    leads = query(
        f"""
        SELECT * FROM leads {where}
        ORDER BY score DESC NULLS LAST, created_at DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params), fetch="all"
    )

    return {
        "leads":       [dict(l) for l in leads] if leads else [],
        "total":       total,
        "page":        page,
        "per_page":    per_page,
        "total_pages": math.ceil(total / per_page) if total > 0 else 1
    }


def get_lead_by_id(lead_id: str, org_id: Optional[str] = None) -> Optional[dict]:
    if org_id:
        result = query(
            "SELECT * FROM leads WHERE id = %s AND org_id = %s LIMIT 1",
            (lead_id, org_id), fetch="one"
        )
    else:
        result = query(
            "SELECT * FROM leads WHERE id = %s LIMIT 1",
            (lead_id,), fetch="one"
        )
    return dict(result) if result else None


def create_lead(data: dict) -> dict:
    result = query(
        """
        INSERT INTO leads
            (name, company, email, phone, source,
             service_interest, message, user_id, org_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            data["name"],
            data.get("company"),
            data.get("email"),
            data.get("phone"),
            data.get("source", "Manual"),
            data.get("service_interest"),
            data["message"],
            data.get("user_id"),
            data.get("org_id")
        ),
        fetch="one"
    )
    return dict(result)


def bulk_create_leads(leads_data: list, user_id: str, org_id: str) -> list:
    created = []
    for lead_data in leads_data:
        try:
            lead_data["user_id"] = user_id
            lead_data["org_id"]  = org_id
            lead = create_lead(lead_data)
            created.append(lead)
        except Exception as e:
            print(f"[DB] Failed to insert lead: {e}")
            continue
    return created


def update_lead(lead_id: str, updates: dict) -> Optional[dict]:
    if not updates:
        return get_lead_by_id(lead_id)

    set_parts = []
    params    = []

    for field, value in updates.items():
        if value is not None:
            set_parts.append(f"{field} = %s")
            params.append(value)

    if not set_parts:
        return get_lead_by_id(lead_id)

    params.append(lead_id)
    result = query(
        f"UPDATE leads SET {', '.join(set_parts)} WHERE id = %s RETURNING *",
        tuple(params), fetch="one"
    )
    return dict(result) if result else None


def delete_lead(lead_id: str, org_id: str) -> bool:
    query(
        "DELETE FROM leads WHERE id = %s AND org_id = %s",
        (lead_id, org_id), fetch="none"
    )
    return True


def get_lead_analysis(lead_id: str) -> Optional[dict]:
    result = query(
        """
        SELECT * FROM lead_ai_analysis
        WHERE lead_id = %s ORDER BY analyzed_at DESC LIMIT 1
        """,
        (lead_id,), fetch="one"
    )
    return dict(result) if result else None


def get_lead_events(lead_id: str) -> list:
    results = query(
        "SELECT * FROM lead_events WHERE lead_id = %s ORDER BY created_at DESC",
        (lead_id,), fetch="all"
    )
    return [dict(r) for r in results] if results else []


def create_lead_event(lead_id: str, event_type: str, event_data: dict = {}) -> dict:
    import json
    result = query(
        """
        INSERT INTO lead_events (lead_id, event_type, event_data)
        VALUES (%s, %s, %s) RETURNING *
        """,
        (lead_id, event_type, json.dumps(event_data)), fetch="one"
    )
    return dict(result)


def get_dashboard_stats(org_id: str) -> dict:
    total = query(
        "SELECT COUNT(*) as count FROM leads WHERE org_id = %s",
        (org_id,), fetch="one"
    )
    high = query(
        "SELECT COUNT(*) as count FROM leads WHERE org_id = %s AND priority = 'High'",
        (org_id,), fetch="one"
    )
    medium = query(
        "SELECT COUNT(*) as count FROM leads WHERE org_id = %s AND priority = 'Medium'",
        (org_id,), fetch="one"
    )
    today = query(
        "SELECT COUNT(*) as count FROM leads WHERE org_id = %s AND DATE(created_at) = CURRENT_DATE",
        (org_id,), fetch="one"
    )
    avg_score = query(
        "SELECT COALESCE(AVG(score), 0) as avg FROM leads WHERE org_id = %s AND score > 0",
        (org_id,), fetch="one"
    )
    recent = query(
        "SELECT * FROM leads WHERE org_id = %s ORDER BY created_at DESC LIMIT 5",
        (org_id,), fetch="all"
    )
    return {
        "total_leads":   total["count"]                    if total     else 0,
        "hot_leads":     high["count"]                     if high      else 0,
        "warm_leads":    medium["count"]                   if medium    else 0,
        "new_today":     today["count"]                    if today     else 0,
        "average_score": round(float(avg_score["avg"]), 1) if avg_score else 0.0,
        "recent_leads":  [dict(r) for r in recent]         if recent    else []
    }