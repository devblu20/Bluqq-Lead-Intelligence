import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import { leadsAPI } from '@/services/api';
import { LeadDetail, LeadStatus } from '@/types';
import { formatDate, timeAgo } from '@/utils/helpers';
import toast from 'react-hot-toast';
import Link from 'next/link';
import ContactLeadCard from '@/components/leads/ContactLeadCard';

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new',       label: 'New'       },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed',    label: 'Closed'    },
];

function ActivityTimeline({ events }: { events: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_SHOW = 2;
  const visible   = expanded ? events : events.slice(0, INITIAL_SHOW);
  const remaining = events.length - INITIAL_SHOW;

  return (
    <div className="bq-card">
      <style>{`
        .ld-timeline-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 16px;
        }
        .ld-timeline-event-type {
          font-size: 13px; font-weight: 500;
          color: var(--text-secondary);
          text-transform: capitalize;
        }
        .ld-timeline-event-time {
          font-size: 11px;
          color: var(--text-hint);
        }
        .ld-timeline-toggle {
          margin-top: 14px; width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px; cursor: pointer;
          font-size: 12px; color: var(--text-muted);
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: border-color 0.15s, color 0.15s;
        }
        .ld-timeline-toggle:hover { border-color: var(--border-focus); color: var(--text-secondary); }
      `}</style>

      <p className="ld-timeline-title">Activity Timeline</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visible.map(event => (
          <div key={event.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#2563EB', marginTop: '6px', flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p className="ld-timeline-event-type">{event.event_type.replace(/_/g, ' ')}</p>
                <p className="ld-timeline-event-time">{timeAgo(event.created_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > INITIAL_SHOW && (
        <button className="ld-timeline-toggle" onClick={() => setExpanded(p => !p)}>
          {expanded ? '↑ Show less' : `↓ Show ${remaining} more event${remaining > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [detail, setDetail]     = useState<LeadDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeStatus, setActiveStatus] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    leadsAPI.getOne(id as string)
      .then(res => { setDetail(res.data); setActiveStatus(res.data.lead.status as LeadStatus); })
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!detail || newStatus === activeStatus) return;
    setUpdating(true);
    try {
      const res = await leadsAPI.update(detail.lead.id, { status: newStatus });
      setDetail(res.data); setActiveStatus(newStatus);
      toast.success(`Status updated to ${newStatus}!`);
    } catch { toast.error('Failed to update status'); }
    finally  { setUpdating(false); }
  };

  const handleDelete = async () => {
    if (!detail || !confirm('Delete this lead permanently?')) return;
    try { await leadsAPI.delete(detail.lead.id); toast.success('Lead deleted'); router.push('/leads'); }
    catch { toast.error('Failed to delete lead'); }
  };

  const scoreColor = (s: number | null) => {
    if (!s) return 'var(--text-hint)';
    if (s >= 75) return '#ef4444';
    if (s >= 50) return '#f59e0b';
    return '#3b82f6';
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <div className="bq-spinner" />
      </div>
    </AppLayout>
  );

  if (!detail) return (
    <AppLayout>
      <div className="bq-empty">
        <p className="bq-empty-title">Lead not found</p>
        <Link href="/leads" className="bq-btn-ghost">← Back to Leads</Link>
      </div>
    </AppLayout>
  );

  const { lead, analysis, events } = detail;

  const priClass = (p: string | null) => {
    if (!p) return 'bq-badge bq-badge-gray';
    if (p === 'High')   return 'bq-badge bq-pri-high';
    if (p === 'Medium') return 'bq-badge bq-pri-medium';
    return 'bq-badge bq-pri-low';
  };

  const srcClass = `bq-badge bq-src-${(lead.source || 'manual').toLowerCase()}`;

  return (
    <AppLayout>
      <style>{`
        .ld-back { font-size: 13px; color: var(--text-muted); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
        .ld-back:hover { color: var(--text-primary); }

        .ld-card-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700;
          color: var(--text-primary); margin: 0;
        }

        /* Status pipeline */
        .ld-status-btn {
          padding: 16px 12px; border-radius: 10px; text-align: left;
          cursor: pointer; transition: all 0.15s;
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
        }
        .ld-status-btn.active {
          background: rgba(37,99,235,0.1);
          border-color: #2563EB;
        }
        .ld-status-btn.past {
          background: rgba(22,101,52,0.08);
          border-color: #166534;
        }
        .ld-status-label {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 600; margin-bottom: 4px;
          color: var(--text-muted);
        }
        .ld-status-btn.active .ld-status-label { color: #60A5FA; }
        .ld-status-btn.past  .ld-status-label { color: #4ADE80; }
        .ld-status-sub { font-size: 11px; color: var(--text-hint); }
        .ld-status-btn.active .ld-status-sub { color: #2563EB; }
        .ld-status-btn.past  .ld-status-sub  { color: #166834; }
        .ld-status-hint { font-size: 11px; color: var(--text-hint); margin-top: 12px; }

        /* Lead info */
        .ld-lead-name {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 18px; font-weight: 700;
          color: var(--text-primary);
        }
        .ld-lead-company { font-size: 13px; color: var(--text-muted); margin-top: 3px; }

        /* Score box */
        .ld-score-box {
          text-align: center; padding: 12px 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .ld-score-label { font-size: 11px; color: var(--text-hint); margin-top: 2px; }

        /* Info cells */
        .ld-info-cell {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 12px;
        }
        .ld-info-cell-label {
          font-size: 11px; color: var(--text-hint); margin-bottom: 4px;
          font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .ld-info-cell-value {
          font-size: 13px; color: var(--text-primary); font-weight: 500;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Message / content blocks */
        .ld-content-block {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 16px;
        }
        .ld-content-block p { font-size: 13px; color: var(--text-secondary); line-height: 1.7; white-space: pre-wrap; }

        .ld-block-label {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
        }

        /* AI analysis */
        .ld-ai-signal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 14px; text-align: center;
        }
        .ld-ai-signal-label {
          font-size: 11px; color: var(--text-hint); margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
        }
        .ld-ai-signal-value { font-size: 14px; font-weight: 700; color: var(--text-primary); text-transform: capitalize; }

        .ld-recommended {
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(37,99,235,0.2);
          border-radius: 10px; padding: 14px; margin-bottom: 14px;
        }
        .ld-recommended-label {
          font-size: 11px; font-weight: 600; color: #2563EB;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .ld-recommended-text { font-size: 13px; color: #93C5FD; font-weight: 500; }
        [data-theme="light"] .ld-recommended-text { color: #1d4ed8; }

        .ld-confidence-label { font-size: 12px; color: var(--text-muted); }
        .ld-confidence-bar-bg {
          height: 4px; background: var(--border);
          border-radius: 99px; overflow: hidden;
        }

        .ld-breakdown-divider { border-top: 1px solid var(--border); margin-top: 18px; padding-top: 16px; }
        .ld-breakdown-label {
          font-size: 11px; font-weight: 600; color: var(--text-hint);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;
        }

        .ld-reason {
          font-size: 12px; padding: 6px 10px; border-radius: 6px;
          color: var(--text-muted);
        }
        .ld-reason-pass { color: #16a34a; background: rgba(34,197,94,0.06); }
        .ld-reason-fail { color: #dc2626; background: rgba(239,68,68,0.06); }
        .ld-reason-ai   { color: #3b82f6; background: rgba(37,99,235,0.06); }

        .ld-updating-label {
          font-size: 12px; color: var(--text-hint);
          display: flex; align-items: center; gap: 6px;
        }
      `}</style>

      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/leads" className="ld-back">← Back to Leads</Link>
          <button onClick={handleDelete} className="bq-btn-danger">Delete Lead</button>
        </div>

        {/* Status Pipeline */}
        <div className="bq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p className="ld-card-title">Lead Status</p>
            {updating && (
              <span className="ld-updating-label">
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(37,99,235,0.2)', borderTopColor: '#2563EB', animation: 'bq-spin 0.75s linear infinite' }} />
                Saving...
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {STATUSES.map((s, index) => {
              const isActive = activeStatus === s.value;
              const isPast   = STATUSES.findIndex(x => x.value === activeStatus) > index;
              return (
                <button key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={updating}
                  className={`ld-status-btn${isActive ? ' active' : isPast ? ' past' : ''}`}
                  style={{ opacity: updating ? 0.6 : 1, cursor: updating ? 'not-allowed' : 'pointer' }}
                >
                  <p className="ld-status-label">{s.label}</p>
                  <p className="ld-status-sub">
                    {isActive ? 'Current ✓' : isPast ? 'Done ✓' : 'Click to set'}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="ld-status-hint">Click any stage above to update this lead's progress</p>
        </div>

        {/* Lead Info */}
        <div className="bq-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #1E40AF, #2563EB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px', fontWeight: 800, color: '#fff',
                flexShrink: 0,
              }}>
                {lead.name[0].toUpperCase()}
              </div>
              <div>
                <h1 className="ld-lead-name">{lead.name}</h1>
                {lead.company && <p className="ld-lead-company">{lead.company}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className={`bq-badge ${srcClass}`}>{lead.source}</span>
                  {lead.priority && <span className={priClass(lead.priority)}>{lead.priority}</span>}
                </div>
              </div>
            </div>

            <div className="ld-score-box">
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, color: scoreColor(lead.score) }}>
                {lead.score ?? '—'}
              </p>
              <p className="ld-score-label">Score</p>
            </div>
          </div>

          {/* Contact grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Email',   value: lead.email            },
              { label: 'Phone',   value: lead.phone            },
              { label: 'Service', value: lead.service_interest },
              { label: 'Added',   value: formatDate(lead.created_at) },
            ].map(item => (
              <div key={item.label} className="ld-info-cell">
                <p className="ld-info-cell-label">{item.label}</p>
                <p className="ld-info-cell-value">{item.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Message */}
          <div>
            <p className="ld-block-label">Message</p>
            <div className="ld-content-block">
              <p>{lead.message}</p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {analysis ? (
          <div className="bq-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <p className="ld-card-title">AI Analysis</p>
              <span style={{ fontSize: '11px', color: 'var(--text-hint)' }}>{timeAgo(analysis.analyzed_at)}</span>
            </div>

            {/* 3 signals */}
            <div className="bq-grid-3" style={{ marginBottom: '16px' }}>
              {[
                { label: 'Qualification', value: analysis.qualification_label },
                { label: 'Intent',        value: analysis.intent,  capitalize: true },
                { label: 'Urgency',       value: analysis.urgency, capitalize: true,
                  color: analysis.urgency === 'high' ? '#ef4444' : analysis.urgency === 'medium' ? '#f59e0b' : '#22c55e' },
              ].map(item => (
                <div key={item.label} className="ld-ai-signal">
                  <p className="ld-ai-signal-label">{item.label}</p>
                  <p className="ld-ai-signal-value" style={{ color: (item as any).color || 'var(--text-primary)', textTransform: item.capitalize ? 'capitalize' : 'none' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ marginBottom: '14px' }}>
              <p className="ld-block-label">Summary</p>
              <div className="ld-content-block"><p>{analysis.summary}</p></div>
            </div>

            {/* Recommended Action */}
            <div className="ld-recommended">
              <p className="ld-recommended-label">Recommended Action</p>
              <p className="ld-recommended-text">{analysis.recommended_action}</p>
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="ld-confidence-label">AI Confidence</span>
                <span className="ld-confidence-label">{Math.round((analysis.confidence || 0) * 100)}%</span>
              </div>
              <div className="ld-confidence-bar-bg">
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563EB, #60A5FA)', borderRadius: '99px', width: `${(analysis.confidence || 0) * 100}%`, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Score Breakdown */}
            {(analysis as any).raw_ai_response?.score_breakdown && (
              <div className="ld-breakdown-divider">
                <p className="ld-breakdown-label">Score Breakdown</p>
                <div className="bq-grid-3" style={{ marginBottom: '12px' }}>
                  {[
                    { label: 'Rule Score',    value: (analysis as any).raw_ai_response.score_breakdown.rule_score, color: 'var(--text-primary)' },
                    { label: 'AI Adjustment', value: (analysis as any).raw_ai_response.score_breakdown.ai_adjustment >= 0
                        ? `+${(analysis as any).raw_ai_response.score_breakdown.ai_adjustment}`
                        : (analysis as any).raw_ai_response.score_breakdown.ai_adjustment,
                      color: '#60A5FA' },
                    { label: 'Final Score',   value: lead.score ?? '—', color: scoreColor(lead.score) },
                  ].map(item => (
                    <div key={item.label} className="ld-ai-signal">
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</p>
                      <p className="ld-ai-signal-label" style={{ marginBottom: 0, marginTop: '3px' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                  {[
                    ...(analysis as any).raw_ai_response.score_breakdown.rule_reasons || [],
                    ...(analysis as any).raw_ai_response.score_breakdown.ai_reasons   || [],
                  ].map((reason: string, i: number) => (
                    <p key={i} className={`ld-reason${reason.startsWith('✓') ? ' ld-reason-pass' : reason.startsWith('✗') ? ' ld-reason-fail' : reason.startsWith('🤖') ? ' ld-reason-ai' : ''}`}>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bq-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>No AI Analysis Yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Analysis runs automatically after lead creation</p>
          </div>
        )}

        <ContactLeadCard lead={lead} onMessageSent={() => router.replace(router.asPath)} />

        {events && events.length > 0 && <ActivityTimeline events={events} />}

      </div>
    </AppLayout>
  );
}