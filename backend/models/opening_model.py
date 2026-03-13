"""
Opening ORM model – represents a curated chess opening / repertoire.
No more PGN – openings are loaded from JSON repertoire files.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Opening(Base):
    __tablename__ = "openings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    repertoire_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(10), nullable=False, default="white")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    line_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    training_history = relationship("TrainingHistory", back_populates="opening", lazy="selectin")
    repetition_schedules = relationship("RepetitionSchedule", back_populates="opening", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Opening id={self.id} repertoire_id={self.repertoire_id} name={self.name}>"
