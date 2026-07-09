# 🎟️ Smart Ticket Router

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

---

## What's in the UI

| Tab | What it does |
|---|---|
| **Route a Ticket** | The core deliverable — paste a message, get category/priority/team/reasoning back, optionally side-by-side with the keyword baseline, and leave feedback (agree / correct it). |
| **Manual vs AI Race** | Pick a ticket, classify it yourself with a real stopwatch running, then let Claude classify the exact same ticket. No assumed numbers — this is the deliverable #4 "before/after" comparison, measured live instead of guessed. |
| **Demo (20 Tickets)** | One click routes the full 20-ticket mission sample set (including the 3 required edge cases) and shows the JSON-repair mechanism on deliberately malformed input. |
| **Analytics** | Aggregate stats across everything routed so far: time saved, category/priority/team/tone distribution, how many tickets got flagged ambiguous or escalated, and the human/AI agreement rate from feedback. |
| **History** | Every routed ticket, persisted in SQLite, with full detail and feedback on click. |

---

## Handling the 3 required edge cases

| Edge case | How it's handled |
|---|---|
| **Angry tone** | The model classifies `tone` (neutral/frustrated/angry/urgent/confused/positive) as a first-class field, judged from the actual wording — not the topic. The backend then applies one explicit business rule: if tone is `angry`/`urgent` and computed priority is `Medium`, it's escalated to `High` (surfaced in the UI as a "↑ escalated" badge). Try: *"THIS IS RIDICULOUS, I've been charged for months and no one responds!!!"* |
| **Very short message** | The system prompt explicitly instructs the model to never refuse — even on `"Help."` or `"??"` — but to set `is_ambiguous=true`, keep `confidence` low, and use `reasoning` to say what's missing. It still returns a fully valid, routable ticket. |
| **Ambiguous ticket** | Same mechanism: `is_ambiguous` and `confidence` are explicit schema fields, not something bolted on after the fact. A multi-issue ticket ("the app is slow, my invoice looks wrong, and can I export my data?") gets a genuine best-guess primary category plus a flag that a human should double-check it — rather than the request failing or the model picking arbitrarily with no signal that it was uncertain. |

All three (plus a few extra curveballs — sarcasm, positive/thank-you tickets, non-English-keyword phrasing) are in [`backend/app/sample_tickets.py`](backend/app/sample_tickets.py) and drive the Demo tab.

---

## Handling AI unreliability (the "what if it returns malformed JSON" question)

Layered, in order of how often each layer actually fires:

1. **Structured Outputs** (`output_config.format` with a hand-written JSON Schema) — this is an API-level constraint, not a prompting trick. Claude's response is guaranteed to be a single JSON object matching the schema's required fields and enums. This eliminates the vast majority of "malformed JSON" failure modes before they happen.
2. **Refusal handling** — if `stop_reason == "refusal"`, we don't try to parse anything; we go straight to the repair/fallback path.
3. **One repair turn** — for the responses structured outputs doesn't fully cover (a refusal, a truncated response, or something that fails our own Pydantic validation), the conversation gets one follow-up turn asking the model to re-emit valid JSON. `_extract_json()` also strips markdown fences and trailing commas as a second layer of defense.
4. **Graceful fallback** — if the repair attempt also fails, or the API is unreachable/unauthenticated/rate-limited, the ticket is routed by the keyword baseline instead, tagged `mode: "fallback"`. The user always gets a usable answer; the app never crashes or 500s on a flaky model response.

The **Demo tab** has a "Show me" button under *"What happens when the AI returns malformed JSON?"* that runs three deterministic examples (fenced JSON with a trailing comma, JSON wrapped in prose, and genuinely broken JSON) through the exact same repair function, independent of any live API call — so this is demoable without waiting for a real model to misbehave.

---

## Where this is most likely to be wrong

Being honest about failure modes is part of the point:

