import { useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import { leadsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const SOURCES   = ['LinkedIn', 'Website', 'Email', 'Upwork', 'Manual'];
const SERVICES  = [
  'AI Automation', 'Chatbot Development', 'Workflow Automation',
  'CRM Integration', 'Custom Software', 'Data Analytics',
  'Web Development', 'Mobile App', 'Document Parsing',
  'Web Scraping', 'Other',
];
const TIMELINES = [
  'Immediately', 'Within 1 week', 'Within 1 month',
  'Within 3 months', 'Within 6 months', 'Just exploring',
];
const BUDGETS   = [
  'Under $1,000', '$1,000 – $5,000', '$5,000 – $15,000',
  '$15,000 – $50,000', '$50,000+', 'Not sure yet',
];
const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '200+'];

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    source: 'Manual', service_interest: '',
    wants_demo: false, has_pricing_ask: false, has_urgency: false,
    timeline: '', budget: '', team_size: '',
    message: '',
  });

  const focus = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(null),
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const toggle = (key: string) =>
    setForm(prev => ({ ...prev, [key]: !(prev as any)[key] }));

  const buildMessage = () => {
    let msg = form.message.trim();
    const extras: string[] = [];
    if (form.wants_demo)      extras.push('Requested a demo/call/meeting to discuss further');
    if (form.has_pricing_ask) extras.push('Asked about pricing, cost and budget requirements');
    if (form.has_urgency)     extras.push('This is urgent and they need it ASAP immediately');
    if (form.timeline)        extras.push(`Project timeline: ${form.timeline}`);
    if (form.budget)          extras.push(`Budget: ${form.budget}`);
    if (form.team_size)       extras.push(`Team size: ${form.team_size}`);
    if (extras.length > 0)
      msg += `\n\n[Structured Details]\n${extras.join('\n')}`;
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      toast.error('Name and message are required');
      return;
    }
    setLoading(true);
    try {
      const res = await leadsAPI.create({
        name:             form.name,
        company:          form.company          || undefined,
        email:            form.email            || undefined,
        phone:            form.phone            || undefined,
        source:           form.source           as any,
        service_interest: form.service_interest || undefined,
        message:          buildMessage(),
      });
      toast.success('Lead created! AI scoring in progress 🤖');
      router.push(`/leads/${res.data.lead.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  const wordCount = form.message.split(' ').filter(Boolean).length;
  const barColor  = wordCount >= 50 ? '#22c55e' : wordCount >= 20 ? '#f59e0b' : '#2563eb';
  const barWidth  = `${Math.min(100, (wordCount / 50) * 100)}%`;
  const wordHint  = wordCount >= 50 ? 'Excellent detail'
                  : wordCount >= 20 ? 'Good — aim for 50+ words'
                  : 'Add more context for better scoring';

  return (
    <AppLayout title="Add New Lead">
      <style>{`
        .nl-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 28px 28px 24px;
          margin-bottom: 16px;
        }
        .nl-section-label {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-muted); margin-bottom: 20px;
        }
        .nl-field-label {
          display: block; font-size: 14px; font-weight: 500;
          color: var(--text-secondary); margin-bottom: 8px;
        }
        .nl-hint { font-size: 12px; color: var(--text-hint); margin-top: 6px; }
        .nl-sub  { font-size: 13px; color: var(--text-muted); margin-top: -12px; margin-bottom: 16px; }

        .nl-input {
          width: 100%; padding: 11px 14px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 14px; outline: none;
          box-sizing: border-box; font-family: inherit;
          transition: border-color 0.15s;
          appearance: none; -webkit-appearance: none;
        }
        .nl-input:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--blue-glow); }
        .nl-input::placeholder { color: var(--text-hint); }

        .nl-select-wrap { position: relative; }
        .nl-select-wrap::after {
          content: '▼'; position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%); color: var(--text-muted);
          font-size: 12px; pointer-events: none;
        }

        .nl-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .nl-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 640px) {
          .nl-grid-2, .nl-grid-3 { grid-template-columns: 1fr; }
        }

        /* Signal toggle buttons */
        .nl-signal-btn {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; padding: 20px 12px;
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
          border-radius: 12px; cursor: pointer;
          transition: all 0.15s;
        }
        .nl-signal-btn.active {
          background: rgba(37,99,235,0.1);
          border-color: #2563EB;
        }
        .nl-signal-label {
          font-size: 13px; font-weight: 500;
          color: var(--text-secondary);
          text-align: center; line-height: 1.4;
        }
        .nl-signal-btn.active .nl-signal-label { color: #93c5fd; }
        [data-theme="light"] .nl-signal-btn.active .nl-signal-label { color: #1d4ed8; }

        .nl-signal-pill {
          font-size: 11px; padding: 3px 10px;
          border-radius: 20px; font-weight: 500;
          background: var(--bg-card);
          color: var(--text-hint);
        }
        .nl-signal-btn.active .nl-signal-pill {
          background: rgba(37,99,235,0.2);
          color: #60a5fa;
        }
        [data-theme="light"] .nl-signal-btn.active .nl-signal-pill { color: #1d4ed8; }

        /* Word count */
        .nl-word-hint { font-size: 12px; font-weight: 500; }
        .nl-word-target { font-size: 12px; color: var(--text-hint); }
        .nl-word-bar-bg {
          height: 3px; background: var(--border);
          border-radius: 4px; overflow: hidden;
        }

        /* Cancel button */
        .nl-cancel {
          flex: 1; text-align: center; padding: 14px;
          background: transparent;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 15px; font-weight: 500;
          text-decoration: none;
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.15s, color 0.15s;
        }
        .nl-cancel:hover { border-color: var(--blue-primary); color: var(--text-primary); }

        .nl-back {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--text-muted); font-size: 14px;
          text-decoration: none; margin-bottom: 24px;
        }
        .nl-back:hover { color: var(--text-primary); }
      `}</style>

      <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '48px' }}>

        <Link href="/leads" className="nl-back">← Back to Leads</Link>

        <form onSubmit={handleSubmit}>

          {/* ── 1. IDENTITY ── */}
          <div className="nl-card">
            <p className="nl-section-label">Identity</p>
            <div className="nl-grid-2">
              <div>
                <label className="nl-field-label">
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input type="text" name="name" value={form.name}
                  onChange={handleChange} {...focus('name')}
                  placeholder="John Smith"
                  className="nl-input" required />
              </div>
              <div>
                <label className="nl-field-label">Company</label>
                <input type="text" name="company" value={form.company}
                  onChange={handleChange} {...focus('company')}
                  placeholder="Acme Corp"
                  className="nl-input" />
              </div>
            </div>
          </div>

          {/* ── 2. CONTACT ── */}
          <div className="nl-card">
            <p className="nl-section-label">Contact Information</p>
            <div className="nl-grid-2">
              <div>
                <label className="nl-field-label">Email Address</label>
                <input type="email" name="email" value={form.email}
                  onChange={handleChange} {...focus('email')}
                  placeholder="john@company.com"
                  className="nl-input" />
                <p className="nl-hint">Business domain scores higher than Gmail / Yahoo</p>
              </div>
              <div>
                <label className="nl-field-label">Phone Number</label>
                <input type="text" name="phone" value={form.phone}
                  onChange={handleChange} {...focus('phone')}
                  placeholder="+1 555 000 0000"
                  className="nl-input" />
                <p className="nl-hint">Strongest single contact signal</p>
              </div>
            </div>
          </div>

          {/* ── 3. SOURCE & SERVICE ── */}
          <div className="nl-card">
            <p className="nl-section-label">Source & Service Interest</p>
            <div className="nl-grid-2">
              <div>
                <label className="nl-field-label">Lead Source</label>
                <div className="nl-select-wrap">
                  <select name="source" value={form.source}
                    onChange={handleChange} {...focus('source')}
                    className="nl-input">
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="nl-hint">LinkedIn · Upwork · Website · Email · Manual</p>
              </div>
              <div>
                <label className="nl-field-label">Service Interest</label>
                <div className="nl-select-wrap">
                  <select name="service_interest" value={form.service_interest}
                    onChange={handleChange} {...focus('service_interest')}
                    className="nl-input">
                    <option value="">Select a service...</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="nl-hint">AI Automation & Chatbot score highest</p>
              </div>
            </div>
          </div>

          {/* ── 4. BUYING SIGNALS ── */}
          <div className="nl-card">
            <p className="nl-section-label">Buying Signals</p>
            <p className="nl-sub">Select all that apply</p>
            <div className="nl-grid-3">
              {[
                { key: 'wants_demo',      label: 'Requesting Demo / Call', icon: '📅' },
                { key: 'has_pricing_ask', label: 'Asked About Pricing',    icon: '💰' },
                { key: 'has_urgency',     label: 'Urgent / ASAP',          icon: '⚡' },
              ].map(sig => {
                const active = (form as any)[sig.key];
                return (
                  <button key={sig.key} type="button"
                    onClick={() => toggle(sig.key)}
                    className={`nl-signal-btn${active ? ' active' : ''}`}
                  >
                    <span style={{ fontSize: '24px' }}>{sig.icon}</span>
                    <span className="nl-signal-label">{sig.label}</span>
                    <span className="nl-signal-pill">
                      {active ? '✓ Selected' : 'Click to select'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 5. TIMELINE & BUDGET ── */}
          <div className="nl-card">
            <p className="nl-section-label">Timeline & Budget</p>
            <div className="nl-grid-3">
              {[
                { name: 'timeline',  label: 'Project Timeline', options: TIMELINES },
                { name: 'budget',    label: 'Budget Range',     options: BUDGETS   },
                { name: 'team_size', label: 'Team Size',        options: TEAM_SIZES },
              ].map(field => (
                <div key={field.name}>
                  <label className="nl-field-label">{field.label}</label>
                  <div className="nl-select-wrap">
                    <select name={field.name} value={(form as any)[field.name]}
                      onChange={handleChange} {...focus(field.name)}
                      className="nl-input">
                      <option value="">Not specified</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 6. MESSAGE ── */}
          <div className="nl-card">
            <p className="nl-section-label">Message / Notes</p>
            <p className="nl-sub">
              The AI reads this to detect intent, urgency, and qualification.
              More detail means a more accurate score.
            </p>
            <textarea
              name="message" value={form.message}
              onChange={handleChange} {...focus('message')}
              placeholder={
                'Describe what this lead said and what they need.\n\n' +
                'Include:\n' +
                '• What problem they want to solve\n' +
                '• Any specific requirements\n' +
                '• How they found you\n' +
                '• Any other relevant context'
              }
              rows={7}
              className="nl-input"
              style={{ resize: 'vertical', lineHeight: '1.7' }}
              required
            />
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="nl-word-hint" style={{ color: barColor }}>
                  {wordCount} words — {wordHint}
                </span>
                <span className="nl-word-target">50+ for best results</span>
              </div>
              <div className="nl-word-bar-bg">
                <div style={{ height: '100%', width: barWidth, background: barColor, borderRadius: '4px', transition: 'width 0.2s, background 0.3s' }} />
              </div>
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <Link href="/leads" className="nl-cancel">Cancel</Link>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '14px',
              background: loading ? 'rgba(37,99,235,0.5)' : '#1d4ed8',
              border: 'none', borderRadius: '12px',
              color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background 0.15s',
            }}>
              {loading ? (
                <>
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" className="animate-spin">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Creating lead...
                </>
              ) : 'Create Lead →'}
            </button>
          </div>

        </form>
      </div>
    </AppLayout>
  );
}