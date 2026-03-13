"""
Trainer Engine Service – Interactive Guided Training
═════════════════════════════════════════════════════
Manages training sessions with:
  • Learn mode  – shows explanations, auto-plays opponent moves
  • Test mode   – student plays blind, scored
  • Review mode – spaced-repetition review of weak lines

Sessions are stored in-memory (per-process). Each session tracks the
current position in a repertoire line.
"""

from __future__ import annotations

import uuid
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.opening_model import Opening
from backend.models.performance_model import TrainingHistory, MoveResult, TrainingMode
from backend.services.opening_tree_loader import get_repertoire, get_repertoire_line
from backend.schemas import (
    MoveStep,
    StartTrainingResponse,
    SubmitMoveResponse,
)

logger = logging.getLogger("learn64.engine")

# ── In-memory session store ──────────────────────────────
_sessions: dict[str, dict[str, Any]] = {}


def _make_move_step(move_data: dict) -> MoveStep:
    """Convert a raw move dict from JSON into a MoveStep schema."""
    return MoveStep(
        fen=move_data["fen"],
        type=move_data["type"],
        move=move_data["move"],
        san=move_data["san"],
        explanation=move_data.get("explanation", ""),
    )


def start_training_session(
    repertoire_id: str,
    line_index: int = 0,
    mode: str = "learn",
) -> StartTrainingResponse:
    """Create a new training session and return the first step."""
    rep = get_repertoire(repertoire_id)
    if rep is None:
        raise ValueError(f"Repertoire '{repertoire_id}' not found.")

    lines = rep.get("lines", [])
    if not lines or line_index >= len(lines):
        raise ValueError(f"Line index {line_index} out of range (have {len(lines)} lines).")

    line = lines[line_index]
    moves = line.get("moves", [])
    if not moves:
        raise ValueError("Selected line has no moves.")

    session_id = str(uuid.uuid4())

    # Advance past initial auto-moves so current_step points to first student move
    first_student_step = 0
    while first_student_step < len(moves) and moves[first_student_step]["type"] == "auto":
        first_student_step += 1

    _sessions[session_id] = {
        "repertoire_id": repertoire_id,
        "line_index": line_index,
        "line_name": line["line_name"],
        "mode": mode,
        "side": rep.get("side", "white"),
        "moves": moves,
        "current_step": first_student_step,
        "wrong_attempts": 0,  # Track wrong attempts on current step
    }

    first_move = _make_move_step(moves[0])

    # In learn mode, provide a hint for the first student move
    hint = None
    if mode == "learn" and first_student_step < len(moves):
        hint = f"Play {moves[first_student_step]['san']}"

    return StartTrainingResponse(
        session_id=session_id,
        repertoire_id=repertoire_id,
        line_name=line["line_name"],
        mode=mode,
        side=rep.get("side", "white"),
        total_moves=len(moves),
        current_step=first_student_step,
        move=first_move,
        hint=hint,
    )


def get_session(session_id: str) -> dict[str, Any] | None:
    """Get session data."""
    return _sessions.get(session_id)


def advance_session(session_id: str) -> dict[str, Any] | None:
    """Advance to the next step in the session. Returns step info or None if complete.

    Collects any consecutive auto-moves and sets current_step to the
    *next student move* (so the backend is ready for the next submit).
    """
    session = _sessions.get(session_id)
    if not session:
        return None

    moves = session["moves"]
    idx = session["current_step"] + 1

    if idx >= len(moves):
        return {"line_complete": True, "current_step": idx, "total_moves": len(moves)}

    # Collect consecutive auto-moves
    auto_moves = []
    while idx < len(moves) and moves[idx]["type"] == "auto":
        auto_moves.append(_make_move_step(moves[idx]))
        idx += 1

    # Check if auto-moves run to the end of the line
    if idx >= len(moves):
        session["current_step"] = len(moves)
        result = {"line_complete": True, "current_step": idx, "total_moves": len(moves)}
        if auto_moves:
            result["auto_moves"] = auto_moves
        return result

    # idx now points at the next student move
    session["current_step"] = idx

    result = {
        "line_complete": False,
        "current_step": idx,
        "total_moves": len(moves),
        "move": _make_move_step(moves[idx]),
    }
    if auto_moves:
        result["auto_moves"] = auto_moves

    return result


async def submit_student_move(
    db: AsyncSession,
    user_id: int,
    session_id: str,
    user_move_uci: str,
) -> SubmitMoveResponse:
    """
    Validate a student's move against the expected move in the repertoire line.
    Records the attempt in the database and advances the session.
    """
    session = _sessions.get(session_id)
    if not session:
        raise ValueError("Session not found or expired.")

    moves = session["moves"]
    step = session["current_step"]

    if step >= len(moves):
        raise ValueError("Line already complete.")

    expected = moves[step]

    # In learn mode, the current step should be a student move
    if expected["type"] != "student":
        raise ValueError("Current step is an auto-move, not a student move.")

    correct = user_move_uci == expected["move"]
    result_enum = MoveResult.CORRECT if correct else MoveResult.WRONG
    mode_enum = TrainingMode(session["mode"])

    # Track wrong attempts on this step
    if not correct:
        session["wrong_attempts"] = session.get("wrong_attempts", 0) + 1
    wrong_attempts = session.get("wrong_attempts", 0)

    # Find the opening DB record to get its ID
    from sqlalchemy import select
    opening_stmt = select(Opening).where(Opening.repertoire_id == session["repertoire_id"])
    opening = (await db.execute(opening_stmt)).scalar_one_or_none()

    if opening:
        history = TrainingHistory(
            user_id=user_id,
            opening_id=opening.id,
            line_name=session["line_name"],
            mode=mode_enum,
            fen_position=expected["fen"],
            move_index=step,
            expected_move=expected["move"],
            user_move=user_move_uci,
            result=result_enum,
        )
        db.add(history)
        await db.flush()

    # Build response
    if correct:
        message = "Correct! " + expected.get("explanation", "")
    elif session["mode"] == "test" and wrong_attempts >= 3:
        message = f"The correct move was {expected['san']}. {expected.get('explanation', '')}"
    else:
        message = f"Incorrect. Try again!"

    # Advance to next step and gather auto-moves
    line_complete = False
    next_step_data = None
    auto_moves_list = None

    if correct:
        adv = advance_session(session_id)
        if adv and adv.get("line_complete"):
            line_complete = True
            auto_moves_list = adv.get("auto_moves")
        elif adv:
            next_step_data = adv.get("move")
            auto_moves_list = adv.get("auto_moves")
        # Reset wrong attempts for next step
        session["wrong_attempts"] = 0

    # Determine hint for the next student move (learn mode)
    hint = None
    if session["mode"] == "learn":
        if correct and next_step_data:
            hint = f"Play {next_step_data.san}"
        elif not correct:
            hint = f"Play {expected['san']}"

    # In test mode, reveal the answer after 3 wrong attempts
    revealed = False
    if session["mode"] == "test" and not correct and wrong_attempts >= 3:
        revealed = True

    return SubmitMoveResponse(
        correct=correct,
        expected_move=expected["move"],
        expected_san=expected["san"],
        user_move=user_move_uci,
        explanation=expected.get("explanation", ""),
        message=message,
        line_complete=line_complete,
        next_step=next_step_data,
        auto_moves=auto_moves_list,
        hint=hint,
        revealed=revealed,
        wrong_attempts=wrong_attempts,
    )


def cleanup_session(session_id: str) -> None:
    """Remove a session from memory."""
    _sessions.pop(session_id, None)
