"""
generate_repertoires.py
═══════════════════════════════════════════════════════════════
Downloads the **lichess-org/chess-openings** dataset (public domain / CC0)
from GitHub and generates curated repertoire JSON files for the Chess
Opening Trainer.

Source: https://github.com/lichess-org/chess-openings
Format: TSV with columns – eco, name, pgn, uci, epd

The script:
  1. Fetches the five TSV files (a.tsv – e.tsv)
  2. Parses every named variation
  3. Groups them into opening families (Sicilian, French, Caro-Kann …)
  4. Uses python-chess to compute accurate FEN at every ply
  5. Assigns auto/student move types based on which colour the
     opening is "for"
  6. Writes one JSON file per family into repertoires/

Run:
    python generate_repertoires.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import textwrap
from pathlib import Path
from typing import Any
from urllib.request import urlopen

import chess

# ── Configuration ─────────────────────────────────────────
REPO_RAW = "https://raw.githubusercontent.com/lichess-org/chess-openings/master"
TSV_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"]
OUTPUT_DIR = Path(__file__).resolve().parent / "repertoires"

# Maximum lines per opening family (keep JSON files manageable)
MAX_LINES_PER_FAMILY = 12

# Minimum move depth – skip very short lines (≤ 2 plies)
MIN_PLIES = 4

# ── Opening family detection ─────────────────────────────
# Maps a regex pattern to (family_id, display_name, category, side).
# Order matters – first match wins.
FAMILY_RULES: list[tuple[str, str, str, str, str]] = [
    # Gambits first (more specific)
    (r"King'?s Gambit",              "kings_gambit",         "King's Gambit",                          "Gambit",  "white"),
    (r"Queen'?s Gambit Accepted",    "queens_gambit_accepted","Queen's Gambit Accepted",               "Gambit",  "black"),
    (r"Queen'?s Gambit Declined",    "queens_gambit_declined","Queen's Gambit Declined",               "Opening", "black"),
    (r"Queen'?s Gambit",             "queens_gambit",        "Queen's Gambit",                         "Opening", "white"),
    (r"Evans Gambit",                "evans_gambit",         "Evans Gambit",                           "Gambit",  "white"),
    (r"Danish Gambit",               "danish_gambit",        "Danish Gambit",                          "Gambit",  "white"),
    (r"Smith-Morra",                 "smith_morra",          "Smith-Morra Gambit",                     "Gambit",  "white"),
    (r"Stafford Gambit",             "stafford_gambit",      "Stafford Gambit",                        "Gambit",  "black"),
    (r"Budapest Gambit",             "budapest_gambit",      "Budapest Gambit",                        "Gambit",  "black"),
    (r"Benko Gambit",                "benko_gambit",         "Benko Gambit",                           "Gambit",  "black"),
    (r"Marshall Attack",             "marshall_attack",      "Ruy López: Marshall Attack",             "Gambit",  "black"),
    (r"Scotch Gambit",               "scotch_gambit",        "Scotch Gambit",                          "Gambit",  "white"),
    (r"Halloween Gambit",            "halloween_gambit",     "Halloween Gambit",                       "Gambit",  "white"),
    (r"Englund Gambit",              "englund_gambit",       "Englund Gambit",                         "Gambit",  "black"),
    (r"Latvian Gambit",              "latvian_gambit",       "Latvian Gambit",                         "Gambit",  "black"),
    (r"Blackmar-Diemer",             "blackmar_diemer",      "Blackmar-Diemer Gambit",                 "Gambit",  "white"),
    (r"Albin Counter",               "albin_countergambit",  "Albin Countergambit",                    "Gambit",  "black"),

    # Main openings
    (r"Sicilian",                    "sicilian_defense",     "Sicilian Defense",                       "Opening", "black"),
    (r"French Defense",              "french_defense",       "French Defense",                         "Opening", "black"),
    (r"Caro-Kann",                   "caro_kann",            "Caro-Kann Defense",                      "Opening", "black"),
    (r"Pirc Defense",                "pirc_defense",         "Pirc Defense",                           "Opening", "black"),
    (r"Alekhine'?s Defense",         "alekhine_defense",     "Alekhine's Defense",                     "Opening", "black"),
    (r"Scandinavian",                "scandinavian",         "Scandinavian Defense",                   "Opening", "black"),
    (r"Philidor",                    "philidor_defense",     "Philidor Defense",                       "Opening", "black"),
    (r"Ruy L[oó]pez",               "ruy_lopez",            "Ruy López",                              "Opening", "white"),
    (r"Italian Game",                "italian_game",         "Italian Game",                           "Opening", "white"),
    (r"Scotch Game",                 "scotch_game",          "Scotch Game",                            "Opening", "white"),
    (r"Four Knights",                "four_knights",         "Four Knights Game",                      "Opening", "white"),
    (r"Vienna Game",                 "vienna_game",          "Vienna Game",                            "Opening", "white"),
    (r"Bishop'?s Opening",           "bishops_opening",      "Bishop's Opening",                       "Opening", "white"),
    (r"Petrov|Petroff|Russian",      "petrov_defense",       "Petrov's Defense",                       "Opening", "black"),
    (r"King'?s Indian Defense",      "kings_indian",         "King's Indian Defense",                  "Opening", "black"),
    (r"King'?s Indian Attack",       "kings_indian_attack",  "King's Indian Attack",                   "Opening", "white"),
    (r"Grünfeld|Grunfeld",          "grunfeld_defense",     "Grünfeld Defense",                      "Opening", "black"),
    (r"Nimzo-Indian",                "nimzo_indian",         "Nimzo-Indian Defense",                   "Opening", "black"),
    (r"Bogo-Indian",                 "bogo_indian",          "Bogo-Indian Defense",                    "Opening", "black"),
    (r"Queen'?s Indian",             "queens_indian",        "Queen's Indian Defense",                 "Opening", "black"),
    (r"Catalan",                     "catalan",              "Catalan Opening",                        "Opening", "white"),
    (r"London System",               "london_system",        "London System",                          "Opening", "white"),
    (r"Trompowsky",                  "trompowsky",           "Trompowsky Attack",                      "Opening", "white"),
    (r"Torre Attack",                "torre_attack",         "Torre Attack",                           "Opening", "white"),
    (r"Colle System",                "colle_system",         "Colle System",                           "Opening", "white"),
    (r"Dutch Defense",               "dutch_defense",        "Dutch Defense",                          "Opening", "black"),
    (r"Benoni",                      "benoni",               "Benoni Defense",                         "Opening", "black"),
    (r"Slav Defense",                "slav_defense",         "Slav Defense",                           "Opening", "black"),
    (r"Semi-Slav",                   "semi_slav",            "Semi-Slav Defense",                      "Opening", "black"),
    (r"English Opening",             "english_opening",      "English Opening",                        "Opening", "white"),
    (r"Réti|Reti Opening",          "reti_opening",         "Réti Opening",                          "Opening", "white"),
    (r"Bird'?s Opening",             "birds_opening",        "Bird's Opening",                         "Opening", "white"),
    (r"Nimzo-Larsen|Larsen",         "nimzo_larsen",         "Nimzo-Larsen Attack",                    "Opening", "white"),
]

# ── Helpers ───────────────────────────────────────────────

def fetch_tsv(filename: str) -> list[dict[str, str]]:
    """Download and parse a single TSV file from the GitHub repo."""
    url = f"{REPO_RAW}/{filename}"
    print(f"  Fetching {url} …")
    resp = urlopen(url)
    text = resp.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    return list(reader)


def classify_opening(name: str) -> tuple[str, str, str, str] | None:
    """Return (family_id, display_name, category, side) or None."""
    for pattern, fid, display, cat, side in FAMILY_RULES:
        if re.search(pattern, name, re.IGNORECASE):
            return fid, display, cat, side
    return None


def pgn_to_uci_tokens(pgn_str: str) -> list[str]:
    """Convert a PGN move string like '1. e4 c5 2. Nf3 d6' to UCI tokens ['e2e4','c7c5','g1f3','d7d6']."""
    board = chess.Board()
    uci_tokens = []
    # Remove move numbers and result markers
    clean = re.sub(r"\d+\.\s*", "", pgn_str)
    clean = re.sub(r"(1-0|0-1|1/2-1/2|\*)", "", clean)
    san_tokens = clean.strip().split()
    for san in san_tokens:
        san = san.strip()
        if not san:
            continue
        try:
            mv = board.parse_san(san)
            uci_tokens.append(mv.uci())
            board.push(mv)
        except (ValueError, chess.InvalidMoveError, chess.IllegalMoveError, chess.AmbiguousMoveError):
            break
    return uci_tokens


def build_moves(uci_tokens: list[str], side: str) -> list[dict[str, Any]]:
    """
    Given a list of UCI tokens like ["e2e4", "c7c5", "g1f3", "d7d6"],
    produce the move list with accurate FEN, SAN, and auto/student types.
    """
    board = chess.Board()
    moves_out = []

    for token in uci_tokens:
        fen_before = board.fen()

        try:
            mv = chess.Move.from_uci(token)
            san = board.san(mv)
        except (ValueError, chess.InvalidMoveError, chess.IllegalMoveError):
            break

        # Determine if this is an auto-move or a student move.
        # If student plays black: white moves are auto, black moves are student.
        is_white_turn = board.turn == chess.WHITE
        if side == "white":
            move_type = "student" if is_white_turn else "auto"
        else:
            move_type = "auto" if is_white_turn else "student"

        moves_out.append({
            "fen": fen_before,
            "type": move_type,
            "move": token,
            "san": san,
            "explanation": "",
        })

        board.push(mv)

    return moves_out


def slugify(text: str) -> str:
    """Make a URL-safe slug from text."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def extract_variation_name(full_name: str, family_display: str) -> str:
    """Extract the variation part: 'Sicilian Defense: Najdorf Variation' -> 'Najdorf Variation'."""
    # Remove the family prefix (e.g. "Sicilian Defense: ")
    for sep in [": ", " - ", ", "]:
        idx = full_name.find(sep)
        if idx != -1:
            remainder = full_name[idx + len(sep):]
            if len(remainder) > 3:
                return remainder
    return full_name


