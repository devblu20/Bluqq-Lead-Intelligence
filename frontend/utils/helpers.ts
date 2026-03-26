import { LeadPriority, LeadStatus } from '@/types';

export const priorityConfig: Record<string, {
  color: string; label: string; bg: string; dot: string;
}> = {
  High:   { color: 'text-red-700',    label: '🔴 High',   bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500'    },
  Medium: { color: 'text-orange-700', label: '🟡 Medium', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  Low:    { color: 'text-gray-500',   label: '⚪ Low',    bg: 'bg-gray-50 border-gray-200',    dot: 'bg-gray-400'   },
};

export const statusConfig: Record<LeadStatus, {
  color: string; label: string;
}> = {
  new:       { color: 'bg-blue-100 text-blue-700',     label: 'New'       },
  contacted: { color: 'bg-yellow-100 text-yellow-700', label: 'Contacted' },
  qualified: { color: 'bg-green-100 text-green-700',   label: 'Qualified' },
  closed:    { color: 'bg-gray-100 text-gray-600',     label: 'Closed'    },
};

export const sourceConfig: Record<string, { color: string }> = {
  LinkedIn: { color: 'bg-blue-100 text-blue-700'     },
  Website:  { color: 'bg-purple-100 text-purple-700' },
  Email:    { color: 'bg-yellow-100 text-yellow-700' },
  Upwork:   { color: 'bg-green-100 text-green-700'   },
  Manual:   { color: 'bg-gray-100 text-gray-600'     },
};

export const getScoreColor = (score: number | null): string => {
  if (!score && score !== 0) return 'text-gray-400';
  if (score >= 75) return 'text-red-600 font-bold';
  if (score >= 50) return 'text-orange-500 font-bold';
  return 'text-gray-400';
};

export const getScoreBg = (score: number | null): string => {
  if (!score && score !== 0) return 'bg-gray-50 border-gray-200';
  if (score >= 75) return 'bg-red-50 border-red-200';
  if (score >= 50) return 'bg-orange-50 border-orange-200';
  return 'bg-gray-50 border-gray-200';
};

export const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export const timeAgo = (d: string | null): string => {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const truncate = (text: string | null, max = 80): string => {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '...' : text;
};