import clsx from "clsx";
import { AlertTriangle, Frown, HelpCircle, Meh, Smile, Zap as ZapIcon } from "lucide-react";

export function Card({ className, children }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm shadow-black/[0.03] dark:shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

const PRIORITY_STYLES = {
  High: "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/30",
  Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30",
  Low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30",
};

export function PriorityBadge({ priority, escalated }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority === "High" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 pulse-ring" />}
      {priority}
      {escalated && <span title="Priority escalated due to detected tone">↑</span>}
    </span>
  );
}

const TONE_STYLES = {
  neutral: { icon: Meh, className: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  frustrated: { icon: Frown, className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  angry: { icon: AlertTriangle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  urgent: { icon: ZapIcon, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  confused: { icon: HelpCircle, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  positive: { icon: Smile, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

export function ToneBadge({ tone }) {
  const s = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  const Icon = s.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize", s.className)}>
      <Icon size={12} />
      {tone}
    </span>
  );
}

export function CategoryPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:text-brand-dim">
      {children}
    </span>
  );
}

export function ConfidenceMeter({ value, ambiguous }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-ink/70 dark:text-ink-dark/70">{pct}%</span>
      {ambiguous && (
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          ambiguous
        </span>
      )}
    </div>
  );
}

export function ModePill({ mode }) {
  const label = {
    live: "Claude (live)",
    mock: "Keyword baseline",
    repaired: "Claude (self-repaired JSON)",
    fallback: "Fallback baseline",
  };
  const style = {
    live: "bg-brand/10 text-brand dark:text-brand-dim",
    mock: "bg-slate-500/10 text-slate-500 dark:text-slate-300",
    repaired: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    fallback: "bg-red-500/10 text-red-500",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", style[mode] ?? style.mock)}>
      {label[mode] ?? mode}
    </span>
  );
}

export function Button({ children, className, variant = "primary", ...rest }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand text-white hover:bg-indigo-600 active:scale-[0.98] shadow-sm shadow-brand/30",
    ghost: "bg-black/5 dark:bg-white/10 text-ink dark:text-ink-dark hover:bg-black/10 dark:hover:bg-white/15",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
  };
  return (
    <button className={clsx(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}