# ── Main ──────────────────────────────────────────────────

def main():
    print("═" * 60)
    print("  Chess Opening Repertoire Generator")
    print("  Source: lichess-org/chess-openings (CC0 / Public Domain)")
    print("═" * 60)

    # 1. Download all TSV files
    all_rows: list[dict[str, str]] = []
    for tsv in TSV_FILES:
        rows = fetch_tsv(tsv)
        all_rows.extend(rows)
    print(f"\n  Total variations fetched: {len(all_rows)}")

    # 2. Classify each row into families
    families: dict[str, dict[str, Any]] = {}
    unclassified = 0

    for row in all_rows:
        name = row.get("name", "")
        pgn = row.get("pgn", "")
        eco = row.get("eco", "")

        # Convert PGN to UCI tokens
        uci_tokens = pgn_to_uci_tokens(pgn)
        plies = len(uci_tokens)

        if plies < MIN_PLIES:
            continue

        info = classify_opening(name)
        if info is None:
            unclassified += 1
            continue

        fid, display, cat, side = info

        if fid not in families:
            families[fid] = {
                "id": fid,
                "opening": display,
                "category": cat,
                "description": "",
                "side": side,
                "lines": [],
            }

        family = families[fid]

        # Skip if we already have enough lines
        if len(family["lines"]) >= MAX_LINES_PER_FAMILY:
            continue

        moves = build_moves(uci_tokens, side)
        if len(moves) < MIN_PLIES:
            continue

        variation = extract_variation_name(name, display)
        family["lines"].append({
            "line_name": variation,
            "description": f"ECO {eco} – {name}",
            "moves": moves,
        })

    print(f"  Classified into {len(families)} opening families")
    print(f"  Skipped (unclassified or too short): {unclassified}")

    # 3. Generate descriptions from the first few variation names
    for fid, fam in families.items():
        line_names = [l["line_name"] for l in fam["lines"][:3]]
        fam["description"] = (
            f"{fam['opening']} – {len(fam['lines'])} variation(s). "
            f"Includes: {', '.join(line_names)}"
            + ("…" if len(fam["lines"]) > 3 else ".")
        )

    # 4. Write JSON files
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # First, remove the old hand-crafted files
    for old_json in OUTPUT_DIR.glob("*.json"):
        old_json.unlink()
        print(f"  Removed old: {old_json.name}")

    written = 0
    total_lines = 0
    for fid, fam in sorted(families.items()):
        if not fam["lines"]:
            continue
        output_path = OUTPUT_DIR / f"{fid}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(fam, f, indent=2, ensure_ascii=False)
        written += 1
        total_lines += len(fam["lines"])
        print(f"  ✓ {fid}.json  ({len(fam['lines'])} lines)")

    print(f"\n{'═' * 60}")
    print(f"  Done! {written} repertoire files, {total_lines} total lines")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
