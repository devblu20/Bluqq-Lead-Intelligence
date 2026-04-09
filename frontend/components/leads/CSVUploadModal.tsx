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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .csv-spinner { animation: spin 0.8s linear infinite; }
        .csv-pulse   { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* ── Overlay ── */}
      <div
        onClick={phase !== 'processing' ? onClose : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* ── Modal box ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#0d1117',
            border: '1px solid #1F2937',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            fontFamily: "'Inter', sans-serif",
          }}
        >

          {/* Header */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid #1F2937'}}>
            <div>
              <h2 style={{margin:0, fontSize:'15px', fontWeight:700, color:'#F9FAFB'}}>
                {phase==='select' ? 'Import Leads from CSV' : phase==='processing' ? 'Processing Your Leads' : 'Import Complete'}
              </h2>
              <p style={{margin:'3px 0 0', fontSize:'12px', color:'#6B7280'}}>
                {phase==='select' ? 'Upload a CSV to bulk import leads' : phase==='processing' ? 'AI scoring is running automatically' : 'All leads have been scored and prioritized'}
              </p>
            </div>
            {phase !== 'processing' && (
              <button
                onClick={onClose}
                style={{background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:'20px', padding:'4px 8px', borderRadius:'6px', lineHeight:1}}
                onMouseOver={e=>(e.currentTarget.style.background='#1F2937')}
                onMouseOut={e=>(e.currentTarget.style.background='none')}
              >×</button>
            )}
          </div>

          {/* Body */}
          <div style={{padding:'20px'}}>

            {/* ── SELECT ── */}
            {phase === 'select' && (
              <div>
                {/* Info box */}
                <div style={{background:'rgba(0,87,184,0.12)', border:'1px solid rgba(0,87,184,0.3)', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px'}}>
                  <p style={{margin:'0 0 4px', fontSize:'12px', fontWeight:600, color:'#93C5FD'}}>Required columns</p>
                  <p style={{margin:'0 0 4px', fontSize:'12px', color:'#60A5FA', fontFamily:'monospace'}}>name, message</p>
                  <p style={{margin:0, fontSize:'11px', color:'#6B7280'}}>Optional: company, email, phone, source, service_interest</p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e=>{e.preventDefault();setDragging(true);}}
                  onDragLeave={()=>setDragging(false)}
                  onDrop={handleDrop}
                  onClick={()=>inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#2563EB' : file ? '#16A34A' : '#374151'}`,
                    borderRadius: '12px',
                    padding: '32px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragging ? 'rgba(37,99,235,0.08)' : file ? 'rgba(22,163,74,0.08)' : 'transparent',
                    transition: 'all 0.2s',
                    marginBottom: '14px',
                  }}
                >
                  <input ref={inputRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
                  {file ? (
                    <div>
                      <div style={{fontSize:'28px',marginBottom:'8px'}}>📄</div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:600,color:'#4ADE80'}}>{file.name}</p>
                      <p style={{margin:'0 0 8px',fontSize:'11px',color:'#6B7280'}}>{(file.size/1024).toFixed(1)} KB</p>
                      <button onClick={e=>{e.stopPropagation();setFile(null);}} style={{background:'none',border:'none',cursor:'pointer',color:'#F87171',fontSize:'12px'}}>Remove</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:'28px',marginBottom:'8px'}}>📂</div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:600,color:'#D1D5DB'}}>Drop your CSV here</p>
                      <p style={{margin:0,fontSize:'11px',color:'#6B7280'}}>or click to browse</p>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div style={{display:'flex',gap:'10px'}}>
                  <button
                    onClick={onClose}
                    style={{flex:1,padding:'10px',background:'transparent',border:'1px solid #374151',borderRadius:'10px',color:'#9CA3AF',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}
                    onMouseOver={e=>e.currentTarget.style.borderColor='#4B5563'}
                    onMouseOut={e=>e.currentTarget.style.borderColor='#374151'}
                  >Cancel</button>
                  <button
                    onClick={handleUpload}
                    disabled={!file}
                    style={{flex:1,padding:'10px',background:file?'#2563EB':'#1E3A5F',border:'none',borderRadius:'10px',color:file?'#fff':'#4B5563',fontSize:'13px',fontWeight:700,cursor:file?'pointer':'not-allowed',fontFamily:'Inter,sans-serif',transition:'background 0.15s'}}
                    onMouseOver={e=>{if(file)e.currentTarget.style.background='#1D4ED8';}}
                    onMouseOut={e=>{if(file)e.currentTarget.style.background='#2563EB';}}
                  >Import &amp; Score Leads</button>
                </div>
              </div>
            )}

            {/* ── PROCESSING ── */}
            {phase === 'processing' && (
              <div>
                {SCORING_STEPS.map((step) => {
                  const done   = currentStep > step.id;
                  const active = currentStep === step.id;
                  return (
                    <div key={step.id} style={{
                      display:'flex', alignItems:'center', gap:'12px',
                      padding:'10px 14px', borderRadius:'10px', marginBottom:'6px',
                      background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                      border: active ? '1px solid rgba(37,99,235,0.25)' : '1px solid transparent',
                      opacity: done ? 0.6 : active ? 1 : 0.3,
                      transition: 'all 0.3s',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width:'24px', height:'24px', borderRadius:'50%', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'11px', fontWeight:700,
                        background: done ? '#14532D' : active ? '#2563EB' : '#1F2937',
                        color: done ? '#4ADE80' : active ? '#fff' : '#4B5563',
                      }}>
                        {done ? '✓' : active ? (
                          <svg className="csv-spinner" width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <circle style={{opacity:0.25}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path style={{opacity:0.75}} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                        ) : step.id}
                      </div>
                      {/* Label */}
                      <span style={{fontSize:'13px', fontWeight:500, color: done?'#9CA3AF': active?'#F9FAFB':'#4B5563', flex:1}}>
                        {step.label}
                      </span>
                      {done   && <span style={{fontSize:'11px',color:'#4ADE80'}}>Done</span>}
                      {active && <span className="csv-pulse" style={{fontSize:'11px',color:'#60A5FA'}}>Running...</span>}
                    </div>
                  );
                })}

                {/* Progress bar */}
                <div style={{marginTop:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#6B7280',marginBottom:'6px'}}>
                    <span>Overall progress</span><span>{pct}%</span>
                  </div>
                  <div style={{height:'4px',background:'#1F2937',borderRadius:'99px',overflow:'hidden'}}>
                    <div style={{height:'100%',background:'#2563EB',borderRadius:'99px',width:`${pct}%`,transition:'width 0.5s ease'}}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {phase === 'done' && result && (
              <div>
                {/* Summary */}
                <div style={{background:'rgba(22,163,74,0.1)',border:'1px solid rgba(22,163,74,0.25)',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                  <p style={{margin:'0 0 12px',fontSize:'13px',fontWeight:600,color:'#4ADE80'}}>✓ {result.message}</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',textAlign:'center'}}>
                    {[
                      {label:'In File',  value:result.total_in_file, color:'#F9FAFB'},
                      {label:'Imported', value:result.imported,      color:'#4ADE80'},
                      {label:'Skipped',  value:result.skipped,       color:'#FBBF24'},
                    ].map(s=>(
                      <div key={s.label} style={{background:'rgba(0,0,0,0.3)',borderRadius:'8px',padding:'10px'}}>
                        <p style={{margin:'0 0 2px',fontSize:'22px',fontWeight:700,color:s.color}}>{s.value}</p>
                        <p style={{margin:0,fontSize:'11px',color:'#6B7280'}}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI note */}
                <div style={{background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:'10px',padding:'12px',display:'flex',gap:'8px',alignItems:'flex-start',marginBottom:'12px'}}>
                  <span style={{fontSize:'16px'}}>🤖</span>
                  <p style={{margin:0,fontSize:'12px',color:'#93C5FD',lineHeight:1.6}}>
                    AI scoring is running in the background. Scores and priorities will appear on your leads within 30–60 seconds.
                  </p>
                </div>

                {/* Errors */}
                {result.errors?.length > 0 && (
                  <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',padding:'12px',marginBottom:'12px'}}>
                    <p style={{margin:'0 0 8px',fontSize:'12px',fontWeight:600,color:'#F87171'}}>Skipped rows</p>
                    <div style={{maxHeight:'80px',overflowY:'auto'}}>
                      {result.errors.map((e:any,i:number)=>(
                        <p key={i} style={{margin:'0 0 4px',fontSize:'11px',color:'#F87171'}}>Row {e.row}: {e.reason}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={onClose}
                  style={{width:'100%',padding:'11px',background:'#2563EB',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}
                  onMouseOver={e=>e.currentTarget.style.background='#1D4ED8'}
                  onMouseOut={e=>e.currentTarget.style.background='#2563EB'}
                >View Leads →</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}