"""
Spaced Repetition Service
─────────────────────────
Implements an adaptive scheduling algorithm:
  1st mistake  → repeat after 1 day
  2nd mistake  → repeat after 6 hours
  3rd+ mistake → repeat immediately (same session)
  Correct streak → 3d → 7d → 14d → 30d → 60d
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.performance_model import RepetitionSchedule, MoveResult


# ── Interval tables ──────────────────────────────────────
_CORRECT_INTERVALS: list[timedelta] = [
    timedelta(days=3),
    timedelta(days=7),
    timedelta(days=14),
    timedelta(days=30),
    timedelta(days=60),
]

_WRONG_INTERVALS: list[timedelta] = [
    timedelta(days=1),       # 1st mistake
    timedelta(hours=6),      # 2nd mistake
    timedelta(seconds=0),    # 3rd+ mistake → immediate
]


def _next_interval_correct(consecutive_correct: int) -> timedelta:
    idx = min(consecutive_correct, len(_CORRECT_INTERVALS) - 1)
    return _CORRECT_INTERVALS[idx]


def _next_interval_wrong(consecutive_wrong: int) -> timedelta:
    idx = min(consecutive_wrong, len(_WRONG_INTERVALS) - 1)
    return _WRONG_INTERVALS[idx]


async def update_schedule(
    db: AsyncSession,
    user_id: int,
    opening_id: int,
    result: MoveResult,
    line_name: str = "",
) -> RepetitionSchedule:
    """
    Create or update the repetition schedule after a move attempt.
    """
    stmt = select(RepetitionSchedule).where(
        RepetitionSchedule.user_id == user_id,
        RepetitionSchedule.opening_id == opening_id,
        RepetitionSchedule.line_name == line_name,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if row is None:
        row = RepetitionSchedule(
            user_id=user_id,
            opening_id=opening_id,
            line_name=line_name,
            next_review_time=now,
            strength_score=0.0,
            consecutive_correct=0,
            consecutive_wrong=0,
            total_attempts=0,
        )
        db.add(row)

    row.total_attempts += 1

    if result == MoveResult.CORRECT:
        row.consecutive_correct += 1
        row.consecutive_wrong = 0
        delta = _next_interval_correct(row.consecutive_correct - 1)
        row.strength_score = min(row.strength_score + 10.0, 100.0)
    else:
        row.consecutive_wrong += 1
        row.consecutive_correct = 0
        delta = _next_interval_wrong(row.consecutive_wrong - 1)
        row.strength_score = max(row.strength_score - 15.0, 0.0)

    row.next_review_time = now + delta
    await db.flush()
    return row


async def get_due_reviews(
    db: AsyncSession,
    user_id: int,
    limit: int = 10,
) -> List[RepetitionSchedule]:
    """Return openings due for review, ordered by urgency."""
    now = datetime.now(timezone.utc)
    stmt = (
        select(RepetitionSchedule)
        .where(
            RepetitionSchedule.user_id == user_id,
            RepetitionSchedule.next_review_time <= now,
        )
        .order_by(RepetitionSchedule.next_review_time.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_weak_openings(
    db: AsyncSession,
    user_id: int,
    threshold: float = 40.0,
) -> List[RepetitionSchedule]:
    """Return openings with strength below a threshold."""
    stmt = (
        select(RepetitionSchedule)
        .where(
            RepetitionSchedule.user_id == user_id,
            RepetitionSchedule.strength_score < threshold,
        )
        .order_by(RepetitionSchedule.strength_score.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
