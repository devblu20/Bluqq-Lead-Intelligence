from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Existing fields ───────────────────────────────
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    OPENAI_API_KEY: str
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    RESEND_API_KEY: str
    FROM_EMAIL: str
    ENCRYPTION_KEY: str = ""

    WHATSAPP_ACCESS_TOKEN: str
    WHATSAPP_PHONE_NUMBER_ID: str
    WHATSAPP_BUSINESS_ACCOUNT_ID: str
    WHATSAPP_API_VERSION: str

    # ── Voice Agent fields (naaye) ────────────────────
    TWILIO_ACCOUNT_SID:  str = ""
    TWILIO_AUTH_TOKEN:   str = ""
    TWILIO_PHONE_NUMBER: str = ""
    SERVER_URL:          str = ""
    REDIS_URL:           str = "redis://localhost:6379"
    AGENT_PHONE_NUMBER:  str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"          # ← Yeh line add ki — unknown keys ignore honge


@lru_cache()
def get_settings() -> Settings:
    return Settings()