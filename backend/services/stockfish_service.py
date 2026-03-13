"""
Stockfish Engine Service
────────────────────────
Manages a pool of Stockfish engine instances for concurrent evaluation
without spawning a new process on every request.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional, Tuple

import chess
from stockfish import Stockfish

from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class StockfishPool:
    """
    Thread-safe pool of Stockfish engine instances.
    Uses an asyncio.Queue so callers can `await` an available engine.
    """

    def __init__(self, pool_size: int | None = None, depth: int | None = None):
        self._pool_size = pool_size or settings.STOCKFISH_POOL_SIZE
        self._depth = depth or settings.STOCKFISH_DEPTH
        self._queue: asyncio.Queue[Stockfish] = asyncio.Queue(maxsize=self._pool_size)
        self._initialized = False

    async def initialize(self) -> None:
        """Create engine instances and add them to the pool."""
        if self._initialized:
            return
        for _ in range(self._pool_size):
            try:
                engine = Stockfish(
                    path=settings.STOCKFISH_PATH,
                    depth=self._depth,
                    parameters={"Threads": 1, "Hash": 64},
                )
                await self._queue.put(engine)
            except Exception as exc:
                logger.warning("Could not initialise Stockfish instance: %s", exc)
        self._initialized = True
        logger.info(
            "Stockfish pool initialised with %d / %d engines",
            self._queue.qsize(),
            self._pool_size,
        )

    async def acquire(self) -> Stockfish:
        """Borrow an engine from the pool (blocks if none available)."""
        return await self._queue.get()

    async def release(self, engine: Stockfish) -> None:
        """Return an engine to the pool."""
        await self._queue.put(engine)

    async def shutdown(self) -> None:
        """Terminate all engine processes."""
        while not self._queue.empty():
            engine = await self._queue.get()
            try:
                engine.__del__()
            except Exception:
                pass
        self._initialized = False


# ── Module-level singleton ───────────────────────────────
_pool = StockfishPool()


async def init_stockfish_pool() -> None:
    await _pool.initialize()


async def shutdown_stockfish_pool() -> None:
    await _pool.shutdown()


async def evaluate_position(fen: str) -> Tuple[Optional[float], Optional[str]]:
    """
    Evaluate a FEN position.

    Returns:
        (centipawn_eval, best_move_uci)
        centipawn_eval is None when the position is mate.
    """
    engine = await _pool.acquire()
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _sync_evaluate, engine, fen)
        return result
    finally:
        await _pool.release(engine)


def _sync_evaluate(engine: Stockfish, fen: str) -> Tuple[Optional[float], Optional[str]]:
    """Synchronous evaluation (runs in thread executor)."""
    engine.set_fen_position(fen)
    evaluation = engine.get_evaluation()
    best_move = engine.get_best_move()

    cp: Optional[float] = None
    if evaluation["type"] == "cp":
        cp = evaluation["value"]
    elif evaluation["type"] == "mate":
        # Encode mate as ±100_000 ∓ mate_distance so callers still get a numeric
        cp = (100_000 - abs(evaluation["value"])) * (1 if evaluation["value"] > 0 else -1)

    return cp, best_move


async def is_move_best(fen: str, move_uci: str) -> bool:
    """Check if a given move matches the engine's top choice."""
    _, best = await evaluate_position(fen)
    return best == move_uci


async def validate_move_legal(fen: str, move_uci: str) -> bool:
    """Check if a move is legal in the given position."""
    board = chess.Board(fen)
    try:
        move = chess.Move.from_uci(move_uci)
        return move in board.legal_moves
    except (ValueError, chess.InvalidMoveError):
        return False
