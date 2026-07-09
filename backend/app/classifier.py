"""LLM-powered ticket classification with schema enforcement and a repair path.

Design notes (also covered in the README):
- We hand the model a strict JSON Schema (Claude's `output_config.format`
  Structured Outputs, or Groq's `response_format` JSON mode). That constrains
  the *shape* of the response at the API level, so "the model forgot a
  field" or "the model wrapped it in markdown" mostly can't happen. This is
  the primary answer to "how do you handle malformed JSON" — you prevent
  most of it before it happens.
- We still don't trust it blindly. `_extract_json` and the repair turn below
  are a second line of defense for the cases structured outputs doesn't fully
  cover: a refusal, a truncated response (`max_tokens`), or a transient
  response that fails our own Pydantic validation (e.g. confidence outside
  0-1). One repair turn is attempted before we give up and fall back to the
  rule-based baseline so the user always gets *something* usable.
- Two providers are supported: Anthropic (Claude) is preferred if
  `ANTHROPIC_API_KEY` is set; Groq is used as a fallback live provider if
  only `GROQ_API_KEY` is set. Groq's structured-output guarantees are weaker
  than Claude's (JSON mode, not a strict schema), which is exactly what the
  repair path above already exists to cover.
"""
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from pydantic import ValidationError

from . import baseline
from .models import Category, Priority, Team, Tone, TicketClassification

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
FORCE_MOCK = os.environ.get("FORCE_MOCK_MODE", "").strip().lower() in ("1", "true", "yes")

SYSTEM_PROMPT = """You are the triage engine for a company's support ticket routing system. \
You read one incoming support message and decide how it should be routed.

Rules:
- Always choose exactly one category, priority, and team, even if the ticket is short, vague, \
sarcastic, or touches more than one issue. Never refuse to classify a ticket just because it's \
ambiguous — pick your best answer and say so via is_ambiguous instead.
- Set is_ambiguous=true whenever the ticket could reasonably fit more than one category, or there \
is not enough information to be confident.
- confidence is how sure you are in THIS classification (0 = pure guess, 1 = certain), not how \
important the ticket is.
- tone is the customer's emotional state as written (neutral, frustrated, angry, urgent, confused, \
positive) - judge it from the actual words used, not the topic.
- reasoning must be exactly one sentence, specific to this ticket's content.
- Priority guidance: security concerns, data loss, and outages affecting the customer's ability to \
work are usually High. Angry or urgent tone on a billing or account-access issue should usually be \
High too. Cosmetic issues, feature requests, and calm general questions are usually Low or Medium.
- A one-word or near-empty message should still be classified: default toward General Inquiry / \
Triage with low confidence and is_ambiguous=true, and use reasoning to say what's missing."""

# The schema the model must fill in. Deliberately hand-written (rather than
# Category.model_json_schema()) because output_config.format rejects a
# handful of JSON Schema keywords Pydantic likes to emit (minimum/maximum,
# etc. — see the Structured Outputs limitations in the API docs). Confidence
# is still range-checked, just client-side, via TicketClassification below.
# Shared by both providers — Claude's output_config.format and Groq's
# response_format both accept a plain JSON Schema object.
TICKET_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": [c.value for c in Category]},
        "priority": {"type": "string", "enum": [p.value for p in Priority]},
        "team": {"type": "string", "enum": [t.value for t in Team]},
        "tone": {"type": "string", "enum": [t.value for t in Tone]},
        "confidence": {"type": "number"},
        "is_ambiguous": {"type": "boolean"},
        "reasoning": {"type": "string"},
    },
    "required": ["category", "priority", "team", "tone", "confidence", "is_ambiguous", "reasoning"],
    "additionalProperties": False,
}

# Groq's response_format="json_object" only guarantees syntactically valid
# JSON, not conformance to TICKET_SCHEMA — and requires the word "json"
# somewhere in the messages at all. So, unlike Claude, Groq needs the schema
# spelled out in the prompt itself; _extract_json + Pydantic validation +
# the repair turn below are what actually enforce the shape.
GROQ_SYSTEM_PROMPT = (
    SYSTEM_PROMPT
    + "\n\nRespond with ONLY a single JSON object matching this schema, no markdown fences, "
    "no commentary:\n" + json.dumps(TICKET_SCHEMA)
)

