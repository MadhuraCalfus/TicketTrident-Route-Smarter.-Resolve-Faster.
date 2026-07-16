import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, RefreshCw, Search, Sparkles } from "lucide-react";
import { api } from "../../api";
import { Card } from "../../components/primitives";

export function AiResolvedPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  async function load() {
    setLoading(true);
    try {
      const r = await api.adminSelfResolved();
      setCases(r.cases);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? cases
      : cases.filter(
          (c) =>
            String(c.user_name ?? "").toLowerCase().includes(q) ||
            String(c.user_email ?? "").toLowerCase().includes(q) ||
            String(c.message ?? "").toLowerCase().includes(q) ||
            String(c.summary ?? "").toLowerCase().includes(q),
        );
    const sorted = [...matched].sort((a, b) =>
      sortBy === "oldest"
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at),
    );
    return sorted;
  }, [cases, search, sortBy]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Resolved by AI, no ticket raised</h2>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">
        The customer described an issue, AI suggested steps to try, and they confirmed it worked —
        this never became a ticket and never touched a team's queue.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand/10 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand dark:text-brand-dim">
          <Sparkles size={18} />
        </span>
        <div>
          <div className="font-display text-2xl font-bold text-brand dark:text-brand-dim">{cases.length}</div>
          <div className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-ink-dark/50">
            Total tickets solved by AI
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/15 px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50">
          <Search size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer or message..."
            className="w-56 bg-transparent text-xs text-ink dark:text-ink-dark placeholder:text-ink/40 dark:placeholder:text-ink-dark/40 outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink/50 dark:text-ink-dark/50">
          <ArrowDownUp size={13} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs text-ink dark:text-ink-dark"
          >
            <option value="newest">Date (newest first)</option>
            <option value="oldest">Date (oldest first)</option>
          </select>
        </label>
      </div>

      <div className="thin-scroll mt-3 max-h-[650px] overflow-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-black/[0.03] dark:bg-white/[0.05] text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">AI summary</th>
              <th className="px-3 py-2">Suggested steps</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {filtered.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="max-w-[140px] px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">
                  <div className="font-medium">{c.user_name ?? "—"}</div>
                  <div className="text-[11px] text-ink/40 dark:text-ink-dark/40">{c.user_email ?? ""}</div>
                </td>
                <td className="max-w-xs px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">{c.message}</td>
                <td className="max-w-xs px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">{c.summary ?? "—"}</td>
                <td className="max-w-xs px-3 py-2.5 text-ink/70 dark:text-ink-dark/70">
                  {c.steps?.length > 0 ? (
                    <ol className="list-decimal space-y-0.5 pl-4">
                      {c.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-ink/50 dark:text-ink-dark/50">
                  {new Date(c.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">
                  {search ? `No self-resolved cases match "${search}".` : "No self-resolved cases yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
