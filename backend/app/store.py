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
from pathlib import Path

DB_PATH = Path(os.environ.get("TICKET_DB_PATH", Path(__file__).parent.parent / "data" / "tickets.db"))

# Assumed average time a human agent spends reading, categorizing, and
# routing one ticket by hand. Used only when a real measured
# manual_time_seconds isn't provided (see the "Race Mode" feature in the UI,
# which records real stopwatch times instead of relying on this constant).
ASSUMED_MANUAL_SECONDS = 90.0


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


def init_db() -> None:
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                team TEXT NOT NULL,
                tone TEXT NOT NULL,
                confidence REAL NOT NULL,
                is_ambiguous INTEGER NOT NULL,
                escalated INTEGER NOT NULL,
                reasoning TEXT NOT NULL,
                model_used TEXT NOT NULL,
                mode TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                manual_time_seconds REAL,
                created_at TEXT NOT NULL,
                baseline_json TEXT,
                reviewed INTEGER NOT NULL DEFAULT 0,
                corrected_category TEXT,
                corrected_priority TEXT,
                corrected_team TEXT,
                feedback_note TEXT
            )
        """)


def save_ticket(result: dict) -> None:
    with _conn() as conn:
        conn.execute(
            """INSERT INTO tickets (
                id, message, category, priority, team, tone, confidence, is_ambiguous,
                escalated, reasoning, model_used, mode, latency_ms, manual_time_seconds,
                created_at, baseline_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                result["id"], result["message"], result["category"], result["priority"],
                result["team"], result["tone"], result["confidence"], int(result["is_ambiguous"]),
                int(result["escalated"]), result["reasoning"], result["model_used"], result["mode"],
                result["latency_ms"], result.get("manual_time_seconds"), result["created_at"],
                json.dumps(result["baseline"]) if result.get("baseline") else None,
            ),
        )


def save_feedback(ticket_id: str, corrected_category: str | None, corrected_priority: str | None,
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
    d["is_ambiguous"] = bool(d["is_ambiguous"])
    d["escalated"] = bool(d["escalated"])
    d["reviewed"] = bool(d["reviewed"])
    d["baseline"] = json.loads(d.pop("baseline_json")) if d.get("baseline_json") else None
    return d


def get_ticket(ticket_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        return _row_to_dict(row) if row else None


def list_tickets(limit: int = 50, offset: int = 0) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tickets ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def count_tickets() -> int:
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
