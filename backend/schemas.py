"""
Pydantic schemas (request / response DTOs) for Learn_64.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
#  Auth
# ═══════════════════════════════════════════════════════════
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    firebase_uid: str
    role: str
    email_verified: bool

    model_config = {"from_attributes": True}


class OTPRequest(BaseModel):
    """Admin requests an OTP to verify their email."""
    pass  # No body needed, uses current user's email


class OTPVerify(BaseModel):
    otp_code: str = Field(..., min_length=6, max_length=6)


# ═══════════════════════════════════════════════════════════
#  Admin – Teacher Management
# ═══════════════════════════════════════════════════════════
class AddTeacherRequest(BaseModel):
    email: str


class UserListItem(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: List[UserListItem]
    total: int


# ═══════════════════════════════════════════════════════════
#  Assignments (teacher → student)
# ═══════════════════════════════════════════════════════════
class CreateAssignmentRequest(BaseModel):
    student_id: int
    repertoire_id: str
    line_index: int
    note: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    assigned_by: int
    assigned_by_name: str
    repertoire_id: str
    line_index: int
    line_name: str
    note: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssignmentListResponse(BaseModel):
    assignments: List[AssignmentResponse]
    total: int


# ═══════════════════════════════════════════════════════════
#  Repertoire / Openings
# ═══════════════════════════════════════════════════════════
class LineInfo(BaseModel):
    line_name: str
    description: str
    move_count: int


class RepertoireResponse(BaseModel):
    id: str
    opening: str
    category: str
    description: str
    side: str
    lines: List[LineInfo]


class RepertoireListResponse(BaseModel):
    repertoires: List[RepertoireResponse]
    total: int


# ═══════════════════════════════════════════════════════════
#  Training
# ═══════════════════════════════════════════════════════════
class StartTrainingRequest(BaseModel):
    repertoire_id: str
    line_index: int = 0
    mode: str = "learn"  # learn | test | review


class MoveStep(BaseModel):
    fen: str
    type: str  # "auto" | "student"
    move: str  # UCI notation
    san: str
    explanation: str


class StartTrainingResponse(BaseModel):
    session_id: str
    repertoire_id: str
    line_name: str
    mode: str
    side: str
    total_moves: int
    current_step: int
    move: MoveStep
    hint: Optional[str] = None  # SAN hint shown in learn mode


class SubmitMoveRequest(BaseModel):
    session_id: str
    user_move: str  # UCI notation e.g. "e2e4"


class SubmitMoveResponse(BaseModel):
    correct: bool
    expected_move: str
    expected_san: str
    user_move: str
    explanation: str
    message: str
    line_complete: bool
    next_step: Optional[MoveStep] = None
    auto_moves: Optional[List[MoveStep]] = None
    hint: Optional[str] = None        # SAN hint for the NEXT student move (learn mode)
    revealed: bool = False             # True when answer is revealed after 3 wrong (test mode)
    wrong_attempts: int = 0            # Number of wrong attempts on this step


class NextStepRequest(BaseModel):
    session_id: str


class NextStepResponse(BaseModel):
    current_step: int
    total_moves: int
    move: MoveStep
    line_complete: bool
    auto_moves: Optional[List[MoveStep]] = None


# ═══════════════════════════════════════════════════════════
#  Progress / Analytics
# ═══════════════════════════════════════════════════════════
class OpeningAccuracy(BaseModel):
    repertoire_id: str
    opening_name: str
    category: str
    total_attempts: int
    correct: int
    accuracy: float  # 0.0 – 1.0


class StudentProgress(BaseModel):
    user_id: int
    user_name: str
    accuracies: List[OpeningAccuracy]
    daily_streak: int
    weakest_openings: List[str]
    total_lines_completed: int
    review_due_count: int
