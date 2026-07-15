import { useEffect, useState } from "react";
import { ArrowDownUp, MessageCircle, RefreshCw, Search } from "lucide-react";
import { api } from "../../api";
import { filterTickets } from "../../filterTickets";
import { sortTickets } from "../../sortTickets";
import { Card, ConfidenceMeter, Modal, PriorityBadge, ToneBadge } from "../../components/primitives";
import { CommentThread } from "../../components/CommentThread";

const STATUS_ORDER = ["Routed", "In Progress", "Resolved"];

// From the team's point of view, a ticket that was just routed to them is
// "New" — the admin-facing distinction between "New" (unrouted) and
// "Routed" (assigned, not started) doesn't matter here, since this table
// only ever shows tickets that have already been routed to this team.
const TEAM_STATUS_LABELS = { Routed: "New", "In Progress": "In Progress", Resolved: "Resolved" };

// Status only moves forward — a ticket already In Progress or Resolved
// can't be sent back to an earlier stage. Mirrors the backend's own check
// in main.py, which rejects a backward move even if this were bypassed.
const ALLOWED_NEXT_STATUSES = {
  Routed: ["Routed", "In Progress", "Resolved"],
  "In Progress": ["In Progress", "Resolved"],
  Resolved: ["Resolved"],
};

const STATUS_SELECT_STYLES = {
  Routed: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function TeamTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [search, setSearch] = useState("");
  const [activeThread, setActiveThread] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.teamTickets();
      setTickets(r.tickets);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id, status) {
    setUpdating(id);
    try {
      await api.teamUpdateStatus(id, status);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  const openCount = tickets.filter((t) => t.status !== "Resolved").length;
  const sorted = sortTickets(filterTickets(tickets, search), sortBy, STATUS_ORDER);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Your team's tickets ({openCount} open)</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/15 px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50">
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, or message..."
              className="w-44 bg-transparent text-xs text-ink dark:text-ink-dark placeholder:text-ink/40 dark:placeholder:text-ink-dark/40 outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink/50 dark:text-ink-dark/50">
            <ArrowDownUp size={13} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs text-ink dark:text-ink-dark"
            >
              <option value="date">Date (newest first)</option>
              <option value="priority">Priority (High first)</option>
              <option value="status">Status (New → In Progress → Resolved)</option>
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

      {tickets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">Nothing assigned to your team yet.</p>
      ) : sorted.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">No tickets match "{search}".</p>
      ) : (
        <div className="thin-scroll mt-4 max-h-[650px] overflow-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-black/[0.03] dark:bg-white/[0.05] text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Ticket ID</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Tone</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Chat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {sorted.map((t) => (
                <tr key={t.id} className="align-top">
                  <td className="max-w-[140px] px-3 py-2.5">
                    <div className="font-medium text-ink dark:text-ink-dark">{t.user_name ?? "—"}</div>
                    <div className="text-[11px] text-ink/40 dark:text-ink-dark/40">{t.user_email ?? t.user_id}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink/50 dark:text-ink-dark/50">
                    #{t.id}
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">{t.message}</td>
                  <td className="px-3 py-2.5"><PriorityBadge priority={t.priority} escalated={t.escalated} /></td>
                  <td className="px-3 py-2.5"><ToneBadge tone={t.tone} /></td>
                  <td className="px-3 py-2.5"><ConfidenceMeter value={t.confidence} ambiguous={t.is_ambiguous} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-ink/40 dark:text-ink-dark/40">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={t.status}
                      disabled={updating === t.id || t.status === "Resolved"}
                      onChange={(e) => updateStatus(t.id, e.target.value)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-80 ${STATUS_SELECT_STYLES[t.status] ?? STATUS_SELECT_STYLES.Routed}`}
                    >
                      {(ALLOWED_NEXT_STATUSES[t.status] ?? ["Resolved"]).map((value) => (
                        <option key={value} value={value} className="bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark">
                          {TEAM_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setActiveThread(t.id)}
                      disabled={t.status !== "In Progress"}
                      aria-label={`Message customer for ticket ${t.id}`}
                      title={
                        t.status === "In Progress"
                          ? undefined
                          : t.status === "Resolved"
                            ? "This ticket is resolved — messaging is closed."
                            : "Move this ticket to In Progress to start messaging the customer."
                      }
                      className="relative grid h-7 w-7 place-items-center rounded-lg text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <MessageCircle size={15} />
                      {t.unread_comments > 0 && (
                        <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                          {t.unread_comments}
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeThread && (
        <Modal
          title={`Ticket #${activeThread} — Messages`}
          onClose={() => {
            setActiveThread(null);
            load();
          }}
        >
          <CommentThread ticketId={activeThread} />
        </Modal>
      )}
    </Card>
  );
}
