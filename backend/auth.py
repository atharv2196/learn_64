"""
Firebase authentication helpers with role-based access control.
Roles: admin (single, OTP-verified), teacher (admin-created), student (self-register).
Admin can also act as teacher.
"""

from __future__ import annotations

from typing import Any, Mapping, cast

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models.user_model import User, UserRole

settings = get_settings()
FIREBASE_PROJECT_ID = "chess-46e00"

# Reusable transport for fetching Google's public keys
_g_request = google_requests.Request()


def _extract_token(request: Request) -> str:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )
    return auth_header[7:]


def _verify_firebase_token(token: str) -> Mapping[str, Any]:
    """Verify a Firebase ID token using Google's public keys. No credentials needed."""
    try:
        claims = google_id_token.verify_firebase_token(
            token, _g_request, audience=FIREBASE_PROJECT_ID
        )
        return claims
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase token: {exc}",
        )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency – verifies Firebase ID token and returns/creates User."""
    token = _extract_token(request)
    decoded = _verify_firebase_token(token)

    firebase_uid = cast(str, decoded.get("user_id") or decoded["sub"])
    email = cast(str, decoded.get("email", ""))
    name = cast(str, decoded.get("name") or decoded.get("display_name") or email.split("@")[0])
    email_verified = bool(decoded.get("email_verified", False))

    # Find or create user by firebase_uid
    stmt = select(User).where(User.firebase_uid == firebase_uid)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        # Check if there's a pending teacher invite for this email
        pending_stmt = select(User).where(
            User.email == email,
            User.firebase_uid.startswith("pending_teacher_"),
        )
        pending = (await db.execute(pending_stmt)).scalar_one_or_none()

        if pending:
            # Merge: update the pending record with real firebase_uid
            pending.firebase_uid = firebase_uid
            pending.name = name
            await db.flush()
            return pending

        # Determine role: if this email matches ADMIN_EMAIL and no admin exists, make them admin
        role = UserRole.STUDENT
        if settings.ADMIN_EMAIL and email.lower() == settings.ADMIN_EMAIL.lower():
            admin_check = select(User).where(User.role == UserRole.ADMIN)
            existing_admin = (await db.execute(admin_check)).scalar_one_or_none()
            if not existing_admin:
                role = UserRole.ADMIN

        user = User(
            firebase_uid=firebase_uid,
            name=name,
            email=email,
            role=role,
            email_verified=email_verified,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    # Update name/email if changed on Google side
    if user.name != name or user.email != email:
        user.name = name
        user.email = email
        await db.flush()

    # Trust Firebase's verified-email claim for Google sign-in users.
    if email_verified and not user.email_verified:
        user.email_verified = True
        user.otp_code = None
        user.otp_expires_at = None
        await db.flush()

    # Emergency fallback: allow instant verification in debug mode.
    if settings.OTP_DEBUG_MODE and not user.email_verified:
        user.email_verified = True
        user.otp_code = None
        user.otp_expires_at = None
        await db.flush()

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency – requires the current user to be an admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin email not verified. Please verify with OTP first.",
        )
    return current_user


async def require_teacher_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency – requires teacher or admin role. Admin can act as teacher."""
    if current_user.role not in (UserRole.ADMIN, UserRole.TEACHER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required.",
        )
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify with OTP first.",
        )
    return current_user


async def require_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency - requires a signed-in user with verified email OTP."""
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify with OTP first.",
        )
    return current_user
