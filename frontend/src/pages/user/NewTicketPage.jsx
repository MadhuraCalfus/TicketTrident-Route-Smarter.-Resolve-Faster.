import { useState } from "react";
import { CheckCircle2, Inbox, Loader2, Send, Sparkles, UserCheck, Wand2 } from "lucide-react";
import { api } from "../../api";
import { Button, Card } from "../../components/primitives";

const STEPS = [
  { icon: Sparkles, title: "AI tries to help first", body: "We'll suggest steps to try yourself, right away — no waiting." },
  { icon: Send, title: "Still stuck? Raise a ticket", body: "One click sends it to our support team instead." },
  { icon: Inbox, title: "It's queued", body: "It waits in the support team's queue, ready for review." },
  { icon: Wand2, title: "It's routed", body: "An admin routes it to the right team with a priority." },
  { icon: UserCheck, title: "It's worked", body: "That team picks it up and resolves it — check status anytime." },
];

export function NewTicketPage({ onSubmitted }) {
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState("describe"); // describe | thinking | suggestion | resolved | submitted
  const [suggestion, setSuggestion] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function getHelp() {
    if (!message.trim() || stage === "thinking") return;
    setStage("thinking");
    setError(null);
    try {
      const s = await api.suggestResolution(message);
      setSuggestion(s);
      setStage("suggestion");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("describe");
    }
  }

  async function raiseTicket() {
    setSubmitting(true);
    setError(null);
    try {
      await api.createTicket(message);
      setStage("submitted");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setStage("describe");
    setMessage("");
    setSuggestion(null);
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        {stage === "describe" || stage === "thinking" ? (
          <>
            <h2 className="font-display text-lg font-semibold">What's going on?</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-ink-dark/60">
              Describe your issue and AI will suggest a few things to try first. Still stuck afterward? One click sends it to our team.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") getHelp();
              }}
              placeholder="What's going on? Be as specific as you can..."
              rows={6}
              disabled={stage === "thinking"}
              className="mt-5 w-full resize-none rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-sm outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            />

            <div className="mt-5 flex items-center gap-3 border-t border-black/5 dark:border-white/10 pt-4">
              <Button onClick={getHelp} disabled={stage === "thinking" || !message.trim()}>
                {stage === "thinking" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {stage === "thinking" ? "Thinking..." : "Get help"}
              </Button>
              <span className="text-xs text-ink/40 dark:text-ink-dark/40">⌘/Ctrl + Enter</span>
            </div>

            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </>
        ) : stage === "suggestion" ? (
          <>
            <h2 className="font-display text-lg font-semibold">Here's what AI suggests</h2>
            <div className="mt-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-sm text-ink/80 dark:text-ink-dark/80">"{message}"</div>

            {suggestion.available && suggestion.steps.length > 0 ? (
              <>
                <p className="mt-4 text-sm font-medium text-ink dark:text-ink-dark">{suggestion.summary}</p>
                <ol className="mt-3 space-y-2.5">
                  {suggestion.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-ink/80 dark:text-ink-dark/80">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand dark:text-brand-dim">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/5 dark:border-white/10 pt-4">
                  <Button onClick={() => setStage("resolved")}>
                    <CheckCircle2 size={16} /> That solved it
                  </Button>
                  <Button variant="ghost" onClick={raiseTicket} disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? "Submitting..." : "Still not solved — raise a ticket"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-ink/70 dark:text-ink-dark/70">
                  {suggestion.available
                    ? suggestion.summary
                    : "Automatic suggestions aren't available right now."}{" "}
                  {suggestion.available && !suggestion.can_likely_self_resolve
                    ? "This looks like something our team should handle directly."
                    : ""}
                </p>
                <div className="mt-5 border-t border-black/5 dark:border-white/10 pt-4">
                  <Button onClick={raiseTicket} disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? "Submitting..." : "Raise a ticket"}
                  </Button>
                </div>
              </>
            )}

            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </>
        ) : stage === "resolved" ? (
          <>
            <h2 className="font-display text-lg font-semibold">Glad that helped!</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-ink-dark/60">
              No ticket was needed. If something else comes up, come back any time.
            </p>
            <Button className="mt-5" variant="ghost" onClick={startOver}>
              Ask about something else
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold">Ticket submitted</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-ink-dark/60">
              Our team will review and route it shortly. Check "My Tickets" for updates.
            </p>
            <Button className="mt-5" variant="ghost" onClick={startOver}>
              Submit another ticket
            </Button>
          </>
        )}
      </Card>

      <div>
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-ink dark:text-ink-dark">What happens after you describe an issue</h3>
          <div className="mt-4 space-y-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand dark:text-brand-dim">
                    <Icon size={15} />
                  </span>
                  {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-black/8 dark:bg-white/10" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-ink dark:text-ink-dark">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink/55 dark:text-ink-dark/55">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
