import { useEffect, useState } from "react";
import { ArrowDownUp, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { sortTickets } from "../../sortTickets";
import { Card, ConfidenceMeter, PriorityBadge, StatusBadge, ToneBadge } from "../../components/primitives";

const STATUS_ORDER = ["New", "Routed", "In Progress", "Resolved"];

export function AllTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("date");

  async function load() {
    setLoading(true);
    try {
      const r = await api.adminAllTickets();
      setTickets(r.tickets);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = sortTickets(tickets, sortBy, STATUS_ORDER);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">All tickets ({tickets.length})</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink/50 dark:text-ink-dark/50">
            <ArrowDownUp size={13} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs text-ink dark:text-ink-dark"
            >
              <option value="date">Date (newest first)</option>
              <option value="priority">Priority (High first)</option>
              <option value="status">Status (New → Routed → In Progress → Resolved)</option>
            </select>
          </label>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="thin-scroll mt-4 max-h-[650px] overflow-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-black/[0.03] dark:bg-white/[0.05] text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Tone</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {sorted.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="max-w-[140px] px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">
                  <div className="font-medium">{t.user_name ?? "—"}</div>
                  <div className="text-[11px] text-ink/40 dark:text-ink-dark/40">{t.user_email ?? t.user_id}</div>
                </td>
                <td className="max-w-xs px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">{t.message}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{t.category ?? "—"}</td>
                <td className="px-3 py-2.5">{t.priority ? <PriorityBadge priority={t.priority} escalated={t.escalated} /> : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{t.team ?? "—"}</td>
                <td className="px-3 py-2.5">{t.tone ? <ToneBadge tone={t.tone} /> : "—"}</td>
                <td className="px-3 py-2.5">{t.confidence != null ? <ConfidenceMeter value={t.confidence} ambiguous={t.is_ambiguous} /> : "—"}</td>
                <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-ink/50 dark:text-ink-dark/50">
                  {new Date(t.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
