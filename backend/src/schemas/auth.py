from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    businessType: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    business_type: Optional[str] = None  # ← yeh add karo — frontend ko chahiye redirect ke liye

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Optional[dict] = None


class MessageResponse(BaseModel):
    message: str