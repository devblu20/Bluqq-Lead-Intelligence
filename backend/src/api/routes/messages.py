from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from src.middleware.auth_middleware import get_current_user
from src.services.message_service import send_message_to_lead, get_conversations
from src.config.database import query

router = APIRouter()


class SendMessageRequest(BaseModel):
    lead_id:      str
    platform:     str
    message:      str
    use_template: bool = False


class ConnectChannelRequest(BaseModel):
    platform:        str
    access_token:    str
    phone_number_id: Optional[str] = None
    ig_account_id:   Optional[str] = None
    account_name:    Optional[str] = None


@router.post("/send")
async def send_message(
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    return await send_message_to_lead(
        org_id=current_user["org_id"],
        lead_id=body.lead_id,
        platform=body.platform,
        message=body.message,
        use_template=body.use_template
    )


@router.get("/conversations/{lead_id}")
def get_lead_conversations(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    return get_conversations(
        org_id=current_user["org_id"],
        lead_id=lead_id
    )


@router.post("/channels/connect")
def connect_channel(
    body: ConnectChannelRequest,
    current_user: dict = Depends(get_current_user)
):
    result = query(
        """
        INSERT INTO channels
            (org_id, platform, access_token, phone_number_id, ig_account_id, account_name)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (org_id, platform) DO UPDATE SET
            access_token    = EXCLUDED.access_token,
            phone_number_id = EXCLUDED.phone_number_id,
            ig_account_id   = EXCLUDED.ig_account_id,
            account_name    = EXCLUDED.account_name,
            is_active       = TRUE
        RETURNING id, platform, account_name, is_active, created_at
        """,
        (current_user["org_id"], body.platform, body.access_token,
         body.phone_number_id, body.ig_account_id, body.account_name),
        fetch="one"
    )
    return dict(result)


@router.get("/channels")
def get_channels(current_user: dict = Depends(get_current_user)):
    results = query(
        "SELECT id, platform, account_name, is_active, created_at FROM channels WHERE org_id = %s",
        (current_user["org_id"],), fetch="all"
    )
    return [dict(r) for r in results] if results else []