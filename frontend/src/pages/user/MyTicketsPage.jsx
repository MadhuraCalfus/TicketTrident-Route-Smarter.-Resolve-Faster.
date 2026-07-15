import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { Card, CategoryPill, Modal, PriorityBadge, StatusStepper } from "../../components/primitives";
import { CommentThread } from "../../components/CommentThread";

// Plain-language stage names for the customer — "Routed" is internal
// jargon, so it reads as "Assigned" here instead.
const CUSTOMER_STATUS_LABELS = ["In queue", "Assigned", "In Progress", "Resolved"];
const CUSTOMER_STATUS_TEXT = { New: "In queue", Routed: "Assigned", "In Progress": "In Progress", Resolved: "Resolved" };
const CUSTOMER_STATUS_STYLES = {
  New: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  Routed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${highlight ? "border-brand/30 bg-brand/5" : "border-black/10 dark:border-white/15"}`}>
      <div className={`font-display text-2xl font-bold ${highlight ? "text-brand dark:text-brand-dim" : "text-ink dark:text-ink-dark"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
    </div>
  );
}

export function MyTicketsPage({ reloadKey }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeThread, setActiveThread] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.myTickets();
      setTickets(r.tickets);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  const resolved = tickets.filter((t) => t.status === "Resolved").length;
  const open = tickets.length - resolved;

  return (
    <div className="space-y-4">
      {tickets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={tickets.length} />
          <StatCard label="Open" value={open} highlight={open > 0} />
          <StatCard label="Resolved" value={resolved} />
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">My tickets ({tickets.length})</h2>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {tickets.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">
            You haven't submitted any tickets yet.
          </p>
        ) : (
          <div className="thin-scroll mt-4 max-h-[600px] space-y-3 overflow-y-auto pr-1">
            {tickets.map((t) => (
              <div key={t.id} className="fade-up rounded-xl border border-black/8 dark:border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <StatusStepper status={t.status} labels={CUSTOMER_STATUS_LABELS} />
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CUSTOMER_STATUS_STYLES[t.status] ?? CUSTOMER_STATUS_STYLES.New}`}>
                      {CUSTOMER_STATUS_TEXT[t.status] ?? t.status}
                    </span>
                    <span className="text-[11px] text-ink/40 dark:text-ink-dark/40">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink/80 dark:text-ink-dark/80">{t.message}</p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.category ? (
                      <>
                        <CategoryPill>{t.category}</CategoryPill>
                        <PriorityBadge priority={t.priority} escalated={t.escalated} />
                      </>
                    ) : (
                      <span className="text-xs italic text-ink/40 dark:text-ink-dark/40">Waiting to be reviewed by our team</span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveThread(t.id)}
                    disabled={t.status !== "In Progress"}
                    title={
                      t.status === "In Progress"
                        ? undefined
                        : t.status === "Resolved"
                          ? "This ticket is resolved — messaging is closed."
                          : "Messaging opens once a team starts working this ticket."
                    }
                    className="relative inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/60 dark:text-ink-dark/60 hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <MessageCircle size={13} /> Message team
                    {t.unread_comments > 0 && (
                      <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                        {t.unread_comments}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
    </div>
  );
}
