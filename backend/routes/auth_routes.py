"""
Authentication routes - Firebase-based with role support and OTP email verification.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models.user_model import User
from backend.auth import get_current_user
from backend.schemas import OTPVerify
from backend.services.email_service import generate_otp, otp_expiry, send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("learn64.auth")
settings = get_settings()


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "firebase_uid": current_user.firebase_uid,
        "role": current_user.role.value,
        "email_verified": current_user.email_verified,
    }


@router.post("/request-otp")
async def request_otp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an OTP code to the current user's email for verification."""

    if current_user.email_verified:
        return {"detail": "Email already verified."}

    otp = generate_otp()
    current_user.otp_code = otp
    current_user.otp_expires_at = otp_expiry()
    await db.flush()

    sent = send_otp_email(current_user.email, otp)
    if not sent:
        logger.warning("OTP fallback for %s is %s", current_user.email, otp)
        payload = {
            "detail": (
                "OTP generated but email delivery failed. "
                "Open backend logs to copy the OTP code."
            )
        }
        if settings.OTP_DEBUG_MODE:
            payload["otp_code"] = otp
        return payload

    payload = {"detail": "OTP sent to your email."}
    if settings.OTP_DEBUG_MODE:
        payload["otp_code"] = otp
    return payload


@router.post("/verify-otp")
async def verify_otp(
    body: OTPVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify the current user's email with OTP code."""

    if current_user.email_verified:
        return {"detail": "Email already verified."}

    if not current_user.otp_code or not current_user.otp_expires_at:
        raise HTTPException(status_code=400, detail="No OTP requested. Request one first.")

    if datetime.now(timezone.utc) > current_user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if current_user.otp_code != body.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    current_user.email_verified = True
    current_user.otp_code = None
    current_user.otp_expires_at = None
    await db.flush()

    return {"detail": "Email verified successfully."}


@router.post("/debug-verify")
async def debug_verify(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Debug fallback: directly verify email when OTP_DEBUG_MODE is enabled."""
    if not settings.OTP_DEBUG_MODE:
        raise HTTPException(status_code=403, detail="Debug verify is disabled.")

    if current_user.email_verified:
        return {"detail": "Email already verified."}

    current_user.email_verified = True
    current_user.otp_code = None
    current_user.otp_expires_at = None
    await db.flush()
    return {"detail": "Email verified via debug mode."}
