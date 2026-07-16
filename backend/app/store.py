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
ATTACHMENTS_DIR = Path(os.environ.get("TICKET_ATTACHMENTS_PATH", Path(__file__).parent.parent / "data" / "attachments"))

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

_TICKET_COMMENTS_SCHEMA = """
    CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        author_role TEXT NOT NULL,
        author_name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
"""

_TICKET_COMMENT_READS_SCHEMA = """
    CREATE TABLE IF NOT EXISTS ticket_comment_reads (
        ticket_id INTEGER NOT NULL,
        viewer_role TEXT NOT NULL,
        viewer_key TEXT NOT NULL,
        last_read_at TEXT NOT NULL,
        PRIMARY KEY (ticket_id, viewer_role, viewer_key)
    )
"""

# A customer whose issue AI resolved before any ticket ever existed — logged
# separately from `tickets` (rather than as a ticket with some new status)
# because these never got a category/priority/team/status lifecycle at all;
# they're a distinct kind of event: AI handled it, no human/team involved.
_SELF_RESOLVED_SCHEMA = """
    CREATE TABLE IF NOT EXISTS self_resolved (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        summary TEXT,
        steps_json TEXT,
        created_at TEXT NOT NULL
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
        # Added after the table already existed in some databases — SQLite
        # can add nullable columns in place, no full-table migration needed.
        member_cols = {row["name"] for row in conn.execute("PRAGMA table_info(team_members)").fetchall()}
        if "reset_token" not in member_cols:
            conn.execute("ALTER TABLE team_members ADD COLUMN reset_token TEXT")
        if "reset_token_expires" not in member_cols:
            conn.execute("ALTER TABLE team_members ADD COLUMN reset_token_expires TEXT")
        conn.execute(_TICKETS_SCHEMA)
        conn.execute(_TICKET_COMMENTS_SCHEMA)
        conn.execute(_TICKET_COMMENT_READS_SCHEMA)
        conn.execute(_SELF_RESOLVED_SCHEMA)

        # Attachment support added after ticket_comments already existed in
        # some databases — same in-place nullable-column pattern as above.
        # attachment_path is legacy (files used to live on disk); attachments
        # are now stored directly in the database as attachment_data.
        comment_cols = {row["name"] for row in conn.execute("PRAGMA table_info(ticket_comments)").fetchall()}
        for col in ("attachment_path", "attachment_name", "attachment_mime"):
            if col not in comment_cols:
                conn.execute(f"ALTER TABLE ticket_comments ADD COLUMN {col} TEXT")
        if "attachment_data" not in comment_cols:
            conn.execute("ALTER TABLE ticket_comments ADD COLUMN attachment_data BLOB")

        # One-time backfill: any row still pointing at an on-disk file (from
        # before attachments moved into the database) gets its bytes pulled
        # in now, so downloads keep working uniformly through attachment_data
        # regardless of when the attachment was originally uploaded.
        for row in conn.execute(
            "SELECT id, attachment_path FROM ticket_comments WHERE attachment_path IS NOT NULL AND attachment_data IS NULL"
        ).fetchall():
            file_path = ATTACHMENTS_DIR / row["attachment_path"]
            if file_path.exists():
                conn.execute(
                    "UPDATE ticket_comments SET attachment_data = ? WHERE id = ?",
                    (file_path.read_bytes(), row["id"]),
                )

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


def get_team_member_by_id(member_id: int) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM team_members WHERE id = ?", (member_id,)).fetchone()
        return dict(row) if row else None


def delete_team_member(member_id: int) -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM team_members WHERE id = ?", (member_id,))


def update_team_member_password(member_id: int, password_hash: str) -> None:
    with _conn() as conn:
        conn.execute("UPDATE team_members SET password_hash = ? WHERE id = ?", (password_hash, member_id))


def set_team_member_reset_token(member_id: int, token: str, expires_at: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE team_members SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
            (token, expires_at, member_id),
        )


def get_team_member_by_reset_token(token: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM team_members WHERE reset_token = ?", (token,)).fetchone()
        return dict(row) if row else None


def clear_team_member_reset_token(member_id: int) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE team_members SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?", (member_id,)
        )


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


def get_ticket_with_user(ticket_id: int) -> dict | None:
    """Same as get_ticket, joined with the submitting user's name/email —
    powers the per-ticket PDF report."""
    with _conn() as conn:
        row = conn.execute(
            """SELECT tickets.*, users.name AS user_name, users.email AS user_email
               FROM tickets JOIN users ON tickets.user_id = users.id
               WHERE tickets.id = ?""",
            (ticket_id,),
        ).fetchone()
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
            """SELECT tickets.*, users.name AS user_name, users.email AS user_email
               FROM tickets JOIN users ON tickets.user_id = users.id
               WHERE tickets.status = ? ORDER BY tickets.created_at ASC""",
            (status,),
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


def list_known_teams() -> list[str]:
    """Teams that actually exist in this deployment — have a team member or
    at least one ticket ever routed to them — rather than every team in the
    fixed classification enum."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT team FROM team_members
               UNION
               SELECT team FROM tickets WHERE team IS NOT NULL"""
        ).fetchall()
        return sorted({r["team"] for r in rows})


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


# ---- self-resolved (AI helped, customer confirmed, no ticket ever raised) --

def save_self_resolved(user_id: int, message: str, summary: str | None, steps: list[str]) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO self_resolved (user_id, message, summary, steps_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, message, summary, json.dumps(steps), _now()),
        )
        row = conn.execute("SELECT * FROM self_resolved WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _self_resolved_row_to_dict(row)


def list_self_resolved(limit: int = 200, offset: int = 0) -> list[dict]:
    """Joined with the customer's name/email — powers the Admin "AI Resolved" view."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT self_resolved.*, users.name AS user_name, users.email AS user_email
               FROM self_resolved JOIN users ON self_resolved.user_id = users.id
               ORDER BY self_resolved.created_at DESC LIMIT ? OFFSET ?""",
            (limit, offset),
        ).fetchall()
        return [_self_resolved_row_to_dict(r) for r in rows]


def list_self_resolved_for_user(user_id: int) -> list[dict]:
    """One customer's own AI-resolved history — powers their 'Resolved by AI'
    tab, the self-service mirror of list_tickets_for_user."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM self_resolved WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        return [_self_resolved_row_to_dict(r) for r in rows]


