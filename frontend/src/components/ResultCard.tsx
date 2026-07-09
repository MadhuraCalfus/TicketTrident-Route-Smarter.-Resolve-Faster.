import { useState } from "react";
import { Check, MessageSquareWarning, Sparkles, X } from "lucide-react";
import { api } from "../api";
import type { TicketResult } from "../types";
import { CATEGORIES, PRIORITIES, TEAMS } from "../types";
import { Button, Card, CategoryPill, ConfidenceMeter, ModePill, PriorityBadge, ToneBadge } from "./primitives";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
      {children}
    </div>
  );
}

export function ResultCard({ result, onUpdated }: { result: TicketResult; onUpdated?: (r: TicketResult) => void }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [correctedCategory, setCorrectedCategory] = useState(result.category);
  const [correctedPriority, setCorrectedPriority] = useState(result.priority);
  const [correctedTeam, setCorrectedTeam] = useState(result.team);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<TicketResult | null>(
    result.reviewed ? result : null,
  );

  async function submitAgree() {
    setSubmitting(true);
    try {
      const updated = await api.feedback(result.id, { agree: true });
      setDone(updated);
      onUpdated?.(updated);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCorrection() {
    setSubmitting(true);
    try {
      const updated = await api.feedback(result.id, {
        agree: false,
        corrected_category: correctedCategory !== result.category ? correctedCategory : undefined,
        corrected_priority: correctedPriority !== result.priority ? correctedPriority : undefined,
        corrected_team: correctedTeam !== result.team ? correctedTeam : undefined,
        note: note || undefined,
      });
      setDone(updated);
      setFeedbackOpen(false);
      onUpdated?.(updated);
    } finally {
      setSubmitting(false);
    }
  }

  const wasCorrected = done && (done.corrected_category || done.corrected_priority || done.corrected_team);

  return (
    <Card className="fade-up p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill>{result.category}</CategoryPill>
          <PriorityBadge priority={result.priority} escalated={result.escalated} />
          <ToneBadge tone={result.tone} />
        </div>
        <div className="flex items-center gap-2">
          <ModePill mode={result.mode} />
          <span className="text-xs text-ink/40 dark:text-ink-dark/40">{result.latency_ms}ms</span>
        </div>
      </div>

      <p className="my-4 text-sm leading-relaxed text-ink/80 dark:text-ink-dark/80">"{result.message}"</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Assigned team">
          <span className="text-sm font-semibold">{result.team}</span>
        </Field>
        <Field label="Confidence">
          <ConfidenceMeter value={result.confidence} ambiguous={result.is_ambiguous} />
        </Field>
        <Field label="Model">
          <span className="text-sm">{result.model_used}</span>
        </Field>
        <Field label="Escalated?">
          <span className="text-sm">{result.escalated ? "Yes, tone-triggered" : "No"}</span>
        </Field>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-sm">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-brand dark:text-brand-dim" />
        <span className="text-ink/80 dark:text-ink-dark/80">{result.reasoning}</span>
      </div>

      {result.baseline && (
        <div className="mt-4 rounded-xl border border-dashed border-black/10 dark:border-white/15 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
            vs. keyword-only baseline
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CategoryPill>{result.baseline.category}</CategoryPill>
            <PriorityBadge priority={result.baseline.priority} />
            <span className="text-ink/60 dark:text-ink-dark/60">→ {result.baseline.team}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink/50 dark:text-ink-dark/50">{result.baseline.reasoning}</p>
          {(result.baseline.category !== result.category || result.baseline.priority !== result.priority) && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              ⚠ Disagrees with Claude's classification — a common failure mode for keyword matching (sarcasm, negation, multi-issue tickets).
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
        {done ? (
          <div className="flex items-center gap-2 text-sm">
            {wasCorrected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-400">
                <MessageSquareWarning size={14} /> Corrected by reviewer
                {done.corrected_category && <> — category → {done.corrected_category}</>}
                {done.corrected_priority && <> — priority → {done.corrected_priority}</>}
                {done.corrected_team && <> — team → {done.corrected_team}</>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
                <Check size={14} /> Confirmed correct by reviewer
              </span>
            )}
          </div>
        ) : feedbackOpen ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs">
                Category
                <select
                  value={correctedCategory}
                  onChange={(e) => setCorrectedCategory(e.target.value as typeof correctedCategory)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Priority
                <select
                  value={correctedPriority}
                  onChange={(e) => setCorrectedPriority(e.target.value as typeof correctedPriority)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Team
                <select
                  value={correctedTeam}
                  onChange={(e) => setCorrectedTeam(e.target.value as typeof correctedTeam)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm"
                >
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for why you corrected this..."
              className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={submitCorrection} disabled={submitting}>Save correction</Button>
              <Button variant="ghost" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/50 dark:text-ink-dark/50 mr-1">Did the AI get this right?</span>
            <Button variant="ghost" className="!py-1.5 !px-3" onClick={submitAgree} disabled={submitting}>
              <Check size={14} /> Looks right
            </Button>
            <Button variant="ghost" className="!py-1.5 !px-3" onClick={() => setFeedbackOpen(true)}>
              <X size={14} /> Needs correction
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
