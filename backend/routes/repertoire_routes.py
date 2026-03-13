"""
Repertoire routes – list available openings, get lines, and details.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.services.opening_tree_loader import (
    get_all_repertoire_summaries,
    get_repertoire,
    get_repertoire_line,
)
from backend.schemas import RepertoireResponse, RepertoireListResponse, LineInfo

router = APIRouter(prefix="/api/repertoires", tags=["repertoires"])


@router.get("", response_model=RepertoireListResponse)
async def list_repertoires():
    """List all available openings/gambits with their lines."""
    summaries = get_all_repertoire_summaries()
    items = []
    for s in summaries:
        items.append(RepertoireResponse(
            id=s["id"],
            opening=s["opening"],
            category=s["category"],
            description=s["description"],
            side=s["side"],
            lines=[LineInfo(**l) for l in s["lines"]],
        ))
    return RepertoireListResponse(repertoires=items, total=len(items))


@router.get("/{repertoire_id}")
async def get_repertoire_detail(repertoire_id: str):
    """Get full details of a specific repertoire."""
    rep = get_repertoire(repertoire_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Repertoire not found.")
    return rep


@router.get("/{repertoire_id}/lines/{line_index}")
async def get_line_detail(repertoire_id: str, line_index: int):
    """Get a specific line from a repertoire."""
    line = get_repertoire_line(repertoire_id, line_index)
    if not line:
        raise HTTPException(status_code=404, detail="Line not found.")
    return line
