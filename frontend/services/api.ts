import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AuthResponse, CreateLeadInput, UpdateLeadInput,
  PaginatedLeads, LeadDetail, DashboardStats, AIAnalysis
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('bluqq_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bluqq_token');
        localStorage.removeItem('bluqq_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signup:     (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/signup', data),
  login:      (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  getMe:      () =>
    api.get('/auth/me'),
  sendCode:   (email: string) =>
    api.post('/auth/send-code', { email }),
  verifyCode: (email: string, code: string) =>
    api.post('/auth/verify-code', { email, code }),
};

export const leadsAPI = {
  getAll:    (params?: object) =>
    api.get<PaginatedLeads>('/leads', { params }),
  getOne:    (id: string) =>
    api.get<LeadDetail>(`/leads/${id}`),
  create:    (data: CreateLeadInput) =>
    api.post<LeadDetail>('/leads', data),
  update:    (id: string, data: UpdateLeadInput) =>
    api.patch<LeadDetail>(`/leads/${id}`, data),
  delete:    (id: string) =>
    api.delete(`/leads/${id}`),
  analyze:   (id: string) =>
    api.post<AIAnalysis>(`/leads/${id}/analyze`),
  getStats:  () =>
    api.get<DashboardStats>('/leads/stats/summary'),
  uploadCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;