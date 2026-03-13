# ── Backend ────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

# Install Stockfish
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY openings/ ./openings/

ENV STOCKFISH_PATH=/usr/games/stockfish
ENV DATABASE_URL=sqlite+aiosqlite:///./chess_trainer.db

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]


# ── Frontend build ────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build


# ── Production (nginx + backend) ─────────────────────
FROM python:3.12-slim AS production

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish nginx && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY openings/ ./openings/
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Nginx config
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    location /api { proxy_pass http://127.0.0.1:8000; } \
    location / { try_files $uri /index.html; } \
}' > /etc/nginx/conf.d/default.conf

ENV STOCKFISH_PATH=/usr/games/stockfish

EXPOSE 80

CMD nginx && uvicorn backend.main:app --host 127.0.0.1 --port 8000
