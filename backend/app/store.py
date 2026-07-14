"""Tiny synchronous SQLite persistence layer.

A student project doesn't need Postgres — but it does need every routed
ticket to survive a server restart, and it needs a real audit trail (what
did the AI decide, how confident was it, did a human correct it, how long
did it take) to back the analytics dashboard with real numbers instead of
made-up ones.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("TICKET_DB_PATH", Path(__file__).parent.parent / "data" / "tickets.db"))

# Assumed average time a human agent spends reading, categorizing, and
# routing one ticket by hand. Used only when a real measured
# manual_time_seconds isn't provided (see the "Race Mode" feature in the UI,
# which records real stopwatch times instead of relying on this constant).
ASSUMED_MANUAL_SECONDS = 90.0

# Every id (users.id, team_members.id, tickets.id, tickets.user_id) is a
# plain autoincrement integer, assigned by SQLite itself — nothing in this
# module generates ids by hand.

_TICKETS_SCHEMA = """
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        category TEXT,
        priority TEXT,
        team TEXT,
        tone TEXT,
        confidence REAL,
        is_ambiguous INTEGER,
        escalated INTEGER,
        reasoning TEXT,
        model_used TEXT,
        mode TEXT,
        latency_ms INTEGER,
        manual_time_seconds REAL,
        created_at TEXT NOT NULL,
        baseline_json TEXT,
        reviewed INTEGER NOT NULL DEFAULT 0,
        corrected_category TEXT,
        corrected_priority TEXT,
        corrected_team TEXT,
        feedback_note TEXT,
        model_results_json TEXT
    )
