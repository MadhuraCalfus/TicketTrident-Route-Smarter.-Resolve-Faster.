async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
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

  repairExample: () => request("/demo/repair-example"),
};
