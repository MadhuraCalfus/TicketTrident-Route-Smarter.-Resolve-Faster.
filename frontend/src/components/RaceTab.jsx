import { useEffect, useRef, useState } from "react";
import { Flag, Play, RotateCcw, Timer, Zap } from "lucide-react";
import { api } from "../api";
import { CATEGORIES, PRIORITIES, TEAMS } from "../constants";
import { Button, Card, PriorityBadge } from "./primitives";

export function RaceTab() {
  const [samples, setSamples] = useState([]);
  const [ticket, setTicket] = useState("");
  const [stage, setStage] = useState("pick");
  const [elapsed, setElapsed] = useState(0);
  const [manualTime, setManualTime] = useState(0);
  const [manualCategory, setManualCategory] = useState("General Inquiry");
  const [manualPriority, setManualPriority] = useState("Medium");
  const [manualTeam, setManualTeam] = useState("Triage");
  const [aiResult, setAiResult] = useState(null);
  const [aiClockMs, setAiClockMs] = useState(0);
  const startRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.sampleTickets().then((r) => setSamples(r.tickets)).catch(() => {});
  }, []);

  function pickTicket(text) {
    setTicket(text);
    setStage("pick");
    setAiResult(null);
    setManualTime(0);
    setElapsed(0);
  }

  function startManual() {
    setStage("manual-timing");
    startRef.current = performance.now();
    intervalRef.current = window.setInterval(() => {
      setElapsed((performance.now() - startRef.current) / 1000);
    }, 50);
  }

  function submitManual() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const t = (performance.now() - startRef.current) / 1000;
    setManualTime(t);
    setStage("manual-done");
  }

  async function runAi() {
    setStage("ai-timing");
    const clientStart = performance.now();
    try {
      const r = await api.route(ticket, { manual_time_seconds: manualTime });
      setAiClockMs(performance.now() - clientStart);
      setAiResult(r);
      setStage("result");
    } catch {
      setStage("manual-done");
    }
  }

  function reset() {
    setStage("pick");
    setTicket("");
    setAiResult(null);
    setManualTime(0);
    setElapsed(0);
  }

  const aiSeconds = aiResult ? aiResult.latency_ms / 1000 : aiClockMs / 1000;
  const speedup = manualTime > 0 && aiSeconds > 0 ? manualTime / aiSeconds : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Manual vs. AI — the actual race</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">
          No assumed numbers here. Pick a ticket, classify it yourself with a real stopwatch running,
          then let AI route the exact same ticket and compare real, measured times.
        </p>

        {stage === "pick" && (
          <div className="mt-4 space-y-3">
            <textarea
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Paste a ticket, or pick a random sample below..."
              rows={4}
              className="w-full resize-none rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-sm outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex flex-wrap gap-2">
              {samples.slice(0, 4).map((s, i) => (
                <button
                  key={i}
                  onClick={() => pickTicket(s.text)}
                  className="rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {s.tag}
                </button>
              ))}
            </div>
            <Button onClick={startManual} disabled={!ticket.trim()}>
              <Play size={15} /> Start the clock &amp; classify it yourself
            </Button>
          </div>
        )}

        {(stage === "manual-timing" || stage === "manual-done") && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-sm">"{ticket}"</div>

            <div className="flex items-center gap-2 rounded-xl bg-brand/10 px-3 py-2 font-mono text-lg text-brand dark:text-brand-dim">
              <Timer size={18} className={stage === "manual-timing" ? "animate-pulse" : ""} />
              {(stage === "manual-timing" ? elapsed : manualTime).toFixed(1)}s
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs">
                Category
                <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-xs">
                Priority
                <select value={manualPriority} onChange={(e) => setManualPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-xs">
                Team
                <select value={manualTeam} onChange={(e) => setManualTeam(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm">
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>

            {stage === "manual-timing" ? (
              <Button onClick={submitManual}>
                <Flag size={15} /> Submit my answer &amp; stop the clock
              </Button>
            ) : (
              <Button onClick={runAi}>
                <Zap size={15} /> Now route it with AI
              </Button>
            )}
          </div>
        )}

        {(stage === "ai-timing" || stage === "result") && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink/60 dark:text-ink-dark/60">
              You took <strong>{manualTime.toFixed(1)}s</strong>: {manualCategory} / {manualPriority} / {manualTeam}
            </p>
            {stage === "ai-timing" && <p className="text-sm animate-pulse">Claude is classifying the same ticket...</p>}
            {stage === "result" && (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw size={15} /> Race another ticket
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Live result</h3>
        {stage !== "result" || !aiResult ? (
          <div className="mt-6 flex h-64 items-center justify-center text-center text-sm text-ink/40 dark:text-ink-dark/40">
            Finish the race to see the comparison
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <RaceBar label="You" seconds={manualTime} maxSeconds={Math.max(manualTime, aiSeconds)} color="bg-slate-400" />
            <RaceBar label="Claude" seconds={aiSeconds} maxSeconds={Math.max(manualTime, aiSeconds)} color="bg-brand" />

            {speedup > 0 && (
              <div className="rounded-xl bg-brand/10 p-4 text-center">
                <div className="font-display text-3xl font-bold text-brand dark:text-brand-dim">{speedup.toFixed(0)}x faster</div>
                <div className="text-xs text-ink/50 dark:text-ink-dark/50">than manual triage on this ticket</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-3">
                <div className="mb-1 text-[11px] uppercase text-ink/40 dark:text-ink-dark/40">Your answer</div>
                <PriorityBadge priority={manualPriority} />
                <div className="mt-1 text-xs">{manualCategory} → {manualTeam}</div>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-3">
                <div className="mb-1 text-[11px] uppercase text-ink/40 dark:text-ink-dark/40">Claude's answer</div>
                <PriorityBadge priority={aiResult.priority} escalated={aiResult.escalated} />
                <div className="mt-1 text-xs">{aiResult.category} → {aiResult.team}</div>
              </div>
            </div>
            {(aiResult.category !== manualCategory || aiResult.priority !== manualPriority || aiResult.team !== manualTeam) && (
              <p className="text-xs text-ink/50 dark:text-ink-dark/50">
                You and Claude disagreed on this one — a good candidate to open in the Route tab and leave feedback on.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function RaceBar({ label, seconds, maxSeconds, color }) {
  const pct = maxSeconds > 0 ? Math.max(4, (seconds / maxSeconds) * 100) : 4;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink/50 dark:text-ink-dark/50">{seconds.toFixed(2)}s</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
