#!/usr/bin/env python3
"""Command-line interface for TicketTrident.

Usage:
    python -m app.cli route "The app keeps crashing when I upload a photo"
    python -m app.cli demo              # run all 30 bundled sample tickets
    python -m app.cli health
"""
import argparse
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from . import classifier, store
from .sample_tickets import SAMPLE_TICKETS

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
COLORS = {"High": "\033[91m", "Medium": "\033[93m", "Low": "\033[92m"}


def _print_result(result: dict) -> None:
    color = COLORS.get(result["priority"], "")
    print(f"{BOLD}Category:{RESET}   {result['category']}")
    print(f"{BOLD}Priority:{RESET}   {color}{result['priority']}{RESET}"
          + (f"  {DIM}(escalated due to {result['tone']} tone){RESET}" if result["escalated"] else ""))
    print(f"{BOLD}Team:{RESET}       {result['team']}")
    print(f"{BOLD}Tone:{RESET}       {result['tone']}")
    print(f"{BOLD}Confidence:{RESET} {result['confidence']:.0%}" + ("  (ambiguous)" if result["is_ambiguous"] else ""))
    print(f"{BOLD}Reasoning:{RESET}  {result['reasoning']}")
    print(f"{DIM}mode={result['mode']} model={result['model_used']} latency={result['latency_ms']}ms{RESET}")


def cmd_route(args) -> None:
    store.init_db()
    result = classifier.build_ticket_result(args.message, manual_time_seconds=None, compare=args.compare)
    store.save_ticket(result)
    if args.json:
        print(json.dumps(result, indent=2, default=str))
        return
    _print_result(result)
    if args.compare and result.get("baseline"):
        print(f"\n{BOLD}--- keyword baseline (for comparison) ---{RESET}")
        b = result["baseline"]
        print(f"Category: {b['category']}   Priority: {b['priority']}   Team: {b['team']}")
        print(f"Reasoning: {b['reasoning']}")


def cmd_demo(args) -> None:
    store.init_db()
    print(f"Routing {len(SAMPLE_TICKETS)} sample tickets...\n")
    total_ai = 0.0
    for i, item in enumerate(SAMPLE_TICKETS, 1):
        start = time.monotonic()
        result = classifier.build_ticket_result(item["text"], manual_time_seconds=None, compare=False)
        store.save_ticket(result)
        total_ai += time.monotonic() - start
        print(f"{BOLD}[{i:02d}]{RESET} {item['text'][:70]}")
        print(f"     -> {result['category']} / {result['priority']} / {result['team']}"
              f"  (confidence {result['confidence']:.0%}, tone={result['tone']})")
    manual_estimate = len(SAMPLE_TICKETS) * store.ASSUMED_MANUAL_SECONDS
    print(f"\n{BOLD}Done.{RESET} AI routed {len(SAMPLE_TICKETS)} tickets in {total_ai:.1f}s total.")
    print(f"Estimated manual time for the same batch: ~{manual_estimate/60:.1f} min "
          f"(~{store.ASSUMED_MANUAL_SECONDS:.0f}s/ticket).")


def cmd_health(args) -> None:
    info = classifier.mode_info()
    print(json.dumps(info, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="tickettrident", description="TicketTrident CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_route = sub.add_parser("route", help="Classify a single ticket message")
    p_route.add_argument("message", help="The support ticket text")
    p_route.add_argument("--json", action="store_true", help="Print raw JSON output")
    p_route.add_argument("--compare", action="store_true", help="Also show the keyword-baseline result")
    p_route.set_defaults(func=cmd_route)

    p_demo = sub.add_parser("demo", help="Route all 30 bundled sample tickets")
    p_demo.set_defaults(func=cmd_demo)

    p_health = sub.add_parser("health", help="Show whether live Claude or mock mode is active")
    p_health.set_defaults(func=cmd_health)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())
