import { useEffect, useState } from "react";
import { Loader2, Shuffle, Wand2 } from "lucide-react";
import { api } from "../api";
import { Button, Card } from "./primitives";
import { ResultCard } from "./ResultCard";

export function RouteTicketTab() {
  const [message, setMessage] = useState("");
  const [compare, setCompare] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    api.sampleTickets().then((r) => setSamples(r.tickets)).catch(() => {});
  }, []);

  async function submit() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.route(message, { compare });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function loadRandomSample() {
    if (samples.length === 0) return;
    const s = samples[Math.floor(Math.random() * samples.length)];
    setMessage(s.text);
    setResult(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Route a ticket</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-ink-dark/60">
          Paste any support message. 
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder='Try: "I was charged twice this month and support has ignored me for a week!!"'
          rows={6}
          className="mt-5 w-full resize-none rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-sm outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-ink/60 dark:text-ink-dark/60">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-current" />
            Compare against keyword baseline &amp; other configured models
          </label>
          <button
            onClick={loadRandomSample}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand dark:text-brand-dim hover:underline"
          >
            <Shuffle size={13} /> Load a sample ticket
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-black/5 dark:border-white/10 pt-4">
          <Button onClick={submit} disabled={loading || !message.trim()}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Routing..." : "Route with AI"}
          </Button>
          <span className="text-xs text-ink/40 dark:text-ink-dark/40">⌘/Ctrl + Enter</span>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </Card>

      <div>
        {result ? (
          <ResultCard result={result} onUpdated={setResult} />
        ) : (
          <Card className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <Wand2 size={28} className="mb-3 text-ink/20 dark:text-ink-dark/20" />
            <p className="text-sm text-ink/50 dark:text-ink-dark/50">
              Results will show up here — category, priority, team, tone, confidence, and the model's reasoning.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
