from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import analytics, auth, classifier, store
from .models import (
    AdminAssignRequest,
    BulkRouteRequest,
    DemoRunRequest,
    FeedbackRequest,
    LoginRequest,
    NewTicketRequest,
    RouteRequest,
    SignupRequest,
    TeamMemberCreateRequest,
    TicketStatusUpdateRequest,
    TokenResponse,
)
from .sample_tickets import SAMPLE_TICKETS

app = FastAPI(title="TicketTrident", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _no_cache(request, call_next):
    """These dashboards need every refresh to hit real, current data — never
    a cached copy of a previous response, whether from the browser or an
    intermediate proxy."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.on_event("startup")
def _startup():
    store.init_db()


@app.get("/api/health")
def health():
    info = classifier.mode_info()
    return {"status": "ok", **info, "ticket_count": store.count_tickets()}


# ---- auth -------------------------------------------------------------

@app.post("/api/auth/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    if store.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="an account with that email already exists")
    user = store.create_user(req.name, req.email, auth.hash_password(req.password))
    token = auth.create_token(user["id"], "user", user["name"])
    return TokenResponse(access_token=token, role="user", name=user["name"])


@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest):
    user = store.get_user_by_email(req.email)
    if user and auth.verify_password(req.password, user["password_hash"]):
        token = auth.create_token(user["id"], "user", user["name"])
        return TokenResponse(access_token=token, role="user", name=user["name"])

    member = store.get_team_member_by_email(req.email)
    if member and auth.verify_password(req.password, member["password_hash"]):
        token = auth.create_token(member["id"], "team", member["name"], team=member["team"])
        return TokenResponse(access_token=token, role="team", name=member["name"], team=member["team"])

    if req.email == auth.ADMIN_EMAIL and req.password == auth.ADMIN_PASSWORD:
        token = auth.create_token("admin", "admin", "Admin")
        return TokenResponse(access_token=token, role="admin", name="Admin")

    raise HTTPException(status_code=401, detail="invalid email or password")


@app.get("/api/auth/me")
def me(claims: dict = Depends(auth.require_any)):
    return claims


# ---- admin sandbox tools (Manual vs AI Race / Demo / Analytics) ----
# Gated behind admin login. Race and Demo classify ad-hoc/sample text for
# demonstration purposes only — deliberately NOT persisted, so they never
# show up in All Tickets, Analytics, or the Teams summary.

@app.post("/api/route")
def route_ticket(req: RouteRequest, claims: dict = Depends(auth.require_admin)):
    return classifier.build_ticket_result(req.message, req.manual_time_seconds, req.compare)


@app.get("/api/tickets")
def get_tickets(limit: int = 50, offset: int = 0, claims: dict = Depends(auth.require_admin)):
    return {"tickets": store.list_tickets(limit=limit, offset=offset), "total": store.count_tickets()}


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int, claims: dict = Depends(auth.require_admin)):
    t = store.get_ticket(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="ticket not found")
    return t


@app.post("/api/tickets/{ticket_id}/feedback")
def give_feedback(ticket_id: int, req: FeedbackRequest, claims: dict = Depends(auth.require_admin)):
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


# ---- user: submit + track tickets --------------------------------------

@app.post("/api/tickets")
def create_ticket(req: NewTicketRequest, claims: dict = Depends(auth.require_user)):
    """A user submits a ticket. No AI call here — it stays unclassified
    (status="New") until an Admin routes it."""
    return store.create_ticket(user_id=int(claims["sub"]), message=req.message)


@app.get("/api/my-tickets")
def my_tickets(claims: dict = Depends(auth.require_user)):
    return {"tickets": store.list_tickets_for_user(int(claims["sub"]))}


# ---- admin: route the queue + full detail ------------------------------

@app.get("/api/admin/tickets/new")
def admin_new_tickets(claims: dict = Depends(auth.require_admin)):
    return {"tickets": store.list_tickets_by_status("New")}


@app.post("/api/admin/tickets/{ticket_id}/route")
def admin_route_ticket(ticket_id: int, claims: dict = Depends(auth.require_admin)):
    ticket = store.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket not found")
    # compare=True so the admin sees the same full picture as the Route a
    # Ticket tab (baseline + multi-model comparison), not just the bare pick.
    result = classifier.build_ticket_result(ticket["message"], manual_time_seconds=None, compare=True)
    return store.apply_classification(ticket_id, result)


@app.post("/api/admin/tickets/route-bulk")
def admin_route_bulk(req: BulkRouteRequest, claims: dict = Depends(auth.require_admin)):
    """Route several queued tickets in one action, each accepting the AI's
    own pick outright — the fast path for clearing a backlog, as opposed to
    the single-ticket flow's per-ticket review-and-override step."""
    results = []
    for ticket_id in req.ticket_ids:
        ticket = store.get_ticket(ticket_id)
        if not ticket or ticket["status"] != "New":
            continue
        result = classifier.build_ticket_result(ticket["message"], manual_time_seconds=None, compare=False)
        results.append(store.apply_classification(ticket_id, result))
    return {"results": results}


@app.post("/api/admin/tickets/{ticket_id}/assign")
def admin_assign_ticket(ticket_id: int, req: AdminAssignRequest, claims: dict = Depends(auth.require_admin)):
    """Finalize a routed ticket. Send back the AI's own category/priority/team
    unchanged to approve it as-is, or different values to override before
    the assigned team ever sees it."""
    ticket = store.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket not found")
    return store.assign_ticket(ticket_id, req.category.value, req.priority.value, req.team.value)


@app.get("/api/admin/tickets")
def admin_all_tickets(claims: dict = Depends(auth.require_admin)):
    return {"tickets": store.list_tickets_with_user(), "total": store.count_tickets()}


@app.get("/api/admin/team-summary")
def admin_team_summary(claims: dict = Depends(auth.require_admin)):
    return analytics.compute_team_summary()


@app.get("/api/admin/team-members")
def admin_list_team_members(claims: dict = Depends(auth.require_admin)):
    return {"team_members": store.list_team_members()}


@app.post("/api/admin/team-members")
def admin_create_team_member(req: TeamMemberCreateRequest, claims: dict = Depends(auth.require_admin)):
    if store.get_team_member_by_email(req.email):
        raise HTTPException(status_code=409, detail="an account with that email already exists")
    return store.create_team_member(req.name, req.email, auth.hash_password(req.password), req.team.value)


# ---- team: work the assigned queue --------------------------------------

@app.get("/api/team/tickets")
def team_tickets(claims: dict = Depends(auth.require_team)):
    return {"tickets": store.list_tickets_for_team(claims["team"])}


# Status only ever moves forward — a team can't send a ticket back to an
# earlier stage (e.g. Resolved -> In Progress), even via a direct API call.
_ALLOWED_STATUS_MOVES = {
    "Routed": {"Routed", "In Progress", "Resolved"},
    "In Progress": {"In Progress", "Resolved"},
    "Resolved": {"Resolved"},
}


@app.patch("/api/team/tickets/{ticket_id}/status")
def team_update_status(ticket_id: int, req: TicketStatusUpdateRequest, claims: dict = Depends(auth.require_team)):
    ticket = store.get_ticket(ticket_id)
    if not ticket or ticket.get("team") != claims["team"]:
        raise HTTPException(status_code=404, detail="ticket not found")
    allowed = _ALLOWED_STATUS_MOVES.get(ticket["status"], set())
    if req.status.value not in allowed:
        raise HTTPException(status_code=400, detail=f"a {ticket['status']} ticket can't be moved back to {req.status.value}")
    return store.update_ticket_status(ticket_id, req.status.value)


@app.get("/api/analytics")
def get_analytics(claims: dict = Depends(auth.require_admin)):
    return analytics.compute_analytics()


@app.get("/api/sample-tickets")
def get_sample_tickets(claims: dict = Depends(auth.require_admin)):
    return {"tickets": SAMPLE_TICKETS}


@app.post("/api/demo/run")
def run_demo(req: DemoRunRequest, claims: dict = Depends(auth.require_admin)):
    """Classify the sample tickets for demonstration only — not persisted,
    so the demo set never pollutes real ticket history/analytics."""
    results = [classifier.build_ticket_result(text, manual_time_seconds=None, compare=True) for text in req.tickets]
    return {"results": results}


@app.get("/api/demo/repair-example")
def repair_example(claims: dict = Depends(auth.require_admin)):
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
