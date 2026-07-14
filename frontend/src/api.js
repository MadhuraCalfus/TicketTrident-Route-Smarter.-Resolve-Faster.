function authHeader() {
  try {
    const raw = sessionStorage.getItem("auth");
    if (!raw) return {};
    const { access_token } = JSON.parse(raw);
    return access_token ? { Authorization: `Bearer ${access_token}` } : {};
  } catch {
    return {};
  }
}

async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...authHeader() },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),

  // ---- auth ----
  signup: (name, email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request("/auth/me"),

  // ---- admin sandbox tools (Route a Ticket / Race / Demo / Analytics / History) ----
  route: (message, opts) =>
    request("/route", {
      method: "POST",
      body: JSON.stringify({ message, ...opts }),
    }),

  tickets: (limit = 50, offset = 0) => request(`/tickets?limit=${limit}&offset=${offset}`),

  ticket: (id) => request(`/tickets/${id}`),

  feedback: (id, payload) =>
    request(`/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  analytics: () => request("/analytics"),

  sampleTickets: () => request("/sample-tickets"),

  runDemo: (tickets) =>
    request("/demo/run", {
      method: "POST",
      body: JSON.stringify({ tickets }),
    }),

  // ---- user ----
  createTicket: (message) => request("/tickets", { method: "POST", body: JSON.stringify({ message }) }),

  myTickets: () => request("/my-tickets"),

  // ---- admin: ticket queue + team management ----
  adminNewTickets: () => request("/admin/tickets/new"),

  adminRouteTicket: (id) => request(`/admin/tickets/${id}/route`, { method: "POST" }),

  adminAssignTicket: (id, category, priority, team) =>
    request(`/admin/tickets/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ category, priority, team }),
    }),

  adminRouteBulk: (ticketIds) =>
    request("/admin/tickets/route-bulk", {
      method: "POST",
      body: JSON.stringify({ ticket_ids: ticketIds }),
    }),

  adminTeamSummary: () => request("/admin/team-summary"),

  adminAllTickets: () => request("/admin/tickets"),

  adminListTeamMembers: () => request("/admin/team-members"),

  adminCreateTeamMember: (name, email, password, team) =>
    request("/admin/team-members", {
      method: "POST",
      body: JSON.stringify({ name, email, password, team }),
    }),

  // ---- team ----
  teamTickets: () => request("/team/tickets"),

  teamUpdateStatus: (id, status) =>
    request(`/team/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
