import { useEffect, useState } from "react";
import { BarChart3, Building2, Clock, Inbox, Sparkles, Table2, Users, Zap } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { Header } from "../../components/Header";
import { RaceTab } from "../../components/RaceTab";
import { DemoTab } from "../../components/DemoTab";
import { AnalyticsTab } from "../../components/AnalyticsTab";
import { NewTicketsQueuePage } from "./NewTicketsQueuePage";
import { AllTicketsPage } from "./AllTicketsPage";
import { AiResolvedPage } from "./AiResolvedPage";
import { TeamsOverviewPage } from "./TeamsOverviewPage";
import { TeamMembersPage } from "./TeamMembersPage";

const TABS = [
  { id: "queue", label: "New Tickets", icon: Inbox },
  { id: "all", label: "All Tickets", icon: Table2 },
  { id: "ai-resolved", label: "AI Resolved", icon: Sparkles },
  { id: "teams", label: "Teams", icon: Building2 },
  { id: "team-members", label: "Team Members", icon: Users },
  { id: "race", label: "Manual vs AI Race", icon: Clock },
  { id: "demo", label: "Demo (30 Tickets)", icon: Zap },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminDashboard() {
  const [tab, setTab] = useState("queue");
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState(null);
  const { logout } = useAuth();

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, [tab]);

  return (
    <div className="app-backdrop min-h-screen">
      <Header
        tabs={TABS}
        tab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={toggle}
        health={health}
        userLabel="Admin"
        onLogout={logout}
      />
      <main className={`mx-auto px-4 py-8 ${tab === "all" || tab === "ai-resolved" ? "max-w-[1600px]" : "max-w-6xl"}`}>
        {tab === "queue" && <NewTicketsQueuePage />}
        {tab === "all" && <AllTicketsPage />}
        {tab === "ai-resolved" && <AiResolvedPage />}
        {tab === "teams" && <TeamsOverviewPage />}
        {tab === "team-members" && <TeamMembersPage />}
        {tab === "race" && <RaceTab />}
        {tab === "demo" && <DemoTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </main>
    </div>
  );
}