- **Low-context tickets** — a one-line message with no history will always be a guess. The `confidence`/`is_ambiguous` fields exist specifically to surface this rather than hide it, but they don't fix it. A real deployment would want ticket history and account context in the prompt.
- **Sarcasm and tone the model reads wrong** — "great, ANOTHER outage" is easy for a human and mostly fine for Claude, but tone detection from text alone is inherently probabilistic. This is exactly why there's a feedback loop instead of trusting the first answer forever.
- **Category boundaries that are genuinely arguable** — "how do I turn on 2FA" could reasonably be Security Concern or Technical Issue. The model will pick one confidently even when a reasonable human team would disagree, which is why `is_ambiguous` and the correction workflow matter more than raw accuracy.
- **Priority escalation is a single hard-coded rule** (angry/urgent tone + Medium → High). It's deliberately simple and legible, but it's a rule, not a learned policy — a ticket that's genuinely low-priority but written angrily will still get bumped.
- **Baseline comparison is intentionally weak** — the keyword baseline is not a strawman built to lose; it's a legitimate simple approach, and its actual failure modes (sarcasm, negation, multi-issue tickets) are what you're meant to see side-by-side in the UI.

---

## Architecture

```
frontend/ (React + TypeScript + Tailwind v4 + Recharts)
   │  fetch("/api/...")
   ▼
backend/ (FastAPI, SQLite)
   ├── classifier.py   — Claude call, JSON Schema, repair loop, fallback
   ├── baseline.py      — keyword-only classifier (mock mode + comparison feature)
   ├── store.py         — SQLite persistence (full audit trail per ticket)
   ├── analytics.py     — aggregate stats for the dashboard
   ├── cli.py           — command-line interface
   └── sample_tickets.py — the 20-ticket demo/edge-case set
```

**Why FastAPI + a plain SQL table instead of a framework-heavy backend:** this is a classification service with a handful of endpoints and no need for background workers or complex relations — Postgres/Celery/etc. would be solving problems this project doesn't have. SQLite gives real persistence and a real audit trail with zero setup.

**Why the keyword baseline lives in the same codebase as "mock mode":** they're the same function. Not calling an LLM and comparing against a simple non-LLM approach turned out to be the same feature — which is itself the answer to "why not just use keyword search?": here's the keyword search, and here's what it gets wrong.

**Model choice:** defaults to `claude-opus-4-8`. For a live demo, `CLAUDE_MODEL=claude-haiku-4-5` in `.env` is a better fit for this specific task — ticket classification is a low-reasoning, high-volume workload, and Haiku is dramatically cheaper and faster for it at a small accuracy cost. That's a deliberate cost/latency/quality tradeoff, not a limitation — swap it back to Opus any time.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Live vs. mock mode, active model, ticket count |
| `POST` | `/api/route` | `{message, manual_time_seconds?, compare?}` → full `TicketResult` |
| `GET` | `/api/tickets` | Paginated history |
| `GET` | `/api/tickets/{id}` | One ticket, full detail |
| `POST` | `/api/tickets/{id}/feedback` | `{agree, corrected_category?, corrected_priority?, corrected_team?, note?}` |
| `GET` | `/api/analytics` | Aggregate stats for the dashboard |
| `GET` | `/api/sample-tickets` | The 20 bundled demo tickets |
| `POST` | `/api/demo/run` | Route a batch of tickets in one call |
| `GET` | `/api/demo/repair-example` | Deterministic JSON-repair demonstration |

Interactive docs at `http://localhost:8000/docs` (FastAPI's built-in Swagger UI) once the backend is running.

---

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| LLM | Claude API, Structured Outputs (`output_config.format`) | JSON Schema enforcement at the API level, not a prompt convention — the actual mechanism this mission is teaching. |
| Backend | FastAPI + Pydantic | Schema-first by default; the same `TicketClassification` model that validates Claude's output also generates the OpenAPI docs. |
| Storage | SQLite | Real persistence and an audit trail, zero infra. |
| Frontend | React + TypeScript + Vite | Fast dev loop, typed API contracts shared conceptually with the Pydantic models. |
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
│       ├── api.ts             typed fetch client
│       └── types.ts           shared types (mirrors backend Pydantic models)
├── dev.sh                     one-command local dev (both servers)
└── README.md
```
