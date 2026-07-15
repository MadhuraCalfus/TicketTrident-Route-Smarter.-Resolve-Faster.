import { useEffect, useState } from "react";
import { RefreshCw, Trash2, UserPlus } from "lucide-react";
import { api } from "../../api";
import { TEAMS } from "../../constants";
import { Button, Card } from "../../components/primitives";

export function TeamMembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState(TEAMS[0]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.adminListTeamMembers();
      setMembers(r.team_members);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.adminCreateTeamMember(name, email, password, team);
      setSuccess(
        created.emailed
          ? `Account created — login details emailed to ${email}.`
          : `Account created. Email delivery isn't configured, so share the password with them directly.`,
      );
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err.message.includes("409") ? "An account with that email already exists." : "Couldn't create that account.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(member) {
    if (!window.confirm(`Delete ${member.name}'s account? This can't be undone.`)) return;
    setDeletingId(member.id);
    try {
      await api.adminDeleteTeamMember(member.id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Add a team member</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-ink-dark/60">Create a login for one support team.</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs">
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">
            Password
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">
            Team
            <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-2 text-sm">
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <p className="text-[11px] text-ink/50 dark:text-ink-dark/50">
            This password is emailed to them along with their login — set something they can change later via "Forgot password?".
          </p>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{success}</p>}

          <Button type="submit" className="w-full" disabled={creating}>
            <UserPlus size={15} /> {creating ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Team members ({members.length})</h2>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/50 dark:text-ink-dark/50 hover:bg-black/5 dark:hover:bg-white/10">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {members.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink/50 dark:text-ink-dark/50">No team members yet.</p>
        ) : (
          <div className="thin-scroll mt-4 max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-black/8 dark:border-white/10 p-3">
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-ink/50 dark:text-ink-dark/50">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:text-brand-dim">{m.team}</span>
                  <button
                    onClick={() => remove(m)}
                    disabled={deletingId === m.id}
                    aria-label={`Delete ${m.name}`}
                    className="grid h-7 w-7 place-items-center rounded-lg text-red-500/70 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
