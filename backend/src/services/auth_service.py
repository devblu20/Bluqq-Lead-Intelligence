from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException
from src.config.settings import get_settings
from src.models.user import get_user_by_email, get_user_by_id, create_user
from src.models.organisation import create_org, add_member, get_org_by_user

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    """Create a JWT token containing user_id and org_id"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def decode_token(token: str) -> Optional[dict]:
    """
    Decode JWT token and return full payload dict.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def signup_user(name: str, email: str, password: str) -> dict:
    # Validate password length
    if len(password) > 70:
        raise ValueError("Password must be less than 70 characters")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    # Check email not already taken
    existing = get_user_by_email(email)
    if existing:
        raise ValueError("Email already registered")

    # Create user
    hashed = hash_password(password)
    user = create_user(name, email, hashed)

    # Create org for this user
    org = create_org(name=f"{name}'s Workspace")
    add_member(org_id=str(org["id"]), user_id=str(user["id"]), role="owner")

    # Return user with org_id attached
    user_dict = dict(user)
    user_dict["org_id"] = str(org["id"])
    return user_dict


def login_user(email: str, password: str) -> dict:
    """
    Authenticate user with email + password.
    Raises ValueError if credentials are wrong.
    """
    user = get_user_by_email(email)
    if not user:
        raise ValueError("Invalid email or password")

    if not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")

    # Fetch org for this user
    org = get_org_by_user(str(user["id"]))
    org_id = str(org["id"]) if org else None

    # Return user with org_id attached
    user_dict = dict(user)
    user_dict["org_id"] = org_id
    return user_dict