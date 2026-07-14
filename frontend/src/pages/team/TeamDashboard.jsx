import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { Header } from "../../components/Header";
import { TeamTicketsPage } from "./TeamTicketsPage";

export function TeamDashboard() {
  const { theme, toggle } = useTheme();
  const { auth, logout } = useAuth();

  return (
    <div className="app-backdrop min-h-screen">
      <Header theme={theme} onToggleTheme={toggle} userLabel={`${auth.name} · ${auth.team} team`} onLogout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <TeamTicketsPage />
      </main>
    </div>
  );
}
