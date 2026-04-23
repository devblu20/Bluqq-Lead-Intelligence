import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { leadsAPI } from '@/services/api';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

const SCORING_STEPS = [
  { id: 1, label: 'Parsing CSV file',             duration: 800  },
  { id: 2, label: 'Validating lead records',       duration: 1000 },
  { id: 3, label: 'Importing to database',         duration: 1200 },
  { id: 4, label: 'Analyzing contact signals',     duration: 1500 },
  { id: 5, label: 'Running AI qualification',      duration: 2000 },
  { id: 6, label: 'Calculating scores & priority', duration: 1000 },
];

export default function CSVUploadModal({ onClose, onSuccess }: Props) {
  const [file,        setFile]    = useState<File | null>(null);
  const [dragging,    setDragging]= useState(false);
  const [phase,       setPhase]   = useState<'select'|'processing'|'done'>('select');
  const [currentStep, setStep]    = useState(0);
  const [result,      setResult]  = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { toast.error('Please upload a .csv file only'); return; }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runSteps = async () => {
    for (let i = 0; i < SCORING_STEPS.length; i++) {
      setStep(i + 1);
      await new Promise(r => setTimeout(r, SCORING_STEPS[i].duration));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase('processing'); setStep(0);
    try {
      const [res] = await Promise.all([leadsAPI.uploadCSV(file), runSteps()]);
      setResult(res.data); setPhase('done');
      if (res.data.imported > 0) { toast.success(`${res.data.imported} leads imported!`); onSuccess(); }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
      setPhase('select');
    }
  };

  const pct = Math.round((currentStep / SCORING_STEPS.length) * 100);

  return (
    <>
      <style>{`
        @keyframes csv-spin  { to { transform: rotate(360deg); } }
        @keyframes csv-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .csv-spinner { animation: csv-spin  0.8s linear infinite; }
        .csv-pulse   { animation: csv-pulse 1.5s ease-in-out infinite; }

        /* ── Modal overlay ── */
        .csv-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }

        /* ── Modal box ── */
        .csv-modal {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%; max-width: 440px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.3);
          font-family: 'Inter', sans-serif;
        }

        /* ── Header ── */
        .csv-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
        }
        .csv-header-title {
          font-size: 15px; font-weight: 700;
          color: var(--text-primary); margin: 0 0 3px;
        }
        .csv-header-sub {
          font-size: 12px; color: var(--text-muted); margin: 0;
        }
        .csv-close-btn {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 20px;
          padding: 4px 8px; border-radius: 6px; line-height: 1;
          transition: background 0.15s, color 0.15s;
        }
        .csv-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* ── Body ── */
        .csv-body { padding: 20px; }

        /* Info box */
        .csv-info-box {
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(37,99,235,0.2);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
        }
        .csv-info-title { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #3b82f6; }
        .csv-info-cols  { margin: 0 0 4px; font-size: 12px; color: #2563eb; font-family: monospace; }
        [data-theme="light"] .csv-info-cols { color: #1d4ed8; }
        .csv-info-optional { margin: 0; font-size: 11px; color: var(--text-muted); }

        /* Drop zone */
        .csv-dropzone {
          border-radius: 12px; padding: 32px 20px;
          text-align: center; cursor: pointer;
          transition: all 0.2s; margin-bottom: 14px;
          border: 2px dashed var(--border);
          background: transparent;
        }
        .csv-dropzone:hover { border-color: var(--blue-primary); background: var(--blue-glow); }
        .csv-dropzone.dragging { border-color: #2563EB; background: rgba(37,99,235,0.08); }
        .csv-dropzone.has-file  { border-color: #16a34a; background: rgba(22,163,74,0.06); }

        .csv-drop-text {
          font-size: 13px; font-weight: 600;
          color: var(--text-primary); margin: 0 0 4px;
        }
        .csv-drop-sub {
          font-size: 11px; color: var(--text-muted); margin: 0;
        }
        .csv-file-name {
          font-size: 13px; font-weight: 600; color: #16a34a; margin: 0 0 4px;
        }
        [data-theme="light"] .csv-file-name { color: #15803d; }
        .csv-file-size { font-size: 11px; color: var(--text-muted); margin: 0 0 8px; }
        .csv-remove-btn {
          background: none; border: none; cursor: pointer;
          color: #ef4444; font-size: 12px;
        }

        /* Buttons */
        .csv-btn-cancel {
          flex: 1; padding: 10px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-secondary);
          font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: border-color 0.15s, color 0.15s;
        }
        .csv-btn-cancel:hover { border-color: var(--blue-primary); color: var(--text-primary); }

        .csv-btn-import {
          flex: 1; padding: 10px;
          background: #2563EB; border: none;
          border-radius: 10px; color: #fff;
          font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: background 0.15s, opacity 0.15s;
        }
        .csv-btn-import:disabled {
          background: var(--bg-hover);
          color: var(--text-hint);
          cursor: not-allowed;
        }
        .csv-btn-import:not(:disabled):hover { background: #1d4ed8; }

        /* Processing steps */
        .csv-step {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px; margin-bottom: 6px;
          border: 1px solid transparent;
          transition: all 0.3s;
        }
        .csv-step.active {
          background: rgba(37,99,235,0.10);
          border-color: rgba(37,99,235,0.25);
        }
        .csv-step-icon {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          background: var(--bg-hover);
          color: var(--text-hint);
        }
        .csv-step-icon.done   { background: #14532d; color: #4ade80; }
        .csv-step-icon.active { background: #2563EB; color: #fff; }
        .csv-step-label { font-size: 13px; font-weight: 500; color: var(--text-hint); flex: 1; }
        .csv-step-label.done   { color: var(--text-muted); }
        .csv-step-label.active { color: var(--text-primary); }
        .csv-step-done-tag   { font-size: 11px; color: #4ade80; }
        .csv-step-active-tag { font-size: 11px; color: #60a5fa; }

        /* Progress bar */
        .csv-progress-bar-bg {
          height: 4px; background: var(--border);
          border-radius: 99px; overflow: hidden;
        }
        .csv-progress-label { font-size: 11px; color: var(--text-muted); }

        /* Done state */
        .csv-done-success {
          background: rgba(22,163,74,0.08);
          border: 1px solid rgba(22,163,74,0.2);
          border-radius: 12px; padding: 16px; margin-bottom: 12px;
        }
        .csv-done-msg { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #4ade80; }
        [data-theme="light"] .csv-done-msg { color: #15803d; }

        .csv-stat-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 10px; text-align: center;
        }
        .csv-stat-val   { margin: 0 0 2px; font-size: 22px; font-weight: 700; }
        .csv-stat-label { margin: 0; font-size: 11px; color: var(--text-muted); }

        .csv-ai-note {
          background: rgba(37,99,235,0.06);
          border: 1px solid rgba(37,99,235,0.15);
          border-radius: 10px; padding: 12px;
          display: flex; gap: 8px; align-items: flex-start;
          margin-bottom: 12px;
        }
        .csv-ai-note p { margin: 0; font-size: 12px; color: #3b82f6; line-height: 1.6; }
        [data-theme="light"] .csv-ai-note p { color: #1d4ed8; }

        .csv-errors {
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; padding: 12px; margin-bottom: 12px;
        }
        .csv-errors-title { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #ef4444; }
        .csv-error-row { margin: 0 0 4px; font-size: 11px; color: #ef4444; }

        .csv-btn-view {
          width: 100%; padding: 11px;
          background: #2563EB; border: none;
          border-radius: 10px; color: #fff;
          font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }
        .csv-btn-view:hover { background: #1d4ed8; }
      `}</style>

      <div className="csv-overlay" onClick={phase !== 'processing' ? onClose : undefined}>
        <div className="csv-modal" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="csv-header">
            <div>
              <p className="csv-header-title">
                {phase === 'select'     ? 'Import Leads from CSV'    :
                 phase === 'processing' ? 'Processing Your Leads'    : 'Import Complete'}
              </p>
              <p className="csv-header-sub">
                {phase === 'select'     ? 'Upload a CSV to bulk import leads'         :
                 phase === 'processing' ? 'AI scoring is running automatically'        :
                                         'All leads have been scored and prioritized'}
              </p>
            </div>
            {phase !== 'processing' && (
              <button className="csv-close-btn" onClick={onClose}>×</button>
            )}
          </div>

          {/* Body */}
          <div className="csv-body">

            {/* ── SELECT ── */}
            {phase === 'select' && (
              <div>
                <div className="csv-info-box">
                  <p className="csv-info-title">Required columns</p>
                  <p className="csv-info-cols">name, message</p>
                  <p className="csv-info-optional">Optional: company, email, phone, source, service_interest</p>
                </div>

                <div
                  className={`csv-dropzone${dragging ? ' dragging' : file ? ' has-file' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                  {file ? (
                    <div>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                      <p className="csv-file-name">{file.name}</p>
                      <p className="csv-file-size">{(file.size / 1024).toFixed(1)} KB</p>
                      <button className="csv-remove-btn"
                        onClick={e => { e.stopPropagation(); setFile(null); }}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                      <p className="csv-drop-text">Drop your CSV here</p>
                      <p className="csv-drop-sub">or click to browse</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="csv-btn-cancel" onClick={onClose}>Cancel</button>
                  <button className="csv-btn-import" onClick={handleUpload} disabled={!file}>
                    Import &amp; Score Leads
                  </button>
                </div>
              </div>
            )}

            {/* ── PROCESSING ── */}
            {phase === 'processing' && (
              <div>
                {SCORING_STEPS.map(step => {
                  const done   = currentStep > step.id;
                  const active = currentStep === step.id;
                  return (
                    <div key={step.id}
                      className={`csv-step${active ? ' active' : ''}`}
                      style={{ opacity: done ? 0.6 : active ? 1 : 0.3 }}
                    >
                      <div className={`csv-step-icon${done ? ' done' : active ? ' active' : ''}`}>
                        {done ? '✓' : active ? (
                          <svg className="csv-spinner" width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                        ) : step.id}
                      </div>
                      <span className={`csv-step-label${done ? ' done' : active ? ' active' : ''}`}>
                        {step.label}
                      </span>
                      {done   && <span className="csv-step-done-tag">Done</span>}
                      {active && <span className="csv-pulse csv-step-active-tag">Running...</span>}
                    </div>
                  );
                })}

                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="csv-progress-label">Overall progress</span>
                    <span className="csv-progress-label">{pct}%</span>
                  </div>
                  <div className="csv-progress-bar-bg">
                    <div style={{ height: '100%', background: '#2563EB', borderRadius: '99px', width: `${pct}%`, transition: 'width 0.5s ease' }}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {phase === 'done' && result && (
              <div>
                <div className="csv-done-success">
                  <p className="csv-done-msg">✓ {result.message}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                    {[
                      { label: 'In File',  value: result.total_in_file, color: 'var(--text-primary)' },
                      { label: 'Imported', value: result.imported,      color: '#4ade80'              },
                      { label: 'Skipped',  value: result.skipped,       color: '#f59e0b'              },
                    ].map(s => (
                      <div key={s.label} className="csv-stat-box">
                        <p className="csv-stat-val" style={{ color: s.color }}>{s.value}</p>
                        <p className="csv-stat-label">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="csv-ai-note">
                  <span style={{ fontSize: '16px' }}>🤖</span>
                  <p>AI scoring is running in the background. Scores and priorities will appear on your leads within 30–60 seconds.</p>
                </div>

                {result.errors?.length > 0 && (
                  <div className="csv-errors">
                    <p className="csv-errors-title">Skipped rows</p>
                    <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
                      {result.errors.map((e: any, i: number) => (
                        <p key={i} className="csv-error-row">Row {e.row}: {e.reason}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button className="csv-btn-view" onClick={onClose}>View Leads →</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}