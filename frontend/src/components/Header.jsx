import { BarChart3, Clock, History, Moon, Sun, Ticket, Zap } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { id: "route", label: "Route a Ticket", icon: Ticket },
  { id: "race", label: "Manual vs AI Race", icon: Clock },
  { id: "demo", label: "Demo (20 Tickets)", icon: Zap },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
];

export function Header({ tab, onTab, theme, onToggleTheme, health }) {
  return (
    <header className="border-b border-black/8 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">🎟️</span>
          <div>
            <h1 className="font-display text-base font-semibold leading-tight">TicketTrident</h1>
            <p className="text-[11px] leading-tight text-ink/50 dark:text-ink-dark/50">Route Smarter. Resolve Faster.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {health && (
            <span
              className={clsx(
                "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
                health.mode === "live"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
              title={health.reason ?? undefined}
            >
              <span className={clsx("h-1.5 w-1.5 rounded-full", health.mode === "live" ? "bg-emerald-500" : "bg-amber-500")} />
              {health.mode === "live" ? `Live · ${health.model}` : "Mock mode (keyword baseline)"}
            </span>
          )}
          <button
            onClick={onToggleTheme}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink/60 dark:text-ink-dark/60 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTab(id)}
            className={clsx(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              tab === id
                ? "border-brand text-brand dark:text-brand-dim"
                : "border-transparent text-ink/50 dark:text-ink-dark/50 hover:text-ink dark:hover:text-ink-dark",
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
