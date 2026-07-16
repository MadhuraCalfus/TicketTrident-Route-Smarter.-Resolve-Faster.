import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { api } from "../../api";
import { Card } from "../../components/primitives";

export function MyResolvedIssuesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.mySelfResolved();
      setCases(r.cases);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      {cases.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand dark:text-brand-dim">
            <Sparkles size={18} />
          </span>
          <div>
            <div className="font-display text-2xl font-bold text-brand dark:text-brand-dim">{cases.length}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-ink-dark/50">
              {cases.length === 1 ? "issue" : "issues"} resolved by AI — no ticket needed
            </div>
          </div>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Resolved by AI ({cases.length})</h2>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">
          Every time AI's suggested steps solved it for you before a ticket was ever needed.
        </p>

        {cases.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">
            Nothing here yet — when AI's suggestion solves an issue for you, it'll show up in this list.
          </p>
        ) : (
          <div className="thin-scroll mt-4 max-h-[600px] space-y-3 overflow-y-auto pr-1">
            {cases.map((c) => (
              <div key={c.id} className="fade-up rounded-xl border border-black/8 dark:border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink/80 dark:text-ink-dark/80">"{c.message}"</p>
                  <span className="shrink-0 text-[11px] text-ink/40 dark:text-ink-dark/40">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                {c.summary && <p className="mt-2.5 text-sm font-medium text-ink dark:text-ink-dark">{c.summary}</p>}
                {c.steps?.length > 0 && (
                  <ol className="mt-2.5 space-y-1.5">
                    {c.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-ink/70 dark:text-ink-dark/70">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand dark:text-brand-dim">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
