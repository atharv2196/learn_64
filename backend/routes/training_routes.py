"""
Training routes – start sessions, submit moves, get progress.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user_model import User
from backend.models.opening_model import Opening
from backend.models.performance_model import TrainingHistory, MoveResult, RepetitionSchedule
from backend.schemas import (
    StartTrainingRequest,
    StartTrainingResponse,
    SubmitMoveRequest,
    SubmitMoveResponse,
    StudentProgress,
    OpeningAccuracy,
)
from backend.auth import require_verified_user
from backend.services.trainer_engine import (
    start_training_session,
    submit_student_move,
    get_session,
    advance_session,
    cleanup_session,
)
from backend.services.spaced_repetition import get_due_reviews, get_weak_openings

router = APIRouter(prefix="/api/training", tags=["training"])


# ── Start Training ───────────────────────────────────────
@router.post("/start", response_model=StartTrainingResponse)
async def start_training(
    body: StartTrainingRequest,
    current_user: User = Depends(require_verified_user),
):
    """Start a new guided training session for a repertoire line."""
    _ = current_user
    try:
        return start_training_session(
            repertoire_id=body.repertoire_id,
            line_index=body.line_index,
            mode=body.mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Submit Move ──────────────────────────────────────────
@router.post("/submit-move", response_model=SubmitMoveResponse)
async def submit_move_route(
    body: SubmitMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
):
    """Validate the student's move and return feedback + next steps."""
    try:
        return await submit_student_move(
            db,
            current_user.id,
            body.session_id,
            body.user_move,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Get Session Status ───────────────────────────────────
@router.get("/session/{session_id}")
async def get_session_status(session_id: str):
    """Get current state of a training session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    moves = session["moves"]
    step = session["current_step"]
    return {
        "session_id": session_id,
        "repertoire_id": session["repertoire_id"],
        "line_name": session["line_name"],
        "mode": session["mode"],
        "side": session["side"],
        "current_step": step,
        "total_moves": len(moves),
        "complete": step >= len(moves),
    }


# ── End Session ──────────────────────────────────────────
@router.delete("/session/{session_id}")
async def end_session(session_id: str):
    """End and cleanup a training session."""
    cleanup_session(session_id)
    return {"detail": "Session ended."}


# ── Progress / Analytics ─────────────────────────────────
@router.get("/progress", response_model=StudentProgress)
async def progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
):
    """Get progress analytics for the current user."""
    target_id = current_user.id
    target_name = current_user.name

    # Per-opening accuracy
    stmt = (
        select(
            Opening.repertoire_id,
            Opening.name,
            Opening.category,
            func.count().label("total"),
            func.sum(case((TrainingHistory.result == MoveResult.CORRECT, 1), else_=0)).label("correct"),
        )
        .join(Opening, TrainingHistory.opening_id == Opening.id)
        .where(TrainingHistory.user_id == target_id)
        .group_by(Opening.repertoire_id, Opening.name, Opening.category)
    )
    rows = (await db.execute(stmt)).all()

    accuracies: List[OpeningAccuracy] = []
    for row in rows:
        total = row.total or 0
        correct = row.correct or 0
        accuracies.append(
            OpeningAccuracy(
                repertoire_id=row.repertoire_id,
                opening_name=row.name,
                category=row.category,
                total_attempts=total,
                correct=correct,
                accuracy=round(correct / total, 3) if total else 0.0,
            )
        )

    # Daily streak
    streak = await _compute_streak(db, target_id)

    # Weak openings
    weak = await get_weak_openings(db, target_id)
    weak_names: List[str] = []
    for sched in weak:
        opening = await db.get(Opening, sched.opening_id)
        if opening:
            weak_names.append(opening.name)

    # Lines completed (unique line_names with at least one correct)
    lines_stmt = (
        select(func.count(func.distinct(TrainingHistory.line_name)))
        .where(
            TrainingHistory.user_id == target_id,
            TrainingHistory.result == MoveResult.CORRECT,
        )
    )
    lines_completed = (await db.execute(lines_stmt)).scalar() or 0

    # Due reviews count
    due = await get_due_reviews(db, target_id)

    return StudentProgress(
        user_id=target_id,
        user_name=target_name,
        accuracies=accuracies,
        daily_streak=streak,
        weakest_openings=weak_names,
        total_lines_completed=lines_completed,
        review_due_count=len(due),
    )


# ── Internal helpers ─────────────────────────────────────
async def _compute_streak(db: AsyncSession, user_id: int) -> int:
    """Compute the current daily practice streak."""
    stmt = (
        select(func.date(TrainingHistory.timestamp))
        .where(TrainingHistory.user_id == user_id)
        .group_by(func.date(TrainingHistory.timestamp))
        .order_by(func.date(TrainingHistory.timestamp).desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return 0

    streak = 1
    for i in range(1, len(rows)):
        prev = rows[i - 1]
        curr = rows[i]
        try:
            diff = (prev - curr).days
        except TypeError:
            break
        if diff == 1:
            streak += 1
        else:
            break
    return streak
