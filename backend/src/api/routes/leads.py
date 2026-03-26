from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from src.schemas.lead import (
    CreateLeadRequest, UpdateLeadRequest,
    LeadDetailResponse, PaginatedLeadsResponse,
    DashboardStatsResponse, CSVUploadResponse
)
from src.services.lead_service import (
    fetch_all_leads, fetch_lead_detail,
    create_new_lead, import_leads_from_csv,
    update_lead_fields, remove_lead,
    fetch_dashboard_stats
)
from src.middleware.auth_middleware import get_current_user
from typing import Optional

router = APIRouter()


@router.get("/stats/summary", response_model=DashboardStatsResponse)
def get_stats(current_user: dict = Depends(get_current_user)):
    return fetch_dashboard_stats(org_id=str(current_user["org_id"]))


@router.get("", response_model=PaginatedLeadsResponse)
def list_leads(
    page:     int           = Query(default=1,   ge=1),
    per_page: int           = Query(default=10,  ge=1, le=100),
    status:   Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    source:   Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user)
):
    return fetch_all_leads(
        org_id=str(current_user["org_id"]),
        page=page, per_page=per_page,
        status=status, priority=priority, source=source
    )


@router.post("", response_model=LeadDetailResponse, status_code=201)
def create_lead(
    body: CreateLeadRequest,
    current_user: dict = Depends(get_current_user)
):
    return create_new_lead(
        data=body.model_dump(),
        user_id=str(current_user["id"]),
        org_id=str(current_user["org_id"])
    )


@router.post("/upload-csv", response_model=CSVUploadResponse, status_code=201)
async def upload_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")
    return import_leads_from_csv(
        file_content=content,
        user_id=str(current_user["id"]),
        org_id=str(current_user["org_id"])
    )


@router.get("/{lead_id}", response_model=LeadDetailResponse)
def get_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    return fetch_lead_detail(
        lead_id,
        org_id=str(current_user["org_id"])
    )


@router.patch("/{lead_id}", response_model=LeadDetailResponse)
def update_lead(
    lead_id: str,
    body: UpdateLeadRequest,
    current_user: dict = Depends(get_current_user)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return update_lead_fields(
        lead_id=lead_id,
        updates=updates,
        org_id=str(current_user["org_id"])
    )


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    remove_lead(
        lead_id,
        org_id=str(current_user["org_id"])
    )
    return {"message": "Lead deleted successfully"}


@router.post("/{lead_id}/analyze")
def analyze_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    from src.models.lead import get_lead_by_id
    from src.services.ai_service import run_analysis_and_score
    lead = get_lead_by_id(lead_id, org_id=str(current_user["org_id"]))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    analysis = run_analysis_and_score(lead)
    return analysis