from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from src.config.settings import get_settings
from src.models.user import get_user_by_email, get_user_by_id, create_user
from src.models.organisation import create_org, add_member, get_org_by_user
from src.services.email_service import (
    send_welcome_email,
    generate_code,
    store_verification_code,
    send_verification_email,
    send_password_reset_email,
    generate_token,
    hash_token,
    get_token_expiry,
)

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def signup_user(name: str, email: str, password: str, business_type: Optional[str] = None) -> dict:
    if len(password) > 70:
        raise ValueError("Password must be less than 70 characters")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    existing = get_user_by_email(email)
    if existing:
        raise ValueError("Email already registered")

    hashed = hash_password(password)

    # create_user ke saath business_type pass karo
    user = create_user(name, email, hashed, business_type=business_type)

    org = create_org(name=f"{name}'s Workspace")
    add_member(org_id=str(org["id"]), user_id=str(user["id"]), role="owner")

    user_dict = dict(user)
    user_dict["org_id"] = str(org["id"])

    # Send welcome email only
    send_welcome_email(to_email=email, name=name)

    return user_dict


def login_user(email: str, password: str) -> dict:
    user = get_user_by_email(email)
    if not user:
        raise ValueError("Invalid email or password")
    if not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")

    org = get_org_by_user(str(user["id"]))
    user_dict = dict(user)
    user_dict["org_id"] = str(org["id"]) if org else None
    return user_dict


def request_password_reset(email: str) -> bool:
    user = get_user_by_email(email)
    if not user:
        return True
    reset_token = generate_token()
    send_password_reset_email(to_email=email, name=user["name"], token=reset_token)
    return True

def verify_email_token(token: str) -> bool:
    return True

def reset_password(token: str, new_password: str) -> bool:
    if len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters")
    if len(new_password) > 70:
        raise ValueError("Password must be less than 70 characters")
    return True