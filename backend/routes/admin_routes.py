"""
Admin routes – manage teachers and view all users.
Only accessible by verified admin.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user_model import User, UserRole
from backend.auth import require_admin
from backend.schemas import (
    AddTeacherRequest,
    UserListItem,
    UserListResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=UserListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all users (admin only)."""
    stmt = select(User).order_by(User.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        UserListItem(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role.value,
            created_at=u.created_at,
        )
        for u in rows
    ]
    return UserListResponse(users=items, total=len(items))


@router.get("/students", response_model=UserListResponse)
async def list_students(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all students (admin only)."""
    stmt = select(User).where(User.role == UserRole.STUDENT).order_by(User.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        UserListItem(id=u.id, name=u.name, email=u.email, role=u.role.value, created_at=u.created_at)
        for u in rows
    ]
    return UserListResponse(users=items, total=len(items))


@router.get("/teachers", response_model=UserListResponse)
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all teachers (admin only)."""
    stmt = select(User).where(User.role == UserRole.TEACHER).order_by(User.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        UserListItem(id=u.id, name=u.name, email=u.email, role=u.role.value, created_at=u.created_at)
        for u in rows
    ]
    return UserListResponse(users=items, total=len(items))


@router.post("/add-teacher")
async def add_teacher(
    body: AddTeacherRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Promote an existing user to teacher, or pre-register a teacher by email."""
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    # Check if user already exists
    stmt = select(User).where(User.email == email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user:
        if user.role == UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Cannot change admin role.")
        if user.role == UserRole.TEACHER:
            raise HTTPException(status_code=400, detail="User is already a teacher.")
        user.role = UserRole.TEACHER
        await db.flush()
        return {"detail": f"{user.name or email} is now a teacher.", "user_id": user.id}
    else:
        # Pre-create a placeholder user that will be matched on first sign-in
        new_user = User(
            firebase_uid=f"pending_teacher_{email}",
            name=email.split("@")[0],
            email=email,
            role=UserRole.TEACHER,
        )
        db.add(new_user)
        await db.flush()
        return {"detail": f"Teacher invite created for {email}. They will get teacher role on sign-in.", "user_id": new_user.id}


@router.delete("/remove-teacher/{user_id}")
async def remove_teacher(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Demote a teacher back to student."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot demote admin.")
    if user.role != UserRole.TEACHER:
        raise HTTPException(status_code=400, detail="User is not a teacher.")
    user.role = UserRole.STUDENT
    await db.flush()
    return {"detail": f"{user.name} demoted to student."}