REPAIR_INSTRUCTION = (
    "Your previous response could not be parsed as valid JSON matching the required schema. "
    "Respond again with ONLY a single JSON object matching the schema — no markdown fences, "
    "no commentary, no trailing text."
)

_client = None
_provider: str | None = None
_client_unavailable_reason: str | None = None


def _get_provider() -> tuple[str | None, object | None]:
    """Lazily construct whichever LLM client is configured. Returns
    (provider, client) — provider is "anthropic" or "groq" — or (None, None)
    if neither has usable credentials; callers fall back to the baseline.
    Anthropic is preferred if both are configured."""
    global _client, _provider, _client_unavailable_reason
    if FORCE_MOCK:
        return None, None
    if _client is not None:
        return _provider, _client

    try:
        import anthropic
        client = anthropic.Anthropic()
        if client.api_key or client.auth_token:
            _client, _provider = client, "anthropic"
            return _provider, _client
    except Exception as exc:  # pragma: no cover - environment dependent
        _client_unavailable_reason = str(exc)

    try:
        import groq
        client = groq.Groq()
        _client, _provider = client, "groq"
        return _provider, _client
    except Exception as exc:  # pragma: no cover - environment dependent
        _client_unavailable_reason = str(exc)

    return None, None


def mode_info() -> dict:
    provider, _ = _get_provider()
    live = provider is not None
    if live:
        reason = None
    elif FORCE_MOCK:
        reason = "FORCE_MOCK_MODE is enabled"
    else:
        reason = _client_unavailable_reason or "no ANTHROPIC_API_KEY or GROQ_API_KEY set"
    model = {"anthropic": MODEL, "groq": GROQ_MODEL}.get(provider, "keyword-baseline")
    return {
        "mode": "live" if live else "mock",
        "provider": provider,
        "model": model,
        "forced_mock": FORCE_MOCK,
        "reason": reason,
    }


