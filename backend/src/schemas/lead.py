from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class LeadStatus(str, Enum):
    new       = "new"
    contacted = "contacted"
    qualified = "qualified"
    closed    = "closed"


class LeadPriority(str, Enum):
    High   = "High"
    Medium = "Medium"
    Low    = "Low"


class LeadSource(str, Enum):
    LinkedIn = "LinkedIn"
    Website  = "Website"
    Email    = "Email"
    Upwork   = "Upwork"
    Manual   = "Manual"


class CreateLeadRequest(BaseModel):
    name:             str
    company:          Optional[str] = None
    email:            Optional[str] = None
    phone:            Optional[str] = None
    source:           LeadSource    = LeadSource.Manual
    service_interest: Optional[str] = None
    message:          str


class UpdateLeadRequest(BaseModel):
    status:   Optional[LeadStatus]   = None
    priority: Optional[LeadPriority] = None
    score:    Optional[int]          = None


class LeadResponse(BaseModel):
    id:               str
    name:             str
    company:          Optional[str]
    email:            Optional[str]
    phone:            Optional[str]
    source:           str
    service_interest: Optional[str]
    message:          str
    status:           str
    score:            Optional[int]
    priority:         Optional[str]
    created_at:       datetime
    updated_at:       datetime


class AIAnalysisResponse(BaseModel):
    id:                  str
    lead_id:             str
    summary:             Optional[str]
    intent:              Optional[str]
    urgency:             Optional[str]
    qualification_label: Optional[str]
    recommended_action:  Optional[str]
    confidence:          Optional[float]
    analyzed_at:         datetime


class LeadEventResponse(BaseModel):
    id:         str
    lead_id:    str
    event_type: str
    event_data: dict
    created_at: datetime


class LeadDetailResponse(BaseModel):
    lead:     LeadResponse
    analysis: Optional[AIAnalysisResponse]
    events:   list[LeadEventResponse]


class PaginatedLeadsResponse(BaseModel):
    leads:       list[LeadResponse]
    total:       int
    page:        int
    per_page:    int
    total_pages: int


class DashboardStatsResponse(BaseModel):
    total_leads:   int
    hot_leads:     int
    warm_leads:    int
    new_today:     int
    average_score: float
    recent_leads:  list[LeadResponse]


# ── NEW: CSV Upload Response ───────────────────────────────────
class CSVUploadError(BaseModel):
    row:    int
    reason: str


class CSVUploadResponse(BaseModel):
    success:        bool
    total_in_file:  int
    imported:       int
    skipped:        int
    errors:         list[CSVUploadError]
    message:        str