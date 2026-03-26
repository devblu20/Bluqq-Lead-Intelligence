import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { leadsAPI } from '@/services/api';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

const SCORING_STEPS = [
  { id: 1, label: 'Parsing CSV file',              duration: 800  },
  { id: 2, label: 'Validating lead records',        duration: 1000 },
  { id: 3, label: 'Importing to database',          duration: 1200 },
  { id: 4, label: 'Analyzing contact signals',      duration: 1500 },
  { id: 5, label: 'Running AI qualification',       duration: 2000 },
  { id: 6, label: 'Calculating scores & priority',  duration: 1000 },
];

export default function CSVUploadModal({ onClose, onSuccess }: Props) {
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [phase, setPhase]         = useState<'select' | 'processing' | 'done'>('select');
  const [currentStep, setStep]    = useState(0);
  const [result, setResult]       = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file only');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
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
    setPhase('processing');
    setStep(0);

    try {
      // Run visual steps + API call in parallel
      const [res] = await Promise.all([
        leadsAPI.uploadCSV(file),
        runSteps()
      ]);

      setResult(res.data);
      setPhase('done');

      if (res.data.imported > 0) {
        toast.success(`${res.data.imported} leads imported!`);
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
      setPhase('select');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white">
              {phase === 'select'     ? 'Import Leads from CSV'  :
               phase === 'processing' ? 'Processing Your Leads'  :
               'Import Complete'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'select'     ? 'Upload a CSV to bulk import leads' :
               phase === 'processing' ? 'AI scoring is running automatically' :
               'All leads have been scored and prioritized'}
            </p>
          </div>
          {phase !== 'processing' && (
            <button onClick={onClose}
              className="text-gray-500 hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-lg">
              ×
            </button>
          )}
        </div>

        <div className="p-5">

          {/* ── SELECT PHASE ─────────────────────────────── */}
          {phase === 'select' && (
            <div className="space-y-4">

              {/* Format hint */}
              <div className="bg-[#003087]/20 border border-[#0057b8]/30 rounded-xl p-3">
                <p className="text-xs font-medium text-blue-300 mb-1">
                  Required columns
                </p>
                <p className="text-xs text-blue-400 font-mono">
                  name, message
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: company, email, phone, source, service_interest
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${dragging    ? 'border-[#0057b8] bg-[#0057b8]/10' :
                    file        ? 'border-green-600 bg-green-900/20'  :
                    'border-gray-700 hover:border-gray-500'
                  }`}
              >
                <input ref={inputRef} type="file" accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {file ? (
                  <div>
                    <div className="text-3xl mb-2">📄</div>
                    <p className="text-green-400 font-medium text-sm">{file.name}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-red-400 hover:text-red-300 mt-2">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl mb-2">📂</div>
                    <p className="text-gray-300 text-sm font-medium">
                      Drop your CSV here
                    </p>
                    <p className="text-gray-600 text-xs mt-1">or click to browse</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
                  Cancel
                </button>
                <button onClick={handleUpload} disabled={!file}
                  className="flex-1 py-2.5 bg-[#0057b8] hover:bg-[#003087] text-white font-semibold rounded-xl transition-all disabled:opacity-40 text-sm">
                  Import & Score Leads
                </button>
              </div>
            </div>
          )}

          {/* ── PROCESSING PHASE ─────────────────────────── */}
          {phase === 'processing' && (
            <div className="py-2 space-y-3">
              {SCORING_STEPS.map((step, i) => {
                const done    = currentStep > step.id;
                const active  = currentStep === step.id;
                const pending = currentStep < step.id;

                return (
                  <div key={step.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                      ${active  ? 'bg-[#0057b8]/15 border border-[#0057b8]/30' :
                        done    ? 'opacity-60' : 'opacity-30'
                      }`}
                  >
                    {/* Icon */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                      ${done   ? 'bg-green-800 text-green-300' :
                        active  ? 'bg-[#0057b8] text-white'     :
                        'bg-gray-800 text-gray-600'
                      }`}
                    >
                      {done ? '✓' : active ? (
                        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                      ) : step.id}
                    </div>

                    {/* Label */}
                    <span className={`text-sm font-medium
                      ${done   ? 'text-gray-400' :
                        active  ? 'text-white'    :
                        'text-gray-600'
                      }`}
                    >
                      {step.label}
                    </span>

                    {done && (
                      <span className="ml-auto text-xs text-green-500">Done</span>
                    )}
                    {active && (
                      <span className="ml-auto text-xs text-blue-400 animate-pulse">
                        Running...
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Overall progress</span>
                  <span>{Math.round((currentStep / SCORING_STEPS.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0057b8] rounded-full transition-all duration-500"
                    style={{ width: `${(currentStep / SCORING_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── DONE PHASE ───────────────────────────────── */}
          {phase === 'done' && result && (
            <div className="space-y-4">

              {/* Summary */}
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
                <p className="text-green-300 font-semibold text-sm mb-3">
                  ✓ {result.message}
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'In File',   value: result.total_in_file, color: 'text-white'       },
                    { label: 'Imported',  value: result.imported,      color: 'text-green-400'   },
                    { label: 'Skipped',   value: result.skipped,       color: 'text-yellow-400'  },
                  ].map(stat => (
                    <div key={stat.label} className="bg-black/20 rounded-lg p-3">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI scoring note */}
              <div className="bg-[#0057b8]/10 border border-[#0057b8]/20 rounded-xl p-3 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">🤖</span>
                <p className="text-xs text-blue-300 leading-relaxed">
                  AI scoring is running in the background. Scores and priorities
                  will appear on your leads within 30–60 seconds.
                </p>
              </div>

              {/* Errors */}
              {result.errors?.length > 0 && (
                <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-400 mb-2">
                    Skipped rows
                  </p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {result.errors.map((e: any, i: number) => (
                      <p key={i} className="text-xs text-red-400">
                        Row {e.row}: {e.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={onClose}
                className="w-full py-2.5 bg-[#0057b8] hover:bg-[#003087] text-white font-semibold rounded-xl transition-all text-sm">
                View Leads →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}