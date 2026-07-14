import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { api } from "../../api";
import { CATEGORIES, PRIORITIES, TEAMS } from "../../constants";
import { Button, Card, CategoryPill, ConfidenceMeter, ModePill, PriorityBadge, ToneBadge } from "../../components/primitives";

function Select({ label, value, onChange, options }) {
  return (
    <label className="block text-xs text-ink/60 dark:text-ink-dark/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm text-ink dark:text-ink-dark"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function NewTicketsQueuePage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState(null);
  const [routed, setRouted] = useState({});
  const [edits, setEdits] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkRouting, setBulkRouting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.adminNewTickets();
      setTickets(r.tickets);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function routeTicket(id) {
    setRouting(id);
    try {
      const result = await api.adminRouteTicket(id);
      setRouted((prev) => ({ ...prev, [id]: result }));
      setEdits((prev) => ({ ...prev, [id]: { category: result.category, priority: result.priority, team: result.team } }));
    } finally {
      setRouting(null);
    }
  }

  function setEdit(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function confirm(id) {
    setAssigning(id);
    try {
      const { category, priority, team } = edits[id];
      const result = await api.adminAssignTicket(id, category, priority, team);
      setAssigned((prev) => ({ ...prev, [id]: result }));
    } finally {
      setAssigning(null);
    }
  }

  // Only tickets not already mid-review (single-ticket flow) are eligible
  // for bulk selection — once someone's looking at one individually, it's
  // no longer part of the "just route them all" fast path.
  const selectableIds = tickets.filter((t) => !routed[t.id]).map((t) => t.id);
  const allSelected = selectableIds.length > 0 && selected.size === selectableIds.length;

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  async function routeBulk() {
    setBulkRouting(true);
    try {
      await api.adminRouteBulk([...selected]);
      await load();
    } finally {
      setBulkRouting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">New tickets ({tickets.length})</h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">
            Submitted by customers, not yet routed. Route one, then approve the AI's pick as-is or change it before assigning.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {tickets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">The queue is empty — nothing waiting to be routed.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-black/8 dark:border-white/10 px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-ink/60 dark:text-ink-dark/60">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-current" />
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </label>
            <Button className="!py-1.5 !px-3" onClick={routeBulk} disabled={selected.size === 0 || bulkRouting}>
              {bulkRouting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {bulkRouting ? "Routing..." : `Route ${selected.size || ""} selected`}
            </Button>
          </div>

          <div className="thin-scroll mt-3 max-h-[700px] space-y-3 overflow-y-auto pr-1">
          {tickets.map((t) => {
            const result = routed[t.id];
            const edit = edits[t.id];
            const done = assigned[t.id];
            const changed = result && edit && (edit.category !== result.category || edit.priority !== result.priority || edit.team !== result.team);

            return (
              <div key={t.id} className="rounded-xl border border-black/8 dark:border-white/10 p-4">
                <div className="flex items-start gap-3">
                  {!result && (
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelected(t.id)}
                      className="mt-0.5 accent-current"
                      aria-label="Select ticket for bulk routing"
                    />
                  )}
                  <p className="flex-1 text-sm text-ink/80 dark:text-ink-dark/80">"{t.message}"</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-ink/40 dark:text-ink-dark/40">
                    submitted by {t.user_name ?? t.user_id} · {new Date(t.created_at).toLocaleString()}
                  </span>
                  {!result && (
                    <Button className="!py-1.5 !px-3" onClick={() => routeTicket(t.id)} disabled={routing === t.id}>
                      {routing === t.id ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {routing === t.id ? "Routing..." : "Route"}
                    </Button>
                  )}
                </div>

                {result && (
                  <div className="fade-up mt-3 space-y-3 border-t border-black/5 dark:border-white/10 pt-3">
                    {/* AI's own read, unedited — for comparison against whatever the admin picks below */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                      <Field label="Category"><CategoryPill>{result.category}</CategoryPill></Field>
                      <Field label="Priority"><PriorityBadge priority={result.priority} escalated={result.escalated} /></Field>
                      <Field label="Team"><span className="text-sm font-semibold text-ink dark:text-ink-dark">{result.team}</span></Field>
                      <Field label="Tone"><ToneBadge tone={result.tone} /></Field>
                      <Field label="Confidence"><ConfidenceMeter value={result.confidence} ambiguous={result.is_ambiguous} /></Field>
                    </div>
                    <div className="flex items-center gap-2">
                      <ModePill mode={result.mode} model={result.model_used} />
                    </div>
                    <div className="flex items-start gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-sm">
                      <Sparkles size={16} className="mt-0.5 shrink-0 text-brand dark:text-brand-dim" />
                      <span className="text-ink/80 dark:text-ink-dark/80">{result.reasoning}</span>
                    </div>

                    {result.baseline && (
                      <div className="rounded-xl border border-dashed border-black/10 dark:border-white/15 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
                          vs. keyword-only baseline
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <CategoryPill>{result.baseline.category}</CategoryPill>
                          <PriorityBadge priority={result.baseline.priority} />
                          <span className="text-ink/60 dark:text-ink-dark/60">→ {result.baseline.team}</span>
                        </div>
                      </div>
                    )}

                    {result.model_results && result.model_results.length > 1 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
                          Model comparison
                        </div>
                        {result.model_results.map((m) => (
                          <div key={m.provider} className="rounded-xl border border-black/10 dark:border-white/15 p-2.5 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-ink-dark/50">{m.provider}</span>
                              <CategoryPill>{m.category}</CategoryPill>
                              <PriorityBadge priority={m.priority} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Editable — pre-filled with the AI's pick. Approve by leaving as-is, or change before assigning. */}
                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand dark:text-brand-dim">
                        {done ? "Assigned" : "Approve or change before assigning"}
                      </div>
                      {done ? (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                          <Field label="Category"><CategoryPill>{done.category}</CategoryPill></Field>
                          <Field label="Priority"><PriorityBadge priority={done.priority} escalated={done.escalated} /></Field>
                          <Field label="Team"><span className="text-sm font-semibold text-ink dark:text-ink-dark">{done.team}</span></Field>
                          <Field label="Tone"><ToneBadge tone={done.tone} /></Field>
                          <Field label="Confidence"><ConfidenceMeter value={done.confidence} ambiguous={done.is_ambiguous} /></Field>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Select label="Category" value={edit.category} onChange={(v) => setEdit(t.id, "category", v)} options={CATEGORIES} />
                            <Select label="Priority" value={edit.priority} onChange={(v) => setEdit(t.id, "priority", v)} options={PRIORITIES} />
                            <Select label="Team" value={edit.team} onChange={(v) => setEdit(t.id, "team", v)} options={TEAMS} />
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button className="!py-1.5 !px-3" onClick={() => confirm(t.id)} disabled={assigning === t.id}>
                              {assigning === t.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              {changed ? "Save changes & assign" : "Approve & assign"}
                            </Button>
                            {changed && <span className="text-xs text-amber-600 dark:text-amber-400">Overriding the AI's pick</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
    </Card>
  );
}
