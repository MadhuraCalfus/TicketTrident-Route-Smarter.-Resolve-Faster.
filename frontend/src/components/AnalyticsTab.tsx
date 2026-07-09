import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { api } from "../api";
import type { AnalyticsData } from "../types";
import { Card } from "./primitives";

const PRIORITY_COLORS: Record<string, string> = { High: "#e0524c", Medium: "#d99a2b", Low: "#2fa66a" };
const PALETTE = ["#5b4dff", "#7a70ff", "#e0524c", "#d99a2b", "#2fa66a", "#3b82f6", "#ec4899", "#14b8a6"];

function toChartData(breakdown: Record<string, number>) {
  return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api.analytics());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <Card className="p-8 text-center text-sm text-ink/50 dark:text-ink-dark/50">Loading analytics...</Card>
    );
  }

  if (data.total_tickets === 0) {
    return (
      <Card className="p-8 text-center text-sm text-ink/50 dark:text-ink-dark/50">
        No tickets routed yet — try the "Route a Ticket" or "Demo" tab first, then come back here.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Analytics</h2>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tickets routed" value={String(data.total_tickets)} />
        <StatCard label="Avg. AI time" value={`${data.avg_ai_latency_ms.toFixed(0)}ms`} sub="per ticket" />
        <StatCard label="Avg. manual time" value={`${data.avg_manual_seconds.toFixed(0)}s`} sub={data.measured_manual_count > 0 ? `${data.measured_manual_count} measured` : "assumed baseline"} />
        <StatCard label="Time saved" value={`${data.time_saved_pct.toFixed(0)}%`} sub={`~${Math.round(data.total_time_saved_seconds / 60)} min total`} highlight />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Priority breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={toChartData(data.priority_breakdown)}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {toChartData(data.priority_breakdown).map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#5b4dff"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Category breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toChartData(data.category_breakdown)} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {toChartData(data.category_breakdown).map((entry, i) => (
                  <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Team assignment</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toChartData(data.team_breakdown)} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#5b4dff" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Customer tone detected</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toChartData(data.tone_breakdown)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#7a70ff" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Flagged ambiguous" value={String(data.ambiguous_count)} sub="auto-flagged low confidence" />
        <StatCard label="Priority escalated" value={String(data.escalated_count)} sub="due to angry/urgent tone" />
        <StatCard label="Reviewed by human" value={String(data.feedback_count)} />
        <StatCard
          label="Agreement rate"
          value={data.agreement_rate === null ? "—" : `${data.agreement_rate.toFixed(0)}%`}
          sub={data.agreement_rate === null ? "no feedback yet" : "of reviewed tickets"}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 text-center ${highlight ? "ring-2 ring-brand/40" : ""}`}>
      <div className={`font-display text-2xl font-bold ${highlight ? "text-brand dark:text-brand-dim" : ""}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink/40 dark:text-ink-dark/40">{sub}</div>}
    </Card>
  );
}
