import random
import string
from src.config.database import query
from src.config.settings import get_settings
import json

settings = get_settings()


def generate_code() -> str:
    """Generate 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


def store_verification_code(email: str, code: str):
    """Store code in DB with 15-minute expiry"""
    query(
        """
        INSERT INTO verification_codes (email, code, expires_at)
        VALUES (%s, %s, NOW() + INTERVAL '15 minutes')
        ON CONFLICT (email)
        DO UPDATE SET
            code       = EXCLUDED.code,
            expires_at = EXCLUDED.expires_at,
            used       = FALSE
        """,
        (email, code),
        fetch="none"
    )


def verify_code(email: str, code: str) -> bool:
    """Check if code is valid and not expired"""
    result = query(
        """
        SELECT id FROM verification_codes
        WHERE email = %s
          AND code = %s
          AND expires_at > NOW()
          AND used = FALSE
        LIMIT 1
        """,
        (email, code),
        fetch="one"
    )
    if result:
        # Mark as used
        query(
            "UPDATE verification_codes SET used = TRUE WHERE email = %s",
            (email,),
            fetch="none"
        )
        return True
    return False


def send_verification_email(email: str, code: str) -> bool:
    """
    Send verification email.
    Uses Resend if API key is configured, otherwise logs to console.
    """
    # Always log for development
    print(f"\n{'='*40}")
    print(f"[EMAIL] Verification code for {email}: {code}")
    print(f"{'='*40}\n")

    # Try Resend if configured
    resend_key = getattr(settings, 'RESEND_API_KEY', None)
    if resend_key and resend_key != 're_your_key_here':
        try:
            import resend
            resend.api_key = resend_key
            resend.Emails.send({
                "from":    getattr(settings, 'FROM_EMAIL', 'BluQQ <noreply@bluqq.com>'),
                "to":      [email],
                "subject": f"Your BluQQ verification code: {code}",
                "html":    f"""
                <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#0F172A;color:#F9FAFB;border-radius:16px;">
                    <div style="margin-bottom:32px;">
                        <span style="font-size:24px;font-weight:800;background:linear-gradient(135deg,#2563EB,#60A5FA);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">BluQQ</span>
                    </div>
                    <h2 style="font-size:22px;font-weight:700;margin-bottom:12px;color:#F9FAFB;">Verify your email</h2>
                    <p style="color:#9CA3AF;margin-bottom:28px;line-height:1.6;">Enter this code to complete your registration. It expires in 15 minutes.</p>
                    <div style="background:#1F2937;border:1px solid #374151;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                        <span style="font-size:36px;font-weight:800;letter-spacing:0.2em;color:#60A5FA;font-family:monospace;">{code}</span>
                    </div>
                    <p style="color:#4B5563;font-size:12px;">If you didn't request this, ignore this email.</p>
                </div>
                """
            })
            return True
        except Exception as e:
            print(f"[EMAIL] Resend failed: {e}")
    return True  # Always return True — code is logged to console