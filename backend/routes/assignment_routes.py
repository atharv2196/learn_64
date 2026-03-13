"""
Assignment routes – teachers assign specific lines to students.
Admin can also assign (since admin can act as teacher).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user_model import User, UserRole
from backend.models.assignment_model import Assignment, AssignmentStatus
from backend.auth import require_verified_user, require_teacher_or_admin
from backend.services.opening_tree_loader import get_repertoire, get_repertoire_line
from backend.schemas import (
    CreateAssignmentRequest,
    AssignmentResponse,
    AssignmentListResponse,
)

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


def _build_assignment_response(a: Assignment, student: User | None, teacher: User | None) -> AssignmentResponse:
    return AssignmentResponse(
        id=a.id,
        student_id=a.student_id,
        student_name=student.name if student else "Unknown",
        assigned_by=a.assigned_by,
        assigned_by_name=teacher.name if teacher else "Unknown",
        repertoire_id=a.repertoire_id,
        line_index=a.line_index,
        line_name=a.line_name,
        note=a.note,
        status=a.status.value,
        created_at=a.created_at,
        completed_at=a.completed_at,
    )


@router.post("", response_model=AssignmentResponse)
async def create_assignment(
    body: CreateAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher_or_admin),
):
    """Teacher/admin assigns a specific line to a student."""
    # Validate student exists and is a student
    student = await db.get(User, body.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    if student.role not in (UserRole.STUDENT,):
        raise HTTPException(status_code=400, detail="Can only assign lines to students.")

    # Validate repertoire and line exist
    rep = get_repertoire(body.repertoire_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Repertoire not found.")
    line = get_repertoire_line(body.repertoire_id, body.line_index)
    if not line:
        raise HTTPException(status_code=404, detail="Line not found in repertoire.")

    line_name = line.get("line_name", f"Line {body.line_index}")

    assignment = Assignment(
        student_id=body.student_id,
        assigned_by=teacher.id,
        repertoire_id=body.repertoire_id,
        line_index=body.line_index,
        line_name=line_name,
        note=body.note,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)

    return _build_assignment_response(assignment, student, teacher)


@router.get("/my", response_model=AssignmentListResponse)
async def my_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
):
    """Get assignments for the current student user."""
    stmt = (
        select(Assignment)
        .where(Assignment.student_id == current_user.id)
        .order_by(Assignment.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for a in rows:
        student = await db.get(User, a.student_id)
        teacher = await db.get(User, a.assigned_by)
        items.append(_build_assignment_response(a, student, teacher))

    return AssignmentListResponse(assignments=items, total=len(items))


@router.get("/given", response_model=AssignmentListResponse)
async def given_assignments(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher_or_admin),
):
    """Get all assignments created by the current teacher/admin."""
    stmt = (
        select(Assignment)
        .where(Assignment.assigned_by == teacher.id)
        .order_by(Assignment.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for a in rows:
        student = await db.get(User, a.student_id)
        items.append(_build_assignment_response(a, student, teacher))

    return AssignmentListResponse(assignments=items, total=len(items))


@router.get("/students", response_model=dict)
async def list_assignable_students(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher_or_admin),
):
    """List students that can be assigned lines (for teacher UI)."""
    stmt = select(User).where(User.role == UserRole.STUDENT).order_by(User.name)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "students": [
            {"id": u.id, "name": u.name, "email": u.email}
            for u in rows
        ]
    }


@router.patch("/{assignment_id}/complete")
async def complete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
):
    """Mark an assignment as completed (student or teacher/admin)."""
    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    # Only the assigned student or the assigner can mark complete
    if current_user.id != assignment.student_id and current_user.id != assignment.assigned_by:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Not authorized.")

    assignment.status = AssignmentStatus.COMPLETED
    assignment.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return {"detail": "Assignment marked as completed."}


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher_or_admin),
):
    """Delete an assignment (teacher/admin only)."""
    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    # Only the assigner or admin can delete
    if teacher.id != assignment.assigned_by and teacher.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized.")

    await db.delete(assignment)
    await db.flush()
    return {"detail": "Assignment deleted."}
