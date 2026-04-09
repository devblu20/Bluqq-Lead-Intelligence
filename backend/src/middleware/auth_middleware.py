from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.services.auth_service import decode_token
from src.models.user import get_user_by_id

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> dict:
    """
    Middleware that:
    1. Reads the Bearer token from the request header
    2. Decodes it to get user_id and org_id
    3. Fetches user from DB
    4. Returns user dict with org_id attached — or raises 401 if anything is wrong

    Usage in any route:
        @router.get("/protected")
        def protected(user = Depends(get_current_user)):
            return {"user": user}
            # user["org_id"] is now always available
    """
    token = credentials.credentials

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # support both "user_id" (new) and "sub" (old tokens)
    user_id = payload.get("user_id") or payload.get("sub")
    org_id  = payload.get("org_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure"
        )

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    user_dict = dict(user)
    user_dict["org_id"] = org_id
    return user_dict