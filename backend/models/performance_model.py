"""
Performance-related ORM models:
  • TrainingHistory  – logs every move attempt
  • RepetitionSchedule – adaptive spaced-repetition state per user+opening+line
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    ForeignKey, String, Float, Integer, Enum as SAEnum,
    DateTime, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


# ── Enums ────────────────────────────────────────────────
class MoveResult(str, enum.Enum):
    CORRECT = "correct"
    WRONG = "wrong"


class TrainingMode(str, enum.Enum):
    LEARN = "learn"
    TEST = "test"
    REVIEW = "review"


# ── Training History ─────────────────────────────────────
class TrainingHistory(Base):
    __tablename__ = "training_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    opening_id: Mapped[int] = mapped_column(ForeignKey("openings.id"), nullable=False, index=True)
    line_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    mode: Mapped[TrainingMode] = mapped_column(
        SAEnum(TrainingMode), nullable=False, default=TrainingMode.LEARN
    )
    fen_position: Mapped[str] = mapped_column(String(100), nullable=False)
    move_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expected_move: Mapped[str] = mapped_column(String(10), nullable=False)
    user_move: Mapped[str] = mapped_column(String(10), nullable=False)
    result: Mapped[MoveResult] = mapped_column(SAEnum(MoveResult), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="training_history")
    opening = relationship("Opening", back_populates="training_history")

    def __repr__(self) -> str:
        return (
            f"<TrainingHistory user={self.user_id} opening={self.opening_id} "
            f"mode={self.mode.value} result={self.result.value}>"
        )


# ── Repetition Schedule ─────────────────────────────────
class RepetitionSchedule(Base):
    __tablename__ = "repetition_schedule"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    opening_id: Mapped[int] = mapped_column(ForeignKey("openings.id"), nullable=False, index=True)
    line_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    next_review_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    strength_score: Mapped[float] = mapped_column(Float, default=0.0)
    consecutive_correct: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_wrong: Mapped[int] = mapped_column(Integer, default=0)
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="repetition_schedules")
    opening = relationship("Opening", back_populates="repetition_schedules")

    def __repr__(self) -> str:
        return (
            f"<RepetitionSchedule user={self.user_id} opening={self.opening_id} "
            f"line={self.line_name} strength={self.strength_score:.1f}>"
        )
