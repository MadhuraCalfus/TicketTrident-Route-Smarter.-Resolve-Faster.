import type { AnalyticsData, HealthInfo, RepairExample, SampleTicket, TicketResult } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthInfo>("/health"),

  route: (message: string, opts?: { manual_time_seconds?: number; compare?: boolean }) =>
    request<TicketResult>("/route", {
      method: "POST",
      body: JSON.stringify({ message, ...opts }),
    }),

  tickets: (limit = 50, offset = 0) =>
    request<{ tickets: TicketResult[]; total: number }>(`/tickets?limit=${limit}&offset=${offset}`),

  ticket: (id: string) => request<TicketResult>(`/tickets/${id}`),

  feedback: (
    id: string,
    payload: {
      agree: boolean;
      corrected_category?: string;
      corrected_priority?: string;
      corrected_team?: string;
      note?: string;
    },
  ) =>
    request<TicketResult>(`/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  analytics: () => request<AnalyticsData>("/analytics"),

  sampleTickets: () => request<{ tickets: SampleTicket[] }>("/sample-tickets"),

  runDemo: (tickets: string[]) =>
    request<{ results: TicketResult[] }>("/demo/run", {
      method: "POST",
      body: JSON.stringify({ tickets }),
    }),

  repairExample: () => request<{ examples: RepairExample[] }>("/demo/repair-example"),
};
