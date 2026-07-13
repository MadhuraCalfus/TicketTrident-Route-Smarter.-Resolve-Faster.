# 🔱 TicketTrident – Route Smarter. Resolve Faster.

An AI-powered support ticket triage system. Paste (or CLI-pipe) any support message and get back **category, priority, team, and a one-line reason** — as strict, schema-validated JSON, every time.

Built for **Port·04 — The Senate of Gods**.

---

## Why this exists

Support teams drown in tickets because triage is repetitive, low-judgment work that still requires reading and context. That's exactly the profile of task an LLM is good at: it reads the message, understands intent (including sarcasm, negation, and multi-issue tickets a keyword filter can't), and returns a structured decision in under two seconds.

This project doesn't just wrap a prompt in a web form. It treats "the AI might misbehave" as the actual engineering problem to solve:

- **Structured outputs**, not "please return JSON" — the API enforces a JSON Schema server-side.
- **A repair path** for the rare cases structured outputs doesn't fully cover (refusals, truncation).
- **A graceful degrade path** to a rule-based baseline if the model is unavailable, unauthenticated, or rate-limited — the app never 500s on the user.
- **A human-in-the-loop feedback mechanism**, because "the AI decided" isn't the same as "the AI was right."
- **A live, measured comparison** against the simplest possible alternative (keyword matching), so "why an LLM and not a keyword search" has a real answer instead of an assumed one.

---

## Quick start

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # optional — see below
uvicorn app.main:app --reload --port 8000
```

**You do not need an API key to run this.** Without `ANTHROPIC_API_KEY` set in `backend/.env`, the app automatically runs on a rule-based keyword baseline ("mock mode") — every endpoint, the CLI, and the whole UI work fully offline. Add a key to `.env` to switch to live Claude classification.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the backend on port 8000 in dev.

### One command for both

```bash
./dev.sh
```

### Single-server "production" mode

```bash
cd frontend && npm run build && cd ..
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000
```

FastAPI detects `frontend/dist` and serves the built UI directly from `http://localhost:8000/` — one process, one port, nothing else running.

### CLI

```bash
cd backend && source .venv/bin/activate
python -m app.cli route "I was charged twice and support has ignored me for a week!!"
python -m app.cli route "I was charged twice" --compare   # + keyword baseline side by side
python -m app.cli demo                                     # routes all 20 sample tickets
python -m app.cli health                                   # live vs mock mode, current model
```


## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| LLM | Claude API, Structured Outputs (`output_config.format`) | JSON Schema enforcement at the API level, not a prompt convention — the actual mechanism this mission is teaching. |
| Backend | FastAPI + Pydantic | Schema-first by default; the same `TicketClassification` model that validates Claude's output also generates the OpenAPI docs. |
| Storage | SQLite | Real persistence and an audit trail, zero infra. |
| Frontend | React + JavaScript + Vite | Fast dev loop with no build-time type layer; API contracts are documented in `src/constants.js` and by convention with the Pydantic models. |
| Styling | Tailwind CSS v4 | Design tokens (`@theme`) keep light/dark and priority/tone colors consistent across every component without a component library dependency. |
| Charts | Recharts | Composable, React-native chart primitives for the analytics dashboard. |

---

## Project structure

```
smart-ticket-router/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI routes
│   │   ├── classifier.py      Claude integration, schema, repair, fallback
│   │   ├── baseline.py        keyword classifier (mock mode + comparison)
│   │   ├── models.py          Pydantic schemas / enums
│   │   ├── store.py           SQLite persistence
│   │   ├── analytics.py       aggregate stats
│   │   ├── cli.py             CLI entry point
│   │   └── sample_tickets.py  20-ticket demo set
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/        RouteTicketTab, RaceTab, DemoTab, AnalyticsTab, HistoryTab, ...
│       ├── api.js             fetch client
│       └── constants.js       category/priority/team option lists (mirrors backend Pydantic enums)
├── dev.sh                     one-command local dev (both servers)
└── README.md
```
