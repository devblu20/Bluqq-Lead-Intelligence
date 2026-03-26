export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type LeadStatus   = 'new' | 'contacted' | 'qualified' | 'closed';
export type LeadPriority = 'High' | 'Medium' | 'Low';
export type LeadSource   = 'LinkedIn' | 'Website' | 'Email' | 'Upwork' | 'Manual';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  service_interest: string | null;
  message: string;
  status: LeadStatus;
  score: number | null;
  priority: LeadPriority | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  service_interest?: string;
  message: string;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  score?: number;
  priority?: LeadPriority;
}

export type IntentType         = 'purchase' | 'explore' | 'comparison' | 'unclear';
export type UrgencyLevel       = 'high' | 'medium' | 'low';
export type QualificationLabel = 'Qualified' | 'Potential' | 'Weak' | 'Spam';

export interface AIAnalysis {
  id: string;
  lead_id: string;
  summary: string;
  intent: IntentType;
  urgency: UrgencyLevel;
  qualification_label: QualificationLabel;
  recommended_action: string;
  confidence: number;
  analyzed_at: string;
}

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface LeadDetail {
  lead: Lead;
  analysis: AIAnalysis | null;
  events: LeadEvent[];
}

export interface DashboardStats {
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  new_today: number;
  average_score: number;
  recent_leads: Lead[];
}

export interface PaginatedLeads {
  leads: Lead[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}