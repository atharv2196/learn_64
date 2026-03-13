"""
Application configuration using pydantic-settings.
Supports .env file and environment variable overrides.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "Learn_64"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────
    # SQLite by default; switch to PostgreSQL via env var
    DATABASE_URL: str = "sqlite+aiosqlite:///./chess_trainer.db"

    # ── JWT ──────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── Stockfish ────────────────────────────────────────
    STOCKFISH_PATH: str = "stockfish"  # system PATH or absolute path
    STOCKFISH_DEPTH: int = 18
    STOCKFISH_POOL_SIZE: int = 2  # engine instances in pool

    # ── File paths ───────────────────────────────────────
    REPERTOIRES_DIR: str = str(Path(__file__).resolve().parent.parent / "repertoires")

    # ── Rate limiting ────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── Admin ────────────────────────────────────────────
    ADMIN_EMAIL: str = ""  # Set this to the admin's email address

    # ── SMTP (for OTP emails) ────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Learn_64 <noreply@learn64.com>"

    # ── Resend (recommended on Render for OTP emails) ───
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
