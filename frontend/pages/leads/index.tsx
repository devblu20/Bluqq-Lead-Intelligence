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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        /* ── Top bar ── */
        .lp-topbar {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 20px;
        }
        .lp-total { font-size: 13px; color: var(--text-hint); font-family: 'Inter', sans-serif; }
        .lp-actions { display: flex; gap: 10px; align-items: center; }

        .lp-btn-csv {
          padding: 9px 18px;
          background: linear-gradient(135deg, #7c3aed, #9333ea);
          color: #fff; border: none; border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
          display: flex; align-items: center; gap: 7px;
        }
        .lp-btn-csv:hover { opacity: 0.88; transform: translateY(-1px); }

        .lp-btn-add {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px;
          background: #1d4ed8;
          color: #fff; border: none; border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
        }
        .lp-btn-add:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Filters — matches nl-card style from new.tsx ── */
        .lp-filters {
          display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
          padding: 14px 18px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          margin-bottom: 18px;
        }
        .lp-filter-label {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 600;
          color: var(--text-muted);
          font-family: 'Inter', sans-serif;
          text-transform: uppercase; letter-spacing: 0.1em;
        }

        /* matches nl-input from new.tsx */
        .lp-select {
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          padding: 7px 28px 7px 12px;
          outline: none; cursor: pointer;
          transition: border-color 0.15s;
          appearance: none; -webkit-appearance: none;
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }
        .lp-select:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--blue-glow); }
        .lp-select option { background: var(--bg-card); color: var(--text-primary); }

        .lp-clear {
          font-size: 12px; color: #ef4444; background: none; border: none;
          cursor: pointer; font-family: 'Inter', sans-serif;
          padding: 4px 8px; border-radius: 6px;
          transition: background 0.2s;
        }
        .lp-clear:hover { background: rgba(239,68,68,0.1); }

        /* ── Table card — matches nl-card ── */
        .lp-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .lp-table { width: 100%; border-collapse: collapse; }
        .lp-thead tr {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .lp-th {
          padding: 12px 20px; text-align: left;
          font-family: 'Inter', sans-serif;
          font-size: 10px; font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.1em;
          white-space: nowrap;
        }
        .lp-tbody tr {
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .lp-tbody tr:last-child { border-bottom: none; }
        .lp-tbody tr:hover { background: var(--bg-secondary); }
        .lp-td {
          padding: 14px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--text-secondary);
          vertical-align: middle;
        }

        /* name */
        .lp-name-link {
          font-weight: 600; color: var(--text-primary);
          text-decoration: none; display: block;
          transition: color 0.15s; white-space: nowrap;
        }
        .lp-name-link:hover { color: #2563eb; }
        .lp-name-sub { font-size: 11px; color: var(--text-hint); margin-top: 2px; }

        /* source badges */
        .lp-source {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 600; white-space: nowrap;
        }
        .lp-source-website  { background: rgba(139,92,246,0.12); color: #7c3aed; border: 1px solid rgba(139,92,246,0.2); }
        .lp-source-linkedin { background: rgba(37,99,235,0.12);  color: #1d4ed8; border: 1px solid rgba(37,99,235,0.2); }
        .lp-source-email    { background: rgba(234,179,8,0.12);  color: #b45309; border: 1px solid rgba(234,179,8,0.2); }
        .lp-source-upwork   { background: rgba(20,184,166,0.12); color: #0f766e; border: 1px solid rgba(20,184,166,0.2); }
        .lp-source-manual   { background: var(--bg-secondary); color: var(--text-muted); border: 1px solid var(--border); }
        [data-theme="dark"] .lp-source-website  { color: #a78bfa; }
        [data-theme="dark"] .lp-source-linkedin { color: #60a5fa; }
        [data-theme="dark"] .lp-source-email    { color: #fbbf24; }
        [data-theme="dark"] .lp-source-upwork   { color: #2dd4bf; }

        /* score */
        .lp-score { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; }
        .lp-score-hot  { color: #dc2626; }
        .lp-score-warm { color: #d97706; }
        .lp-score-good { color: #2563eb; }
        .lp-score-none { color: var(--text-hint); }
        [data-theme="dark"] .lp-score-hot  { color: #f87171; }
        [data-theme="dark"] .lp-score-warm { color: #fb923c; }
        [data-theme="dark"] .lp-score-good { color: #60a5fa; }

        /* badges */
        .lp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 11px; font-weight: 500; white-space: nowrap;
        }
        .lp-badge-hot  { background: rgba(239,68,68,0.10);  color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }
        .lp-badge-warm { background: rgba(249,115,22,0.10); color: #ea580c; border: 1px solid rgba(249,115,22,0.2); }
        .lp-badge-new  { background: rgba(20,184,166,0.10); color: #0f766e; border: 1px solid rgba(20,184,166,0.2); }
        .lp-badge-cold { background: rgba(99,102,241,0.10); color: #4338ca; border: 1px solid rgba(99,102,241,0.2); }
        .lp-badge-low  { background: var(--bg-secondary); color: var(--text-muted); border: 1px solid var(--border); }
        .lp-badge-def  { background: var(--bg-secondary); color: var(--text-hint);  border: 1px solid var(--border); }
        [data-theme="dark"] .lp-badge-hot  { color: #f87171; }
        [data-theme="dark"] .lp-badge-warm { color: #fb923c; }
        [data-theme="dark"] .lp-badge-new  { color: #2dd4bf; }
        [data-theme="dark"] .lp-badge-cold { color: #a5b4fc; }

        .lp-time { font-size: 12px; color: var(--text-hint); white-space: nowrap; }

        /* action buttons */
        .lp-act-wrap { display: flex; gap: 6px; }
        .lp-btn-view {
          padding: 5px 14px; border-radius: 8px;
          font-size: 11px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          background: rgba(37,99,235,0.08); color: #1d4ed8;
          border: 1.5px solid rgba(37,99,235,0.2);
          cursor: pointer; text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
          display: inline-flex; align-items: center;
        }
        .lp-btn-view:hover { background: rgba(37,99,235,0.15); border-color: rgba(37,99,235,0.35); }
        [data-theme="dark"] .lp-btn-view { color: #60a5fa; }

        .lp-btn-del {
          padding: 5px 14px; border-radius: 8px;
          font-size: 11px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          background: rgba(239,68,68,0.06); color: #dc2626;
          border: 1.5px solid rgba(239,68,68,0.15);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .lp-btn-del:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); }
        [data-theme="dark"] .lp-btn-del { color: #f87171; }

        /* empty */
        .lp-empty { padding: 64px 24px; text-align: center; }
        .lp-empty-icon { font-size: 36px; margin-bottom: 12px; }
        .lp-empty-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
        .lp-empty-sub { font-size: 13px; color: var(--text-hint); margin-bottom: 20px; }
        .lp-empty-actions { display: flex; gap: 10px; justify-content: center; }

        /* spinner */
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .lp-spinner-wrap { display: flex; align-items: center; justify-content: center; height: 200px; }
        .lp-spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid var(--border);
          border-top-color: #2563eb;
          animation: lp-spin 0.75s linear infinite;
        }

        /* pagination */
        .lp-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .lp-page-info { font-size: 12px; color: var(--text-hint); font-family: 'Inter', sans-serif; }
        .lp-page-btns { display: flex; gap: 8px; }
        .lp-page-btn {
          padding: 7px 16px; border-radius: 8px;
          font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif;
          background: transparent;
          border: 1.5px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer; transition: all 0.15s;
        }
        .lp-page-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; }
        .lp-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>

      {showCSV && (
        <CSVUploadModal
          onClose={() => setShowCSV(false)}
          onSuccess={() => { fetchLeads(); setShowCSV(false); }}
        />
      )}

      <div>
        {/* ── Top Bar ── */}
        <div className="lp-topbar">
          <p className="lp-total">
            {data ? `${data.total} total leads` : 'Loading...'}
          </p>
          <div className="lp-actions">
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                        <td className="lp-td">
                          <Link href={`/leads/${lead.id}`} className="lp-name-link">{lead.name}</Link>
                          {lead.company && <p className="lp-name-sub">{lead.company}</p>}
                        </td>
                        <td className="lp-td"><span className={sourceClass}>{lead.source}</span></td>
                        <td className="lp-td">
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{lead.service_interest || '—'}</span>
                        </td>
                        <td className="lp-td"><span className={scoreClass}>{lead.score ?? '—'}</span></td>
                        <td className="lp-td">
                          {lead.priority
                            ? <span className={priorityClass}>{lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}</span>
                            : <span style={{ color: 'var(--text-hint)', fontSize: 12 }}>—</span>}
                        </td>
                        <td className="lp-td">
                          <span className={statusClass}>{lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}</span>
                        </td>
                        <td className="lp-td">
                          <span className="lp-time">
                            {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </span>
                        </td>
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
            <p className="lp-page-info">Page {data.page} of {data.total_pages} — {data.total} total leads</p>
            <div className="lp-page-btns">
              <button className="lp-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Previous</button>
              <button className="lp-page-btn" onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}