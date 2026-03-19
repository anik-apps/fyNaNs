from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    encryption_master_secret: str
    google_client_id: str = ""
    google_client_secret: str = ""
    apple_client_id: str = ""
    apple_client_secret: str = ""
    resend_api_key: str = ""
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False  # True in production (HTTPS)
    cookie_samesite: str = "lax"  # "strict" in production (same origin). Valid: strict, lax, none
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"  # sandbox, development, production
    plaid_webhook_url: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
