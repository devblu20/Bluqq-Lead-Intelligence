import Link from 'next/link';
import { Lead } from '@/types';
import {
  priorityConfig, statusConfig,
  sourceConfig, getScoreColor, timeAgo, truncate
} from '@/utils/helpers';

interface Props {
  lead:     Lead;
  onDelete: (id: string) => void;
}

export default function LeadRow({ lead, onDelete }: Props) {
  const priority = lead.priority ? priorityConfig[lead.priority] : null;
  const status   = statusConfig[lead.status];

  // Source badge styles
  const sourceStyle: Record<string, React.CSSProperties> = {
    LinkedIn: { background: 'rgba(0,119,181,0.14)',  color: '#60a5fa', border: '1px solid rgba(0,119,181,0.28)' },
    Website:  { background: 'rgba(139,92,246,0.14)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.28)' },
    Email:    { background: 'rgba(234,179,8,0.12)',  color: '#fcd34d', border: '1px solid rgba(234,179,8,0.25)' },
    Upwork:   { background: 'rgba(20,184,166,0.14)', color: '#2dd4bf', border: '1px solid rgba(20,184,166,0.28)' },
    Manual:   { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.38)', border: '1px solid rgba(255,255,255,0.1)' },
    Referral: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' },
  };

  const priorityStyle: Record<string, React.CSSProperties> = {
    hot:     { background: 'rgba(239,68,68,0.12)',  color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' },
    warm:    { background: 'rgba(249,115,22,0.12)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.25)' },
    nurture: { background: 'rgba(99,102,241,0.12)', color: '#c4b5fd', border: '1px solid rgba(99,102,241,0.25)' },
    low:     { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.1)' },
  };

  const statusStyle: Record<string, React.CSSProperties> = {
    new:       { background: 'rgba(0,194,168,0.12)',  color: '#5eead4', border: '1px solid rgba(0,194,168,0.25)' },
    contacted: { background: 'rgba(249,115,22,0.12)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.25)' },
    qualified: { background: 'rgba(239,68,68,0.12)',  color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' },
    converted: { background: 'rgba(74,222,128,0.12)', color: '#86efac', border: '1px solid rgba(74,222,128,0.25)' },
    closed:    { background: 'rgba(99,102,241,0.12)', color: '#c4b5fd', border: '1px solid rgba(99,102,241,0.25)' },
    lost:      { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' },
  };

  const score = lead.score ?? 0;
  const scoreColor =
    score >= 75 ? '#f87171' :
    score >= 50 ? '#fb923c' :
    score >   0 ? '#60a5fa' : 'rgba(255,255,255,0.18)';

  const badge: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 99,
    fontSize: 12, fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    letterSpacing: '0.2px',
  };

  const td: React.CSSProperties = {
    padding: '16px 20px',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <tr
      style={{ transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name + Company */}
      <td style={td}>
        <Link
          href={`/leads/${lead.id}`}
          style={{
            fontWeight: 600, fontSize: 15, color: '#fff',
            textDecoration: 'none', display: 'block', transition: 'color 0.15s',
          }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = '#00c2a8')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = '#fff')}
        >
          {lead.name}
        </Link>
        {lead.company && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
            {lead.company}
          </p>
        )}
      </td>

      {/* Source */}
      <td style={td}>
        <span style={{ ...badge, ...(sourceStyle[lead.source] ?? sourceStyle['Manual']) }}>
          {lead.source}
        </span>
      </td>

      {/* Service interest */}
      <td style={{ ...td, color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>
        {truncate(lead.service_interest, 28) || '—'}
      </td>

      {/* Score */}
      <td style={td}>
        <span style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 17, fontWeight: 800,
          color: scoreColor,
          letterSpacing: '-0.5px',
        }}>
          {lead.score ?? '—'}
        </span>
      </td>

      {/* Priority */}
      <td style={td}>
        {priority && lead.priority ? (
          <span style={{ ...badge, ...(priorityStyle[lead.priority as string] ?? {}) }}>
            {priority.label}
          </span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>—</span>
        )}
      </td>

      {/* Status */}
      <td style={td}>
        <span style={{
          ...badge,
          ...(statusStyle[lead.status as string] ?? {
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }),
        }}>
          {status.label}
        </span>
      </td>

      {/* Time */}
      <td style={{ ...td, fontSize: 13, color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>
        {timeAgo(lead.created_at)}
      </td>

      {/* Actions */}
      <td style={td}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <Link
            href={`/leads/${lead.id}`}
            style={{
              padding: '6px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              background: 'rgba(0,194,168,0.1)',
              color: '#2dd4bf',
              border: '1px solid rgba(0,194,168,0.22)',
              textDecoration: 'none',
              transition: 'background 0.15s, border-color 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(0,194,168,0.18)'; el.style.borderColor = 'rgba(0,194,168,0.4)'; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'rgba(0,194,168,0.1)'; el.style.borderColor = 'rgba(0,194,168,0.22)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            View
          </Link>
          <button
            onClick={() => onDelete(lead.id)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              background: 'rgba(239,68,68,0.08)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.18)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = 'rgba(239,68,68,0.35)'; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'rgba(239,68,68,0.08)'; el.style.borderColor = 'rgba(239,68,68,0.18)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}