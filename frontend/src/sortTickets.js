const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

// statusOrder lets each page define its own lifecycle order — Team only
// ever sees Routed/In Progress/Resolved, while Admin's full ticket list
// also includes the pre-routing "New" stage.
export function sortTickets(tickets, sortBy, statusOrder) {
  const sorted = [...tickets];
  if (sortBy === "priority") {
    sorted.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99));
  } else if (sortBy === "status") {
    sorted.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return sorted;
}
