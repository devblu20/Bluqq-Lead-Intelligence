import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import { leadsAPI } from '@/services/api';
import { DashboardStats, Lead } from '@/types';
import { priorityConfig, statusConfig, timeAgo } from '@/utils/helpers';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    leadsAPI.getStats()
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Overview" greeting={`${greeting}, Tanisha`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        /* ── Stats grid ── */
        .db-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1100px) {
          .db-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .db-stats-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        }

        /* ── Bottom row ── */
        .db-bottom-row {
          display: grid;
          grid-template-columns: 1fr 272px;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .db-bottom-row { grid-template-columns: 1fr; }
          .db-sources-panel { display: none; }
        }

        /* ── Section card ── */
        .db-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
        }

        .db-section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 17px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          gap: 12px;
        }

        .db-section-title {
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 800; color: #fff;
          margin: 0 0 3px;
        }

        .db-section-sub {
          font-family: 'Inter', sans-serif;
          font-size: 12px; color: rgba(255,255,255,0.28);
          margin: 0;
        }

        .db-view-all {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 700;
          color: #00c2a8; text-decoration: none;
          padding: 6px 13px; border-radius: 8px;
          border: 1px solid rgba(0,194,168,0.22);
          background: rgba(0,194,168,0.07);
          transition: background 0.2s, border-color 0.2s;
          white-space: nowrap; flex-shrink: 0;
        }
        .db-view-all:hover {
          background: rgba(0,194,168,0.14);
          border-color: rgba(0,194,168,0.38);
        }

        /* ── Lead rows ── */
        .db-lead-row {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        .db-lead-row:last-child { border-bottom: none; }
        .db-lead-row:hover { background: rgba(255,255,255,0.025); }

        @media (max-width: 600px) {
          .db-lead-row { padding: 12px 16px; gap: 10px; flex-wrap: wrap; }
          .db-lead-priority { display: none; }
          .db-time { display: none; }
        }

        .db-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #1d4ed8, #00c2a8);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 800; color: #fff;
          flex-shrink: 0;
        }

        .db-lead-info { flex: 1; min-width: 0; }

        .db-lead-name {
          font-family: 'Inter', sans-serif;
          font-size: 13.5px; font-weight: 700; color: #fff;
          text-decoration: none; display: block;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.15s;
        }
        .db-lead-name:hover { color: #00c2a8; }

        .db-lead-sub {
          font-family: 'Inter', sans-serif;
          font-size: 12px; color: rgba(255,255,255,0.28);
          margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .db-score {
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 800;
          min-width: 30px; text-align: center;
          letter-spacing: -0.5px;
        }
        .db-score-hot  { color: #f87171; }
        .db-score-warm { color: #fbbf24; }
        .db-score-good { color: #60a5fa; }
        .db-score-none { color: rgba(255,255,255,0.18); }

        .db-badge {
          display: inline-flex; align-items: center;
          padding: 3px 11px; border-radius: 99px;
          font-family: 'Inter', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }
        .db-badge-new      { background: rgba(0,194,168,0.12);  color: #5eead4; border: 1px solid rgba(0,194,168,0.25); }
        .db-badge-hot      { background: rgba(239,68,68,0.12);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
        .db-badge-warm     { background: rgba(251,191,36,0.12); color: #fde68a; border: 1px solid rgba(251,191,36,0.25); }
        .db-badge-cold     { background: rgba(99,102,241,0.12); color: #c4b5fd; border: 1px solid rgba(99,102,241,0.25); }
        .db-badge-low      { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.09); }
        .db-badge-def      { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.09); }

        .db-time {
          font-family: 'Inter', sans-serif;
          font-size: 11px; color: rgba(255,255,255,0.20);
          white-space: nowrap; min-width: 26px; text-align: right;
        }

        /* ── Empty state ── */
        .db-empty {
          padding: 56px 24px; text-align: center;
        }
        .db-empty-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(0,194,168,0.08);
          border: 1px solid rgba(0,194,168,0.15);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: rgba(0,194,168,0.6);
        }
        .db-empty p { color: rgba(255,255,255,0.28); font-size: 14px; margin: 0 0 12px; font-family: 'Inter', sans-serif; }
        .db-empty a { color: #00c2a8; font-size: 14px; font-weight: 600; text-decoration: none; }

        /* ── Sources panel ── */
        .db-sources-panel {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
        }

        .db-sources-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 17px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .db-sources-title {
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 800; color: #fff;
          margin: 0 0 3px;
        }

        .db-sources-sub {
          font-family: 'Inter', sans-serif;
          font-size: 12px; color: rgba(255,255,255,0.28);
          margin: 0;
        }

        .db-dots { display: flex; gap: 5px; }
        .db-dot  { width: 10px; height: 10px; border-radius: 50%; }

        .db-sources-body { padding: 18px 20px; }

        .db-src-row { margin-bottom: 16px; }
        .db-src-row:last-child { margin-bottom: 0; }

        .db-src-label {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 7px;
        }

        .db-src-name {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.65);
        }

        .db-src-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        .db-src-count {
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 800;
          color: rgba(255,255,255,0.5);
        }

        .db-src-bar-bg {
          height: 4px; border-radius: 99px;
          background: rgba(255,255,255,0.07);
        }

        .db-src-bar-fill { height: 4px; border-radius: 99px; }

        /* ── Spinner ── */
        @keyframes db-spin { to { transform: rotate(360deg); } }
        .db-spinner-wrap {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 320px; gap: 16px;
        }
        .db-spinner {
          width: 38px; height: 38px; border-radius: 50%;
          border: 2.5px solid rgba(0,194,168,0.15);
          border-top-color: #00c2a8;
          animation: db-spin 0.75s linear infinite;
        }
        .db-spinner-label {
          font-family: 'Inter', sans-serif;
          font-size: 14px; color: rgba(255,255,255,0.28);
        }
      `}</style>

      {loading ? (
        <div className="db-spinner-wrap">
          <div className="db-spinner" />
          <span className="db-spinner-label">Loading dashboard…</span>
        </div>
      ) : (
        <div>

          {/* ── Stats Row ── */}
          <div className="db-stats-grid">
            <StatsCard
              label="Total Leads"
              value={stats?.total_leads ?? 0}
              icon="👥"
              accent="blue"
              subtext="All time"
              badge={`+${stats?.new_today ?? 0} today`}
            />
            <StatsCard
              label="High Priority"
              value={stats?.hot_leads ?? 0}
              icon="🔴"
              accent="red"
              subtext="Score 75+"
              badge="Needs action"
            />
            <StatsCard
              label="Medium Priority"
              value={stats?.warm_leads ?? 0}
              icon="🟡"
              accent="amber"
              subtext="Warming up"
              badge="Score 50–74"
            />
            <StatsCard
              label="Avg Score"
              value={stats?.average_score ?? 0}
              icon="⭐"
              accent="green"
              subtext="Out of 100"
              badge={`${stats?.average_score ?? 0} avg`}
            />
          </div>

          {/* ── Bottom Row ── */}
          <div className="db-bottom-row">

            {/* Recent Leads */}
            <div className="db-section">
              <div className="db-section-header">
                <div>
                  <p className="db-section-title">Recent Leads</p>
                  <p className="db-section-sub">Last 5 added to system</p>
                </div>
                <Link href="/leads" className="db-view-all">
                  View all →
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              </div>

              {!stats?.recent_leads?.length ? (
                <div className="db-empty">
                  <div className="db-empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <p>No leads yet</p>
                  <Link href="/leads">Import your first leads →</Link>
                </div>
              ) : (
                stats.recent_leads.map((lead: Lead) => {
                  const priority = lead.priority ? priorityConfig[lead.priority] : null;
                  const status   = statusConfig[lead.status];

                  const priorityClassMap: Record<string, string> = {
                    hot:  'db-badge db-badge-hot',
                    warm: 'db-badge db-badge-warm',
                    cold: 'db-badge db-badge-cold',
                    low:  'db-badge db-badge-low',
                  };
                  const statusClassMap: Record<string, string> = {
                    new:       'db-badge db-badge-new',
                    cold:      'db-badge db-badge-cold',
                    contacted: 'db-badge db-badge-warm',
                    qualified: 'db-badge db-badge-hot',
                    converted: 'db-badge db-badge-new',
                    lost:      'db-badge db-badge-low',
                  };

                  const score = lead.score ?? 0;
                  const scoreClass =
                    score >= 75 ? 'db-score db-score-hot'  :
                    score >= 50 ? 'db-score db-score-warm' :
                    score  >  0 ? 'db-score db-score-good' : 'db-score db-score-none';

                  return (
                    <div key={lead.id} className="db-lead-row">
                      <div className="db-avatar">{lead.name[0].toUpperCase()}</div>

                      <div className="db-lead-info">
                        <Link href={`/leads/${lead.id}`} className="db-lead-name">
                          {lead.name}
                        </Link>
                        <p className="db-lead-sub">
                          {lead.company || lead.email || lead.source}
                        </p>
                      </div>

                      <span className={scoreClass}>{lead.score ?? '—'}</span>

                      {priority && (
                        <span className={`db-lead-priority ${priorityClassMap[lead.priority as string] ?? 'db-badge db-badge-def'}`}>
                          {priority.label}
                        </span>
                      )}

                      <span className={statusClassMap[lead.status as string] ?? 'db-badge db-badge-def'}>
                        {status.label}
                      </span>

                      <span className="db-time">{timeAgo(lead.created_at)}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Lead Sources */}
            <div className="db-sources-panel">
              <div className="db-sources-head">
                <div>
                  <p className="db-sources-title">Lead Sources</p>
                  <p className="db-sources-sub">Breakdown by channel</p>
                </div>
                <div className="db-dots">
                  <div className="db-dot" style={{ background: '#3b82f6' }} />
                  <div className="db-dot" style={{ background: '#10b981' }} />
                  <div className="db-dot" style={{ background: '#f59e0b' }} />
                  <div className="db-dot" style={{ background: '#6b7280' }} />
                </div>
              </div>
              <div className="db-sources-body">
                {(stats?.source_breakdown ?? [
                  { name: 'LinkedIn', count: 4, color: '#3b82f6' },
                  { name: 'Email',    count: 3, color: '#10b981' },
                  { name: 'Upwork',   count: 2, color: '#f59e0b' },
                  { name: 'Manual',   count: 2, color: '#6b7280' },
                ]).map((src: { name: string; count: number; color: string }) => {
                  const total = (stats?.total_leads ?? 11) || 1;
                  const pct   = Math.round((src.count / total) * 100);
                  return (
                    <div key={src.name} className="db-src-row">
                      <div className="db-src-label">
                        <span className="db-src-name">
                          <span className="db-src-dot" style={{ background: src.color }} />
                          {src.name}
                        </span>
                        <span className="db-src-count">{src.count}</span>
                      </div>
                      <div className="db-src-bar-bg">
                        <div
                          className="db-src-bar-fill"
                          style={{ width: `${pct}%`, background: src.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </AppLayout>
  );
}