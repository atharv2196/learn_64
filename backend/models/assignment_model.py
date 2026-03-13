"""
Assignment ORM model – teacher assigns a specific repertoire line to a student.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import ForeignKey, String, Integer, Text, Enum as SAEnum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class AssignmentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    repertoire_id: Mapped[str] = mapped_column(String(100), nullable=False)
    line_index: Mapped[int] = mapped_column(Integer, nullable=False)
    line_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        SAEnum(AssignmentStatus), nullable=False, default=AssignmentStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student = relationship("User", back_populates="assignments_received", foreign_keys=[student_id])
    assigned_by_user = relationship("User", back_populates="assignments_given", foreign_keys=[assigned_by])

    def __repr__(self) -> str:
        return (
            f"<Assignment id={self.id} student={self.student_id} "
            f"repertoire={self.repertoire_id} line={self.line_index} status={self.status.value}>"
        )
