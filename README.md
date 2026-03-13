# Learn_64 – Chess Opening Trainer

A web platform that teaches chess students openings, gambits, and best counter-moves through **interactive move quizzes**, **spaced repetition scheduling**, and **Stockfish engine-validated feedback**. Features role-based access: Admin, Teacher, and Student.

---

## Architecture

```
/backend          FastAPI (Python)
  main.py         Application entry point
  config.py       Settings via pydantic-settings / .env
  database.py     Async SQLAlchemy (SQLite → PostgreSQL)
  auth.py         JWT helpers (bcrypt + python-jose)
  schemas.py      Pydantic request/response DTOs
  models/         SQLAlchemy ORM models
  services/       Business logic (PGN parser, Stockfish, trainer, spaced rep)
  routes/         API routers (auth, openings, training)

/frontend         React + Vite + TailwindCSS
  src/
    api/          Axios client + API helpers
    context/      Auth context (JWT in localStorage)
    components/   ChessBoard, MoveFeedbackModal, ProgressDashboard, Navbar
    pages/        PracticePage, AdminUploadPage, DashboardPage, LoginPage

/openings         Sample PGN repertoires
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Stockfish engine on PATH (or set `STOCKFISH_PATH`)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn backend.main:app --reload
```
API docs at http://localhost:8000/api/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App at http://localhost:5173

### Docker
```bash
cp .env.example .env
docker compose up --build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/openings/upload` | Upload PGN (coach/admin) |
| GET | `/api/openings` | List openings |
| GET | `/api/training/next-position` | Get next FEN to solve |
| POST | `/api/training/submit-move` | Submit answer + get feedback |
| GET | `/api/training/progress` | Student analytics |
| GET | `/api/training/alerts` | Spaced-rep alerts |
| GET | `/api/training/coach/students` | Coach dashboard |

## Spaced Repetition

| Outcome | Next Review |
|---------|-------------|
| 1st mistake | +1 day |
| 2nd mistake | +6 hours |
| 3rd+ mistake | Immediate |
| Correct streak | 3d → 7d → 14d → 30d → 60d |

## Tech Stack
- **Backend:** FastAPI, python-chess, Stockfish, SQLAlchemy (async), JWT
- **Frontend:** React 18, Vite, react-chessboard, chess.js, TailwindCSS, Axios
- **Database:** SQLite (dev) → PostgreSQL (prod)

## Future Extensions
- Multiplayer training rooms
- Lichess/Chess.com PGN import
- Redis caching for repetition schedules
- Mobile-responsive PWA
