export function filterTickets(tickets, query) {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return tickets;
  return tickets.filter(
    (t) =>
      String(t.id ?? "").toLowerCase().includes(q) ||
      String(t.user_name ?? "").toLowerCase().includes(q) ||
      String(t.message ?? "").toLowerCase().includes(q),
  );
}
