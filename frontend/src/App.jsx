import { useEffect, useState } from "react";
import { api } from "./api";
import { useTheme } from "./hooks/useTheme";
import { Header } from "./components/Header";
import { RouteTicketTab } from "./components/RouteTicketTab";
import { RaceTab } from "./components/RaceTab";
import { DemoTab } from "./components/DemoTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { HistoryTab } from "./components/HistoryTab";

function App() {
  const [tab, setTab] = useState("route");
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, [tab]);

  return (
    <div className="app-backdrop min-h-screen">
      <Header tab={tab} onTab={setTab} theme={theme} onToggleTheme={toggle} health={health} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "route" && <RouteTicketTab />}
        {tab === "race" && <RaceTab />}
        {tab === "demo" && <DemoTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "history" && <HistoryTab />}
      </main>
    </div>
  );
}

export default App;