"""

_sandbox_user_id: int | None = None


@contextmanager
def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    global _sandbox_user_id
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                team TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute(_TICKETS_SCHEMA)

        # A placeholder account tickets can be attached to when there's no
        # real signed-up customer behind them — the Admin sandbox tools
        # (Route a Ticket / Race / Demo) classify ad-hoc text, not a real
        # customer's submitted ticket. INSERT OR IGNORE keyed by the unique
        # email means this only actually inserts once, ever; every later
        # startup just looks its id back up.
        conn.execute(
            "INSERT OR IGNORE INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            ("Admin sandbox", "sandbox@internal", "!", _now()),
        )
        _sandbox_user_id = conn.execute(
            "SELECT id FROM users WHERE email = 'sandbox@internal'"
        ).fetchone()[0]


def _sandbox_user() -> int:
    assert _sandbox_user_id is not None, "store.init_db() must run before saving sandbox tickets"
    return _sandbox_user_id


# ---- users ---------------------------------------------------------------

def create_user(name: str, email: str, password_hash: str) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (name, email, password_hash, _now()),
        )
        return {"id": cur.lastrowid, "name": name, "email": email}


def get_user_by_email(email: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


# ---- team members ----------------------------------------------------------

def create_team_member(name: str, email: str, password_hash: str, team: str) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO team_members (name, email, password_hash, team, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, email, password_hash, team, _now()),
        )
        return {"id": cur.lastrowid, "name": name, "email": email, "team": team}


def get_team_member_by_email(email: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM team_members WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def list_team_members() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute("SELECT id, name, email, team, created_at FROM team_members ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


# ---- tickets ---------------------------------------------------------------

def create_ticket(user_id: int, message: str) -> dict:
    """A brand-new, unrouted ticket submitted by a user — no AI call yet."""
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO tickets (user_id, message, status, created_at) VALUES (?, ?, 'New', ?)",
            (user_id, message, _now()),
        )
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _row_to_dict(row)


def save_ticket(result: dict) -> int:
    """Insert an already-fully-classified ticket — used by the Admin sandbox
    tools (Route a Ticket / Race / Demo), which classify ad-hoc text in one
    call rather than routing a real customer-submitted ticket later. Returns
    the id SQLite assigned it."""
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO tickets (
                user_id, message, status, category, priority, team, tone, confidence, is_ambiguous,
                escalated, reasoning, model_used, mode, latency_ms, manual_time_seconds,
                created_at, baseline_json, model_results_json
            ) VALUES (?, ?, 'Routed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                _sandbox_user(), result["message"], result["category"], result["priority"],
                result["team"], result["tone"], result["confidence"], int(result["is_ambiguous"]),
                int(result["escalated"]), result["reasoning"], result["model_used"], result["mode"],
                result["latency_ms"], result.get("manual_time_seconds"), result["created_at"],
                json.dumps(result["baseline"]) if result.get("baseline") else None,
                json.dumps(result["model_results"]) if result.get("model_results") else None,
            ),
        )
        return cur.lastrowid


def apply_classification(ticket_id: int, result: dict) -> dict | None:
    """Fill in the AI classification on an existing (previously unrouted)
    ticket — what an Admin's "Route" action does. Moves status New -> Routed."""
    with _conn() as conn:
        conn.execute(
            """UPDATE tickets SET
                status = 'Routed', category = ?, priority = ?, team = ?, tone = ?, confidence = ?,
                is_ambiguous = ?, escalated = ?, reasoning = ?, model_used = ?, mode = ?, latency_ms = ?,
                baseline_json = ?, model_results_json = ?
               WHERE id = ?""",
            (
                result["category"], result["priority"], result["team"], result["tone"], result["confidence"],
                int(result["is_ambiguous"]), int(result["escalated"]), result["reasoning"], result["model_used"],
                result["mode"], result["latency_ms"],
                json.dumps(result["baseline"]) if result.get("baseline") else None,
                json.dumps(result["model_results"]) if result.get("model_results") else None,
                ticket_id,
            ),
        )
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def update_ticket_status(ticket_id: int, status: str) -> dict | None:
    with _conn() as conn:
        conn.execute("UPDATE tickets SET status = ? WHERE id = ?", (status, ticket_id))
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def assign_ticket(ticket_id: int, category: str, priority: str, team: str) -> dict | None:
    """An Admin finalizing a routed ticket — whether that's approving the
    AI's own category/priority/team unchanged, or overriding one or more of
    them before the assigned team ever sees it."""
    with _conn() as conn:
        conn.execute(
            "UPDATE tickets SET category = ?, priority = ?, team = ? WHERE id = ?",
            (category, priority, team, ticket_id),
        )
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def save_feedback(ticket_id: int, corrected_category: str | None, corrected_priority: str | None,
                   corrected_team: str | None, note: str | None) -> dict | None:
    with _conn() as conn:
        conn.execute(
            """UPDATE tickets SET reviewed = 1, corrected_category = ?, corrected_priority = ?,
               corrected_team = ?, feedback_note = ? WHERE id = ?""",
            (corrected_category, corrected_priority, corrected_team, note, ticket_id),
        )
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["is_ambiguous"] = bool(d["is_ambiguous"]) if d["is_ambiguous"] is not None else None
    d["escalated"] = bool(d["escalated"]) if d["escalated"] is not None else None
    d["reviewed"] = bool(d["reviewed"])
    d["baseline"] = json.loads(d.pop("baseline_json")) if d.get("baseline_json") else None
    d["model_results"] = json.loads(d.pop("model_results_json")) if d.get("model_results_json") else None
    return d


def get_ticket(ticket_id: int) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def list_tickets(limit: int = 50, offset: int = 0) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tickets ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def list_tickets_for_user(user_id: int) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def list_tickets_by_status(status: str) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tickets WHERE status = ? ORDER BY created_at ASC", (status,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def list_tickets_for_team(team: str) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            """SELECT tickets.*, users.name AS user_name, users.email AS user_email
               FROM tickets JOIN users ON tickets.user_id = users.id
               WHERE tickets.team = ? AND tickets.status != 'New'
               ORDER BY tickets.created_at DESC""",
            (team,),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def list_tickets_with_user(limit: int = 200, offset: int = 0) -> list[dict]:
    """Full detail across all tickets, joined with the submitting user's
    name/email — powers the Admin "all tickets" detail view."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT tickets.*, users.name AS user_name, users.email AS user_email
               FROM tickets JOIN users ON tickets.user_id = users.id
               ORDER BY tickets.created_at DESC LIMIT ? OFFSET ?""",
            (limit, offset),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def count_tickets() -> int:
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
