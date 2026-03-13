"""
Email / OTP Service – generates and sends OTP codes for admin verification.
"""

from __future__ import annotations

import logging
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from backend.config import get_settings

logger = logging.getLogger("learn64.email")
settings = get_settings()


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP code."""
    return "".join(random.choices(string.digits, k=length))


def otp_expiry(minutes: int = 10) -> datetime:
    """Return an expiry timestamp `minutes` from now."""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send an OTP verification email. Returns True on success."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured – OTP for %s is: %s", to_email, otp_code)
        return True  # In dev, just log it

    subject = f"Learn_64 – Your verification code: {otp_code}"
    body = (
        f"Your Learn_64 verification code is:\n\n"
        f"    {otp_code}\n\n"
        f"This code expires in 10 minutes.\n"
        f"If you did not request this, please ignore this email."
    )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("OTP email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send OTP email to %s: %s", to_email, exc)
        return False
