from src.models.lead import (
    get_all_leads, get_lead_by_id, create_lead,
    bulk_create_leads, update_lead, delete_lead,
    get_lead_analysis, get_lead_events,
    create_lead_event, get_dashboard_stats
)
from src.utils.csv_parser import parse_csv_leads
from src.services.ai_service import run_analysis_and_score
from typing import Optional
from fastapi import HTTPException, status
import threading


def _analyze_in_background(lead: dict):
    try:
        print(f"[AI] Analyzing: {lead.get('name')} ({lead.get('id')})")
        run_analysis_and_score(lead)
        print(f"[AI] Done: {lead.get('name')}")
    except Exception as e:
        print(f"[AI] FAILED for {lead.get('id')}: {e}")
        import traceback
        traceback.print_exc()


def fetch_all_leads(
    org_id: str,
    page: int = 1,
    per_page: int = 10,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None
) -> dict:
    return get_all_leads(
        org_id=org_id,
        page=page, per_page=per_page,
        status=status, priority=priority, source=source
    )


def fetch_lead_detail(lead_id: str, org_id: str) -> dict:
    lead = get_lead_by_id(lead_id, org_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    return {
        "lead":     lead,
        "analysis": get_lead_analysis(lead_id),
        "events":   get_lead_events(lead_id)
    }


def create_new_lead(data: dict, user_id: str, org_id: str) -> dict:
    data["user_id"] = user_id
    data["org_id"]  = org_id
    lead = create_lead(data)

    create_lead_event(
        lead_id=lead["id"],
        event_type="created",
        event_data={"source": lead.get("source"), "created_by": user_id}
    )

    # Auto-analyze in background
    t = threading.Thread(
        target=_analyze_in_background,
        args=(dict(lead),),
        daemon=True
    )
    t.start()

    return {
        "lead":     lead,
        "analysis": None,
        "events":   get_lead_events(lead["id"])
    }


def import_leads_from_csv(file_content: bytes, user_id: str, org_id: str) -> dict:
    valid_leads, errors = parse_csv_leads(file_content)

    total_in_file  = len(valid_leads) + len(errors)
    imported_leads = []

    if valid_leads:
        imported_leads = bulk_create_leads(valid_leads, user_id, org_id)

        for lead in imported_leads:
            create_lead_event(
                lead_id=lead["id"],
                event_type="csv_imported",
                event_data={"imported_by": user_id}
            )
            t = threading.Thread(
                target=_analyze_in_background,
                args=(dict(lead),),
                daemon=True
            )
            t.start()

    imported_count = len(imported_leads)
    skipped_count  = len(errors) + (len(valid_leads) - imported_count)

    return {
        "success":       True,
        "total_in_file": total_in_file,
        "imported":      imported_count,
        "skipped":       skipped_count,
        "errors":        errors,
        "message":       f"Imported {imported_count} leads. AI scoring running in background. {skipped_count} skipped."
    }


def update_lead_fields(lead_id: str, updates: dict, org_id: str) -> dict:
    existing = get_lead_by_id(lead_id, org_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    updated = update_lead(lead_id, updates)
    create_lead_event(
        lead_id=lead_id,
        event_type="updated",
        event_data={"changes": updates}
    )
    return {
        "lead":     updated,
        "analysis": get_lead_analysis(lead_id),
        "events":   get_lead_events(lead_id)
    }


def remove_lead(lead_id: str, org_id: str) -> bool:
    existing = get_lead_by_id(lead_id, org_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    return delete_lead(lead_id, org_id)


def fetch_dashboard_stats(org_id: str) -> dict:
    return get_dashboard_stats(org_id)