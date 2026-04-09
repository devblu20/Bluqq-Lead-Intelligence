from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from src.schemas.auth import (
    SignupRequest, LoginRequest,
    TokenResponse, UserResponse
)
from src.services.auth_service import (
    signup_user, login_user, create_access_token
)
from src.services.email_service import (
    generate_code, store_verification_code,
    verify_code, send_verification_email
)
from src.middleware.auth_middleware import get_current_user

router = APIRouter()


class SendCodeRequest(BaseModel):
    email: EmailStr

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


@router.post("/send-code", status_code=200)
def send_code(body: SendCodeRequest):
    from src.models.user import get_user_by_email
    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    code = generate_code()
    store_verification_code(body.email, code)
    send_verification_email(body.email, code)
    return {
        "message": f"Verification code sent to {body.email}",
        "email": body.email
    }


@router.post("/verify-code", status_code=200)
def check_code(body: VerifyCodeRequest):
    valid = verify_code(body.email, body.code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"verified": True, "email": body.email}


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(body: SignupRequest):
    try:
        business_type = getattr(body, 'businessType', None) or getattr(body, 'business_type', None)
        user = signup_user(
            name=body.name,
            email=body.email,
            password=body.password,
            business_type=business_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token_data = {
        "user_id": str(user["id"]),
        "org_id":  str(user.get("org_id")),
    }

    token = create_access_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {**user}
    }

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    try:
        user = login_user(email=body.email, password=body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    token = create_access_token({
        "user_id": str(user["id"]),
        "org_id": str(user.get("org_id")),
    })
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user