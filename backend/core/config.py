from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_SECRET = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION"

class Settings(BaseSettings):
    PROJECT_NAME: str = "RECLAIM"
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days

    # Database
    DATABASE_URL: str = "postgresql://admin:password@localhost:5432/smart_reimburse"

    # Frontend URL
    FRONTEND_URL: str = "https://reclaimai.dev,http://localhost:3000"

    # LLM (ILMU API for chat model)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.ilmu.ai/v1"
    CHAT_MODEL: str = "ilmu-glm-5.1"
    # CHAT_MODEL: str = "google/gemini-2.5-flash-lite"
    
    # (OpenRouter) for vision and embedding model
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    VISION_MODEL: str = "qwen/qwen3.5-flash-02-23"
    EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
    # Optional separate endpoint for the vision model (e.g. Gemini's OpenAI-compatible API).
    # Empty means OpenRouter.
    VISION_BASE_URL: str = ""
    VISION_API_KEY: str = ""

    # PayPal (sandbox by default; mock mode needs no keys)
    PAYPAL_MOCK_MODE: bool = True
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"
    PAYPAL_WEB_URL: str = "https://www.sandbox.paypal.com"
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_CLIENT_SECRET: str = ""
    PAYPAL_WEBHOOK_ID: str = ""
    PAYPAL_CURRENCY: str = "MYR"
    # The only identity mock mode's fake PayPal reports at sign-in (the seeded demo employee). Empty turns it off.
    PAYPAL_MOCK_SIGNIN_PAYER_ID: str = "DEMOMOCKS123"
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"

    # Autonomous reimbursement — kill switch (set to false to force all claims through HR)
    AUTO_REIMBURSE_ENABLED: bool = True

    # VAPID keys for Web Push (auto-generated on startup if not configured)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "reclaim@reclaimai.dev"

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def check_secret_key(self) -> "Settings":
        if self.SECRET_KEY == _DEFAULT_SECRET:
            raise ValueError("SECRET_KEY must be set to a secure value in .env")
        return self

settings = Settings()
