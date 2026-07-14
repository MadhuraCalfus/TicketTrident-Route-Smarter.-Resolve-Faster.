import { useState } from "react";
import { Inbox, Loader2, Send, UserCheck, Wand2 } from "lucide-react";
import { api } from "../../api";
import { Button, Card } from "../../components/primitives";

const STEPS = [
  { icon: Send, title: "You submit", body: "Your message is saved instantly, exactly as you wrote it." },
  { icon: Inbox, title: "It's queued", body: "It waits in the support team's queue, ready for review." },
  { icon: Wand2, title: "It's routed", body: "An admin routes it to the right team with a priority." },
  { icon: UserCheck, title: "It's worked", body: "That team picks it up and resolves it — check status anytime." },
];

export function NewTicketPage({ onSubmitted }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  async function submit() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const ticket = await api.createTicket(message);
      setSubmitted(ticket);
      setMessage("");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Submit a ticket</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-ink-dark/60">
          Describe your issue and our support team will take a look. You can track its status under "My Tickets."
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="What's going on? Be as specific as you can..."
          rows={6}
          className="mt-5 w-full resize-none rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-sm outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-5 flex items-center gap-3 border-t border-black/5 dark:border-white/10 pt-4">
          <Button onClick={submit} disabled={loading || !message.trim()}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? "Submitting..." : "Submit ticket"}
          </Button>
          <span className="text-xs text-ink/40 dark:text-ink-dark/40">⌘/Ctrl + Enter</span>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </Card>

      <div>
        {submitted ? (
          <Card className="fade-up p-5">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Ticket submitted</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/70 dark:text-ink-dark/70">"{submitted.message}"</p>
            <p className="mt-3 text-xs text-ink/50 dark:text-ink-dark/50">
              Our team will review and route it shortly. Check "My Tickets" for updates.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-ink dark:text-ink-dark">What happens after you submit</h3>
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
        )}
      </div>
    </div>
  );
}
