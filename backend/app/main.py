from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import analytics, classifier, store
from .models import DemoRunRequest, FeedbackRequest, RouteRequest
from .sample_tickets import SAMPLE_TICKETS

app = FastAPI(title="TicketTrident", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    store.init_db()


@app.get("/api/health")
def health():
    info = classifier.mode_info()
    return {"status": "ok", **info, "ticket_count": store.count_tickets()}


@app.post("/api/route")
def route_ticket(req: RouteRequest):
    result = classifier.build_ticket_result(req.message, req.manual_time_seconds, req.compare)
    store.save_ticket(result)
    return result


@app.get("/api/tickets")
def get_tickets(limit: int = 50, offset: int = 0):
    return {"tickets": store.list_tickets(limit=limit, offset=offset), "total": store.count_tickets()}


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: str):
    t = store.get_ticket(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="ticket not found")
    return t


@app.post("/api/tickets/{ticket_id}/feedback")
def give_feedback(ticket_id: str, req: FeedbackRequest):
    existing = store.get_ticket(ticket_id)
    if not existing:
        raise HTTPException(status_code=404, detail="ticket not found")
    updated = store.save_feedback(
        ticket_id,
        req.corrected_category.value if req.corrected_category else None,
        req.corrected_priority.value if req.corrected_priority else None,
        req.corrected_team.value if req.corrected_team else None,
        req.note,
    )
    return updated


@app.get("/api/analytics")
def get_analytics():
    return analytics.compute_analytics()


@app.get("/api/sample-tickets")
def get_sample_tickets():
    return {"tickets": SAMPLE_TICKETS}


@app.post("/api/demo/run")
def run_demo(req: DemoRunRequest):
    results = []
    for text in req.tickets:
        result = classifier.build_ticket_result(text, manual_time_seconds=None, compare=True)
        store.save_ticket(result)
        results.append(result)
    return {"results": results}


@app.get("/api/demo/repair-example")
def repair_example():
    """Deterministic proof that the JSON-repair path works, independent of
    any live model call — good for the 'what happens with malformed JSON'
    part of the demo."""
    broken_examples = [
        '```json\n{"category": "Billing", "priority": "High", "team": "Billing Support", '
        '"tone": "angry", "confidence": 0.8, "is_ambiguous": false, "reasoning": "Double charge complaint.",}\n```',
        'Sure! Here is the classification: {"category": "Bug Report", "priority": "Medium", '
        '"team": "Engineering", "tone": "frustrated", "confidence": 0.7, "is_ambiguous": false, '
        '"reasoning": "App crash reported."} Let me know if you need anything else.',
        '{"category": "Security Concern" "priority": "High" "team": "Security Team"}',
    ]
    return {"examples": [classifier.repair_demo(e) for e in broken_examples]}


_frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
