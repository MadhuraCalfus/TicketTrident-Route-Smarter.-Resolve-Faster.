import { useEffect, useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { generateTeamsPdf } from "../../reportPdf";
import { Card } from "../../components/primitives";

function Stat({ value, label, className }) {
  return (
    <div className="text-center">
      <div className={`font-display text-lg font-bold ${className}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${highlight ? "border-brand/30 bg-brand/5" : "border-black/10 dark:border-white/15"}`}>
      <div className={`font-display text-2xl font-bold ${highlight ? "text-brand dark:text-brand-dim" : "text-ink dark:text-ink-dark"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
    </div>
  );
}

export function TeamsOverviewPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.adminTeamSummary();
      setTeams(r.teams);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = teams.reduce(
    (acc, t) => ({
      total: acc.total + t.total,
      assigned: acc.assigned + t.assigned,
      in_progress: acc.in_progress + t.in_progress,
      resolved: acc.resolved + t.resolved,
    }),
    { total: 0, assigned: 0, in_progress: 0, resolved: 0 },
  );

  return (
    <div className="space-y-4">
      {teams.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total tickets" value={totals.total} highlight />
          <SummaryCard label="Assigned" value={totals.assigned} />
          <SummaryCard label="In progress" value={totals.in_progress} />
          <SummaryCard label="Resolved" value={totals.resolved} />
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Teams</h2>
            <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">Workload per team, across every ticket ever routed to them.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateTeamsPdf(teams)}
              disabled={teams.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileDown size={13} /> Export PDF
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((t) => (
            <div key={t.team} className="rounded-xl border border-black/10 dark:border-white/15 p-4">
              <div className="text-sm font-semibold text-ink dark:text-ink-dark">{t.team}</div>
              <div className="mt-0.5 text-[11px] text-ink/40 dark:text-ink-dark/40">{t.total} ticket{t.total === 1 ? "" : "s"} total</div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 dark:border-white/10 pt-3">
                <Stat value={t.assigned} label="Assigned" className="text-blue-600 dark:text-blue-400" />
                <Stat value={t.in_progress} label="In Progress" className="text-amber-600 dark:text-amber-400" />
                <Stat value={t.resolved} label="Resolved" className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
