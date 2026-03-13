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

import httpx

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
    subject = f"Learn_64 - Your verification code: {otp_code}"
    body = (
        f"Your Learn_64 verification code is:\n\n"
        f"    {otp_code}\n\n"
        f"This code expires in 10 minutes.\n"
        f"If you did not request this, please ignore this email."
    )

    # Preferred on Render: send via HTTPS (port 443) using Resend.
    resend_api_key = (settings.RESEND_API_KEY or "").strip()
    resend_from = (settings.RESEND_FROM or "").strip()
    if resend_api_key and resend_from:
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": resend_from,
                    "to": [to_email],
                    "subject": subject,
                    "text": body,
                },
                timeout=20,
            )
            response.raise_for_status()
            logger.info("OTP email sent via Resend to %s", to_email)
            return True
        except Exception as exc:
            logger.error("Resend delivery failed for %s: %s", to_email, exc)

    smtp_user = (settings.SMTP_USER or "").strip()
    # Gmail app passwords are often copied with spaces like "abcd efgh ijkl mnop".
    smtp_password = (settings.SMTP_PASSWORD or "").replace(" ", "").strip()

    if not smtp_user or not smtp_password:
        logger.warning("SMTP not configured – OTP for %s is: %s", to_email, otp_code)
        return True  # In dev, just log it

    msg = MIMEText(body)
    msg["Subject"] = subject
    # Use authenticated sender for maximum Gmail compatibility.
    msg["From"] = smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info("OTP email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send OTP email to %s: %s", to_email, exc)
        return False
