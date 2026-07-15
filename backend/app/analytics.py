"""Aggregate stats over everything routed so far — powers the dashboard."""
from collections import Counter

from . import store


def _bucket(rows: list[dict], field: str) -> dict[str, int]:
    # Unrouted ("New") tickets have no category/priority/team/tone yet —
    # exclude them rather than let them show up as a spurious null bucket.
    return dict(Counter(r[field] for r in rows if r.get(field) is not None))


def compute_analytics() -> dict:
    rows = store.list_tickets(limit=100000, offset=0)
    total = len(rows)

    if total == 0:
        return {
            "total_tickets": 0,
            "avg_ai_latency_ms": 0,
            "avg_manual_seconds": store.ASSUMED_MANUAL_SECONDS,
            "measured_manual_count": 0,
            "total_ai_seconds": 0,
            "total_manual_seconds": 0,
            "total_time_saved_seconds": 0,
            "time_saved_pct": 0,
            "category_breakdown": {},
            "priority_breakdown": {},
            "team_breakdown": {},
            "tone_breakdown": {},
            "mode_breakdown": {},
            "status_breakdown": {},
            "ambiguous_count": 0,
            "escalated_count": 0,
            "feedback_count": 0,
            "agreement_rate": None,
        }

    total_ai_seconds = sum(r["latency_ms"] for r in rows) / 1000.0
    measured = [r["manual_time_seconds"] for r in rows if r.get("manual_time_seconds") is not None]
    total_manual_seconds = sum(measured) + (total - len(measured)) * store.ASSUMED_MANUAL_SECONDS

    reviewed = [r for r in rows if r.get("reviewed")]
    corrected = [
        r for r in reviewed
        if r.get("corrected_category") is not None or r.get("corrected_priority") is not None or r.get("corrected_team") is not None
    ]

    return {
        "total_tickets": total,
        "avg_ai_latency_ms": round(sum(r["latency_ms"] for r in rows) / total, 1),
        "avg_manual_seconds": round(total_manual_seconds / total, 1),
        "measured_manual_count": len(measured),
        "total_ai_seconds": round(total_ai_seconds, 2),
        "total_manual_seconds": round(total_manual_seconds, 2),
        "total_time_saved_seconds": round(total_manual_seconds - total_ai_seconds, 2),
        "time_saved_pct": round(100 * (total_manual_seconds - total_ai_seconds) / total_manual_seconds, 1) if total_manual_seconds else 0,
        "category_breakdown": _bucket(rows, "category"),
        "priority_breakdown": _bucket(rows, "priority"),
        "team_breakdown": _bucket(rows, "team"),
        "tone_breakdown": _bucket(rows, "tone"),
        "mode_breakdown": _bucket(rows, "mode"),
        # Unlike the breakdowns above, status is never null (every ticket
        # defaults to "New"), so New tickets show up here even though they
        # have no category/priority/team/tone yet.
        "status_breakdown": dict(Counter(r["status"] for r in rows)),
        "ambiguous_count": sum(1 for r in rows if r["is_ambiguous"]),
        "escalated_count": sum(1 for r in rows if r["escalated"]),
        "feedback_count": len(reviewed),
        "agreement_rate": None if not reviewed else round(100 * (1 - len(corrected) / len(reviewed)), 1),
    }


def compute_team_summary() -> dict:
    """Per-team workload: how many of that team's tickets are assigned
    (just routed, not started), in progress, or resolved. Every team that
    actually exists in this deployment shows up even with zero tickets, so
    an empty team is visibly empty rather than just missing."""
    rows = store.list_tickets(limit=100000, offset=0)
    counts = {team: {"assigned": 0, "in_progress": 0, "resolved": 0} for team in store.list_known_teams()}

    for r in rows:
        team = r.get("team")
        if team not in counts:
            continue
        if r["status"] == "Routed":
            counts[team]["assigned"] += 1
        elif r["status"] == "In Progress":
            counts[team]["in_progress"] += 1
        elif r["status"] == "Resolved":
            counts[team]["resolved"] += 1

    return {
        "teams": [
            {"team": team, **c, "total": c["assigned"] + c["in_progress"] + c["resolved"]}
            for team, c in counts.items()
        ]
    }
