import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import CSVUploadModal from '@/components/leads/CSVUploadModal';
import { leadsAPI } from '@/services/api';
import { Lead, PaginatedLeads } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';

const STATUSES   = ['', 'new', 'contacted', 'qualified', 'closed'];
const PRIORITIES = ['', 'Hot', 'Warm', 'Nurture', 'Low'];
const SOURCES    = ['', 'LinkedIn', 'Website', 'Email', 'Upwork', 'Manual'];

export default function LeadsPage() {
  const router = useRouter();

  const [data, setData]         = useState<PaginatedLeads | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showCSV, setShowCSV]   = useState(false);
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [priority, setPriority] = useState('');
  const [source, setSource]     = useState('');
  const [theme, setTheme]       = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (router.query.upload === 'true') setShowCSV(true);
  }, [router.query]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 10 };
      if (status)   params.status   = status;
      if (priority) params.priority = priority;
      if (source)   params.source   = source;
      const res = await leadsAPI.getAll(params);
      setData(res.data);
    } catch (err) {
      console.error('Leads fetch error:', err);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, status, priority, source]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await leadsAPI.delete(id);
      toast.success('Lead deleted');
      fetchLeads();
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const resetFilters = () => { setStatus(''); setPriority(''); setSource(''); setPage(1); };
  const hasFilters = status || priority || source;

  return (
    <AppLayout title="Leads">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

        /* ── Theme Variables ── */
        .lp-root[data-theme="dark"] {
          --bg-card:        rgba(255,255,255,0.03);
          --border:         rgba(255,255,255,0.07);
          --border-focus:   rgba(0,194,168,0.4);
          --text-primary:   #ffffff;
          --text-secondary: rgba(255,255,255,0.75);
          --text-muted:     rgba(255,255,255,0.45);
          --text-hint:      rgba(255,255,255,0.25);
          --text-label:     rgba(255,255,255,0.30);
          --select-bg:      rgba(255,255,255,0.05);
          --select-border:  rgba(255,255,255,0.10);
          --select-color:   rgba(255,255,255,0.70);
          --select-option:  #0d1a2e;
          --thead-bg:       rgba(255,255,255,0.03);
          --row-hover:      rgba(255,255,255,0.025);
          --row-border:     rgba(255,255,255,0.04);
          --th-color:       rgba(255,255,255,0.30);
          --page-btn-bg:    rgba(255,255,255,0.04);
          --page-btn-border:rgba(255,255,255,0.08);
          --page-btn-color: rgba(255,255,255,0.60);
          --toggle-bg:      rgba(255,255,255,0.06);
          --toggle-border:  rgba(255,255,255,0.10);
          --toggle-color:   rgba(255,255,255,0.50);
          --score-none:     rgba(255,255,255,0.2);
          --dash-color:     rgba(255,255,255,0.15);
          --source-manual-bg:    rgba(255,255,255,0.05);
          --source-manual-color: rgba(255,255,255,0.4);
          --source-manual-border:rgba(255,255,255,0.08);
        }

        .lp-root[data-theme="light"] {
          --bg-card:        #ffffff;
          --border:         rgba(0,0,0,0.08);
          --border-focus:   rgba(0,150,130,0.4);
          --text-primary:   #0f172a;
          --text-secondary: #334155;
          --text-muted:     #64748b;
          --text-hint:      #94a3b8;
          --text-label:     #475569;
          --select-bg:      #ffffff;
          --select-border:  rgba(0,0,0,0.12);
          --select-color:   #334155;
          --select-option:  #ffffff;
          --thead-bg:       rgba(0,0,0,0.02);
          --row-hover:      rgba(0,0,0,0.015);
          --row-border:     rgba(0,0,0,0.05);
          --th-color:       #94a3b8;
          --page-btn-bg:    #ffffff;
          --page-btn-border:rgba(0,0,0,0.10);
          --page-btn-color: #475569;
          --toggle-bg:      #ffffff;
          --toggle-border:  rgba(0,0,0,0.10);
          --toggle-color:   #475569;
          --score-none:     #cbd5e1;
          --dash-color:     #cbd5e1;
          --source-manual-bg:    rgba(0,0,0,0.04);
          --source-manual-color: #64748b;
          --source-manual-border:rgba(0,0,0,0.08);
        }

        /* ── Top bar ── */
        .lp-topbar {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 20px;
        }
        .lp-total {
          font-size: 13px;
          color: var(--text-hint);
          font-family: 'Inter', sans-serif;
        }
        .lp-actions { display: flex; gap: 10px; align-items: center; }

        /* Theme toggle */
        .lp-theme-toggle {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          background: var(--toggle-bg);
          border: 1px solid var(--toggle-border);
          border-radius: 10px;
          color: var(--toggle-color);
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .lp-theme-toggle:hover {
          border-color: var(--border-focus);
          color: var(--text-secondary);
        }

        .lp-btn-csv {
          padding: 9px 18px;
          background: linear-gradient(135deg, #7c3aed, #9333ea);
          color: #fff; border: none; border-radius: 10px;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
          display: flex; align-items: center; gap: 7px;
        }
        .lp-btn-csv:hover { opacity: 0.88; transform: translateY(-1px); }

        .lp-btn-add {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px;
          background: linear-gradient(135deg, #00c2a8, #0057b8);
          color: #fff; border: none; border-radius: 10px;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
        }
        .lp-btn-add:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Filters ── */
        .lp-filters {
          display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
          padding: 14px 18px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 18px;
        }
        .lp-root[data-theme="light"] .lp-filters {
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .lp-filter-label {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500;
          color: var(--text-label);
          font-family: 'Inter', sans-serif;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .lp-select {
          background: var(--select-bg);
          border: 1px solid var(--select-border);
          border-radius: 8px;
          color: var(--select-color);
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          padding: 6px 28px 6px 10px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s;
          appearance: none;
          background-repeat: no-repeat;
          background-position: right 8px center;
        }
        .lp-root[data-theme="dark"] .lp-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }
        .lp-root[data-theme="light"] .lp-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(0,0,0,0.3)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }
        .lp-select:focus { border-color: var(--border-focus); }
        .lp-select option { background: var(--select-option); color: var(--text-primary); }

        .lp-clear {
          font-size: 12px; background: none; border: none;
          cursor: pointer; font-family: 'Inter', sans-serif;
          padding: 4px 8px; border-radius: 6px;
          transition: background 0.2s;
        }
        .lp-root[data-theme="dark"] .lp-clear { color: #f87171; }
        .lp-root[data-theme="light"] .lp-clear { color: #dc2626; }
        .lp-clear:hover { background: rgba(239,68,68,0.1); }

        /* ── Table card ── */
        .lp-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .lp-root[data-theme="light"] .lp-card {
          box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
        }

        /* ── Table ── */
        .lp-table { width: 100%; border-collapse: collapse; }
        .lp-thead tr {
          background: var(--thead-bg);
          border-bottom: 1px solid var(--border);
        }
        .lp-th {
          padding: 12px 20px;
          text-align: left;
          font-family: 'Inter', sans-serif;
          font-size: 10px; font-weight: 600;
          color: var(--th-color);
          text-transform: uppercase; letter-spacing: 0.8px;
          white-space: nowrap;
        }
        .lp-tbody tr {
          border-bottom: 1px solid var(--row-border);
          transition: background 0.15s;
        }
        .lp-tbody tr:last-child { border-bottom: none; }
        .lp-tbody tr:hover { background: var(--row-hover); }

        .lp-td {
          padding: 14px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--text-secondary);
          vertical-align: middle;
        }

        /* name cell */
        .lp-name-link {
          font-weight: 600;
          color: var(--text-primary);
          text-decoration: none; display: block;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .lp-name-link:hover { color: #00c2a8; }
        .lp-name-sub {
          font-size: 11px;
          color: var(--text-hint);
          margin-top: 2px;
        }

        /* source badges */
        .lp-source {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
          white-space: nowrap;
        }
        .lp-source-website  { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.25); }
        .lp-source-linkedin { background: rgba(0,119,181,0.15);  color: #3b82f6; border: 1px solid rgba(0,119,181,0.25); }
        .lp-source-email    { background: rgba(234,179,8,0.12);  color: #d97706; border: 1px solid rgba(234,179,8,0.2); }
        .lp-source-upwork   { background: rgba(20,184,166,0.12); color: #0d9488; border: 1px solid rgba(20,184,166,0.2); }
        .lp-source-manual   {
          background: var(--source-manual-bg);
          color: var(--source-manual-color);
          border: 1px solid var(--source-manual-border);
        }
        .lp-root[data-theme="dark"] .lp-source-email  { color: #fbbf24; }
        .lp-root[data-theme="dark"] .lp-source-upwork { color: #2dd4bf; }
        .lp-root[data-theme="dark"] .lp-source-linkedin { color: #60a5fa; }

        /* score */
        .lp-score {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700;
        }
        .lp-score-hot  { color: #ef4444; }
        .lp-score-warm { color: #f59e0b; }
        .lp-score-good { color: #3b82f6; }
        .lp-score-none { color: var(--score-none); }
        .lp-root[data-theme="dark"] .lp-score-hot  { color: #f87171; }
        .lp-root[data-theme="dark"] .lp-score-warm { color: #fb923c; }
        .lp-root[data-theme="dark"] .lp-score-good { color: #60a5fa; }

        /* priority / status badges */
        .lp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 11px; font-weight: 500;
          white-space: nowrap;
        }
        .lp-badge-hot  { background: rgba(239,68,68,0.12);  color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }
        .lp-badge-warm { background: rgba(249,115,22,0.12); color: #ea580c; border: 1px solid rgba(249,115,22,0.2); }
        .lp-badge-new  { background: rgba(0,194,168,0.12);  color: #0d9488; border: 1px solid rgba(0,194,168,0.2); }
        .lp-badge-cold { background: rgba(99,102,241,0.12); color: #4f46e5; border: 1px solid rgba(99,102,241,0.2); }
        .lp-badge-low  { background: var(--source-manual-bg); color: var(--text-muted); border: 1px solid var(--border); }
        .lp-badge-def  { background: var(--source-manual-bg); color: var(--text-hint);  border: 1px solid var(--border); }

        .lp-root[data-theme="dark"] .lp-badge-hot  { color: #f87171; }
        .lp-root[data-theme="dark"] .lp-badge-warm { color: #fb923c; }
        .lp-root[data-theme="dark"] .lp-badge-new  { color: #00c2a8; }
        .lp-root[data-theme="dark"] .lp-badge-cold { color: #a5b4fc; }

        .lp-time { font-size: 12px; color: var(--text-hint); white-space: nowrap; }

        /* action buttons */
        .lp-act-wrap { display: flex; gap: 6px; }
        .lp-btn-view {
          padding: 5px 14px; border-radius: 7px;
          font-size: 11px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          background: rgba(0,194,168,0.1);
          color: #00c2a8;
          border: 1px solid rgba(0,194,168,0.2);
          cursor: pointer; text-decoration: none;
          transition: background 0.2s;
          display: inline-flex; align-items: center;
        }
        .lp-root[data-theme="light"] .lp-btn-view { color: #0d9488; border-color: rgba(13,148,136,0.3); }
        .lp-btn-view:hover { background: rgba(0,194,168,0.2); }
        .lp-btn-del {
          padding: 5px 14px; border-radius: 7px;
          font-size: 11px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          background: rgba(239,68,68,0.08);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.18);
          cursor: pointer;
          transition: background 0.2s;
        }
        .lp-root[data-theme="light"] .lp-btn-del { color: #dc2626; }
        .lp-btn-del:hover { background: rgba(239,68,68,0.18); }

        /* empty state */
        .lp-empty { padding: 64px 24px; text-align: center; }
        .lp-empty-icon { font-size: 36px; margin-bottom: 12px; }
        .lp-empty-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px; font-weight: 600;
          color: var(--text-secondary); margin-bottom: 6px;
        }
        .lp-empty-sub { font-size: 13px; color: var(--text-hint); margin-bottom: 20px; }
        .lp-empty-actions { display: flex; gap: 10px; justify-content: center; }

        /* spinner */
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .lp-spinner-wrap { display: flex; align-items: center; justify-content: center; height: 200px; }
        .lp-spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid rgba(0,194,168,0.15);
          border-top-color: #00c2a8;
          animation: lp-spin 0.75s linear infinite;
        }

        /* pagination */
        .lp-pagination {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .lp-page-info { font-size: 12px; color: var(--text-hint); font-family: 'Inter', sans-serif; }
        .lp-page-btns { display: flex; gap: 8px; }
        .lp-page-btn {
          padding: 7px 16px; border-radius: 8px;
          font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif;
          background: var(--page-btn-bg);
          border: 1px solid var(--page-btn-border);
          color: var(--page-btn-color);
          cursor: pointer; transition: all 0.15s;
        }
        .lp-page-btn:hover:not(:disabled) {
          background: rgba(0,194,168,0.1);
          border-color: rgba(0,194,168,0.25);
          color: #00c2a8;
        }
        .lp-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>

      {showCSV && (
        <CSVUploadModal
          onClose={() => setShowCSV(false)}
          onSuccess={() => { fetchLeads(); setShowCSV(false); }}
        />
      )}

      <div className="lp-root" data-theme={theme}>
        {/* ── Top Bar ── */}
        <div className="lp-topbar">
          <p className="lp-total">
            {data ? `${data.total} total leads` : 'Loading...'}
          </p>
          <div className="lp-actions">

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="lp-theme-toggle"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Light
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  Dark
                </>
              )}
            </button>

            <button onClick={() => setShowCSV(true)} className="lp-btn-csv">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import CSV
            </button>
            <Link href="/leads/new" className="lp-btn-add">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Lead
            </Link>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="lp-filters">
          <span className="lp-filter-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filter
          </span>

          <select className="lp-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select className="lp-select" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All Priorities</option>
            {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select className="lp-select" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
            <option value="">All Sources</option>
            {SOURCES.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {hasFilters && (
            <button onClick={resetFilters} className="lp-clear">Clear ×</button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="lp-card">
          {loading ? (
            <div className="lp-spinner-wrap"><div className="lp-spinner" /></div>
          ) : !data?.leads?.length ? (
            <div className="lp-empty">
              <div className="lp-empty-icon">👥</div>
              <p className="lp-empty-title">
                {hasFilters ? 'No leads match your filters' : 'No leads yet'}
              </p>
              <p className="lp-empty-sub">
                {hasFilters ? 'Try adjusting your filters' : 'Import a CSV or add leads manually'}
              </p>
              {!hasFilters && (
                <div className="lp-empty-actions">
                  <button onClick={() => setShowCSV(true)} className="lp-btn-csv">Import CSV</button>
                  <Link href="/leads/new" className="lp-btn-add">Add Manually</Link>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="lp-table">
                <thead className="lp-thead">
                  <tr>
                    {['Name', 'Source', 'Service', 'Score', 'Priority', 'Status', 'Added', 'Actions'].map(h => (
                      <th key={h} className="lp-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="lp-tbody">
                  {data.leads.map((lead: Lead) => {
                    const srcKey = (lead.source || '').toLowerCase();
                    const sourceClass =
                      srcKey === 'website'  ? 'lp-source lp-source-website'  :
                      srcKey === 'linkedin' ? 'lp-source lp-source-linkedin' :
                      srcKey === 'email'    ? 'lp-source lp-source-email'    :
                      srcKey === 'upwork'   ? 'lp-source lp-source-upwork'   :
                                              'lp-source lp-source-manual';

                    const score = lead.score ?? 0;
                    const scoreClass =
                      score >= 75 ? 'lp-score lp-score-hot'  :
                      score >= 50 ? 'lp-score lp-score-warm' :
                      score  >  0 ? 'lp-score lp-score-good' : 'lp-score lp-score-none';

                    const priorityMap: Record<string, string> = {
                      hot:    'lp-badge lp-badge-hot',
                      warm:   'lp-badge lp-badge-warm',
                      nurture:'lp-badge lp-badge-cold',
                      low:    'lp-badge lp-badge-low',
                    };
                    const priorityClass = lead.priority
                      ? (priorityMap[lead.priority as string] ?? 'lp-badge lp-badge-def')
                      : 'lp-badge lp-badge-def';

                    const statusMap: Record<string, string> = {
                      new:       'lp-badge lp-badge-new',
                      contacted: 'lp-badge lp-badge-warm',
                      qualified: 'lp-badge lp-badge-hot',
                      closed:    'lp-badge lp-badge-cold',
                    };
                    const statusClass = statusMap[lead.status as string] ?? 'lp-badge lp-badge-def';

                    return (
                      <tr key={lead.id}>
                        {/* Name */}
                        <td className="lp-td">
                          <Link href={`/leads/${lead.id}`} className="lp-name-link">
                            {lead.name}
                          </Link>
                          {lead.company && <p className="lp-name-sub">{lead.company}</p>}
                        </td>

                        {/* Source */}
                        <td className="lp-td">
                          <span className={sourceClass}>{lead.source}</span>
                        </td>

                        {/* Service */}
                        <td className="lp-td">
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {lead.service_interest || '—'}
                          </span>
                        </td>

                        {/* Score */}
                        <td className="lp-td">
                          <span className={scoreClass}>{lead.score ?? '—'}</span>
                        </td>

                        {/* Priority */}
                        <td className="lp-td">
                          {lead.priority
                            ? <span className={priorityClass}>{lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}</span>
                            : <span style={{ color: 'var(--dash-color)', fontSize: 12 }}>—</span>
                          }
                        </td>

                        {/* Status */}
                        <td className="lp-td">
                          <span className={statusClass}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </span>
                        </td>

                        {/* Added */}
                        <td className="lp-td">
                          <span className="lp-time">
                            {lead.created_at
                              ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="lp-td">
                          <div className="lp-act-wrap">
                            <Link href={`/leads/${lead.id}`} className="lp-btn-view">View</Link>
                            <button onClick={() => handleDelete(lead.id)} className="lp-btn-del">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {data && data.total_pages > 1 && (
          <div className="lp-pagination">
            <p className="lp-page-info">
              Page {data.page} of {data.total_pages} — {data.total} total leads
            </p>
            <div className="lp-page-btns">
              <button
                className="lp-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >← Previous</button>
              <button
                className="lp-page-btn"
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}