def _extract_json(text: str) -> dict | None:
    """Best-effort recovery of a JSON object from a (possibly messy) string.
    Used both as defense-in-depth on real responses and by the /demo repair
    endpoint to show the mechanism deterministically."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ``` fences if present.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Grab the first {...} block and try again (handles stray prose around it).
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    candidate = match.group(0)
    # Common LLM-ism: trailing comma before a closing brace/bracket.
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def repair_demo(broken_json: str) -> dict:
    """Deterministic demonstration of the repair path, independent of any
    live API call — lets you show a mentor exactly what happens when the
    model returns garbage, without waiting on network flakiness to trigger it."""
    recovered = _extract_json(broken_json)
    return {
        "input": broken_json,
        "recovered": recovered,
        "success": recovered is not None,
    }


def _escalate(priority: Priority, tone: Tone) -> tuple[Priority, bool]:
    if tone in (Tone.ANGRY, Tone.URGENT) and priority == Priority.MEDIUM:
        return Priority.HIGH, True
    return priority, False


def _call_anthropic(client, message: str, repair: bool, prior_content=None):
    kwargs = dict(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        output_config={"format": {"type": "json_schema", "schema": TICKET_SCHEMA}, "effort": "low"},
    )
    if repair and prior_content is not None:
        kwargs["messages"] = [
            {"role": "user", "content": message},
            {"role": "assistant", "content": prior_content},
            {"role": "user", "content": REPAIR_INSTRUCTION},
        ]
    else:
        kwargs["messages"] = [{"role": "user", "content": message}]
    return client.messages.create(**kwargs)


def _call_groq(client, message: str, repair: bool, prior_text: str | None = None):
    """Groq's chat.completions API — OpenAI-shaped, not Claude's Messages API.
    Requests JSON mode rather than a strict schema (Groq's schema enforcement
    is weaker/model-dependent), and leans on the shared _extract_json +
    Pydantic validation + repair turn to cover the gap."""
    messages = [{"role": "system", "content": GROQ_SYSTEM_PROMPT}]
    if repair and prior_text is not None:
        messages += [
            {"role": "user", "content": message},
            {"role": "assistant", "content": prior_text},
            {"role": "user", "content": REPAIR_INSTRUCTION},
        ]
    else:
        messages.append({"role": "user", "content": message})
    return client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=1024,
        messages=messages,
        response_format={"type": "json_object"},
    )


@dataclass
class ClassifyOutcome:
    classification: TicketClassification
    mode: str
    model_used: str
    latency_ms: int


def _baseline_as_classification(message: str) -> TicketClassification:
    b = baseline.classify(message)
    return TicketClassification(
        category=b.category,
        priority=b.priority,
        team=b.team,
        tone=b.tone,
        confidence=0.4,
        is_ambiguous=True,
        reasoning=b.reasoning,
    )


def classify_ticket(message: str) -> ClassifyOutcome:
    start = time.monotonic()
    provider, client = _get_provider()

    if provider is None:
        result = _baseline_as_classification(message)
        return ClassifyOutcome(result, "mock", "keyword-baseline", int((time.monotonic() - start) * 1000))

    model_used = MODEL if provider == "anthropic" else GROQ_MODEL

    if provider == "anthropic":
        import anthropic
        transient_errors = (anthropic.APIConnectionError, anthropic.RateLimitError, anthropic.APIStatusError)
    else:
        import groq
        transient_errors = (groq.APIConnectionError, groq.RateLimitError, groq.APIStatusError)

    try:
        if provider == "anthropic":
            response = _call_anthropic(client, message, repair=False)
            if response.stop_reason == "refusal":
                raise ValueError("model refused to classify this ticket")
            text = next((b.text for b in response.content if b.type == "text"), "")
        else:
            response = _call_groq(client, message, repair=False)
            if response.choices[0].finish_reason == "content_filter":
                raise ValueError("model refused to classify this ticket")
            text = response.choices[0].message.content or ""

        data = _extract_json(text)
        if data is None:
            raise ValueError("could not parse JSON from first response")
        classification = TicketClassification.model_validate(data)
        mode = "live"

    except (ValueError, ValidationError, json.JSONDecodeError):
        # Repair path: give the model one chance to fix its own output.
        try:
            if provider == "anthropic":
                repaired = _call_anthropic(client, message, repair=True, prior_content=response.content)
                text = next((b.text for b in repaired.content if b.type == "text"), "")
            else:
                repaired = _call_groq(client, message, repair=True, prior_text=response.choices[0].message.content or "")
                text = repaired.choices[0].message.content or ""

            data = _extract_json(text)
            if data is None:
                raise ValueError("repair attempt still not parseable")
            classification = TicketClassification.model_validate(data)
            mode = "repaired"
        except Exception:
            classification = _baseline_as_classification(message)
            mode = "fallback"

    except transient_errors:
        # Network/quota trouble — degrade gracefully instead of a 500.
        classification = _baseline_as_classification(message)
        mode = "fallback"

    latency_ms = int((time.monotonic() - start) * 1000)
    return ClassifyOutcome(classification, mode, model_used if mode in ("live", "repaired") else "keyword-baseline", latency_ms)


def build_ticket_result(message: str, manual_time_seconds: float | None, compare: bool) -> dict:
    outcome = classify_ticket(message)
    c = outcome.classification
    priority, escalated = _escalate(c.priority, c.tone)

    result = {
        "id": str(uuid.uuid4()),
        "message": message,
        "category": c.category.value,
        "priority": priority.value,
        "team": c.team.value,
        "tone": c.tone.value,
        "confidence": c.confidence,
        "is_ambiguous": c.is_ambiguous,
        "escalated": escalated,
        "reasoning": c.reasoning,
        "model_used": outcome.model_used,
        "mode": outcome.mode,
        "latency_ms": outcome.latency_ms,
        "manual_time_seconds": manual_time_seconds,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if compare:
        b = baseline.classify(message)
        result["baseline"] = {
            "category": b.category.value,
            "priority": b.priority.value,
            "team": b.team.value,
            "reasoning": b.reasoning,
        }

    return result
