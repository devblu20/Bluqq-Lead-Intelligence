import resend
import secrets
import hashlib
import random
import string
from datetime import datetime, timedelta
from src.config.settings import get_settings

settings = get_settings()
resend.api_key = settings.RESEND_API_KEY

FROM_ADDRESS = "BluQQ <noreply@bluqq.com>"

# ── In-memory OTP store (replace with Redis/DB in production) ─────────────────
_verification_codes: dict = {}


# ── OTP helpers ───────────────────────────────────────────────────────────────

def generate_code(length: int = 6) -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=length))

def store_verification_code(email: str, code: str, expiry_minutes: int = 10) -> None:
    """Store OTP in memory with expiry."""
    _verification_codes[email] = {
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=expiry_minutes),
    }

def verify_code(email: str, code: str) -> bool:
    """Check OTP — returns True if valid, deletes it after use."""
    record = _verification_codes.get(email)
    if not record:
        return False
    if record["expires_at"] < datetime.utcnow():
        del _verification_codes[email]
        return False
    if record["code"] != code:
        return False
    del _verification_codes[email]
    return True


# ── Token helpers (for password reset / email verify links) ───────────────────

def generate_token() -> str:
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def get_token_expiry(hours: int = 24) -> datetime:
    return datetime.utcnow() + timedelta(hours=hours)


# ── 1. OTP Verification Email ─────────────────────────────────────────────────

def send_verification_email(to_email: str, code: str) -> bool:
    """Send OTP code email before signup."""
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Your BluQQ verification code",
            "html": f"""
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
              <h2 style="margin:0 0 8px;font-size:22px;color:#fff;">Verify your email</h2>
              <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
                Use the code below to verify your email. It expires in 10 minutes.
              </p>
              <div style="background:rgba(0,194,168,0.08);border:1px solid rgba(0,194,168,0.25);
                          border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#00c2a8;">
                  {code}
                </span>
              </div>
              <p style="font-size:13px;color:rgba(255,255,255,0.3);">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
            """,
        })
        return True
    except Exception as e:
        print(f"[email] verification email failed: {e}")
        return False


# ── 2. Welcome Email ──────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, name: str) -> bool:
    """Send welcome email after successful signup."""
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Welcome to BluQQ 🎉",
            "html": f"""
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
              <h2 style="margin:0 0 8px;font-size:24px;color:#fff;">Welcome, {name}! 👋</h2>
              <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
                Your BluQQ account is ready. Start adding leads and let AI handle your outreach.
              </p>
              <a href="{settings.FRONTEND_URL}/dashboard"
                 style="display:inline-block;background:#00c2a8;color:#fff;text-decoration:none;
                        padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                Go to Dashboard →
              </a>
              <p style="margin-top:32px;font-size:13px;color:rgba(255,255,255,0.3);">
                The BluQQ Team
              </p>
            </div>
            """,
        })
        return True
    except Exception as e:
        print(f"[email] welcome email failed: {e}")
        return False


# ── 3. Password Reset Email ───────────────────────────────────────────────────

def send_password_reset_email(to_email: str, name: str, token: str) -> bool:
    """Send password reset link. Expires in 1 hour."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Reset your BluQQ password",
            "html": f"""
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
              <h2 style="margin:0 0 8px;font-size:22px;color:#fff;">Reset your password</h2>
              <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
                Hi {name}, we received a request to reset your password. This link expires in 1 hour.
              </p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#00c2a8;color:#fff;text-decoration:none;
                        padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                Reset Password →
              </a>
              <p style="margin-top:24px;font-size:13px;color:rgba(255,255,255,0.3);">
                If you didn't request this, ignore this email. Your password won't change.
              </p>
            </div>
            """,
        })
        return True
    except Exception as e:
        print(f"[email] password reset email failed: {e}")
        return False
