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

// ─── Activity Timeline Component ─────────────────────────────────────────────
function ActivityTimeline({ events }: { events: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_SHOW = 2;
  const visible = expanded ? events : events.slice(0, INITIAL_SHOW);
  const remaining = events.length - INITIAL_SHOW;

  return (
    <div className="bq-card">
      <h2 style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '14px', fontWeight: 700, color: '#F9FAFB', marginBottom: '16px',
      }}>
        Activity Timeline
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visible.map(event => (
          <div key={event.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#2563EB', marginTop: '6px', flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{
                  fontSize: '13px', fontWeight: 500,
                  color: '#D1D5DB', textTransform: 'capitalize',
                }}>
                  {event.event_type.replace(/_/g, ' ')}
                </p>
                <p style={{ fontSize: '11px', color: '#374151' }}>{timeAgo(event.created_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > INITIAL_SHOW && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          style={{
            marginTop: '14px',
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #1F2937',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#374151';
            e.currentTarget.style.color = '#9CA3AF';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1F2937';
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          {expanded
            ? '↑ Show less'
            : `↓ Show ${remaining} more event${remaining > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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
    if (!s) return '#374151';
    if (s >= 75) return '#F87171';
    if (s >= 50) return '#FB923C';
    return '#60A5FA';
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '16px' }}>
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
      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/leads" style={{ fontSize: '13px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Back to Leads
          </Link>
          <button onClick={handleDelete} className="bq-btn-danger">
            Delete Lead
          </button>
        </div>

        {/* Status Pipeline */}
        <div className="bq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 700, color: '#F9FAFB' }}>
              Lead Status
            </h2>
            {updating && (
              <span style={{ fontSize: '12px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                <button key={s.value} onClick={() => handleStatusChange(s.value)}
                  disabled={updating}
                  style={{
                    padding: '16px 12px', borderRadius: '10px', textAlign: 'left',
                    border: `1.5px solid ${isActive ? '#2563EB' : isPast ? '#166534' : '#374151'}`,
                    background: isActive ? 'rgba(37,99,235,0.1)' : isPast ? 'rgba(22,101,52,0.08)' : '#1F2937',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    opacity: updating ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <p style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '13px', fontWeight: 600, marginBottom: '4px',
                    color: isActive ? '#60A5FA' : isPast ? '#4ADE80' : '#9CA3AF',
                  }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: '11px', color: isActive ? '#2563EB' : isPast ? '#166534' : '#374151' }}>
                    {isActive ? 'Current ✓' : isPast ? 'Done ✓' : 'Click to set'}
                  </p>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: '#374151', marginTop: '12px' }}>
            Click any stage above to update this lead's progress
          </p>
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
                <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px', fontWeight: 700, color: '#F9FAFB' }}>
                  {lead.name}
                </h1>
                {lead.company && (
                  <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '3px' }}>{lead.company}</p>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className={`bq-badge ${srcClass}`}>{lead.source}</span>
                  {lead.priority && <span className={priClass(lead.priority)}>{lead.priority}</span>}
                </div>
              </div>
            </div>
            {/* Score */}
            <div style={{
              textAlign: 'center', padding: '12px 20px',
              background: '#111827', border: '1px solid #374151', borderRadius: '10px',
            }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, color: scoreColor(lead.score) }}>
                {lead.score ?? '—'}
              </p>
              <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '2px' }}>Score</p>
            </div>
          </div>

          {/* Contact grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Email',   value: lead.email           },
              { label: 'Phone',   value: lead.phone           },
              { label: 'Service', value: lead.service_interest },
              { label: 'Added',   value: formatDate(lead.created_at) },
            ].map(item => (
              <div key={item.label} style={{
                background: '#111827', border: '1px solid #1F2937',
                borderRadius: '8px', padding: '12px',
              }}>
                <p style={{ fontSize: '11px', color: '#4B5563', marginBottom: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.value || '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Message */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Message
            </p>
            <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '10px', padding: '16px' }}>
              <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {lead.message}
              </p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {analysis ? (
          <div className="bq-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 700, color: '#F9FAFB' }}>
                AI Analysis
              </h2>
              <span style={{ fontSize: '11px', color: '#4B5563' }}>{timeAgo(analysis.analyzed_at)}</span>
            </div>

            {/* 3 signals */}
            <div className="bq-grid-3" style={{ marginBottom: '16px' }}>
              {[
                { label: 'Qualification', value: analysis.qualification_label },
                { label: 'Intent',        value: analysis.intent,  capitalize: true },
                { label: 'Urgency',       value: analysis.urgency, capitalize: true,
                  color: analysis.urgency === 'high' ? '#F87171' : analysis.urgency === 'medium' ? '#FB923C' : '#4ADE80' },
              ].map(item => (
                <div key={item.label} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#4B5563', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: (item as any).color || '#F9FAFB', textTransform: item.capitalize ? 'capitalize' : 'none' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Summary</p>
              <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.7' }}>{analysis.summary}</p>
              </div>
            </div>

            {/* Recommended Action */}
            <div style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Recommended Action
              </p>
              <p style={{ fontSize: '13px', color: '#93C5FD', fontWeight: 500 }}>{analysis.recommended_action}</p>
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4B5563', marginBottom: '6px' }}>
                <span>AI Confidence</span>
                <span>{Math.round((analysis.confidence || 0) * 100)}%</span>
              </div>
              <div style={{ height: '4px', background: '#1F2937', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563EB, #60A5FA)', borderRadius: '99px', width: `${(analysis.confidence || 0) * 100}%`, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Score Breakdown */}
            {(analysis as any).raw_ai_response?.score_breakdown && (
              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #1F2937' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Score Breakdown
                </p>
                <div className="bq-grid-3" style={{ marginBottom: '12px' }}>
                  {[
                    { label: 'Rule Score',    value: (analysis as any).raw_ai_response.score_breakdown.rule_score, color: '#F9FAFB' },
                    { label: 'AI Adjustment', value: (analysis as any).raw_ai_response.score_breakdown.ai_adjustment >= 0
                        ? `+${(analysis as any).raw_ai_response.score_breakdown.ai_adjustment}`
                        : (analysis as any).raw_ai_response.score_breakdown.ai_adjustment,
                      color: '#60A5FA' },
                    { label: 'Final Score',   value: lead.score ?? '—', color: scoreColor(lead.score) },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</p>
                      <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '3px' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                  {[
                    ...(analysis as any).raw_ai_response.score_breakdown.rule_reasons || [],
                    ...(analysis as any).raw_ai_response.score_breakdown.ai_reasons   || [],
                  ].map((reason: string, i: number) => (
                    <p key={i} style={{
                      fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                      color: reason.startsWith('✓') ? '#4ADE80' : reason.startsWith('✗') ? '#F87171' : reason.startsWith('🤖') ? '#60A5FA' : '#6B7280',
                      background: reason.startsWith('✓') ? 'rgba(34,197,94,0.06)' : reason.startsWith('✗') ? 'rgba(239,68,68,0.06)' : reason.startsWith('🤖') ? 'rgba(37,99,235,0.06)' : 'transparent',
                    }}>
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
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', fontWeight: 600, color: '#9CA3AF', marginBottom: '6px' }}>No AI Analysis Yet</p>
            <p style={{ fontSize: '13px', color: '#4B5563', marginBottom: '20px' }}>Analysis runs automatically after lead creation</p>
          </div>
        )}

        {/* Contact Lead */}
        <ContactLeadCard
          lead={lead}
          onMessageSent={() => router.replace(router.asPath)}
        />

        {/* Activity Timeline — shows 2 by default, expand to see rest */}
        {events && events.length > 0 && (
          <ActivityTimeline events={events} />
        )}

      </div>
    </AppLayout>
  );
}