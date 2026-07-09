import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api";
import type { TicketResult } from "../types";
import { Card, ConfidenceMeter, ModePill, PriorityBadge, ToneBadge } from "./primitives";
import { ResultCard } from "./ResultCard";

export function HistoryTab() {
  const [tickets, setTickets] = useState<TicketResult[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<TicketResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.tickets(100, 0);
      setTickets(r.tickets);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">History ({total})</h2>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {tickets.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">
            Nothing routed yet. Try the "Route a Ticket" tab.
          </p>
        ) : (
          <div className="thin-scroll mt-4 max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === t.id
                    ? "border-brand/50 bg-brand/5"
                    : "border-black/8 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                }`}
              >
                <p className="line-clamp-1 text-sm text-ink/80 dark:text-ink-dark/80">{t.message}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={t.priority} escalated={t.escalated} />
                  <ToneBadge tone={t.tone} />
                  <span className="text-xs text-ink/50 dark:text-ink-dark/50">{t.category} → {t.team}</span>
                  <ModePill mode={t.mode} />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <ConfidenceMeter value={t.confidence} ambiguous={t.is_ambiguous} />
                  <span className="text-[11px] text-ink/40 dark:text-ink-dark/40">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div>
        {selected ? (
          <ResultCard result={selected} onUpdated={setSelected} />
        ) : (
          <Card className="flex h-full min-h-[280px] items-center justify-center p-8 text-center text-sm text-ink/50 dark:text-ink-dark/50">
            Select a ticket on the left to see full detail and leave feedback.
          </Card>
        )}
      </div>
    </div>
  );
}
