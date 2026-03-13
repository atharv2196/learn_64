"""
User ORM model – Firebase-based authentication with role support.
Roles: admin (single, OTP-verified), teacher (added by admin), student (self-register).
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.STUDENT)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    otp_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    training_history = relationship("TrainingHistory", back_populates="user", lazy="selectin")
    repetition_schedules = relationship("RepetitionSchedule", back_populates="user", lazy="selectin")
    assignments_received = relationship(
        "Assignment", back_populates="student", foreign_keys="Assignment.student_id", lazy="selectin"
    )
    assignments_given = relationship(
        "Assignment", back_populates="assigned_by_user", foreign_keys="Assignment.assigned_by", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} role={self.role.value} email={self.email}>"
