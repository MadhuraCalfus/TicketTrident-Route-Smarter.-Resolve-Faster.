import { useState } from "react";
import { PlusCircle, Sparkles, Ticket } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { Header } from "../../components/Header";
import { NewTicketPage } from "./NewTicketPage";
import { MyTicketsPage } from "./MyTicketsPage";
import { MyResolvedIssuesPage } from "./MyResolvedIssuesPage";

const TABS = [
  { id: "new", label: "New Ticket", icon: PlusCircle },
  { id: "mine", label: "My Tickets", icon: Ticket },
  { id: "resolved", label: "Resolved by AI", icon: Sparkles },
];

export function UserDashboard() {
  const [tab, setTab] = useState("new");
  const [reloadKey, setReloadKey] = useState(0);
  const { theme, toggle } = useTheme();
  const { auth, logout } = useAuth();

  return (
    <div className="app-backdrop min-h-screen">
      <Header
        tabs={TABS}
        tab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={toggle}
        userLabel={`${auth.name} · customer`}
        onLogout={logout}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "new" && (
          <NewTicketPage
            onSubmitted={() => {
              setReloadKey((k) => k + 1);
              setTab("mine");
            }}
          />
        )}
        {tab === "mine" && <MyTicketsPage reloadKey={reloadKey} />}
        {tab === "resolved" && <MyResolvedIssuesPage />}
      </main>
    </div>
  );
}
