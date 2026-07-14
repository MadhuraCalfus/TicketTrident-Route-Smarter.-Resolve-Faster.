import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { api } from "../api";
import { Button, Card, ConfidenceMeter, ModePill, PriorityBadge, ToneBadge } from "./primitives";

export function DemoTab() {
  const [samples, setSamples] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  async function load() {
    const r = await api.sampleTickets();
    setSamples(r.tickets);
    setLoaded(true);
  }

  async function runAll() {
    setRunning(true);
    setResults([]);
    const start = performance.now();
    try {
      const r = await api.runDemo(samples.map((s) => s.text));
      setResults(r.results);
      setElapsedMs(performance.now() - start);
    } finally {
      setRunning(false);
    }
  }

  const manualEstimateSeconds = samples.length * 90;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Demo: 20 sample tickets</h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">
            One click to route the full mission sample set — includes angry-tone, one-word, and
            multi-issue ambiguous tickets end to end.
          </p>
        </div>
        {!loaded ? (
          <Button onClick={load}>Load sample tickets</Button>
        ) : (
          <Button onClick={runAll} disabled={running}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
            {running ? "Routing all 20..." : `Run all ${samples.length} tickets`}
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tickets routed" value={String(results.length)} />
          <Stat label="AI total time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
          <Stat label="Assumed manual time" value={`~${(manualEstimateSeconds / 60).toFixed(0)} min`} />
          <Stat
            label="Flagged ambiguous"
            value={String(results.filter((r) => r.is_ambiguous).length)}
          />
        </div>
      )}

      {results.length > 0 && (
        <div className="thin-scroll mt-5 max-h-[520px] overflow-y-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-black/[0.03] dark:bg-white/[0.05] text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
              <tr>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Tone</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {results.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="max-w-xs px-3 py-2.5 text-ink/80 dark:text-ink-dark/80">{r.message}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.category}</td>
                  <td className="px-3 py-2.5"><PriorityBadge priority={r.priority} escalated={r.escalated} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.team}</td>
                  <td className="px-3 py-2.5"><ToneBadge tone={r.tone} /></td>
                  <td className="px-3 py-2.5"><ConfidenceMeter value={r.confidence} ambiguous={r.is_ambiguous} /></td>
                  <td className="px-3 py-2.5"><ModePill mode={r.mode} model={r.model_used} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 p-3 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">{label}</div>
    </div>
  );
}
