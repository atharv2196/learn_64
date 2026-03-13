"""
Opening Tree Loader – loads and caches curated JSON repertoire files.
Replaces the old PGN parser. Each repertoire has lines with move sequences.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("learn64.tree_loader")

# In-memory cache of all loaded repertoires
_repertoire_cache: dict[str, dict[str, Any]] = {}
_loaded = False


def get_repertoires_dir() -> Path:
    """Return the repertoires directory path."""
    return Path(__file__).resolve().parent.parent.parent / "repertoires"


def load_all_repertoires() -> dict[str, dict[str, Any]]:
    """Load all JSON repertoire files from the repertoires/ directory."""
    global _repertoire_cache, _loaded

    if _loaded:
        return _repertoire_cache

    repertoires_dir = get_repertoires_dir()
    if not repertoires_dir.exists():
        logger.warning("Repertoires directory not found: %s", repertoires_dir)
        return {}

    for json_file in sorted(repertoires_dir.glob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            rep_id = data.get("id", json_file.stem)
            _repertoire_cache[rep_id] = data
            logger.info("Loaded repertoire: %s (%d lines)", rep_id, len(data.get("lines", [])))
        except Exception as exc:
            logger.error("Failed to load %s: %s", json_file.name, exc)

    _loaded = True
    logger.info("Total repertoires loaded: %d", len(_repertoire_cache))
    return _repertoire_cache


def get_repertoire(repertoire_id: str) -> dict[str, Any] | None:
    """Get a specific repertoire by its ID."""
    if not _loaded:
        load_all_repertoires()
    return _repertoire_cache.get(repertoire_id)


def get_repertoire_line(repertoire_id: str, line_index: int) -> dict[str, Any] | None:
    """Get a specific line from a repertoire."""
    rep = get_repertoire(repertoire_id)
    if not rep:
        return None
    lines = rep.get("lines", [])
    if 0 <= line_index < len(lines):
        return lines[line_index]
    return None


def get_all_repertoire_summaries() -> list[dict[str, Any]]:
    """Return a list of summaries for all loaded repertoires."""
    if not _loaded:
        load_all_repertoires()

    summaries = []
    for rep_id, rep_data in _repertoire_cache.items():
        lines_info = []
        for line in rep_data.get("lines", []):
            lines_info.append({
                "line_name": line["line_name"],
                "description": line.get("description", ""),
                "move_count": len(line.get("moves", [])),
            })
        summaries.append({
            "id": rep_id,
            "opening": rep_data.get("opening", ""),
            "category": rep_data.get("category", ""),
            "description": rep_data.get("description", ""),
            "side": rep_data.get("side", "white"),
            "lines": lines_info,
        })
    return summaries


def reload_repertoires() -> int:
    """Force reload all repertoire files. Returns count loaded."""
    global _repertoire_cache, _loaded
    _repertoire_cache = {}
    _loaded = False
    load_all_repertoires()
    return len(_repertoire_cache)
