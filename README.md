# AuraSphere — Multi-tenant CRM

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

## Developer tooling (Claude Code)

- **Skills** live in `.claude/skills/`. CRM workflow skills (adapted from
  CALCOR for AuraSphere's data model): `add-prospects`, `review-records`,
  `personalize-outreach`, `weekly-sales-report`. Generic orchestration/util
  skills: `efficient-fable`, `efficient-frontier`, `stay-within-limits`,
  `quick-recap`, `visual-plan`, `visual-recap`.
- **Cross-session memory** is the `claude-mem` git submodule
  (`github.com/thedotmack/claude-mem`). Initialize it where GitHub is
  reachable:

  ```bash
  git submodule update --init --recursive
  ```

  > Note: it could not be fetched in the locked-down build environment
  > (outbound git is restricted to this repo), so it must be initialized in a
  > network-permitted environment. It is third-party code that installs
  > session hooks — review before enabling.

## Phases

See `CLAUDE.md` for the detailed phase-by-phase build plan. Currently:
**Phase 2 complete** (contacts + companies); next is Phase 3 (deals + pipeline).