def count_self_resolved() -> int:
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM self_resolved").fetchone()[0]


def _self_resolved_row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["steps"] = json.loads(d.pop("steps_json")) if d.get("steps_json") else []
    return d


# ---- ticket comments (customer <-> team messaging on one ticket) --------

# Every JSON-facing read of a comment excludes attachment_data — it's a
# potentially large BLOB that isn't JSON-serializable anyway. Only
# get_ticket_comment (used solely by the file-download endpoint, which
# returns raw bytes, never JSON) selects it.
_COMMENT_JSON_COLUMNS = "id, ticket_id, author_role, author_name, body, created_at, attachment_name, attachment_mime"


def add_ticket_comment(
    ticket_id: int,
    author_role: str,
    author_name: str,
    body: str,
    attachment_data: bytes | None = None,
    attachment_name: str | None = None,
    attachment_mime: str | None = None,
) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO ticket_comments
               (ticket_id, author_role, author_name, body, created_at, attachment_data, attachment_name, attachment_mime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ticket_id, author_role, author_name, body, _now(), attachment_data, attachment_name, attachment_mime),
        )
        row = conn.execute(
            f"SELECT {_COMMENT_JSON_COLUMNS} FROM ticket_comments WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


def get_ticket_comment(comment_id: int) -> dict | None:
    """Includes attachment_data — only call this from the file-download
    endpoint, never anywhere the result gets JSON-serialized."""
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ticket_comments WHERE id = ?", (comment_id,)).fetchone()
        return dict(row) if row else None


def list_ticket_comments(ticket_id: int) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT {_COMMENT_JSON_COLUMNS} FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC",
            (ticket_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_ticket_comments_with_attachments(ticket_id: int) -> list[dict]:
    """Includes attachment_data — only for the PDF report generator, which
    reads the raw bytes to embed/merge attachments. Never JSON-serialize
    this; use list_ticket_comments for anything API-facing."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC", (ticket_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def mark_comments_read(ticket_id: int, viewer_role: str, viewer_key: str) -> None:
    with _conn() as conn:
        conn.execute(
            """INSERT INTO ticket_comment_reads (ticket_id, viewer_role, viewer_key, last_read_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(ticket_id, viewer_role, viewer_key) DO UPDATE SET last_read_at = excluded.last_read_at""",
            (ticket_id, viewer_role, viewer_key, _now()),
        )


def unread_comment_counts(ticket_ids: list[int], viewer_role: str, viewer_key: str) -> dict[int, int]:
    """How many comments from the OTHER side are newer than this viewer's
    last read, per ticket — powers the badge on the message icon."""
    if not ticket_ids:
        return {}
    with _conn() as conn:
        placeholders = ",".join("?" for _ in ticket_ids)
        last_reads = {
            row["ticket_id"]: row["last_read_at"]
            for row in conn.execute(
                f"""SELECT ticket_id, last_read_at FROM ticket_comment_reads
                    WHERE viewer_role = ? AND viewer_key = ? AND ticket_id IN ({placeholders})""",
                (viewer_role, viewer_key, *ticket_ids),
            ).fetchall()
        }
        rows = conn.execute(
            f"""SELECT ticket_id, created_at FROM ticket_comments
                WHERE ticket_id IN ({placeholders}) AND author_role != ?""",
            (*ticket_ids, viewer_role),
        ).fetchall()
        counts: dict[int, int] = {}
        for r in rows:
            last_read = last_reads.get(r["ticket_id"])
            if last_read is None or r["created_at"] > last_read:
                counts[r["ticket_id"]] = counts.get(r["ticket_id"], 0) + 1
        return counts
