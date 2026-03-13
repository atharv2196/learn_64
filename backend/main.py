"""Learn_64 - Chess Opening Trainer
==================================
Role-based platform: Admin, Teacher, Student.
Built-in curated repertoires loaded from JSON.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.database import init_db
from backend.routes.auth_routes import router as auth_router
from backend.routes.repertoire_routes import router as repertoire_router
from backend.routes.training_routes import router as training_router
from backend.routes.admin_routes import router as admin_router
from backend.routes.assignment_routes import router as assignment_router
from backend.services.opening_tree_loader import load_all_repertoires

# Conditionally import Stockfish pool (graceful degradation)
try:
    from backend.services.stockfish_service import init_stockfish_pool, shutdown_stockfish_pool
    _HAS_STOCKFISH = True
except Exception:
    _HAS_STOCKFISH = False

settings = get_settings()
logger = logging.getLogger("learn64")
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s …", settings.APP_NAME)
    await init_db()

    # Load all repertoire JSON files into memory
    load_all_repertoires()

    # Sync repertoire metadata into the database
    await _sync_repertoires_to_db()

    if _HAS_STOCKFISH:
        try:
            await init_stockfish_pool()
        except Exception as exc:
            logger.warning("Stockfish pool not available: %s", exc)
    yield
    if _HAS_STOCKFISH:
        try:
            await shutdown_stockfish_pool()
        except Exception:
            pass
    logger.info("Shutting down %s.", settings.APP_NAME)


async def _sync_repertoires_to_db():
    """Ensure each loaded repertoire has a corresponding Opening row in the DB."""
    from sqlalchemy import select
    from backend.database import async_session
    from backend.models.opening_model import Opening
    from backend.models.assignment_model import Assignment  # noqa: F401 - ensure table created
    from backend.services.opening_tree_loader import get_all_repertoire_summaries

    summaries = get_all_repertoire_summaries()
    async with async_session() as db:
        for s in summaries:
            stmt = select(Opening).where(Opening.repertoire_id == s["id"])
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if not existing:
                opening = Opening(
                    repertoire_id=s["id"],
                    name=s["opening"],
                    category=s["category"],
                    side=s["side"],
                    description=s["description"],
                    line_count=len(s["lines"]),
                )
                db.add(opening)
                logger.info("Synced new repertoire to DB: %s", s["id"])
            else:
                existing.name = s["opening"]
                existing.category = s["category"]
                existing.side = s["side"]
                existing.description = s["description"]
                existing.line_count = len(s["lines"])
        await db.commit()


# ── App factory ──────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Simple in-memory rate limiter ────────────────────────
import time
from collections import defaultdict

_rate_store: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60.0

    # Prune old entries
    _rate_store[client_ip] = [t for t in _rate_store[client_ip] if now - t < window]

    if len(_rate_store[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Try again later."},
        )

    _rate_store[client_ip].append(now)
    return await call_next(request)


# ── Register routers ─────────────────────────────────────
app.include_router(auth_router)
app.include_router(repertoire_router)
app.include_router(training_router)
app.include_router(admin_router)
app.include_router(assignment_router)


# ── Health check ─────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

