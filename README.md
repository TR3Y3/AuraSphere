# PKD — Multi-tenant CRM

A SaaS CRM built on React + FastAPI with PostgreSQL, designed for multi-tenant isolation.

## Project structure

```
├── backend/          FastAPI JSON API
│   ├── app/          Application code
│   ├── alembic/      Database migrations
│   ├── requirements.txt
│   └── .env.example
├── frontend/         React + Vite + TypeScript SPA
│   ├── src/
│   ├── package.json
│   └── .env.example
└── render.yaml       Render deployment config
```

## Getting started

### Backend

```bash
cd backend
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`. OpenAPI docs at `/docs`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Phases

See `CLAUDE.md` for the detailed phase-by-phase build plan. Currently: **Phase 0** (monorepo scaffold).
