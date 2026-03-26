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

  useEffect(() => {
    leadsAPI.getStats()
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Dashboard">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        /* ── Section card ── */
        .db-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          overflow: hidden;
          margin-bottom: 24px;
        }
        .db-section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 26px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .db-section-title {
          font-family: 'Sora', sans-serif;
          font-size: 17px; font-weight: 700; color: #fff;
          margin: 0 0 4px;
        }
        .db-section-sub {
          font-family: 'Inter', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.28);
          margin: 0;
        }
        .db-view-all {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 600;
          color: #00c2a8; text-decoration: none;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid rgba(0,194,168,0.2);
          background: rgba(0,194,168,0.06);
          transition: background 0.2s, border-color 0.2s;
        }
        .db-view-all:hover {
          background: rgba(0,194,168,0.14);
          border-color: rgba(0,194,168,0.38);
        }

        /* ── Lead rows ── */
        .db-lead-row {
          display: flex; align-items: center; gap: 16px;
          padding: 15px 26px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        .db-lead-row:last-child { border-bottom: none; }
        .db-lead-row:hover { background: rgba(255,255,255,0.025); }

        .db-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #00c2a8, #0057b8);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .db-lead-info { flex: 1; min-width: 0; }
        .db-lead-name {
          font-family: 'Inter', sans-serif;
          font-size: 15px; font-weight: 600; color: #fff;
          text-decoration: none; display: block;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.15s;
        }
        .db-lead-name:hover { color: #00c2a8; }
        .db-lead-sub {
          font-family: 'Inter', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.28);
          margin-top: 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .db-score {
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 800;
          min-width: 32px; text-align: center;
          letter-spacing: -0.5px;
        }
        .db-score-hot  { color: #f87171; }
        .db-score-warm { color: #fb923c; }
        .db-score-good { color: #60a5fa; }
        .db-score-none { color: rgba(255,255,255,0.18); }

        .db-badge {
          display: inline-flex; align-items: center;
          padding: 4px 12px; border-radius: 99px;
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.2px;
        }
        .db-badge-new  { background: rgba(0,194,168,0.12);  color: #5eead4; border: 1px solid rgba(0,194,168,0.25); }
        .db-badge-hot  { background: rgba(239,68,68,0.12);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
        .db-badge-warm { background: rgba(249,115,22,0.12); color: #fdba74; border: 1px solid rgba(249,115,22,0.25); }
        .db-badge-cold { background: rgba(99,102,241,0.12); color: '#c4b5fd'; border: 1px solid rgba(99,102,241,0.25); }
        .db-badge-low  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.09); }
        .db-badge-def  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.09); }

        .db-time {
          font-family: 'Inter', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.22);
          white-space: nowrap; min-width: 52px; text-align: right;
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

        /* ── Quick action cards ── */
        .db-action-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 900px) { .db-action-grid { grid-template-columns: 1fr; } }

        .db-action-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px 22px;
          display: flex; align-items: center; gap: 16px;
          text-decoration: none;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .db-action-card:hover {
          border-color: rgba(0,194,168,0.3);
          background: rgba(0,194,168,0.04);
          transform: translateY(-2px);
        }
        .db-action-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: rgba(0,194,168,0.1);
          border: 1px solid rgba(0,194,168,0.18);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: #00c2a8;
          transition: background 0.2s;
        }
        .db-action-card:hover .db-action-icon {
          background: rgba(0,194,168,0.18);
        }
        .db-action-title {
          font-family: 'Sora', sans-serif;
          font-size: 15px; font-weight: 700; color: #fff; margin: 0 0 4px;
          transition: color 0.2s;
        }
        .db-action-card:hover .db-action-title { color: #00c2a8; }
        .db-action-sub {
          font-family: 'Inter', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.3); margin: 0;
        }

        /* spinner */
        @keyframes db-spin { to { transform: rotate(360deg); } }
        .db-spinner-wrap {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; height: 260px; gap: 16px;
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Stats Row ── */}
          <div style={{ display: 'flex', gap: 16 }}>
            <StatsCard label="Total Leads"     value={stats?.total_leads    ?? 0} icon="👥" accent="blue"   subtext="All time"    />
            <StatsCard label="High Priority"   value={stats?.hot_leads      ?? 0} icon="🔴" accent="red"    subtext="Score 75+"   />
            <StatsCard label="Medium Priority" value={stats?.warm_leads     ?? 0} icon="🟡" accent="amber"  subtext="Score 50-74" />
            <StatsCard label="New Today"       value={stats?.new_today      ?? 0} icon="📅" accent="green"  subtext="Added today" />
            <StatsCard label="Avg Score"       value={stats?.average_score  ?? 0} icon="⭐" accent="purple" subtext="Out of 100"  />
          </div>

          {/* ── Recent Leads ── */}
          <div className="db-section">
            <div className="db-section-header">
              <div>
                <p className="db-section-title">Recent Leads</p>
                <p className="db-section-sub">Last 5 leads added to the system</p>
              </div>
              <Link href="/leads" className="db-view-all">
                View all
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  hot: 'db-badge db-badge-hot', warm: 'db-badge db-badge-warm',
                  cold: 'db-badge db-badge-cold', low: 'db-badge db-badge-low',
                };
                const statusClassMap: Record<string, string> = {
                  new: 'db-badge db-badge-new', cold: 'db-badge db-badge-cold',
                  contacted: 'db-badge db-badge-warm', qualified: 'db-badge db-badge-hot',
                  converted: 'db-badge db-badge-new', lost: 'db-badge db-badge-low',
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
                      <span className={priorityClassMap[lead.priority as string] ?? 'db-badge db-badge-def'}>
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

          {/* ── Quick Actions ── */}
          <div className="db-action-grid">
            <Link href="/leads" className="db-action-card">
              <div className="db-action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <p className="db-action-title">View All Leads</p>
                <p className="db-action-sub">Browse and filter leads</p>
              </div>
            </Link>

            <Link href="/leads/new" className="db-action-card">
              <div className="db-action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
              </div>
              <div>
                <p className="db-action-title">Add Lead Manually</p>
                <p className="db-action-sub">Enter lead details by hand</p>
              </div>
            </Link>

            <Link href="/leads?upload=true" className="db-action-card">
              <div className="db-action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <p className="db-action-title">Import CSV</p>
                <p className="db-action-sub">Bulk import from spreadsheet</p>
              </div>
            </Link>
          </div>

        </div>
      )}
    </AppLayout>
  );
}