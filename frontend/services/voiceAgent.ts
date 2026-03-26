/**
 * voiceAgent.ts  →  frontend/services/voiceAgent.ts
 * ───────────────────────────────────────────────────
 * BluQQ Voice Agent ke saare backend APIs ke liye
 * typed fetch wrapper. Frontend mein yahi file use karo.
 *
 * .env.local mein yeh add karo:
 *   NEXT_PUBLIC_API_URL=http://localhost:8000
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const V    = `${BASE}/api/voice`;

// ── Generic fetch helper ──────────────────────────────────────

async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${V}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail ?? `API Error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────

export interface CallSession {
  session_id:   string;
  caller_name:  string;
  caller_phone: string;
  date:         string;
  time:         string;
  duration:     string;
  duration_sec: number;
  turns:        number;
  barge_ins:    number;
  avg_latency:  string;
  tools_used:   string[];
  status:       string;
}

export interface CRMContact {
  phone:         string;
  name:          string;
  email:         string;
  interests:     string[];
  notes:         string;
  first_contact: string;
  last_contact:  string;
  total_calls:   number;
  sessions:      { session_id: string; date: string; summary: string }[];
}

export interface AnalyticsOverview {
  total_calls:    number;
  avg_duration:   number;
  avg_latency_ms: number;
  crm_contacts:   number;
}

export interface CalendarSlot {
  start: string;
  end:   string;
  label: string;
}

export interface VoiceHealthStatus {
  status:       string;
  service:      string;
  timestamp:    string;
  redis:        string;
  crm_contacts: number;
  rag_chunks?:  number;
  calendar?:    string;
}

// ── Health ────────────────────────────────────────────────────

export const getVoiceHealth = () =>
  api<VoiceHealthStatus>("/health");

// ── Calls ─────────────────────────────────────────────────────

export const getCalls = (page = 1, limit = 20, phone = "") =>
  api<{ total: number; sessions: CallSession[] }>(
    `/calls?page=${page}&limit=${limit}&phone=${encodeURIComponent(phone)}`
  );

export const getCall = (sessionId: string) =>
  api<CallSession>(`/calls/${sessionId}`);

// ── Transcripts ───────────────────────────────────────────────

export const listTranscripts = () =>
  api<{ stats: Record<string, unknown>; files: { session_id: string }[] }>(
    "/transcripts"
  );

export const getTranscriptText = async (sessionId: string): Promise<string> => {
  const res = await fetch(`${V}/transcripts/${sessionId}/txt`);
  if (!res.ok) throw new Error("Transcript nahi mila");
  return res.text();
};

export const getTranscriptJson = (sessionId: string) =>
  api<{ role: string; text: string; timestamp: string }[]>(
    `/transcripts/${sessionId}/json`
  );

// ── CRM ───────────────────────────────────────────────────────

export const getCRMContacts = () =>
  api<{ total_contacts: number; contacts: CRMContact[] }>("/crm");

export const getCRMContact = (phone: string) =>
  api<CRMContact>(`/crm/${encodeURIComponent(phone)}`);

export const createCRMContact = (data: {
  phone: string;
  name?: string;
  email?: string;
  interests?: string[];
  notes?: string;
}) =>
  api<{ status: string; contact: CRMContact }>("/crm", {
    method: "POST",
    body:   JSON.stringify(data),
  });

export const updateCRMContact = (
  phone: string,
  data: Partial<Omit<CRMContact, "phone">>
) =>
  api<{ status: string; contact: CRMContact }>(
    `/crm/${encodeURIComponent(phone)}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );

export const deleteCRMContact = (phone: string) =>
  api<{ status: string }>(`/crm/${encodeURIComponent(phone)}`, {
    method: "DELETE",
  });

// ── Analytics ─────────────────────────────────────────────────

export const getAnalyticsOverview = () =>
  api<AnalyticsOverview>("/analytics/overview");

export const getAnalyticsFull = () =>
  api<Record<string, unknown>>("/analytics");

export const getDailyVolume = (days = 7) =>
  api<{ days: number; data: { date: string; calls: number }[] }>(
    `/analytics/volume?days=${days}`
  );

export const getToolUsage = () =>
  api<{ tools: { tool: string; count: number }[] }>("/analytics/tools");

export const getLatencyStats = () =>
  api<{ avg: number; min: number; max: number; samples: number }>(
    "/analytics/latency"
  );

// ── Calendar ──────────────────────────────────────────────────

export const getAvailableSlots = (daysAhead = 7) =>
  api<{ days_ahead: number; available: boolean; slots: CalendarSlot[] }>(
    `/calendar/slots?days_ahead=${daysAhead}`
  );

export const bookConsultation = (data: {
  name:           string;
  email?:         string;
  phone?:         string;
  topic:          string;
  preferred_time: string;
}) =>
  api<{ status: string; event_id?: string }>("/calendar/book", {
    method: "POST",
    body:   JSON.stringify(data),
  });

// ── RAG / Knowledge Base ──────────────────────────────────────

export const getRagStats = () =>
  api<{ total_chunks: number; files: string[] }>("/rag/stats");

export const searchKnowledgeBase = (query: string, topK = 3) =>
  api<{ query: string; context: string; found: boolean }>("/rag/search", {
    method: "POST",
    body:   JSON.stringify({ query, top_k: topK }),
  });

// ── Leads ─────────────────────────────────────────────────────

export const getVoiceLeads = (page = 1, limit = 20) =>
  api<{ total: number; leads: Record<string, unknown>[] }>(
    `/leads?page=${page}&limit=${limit}`
  );