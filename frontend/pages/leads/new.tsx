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
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
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
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : value,
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
  const barColor  = wordCount >= 50 ? '#22c55e' : wordCount >= 20 ? '#f59e0b' : '#0057b8';
  const barWidth  = `${Math.min(100, (wordCount / 50) * 100)}%`;
  const wordHint  = wordCount >= 50 ? 'Excellent detail'
                  : wordCount >= 20 ? 'Good — aim for 50+ words'
                  : 'Add more context for better scoring';

  // ── Shared styles ─────────────────────────────────────────────
  const card: React.CSSProperties = {
    background:   '#111827',
    border:       '1px solid #1f2937',
    borderRadius: '14px',
    padding:      '28px 28px 24px',
    marginBottom: '16px',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize:      '11px',
    fontWeight:    600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color:         '#4b5563',
    marginBottom:  '20px',
  };

  const fieldLabel: React.CSSProperties = {
    display:      'block',
    fontSize:     '14px',
    fontWeight:   500,
    color:        '#d1d5db',
    marginBottom: '8px',
  };

  const hint: React.CSSProperties = {
    fontSize:   '12px',
    color:      '#4b5563',
    marginTop:  '6px',
  };

  const inputBase = (name: string): React.CSSProperties => ({
    width:        '100%',
    padding:      '11px 14px',
    background:   '#1f2937',
    border:       `1.5px solid ${focused === name ? '#2563eb' : '#374151'}`,
    borderRadius: '10px',
    color:        '#f9fafb',
    fontSize:     '14px',
    outline:      'none',
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    transition:   'border-color 0.15s',
    appearance:   'none',
    WebkitAppearance: 'none',
  });

  const grid2: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:                 '16px',
  };

  const grid3: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap:                 '12px',
  };

  return (
    <AppLayout title="Add New Lead">
      <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '48px' }}>

        {/* Back */}
        <Link href="/leads" style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '6px',
          color:         '#6b7280',
          fontSize:      '14px',
          textDecoration:'none',
          marginBottom:  '24px',
        }}>
          ← Back to Leads
        </Link>

        <form onSubmit={handleSubmit}>

          {/* ── 1. IDENTITY ─────────────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Identity</p>
            <div style={grid2}>
              <div>
                <label style={fieldLabel}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input type="text" name="name" value={form.name}
                  onChange={handleChange} {...focus('name')}
                  placeholder="John Smith"
                  style={inputBase('name')} required />
              </div>
              <div>
                <label style={fieldLabel}>Company</label>
                <input type="text" name="company" value={form.company}
                  onChange={handleChange} {...focus('company')}
                  placeholder="Acme Corp"
                  style={inputBase('company')} />
              </div>
            </div>
          </div>

          {/* ── 2. CONTACT ──────────────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Contact Information</p>
            <div style={grid2}>
              <div>
                <label style={fieldLabel}>Email Address</label>
                <input type="email" name="email" value={form.email}
                  onChange={handleChange} {...focus('email')}
                  placeholder="john@company.com"
                  style={inputBase('email')} />
                <p style={hint}>Business domain scores higher than Gmail / Yahoo</p>
              </div>
              <div>
                <label style={fieldLabel}>Phone Number</label>
                <input type="text" name="phone" value={form.phone}
                  onChange={handleChange} {...focus('phone')}
                  placeholder="+1 555 000 0000"
                  style={inputBase('phone')} />
                <p style={hint}>Strongest single contact signal</p>
              </div>
            </div>
          </div>

          {/* ── 3. SOURCE & SERVICE ─────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Source & Service Interest</p>
            <div style={grid2}>
              <div>
                <label style={fieldLabel}>Lead Source</label>
                <div style={{ position: 'relative' }}>
                  <select name="source" value={form.source}
                    onChange={handleChange} {...focus('source')}
                    style={inputBase('source')}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6b7280',
                    pointerEvents: 'none', fontSize: '12px',
                  }}>▼</span>
                </div>
                <p style={hint}>LinkedIn · Upwork · Website · Email · Manual</p>
              </div>
              <div>
                <label style={fieldLabel}>Service Interest</label>
                <div style={{ position: 'relative' }}>
                  <select name="service_interest" value={form.service_interest}
                    onChange={handleChange} {...focus('service_interest')}
                    style={inputBase('service_interest')}>
                    <option value="">Select a service...</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6b7280',
                    pointerEvents: 'none', fontSize: '12px',
                  }}>▼</span>
                </div>
                <p style={hint}>AI Automation & Chatbot score highest</p>
              </div>
            </div>
          </div>

          {/* ── 4. BUYING SIGNALS ───────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Buying Signals</p>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '-12px', marginBottom: '16px' }}>
              Select all that apply
            </p>
            <div style={grid3}>
              {[
                { key: 'wants_demo',      label: 'Requesting Demo / Call', icon: '📅' },
                { key: 'has_pricing_ask', label: 'Asked About Pricing',    icon: '💰' },
                { key: 'has_urgency',     label: 'Urgent / ASAP',          icon: '⚡' },
              ].map(sig => {
                const active = (form as any)[sig.key];
                return (
                  <button key={sig.key} type="button"
                    onClick={() => toggle(sig.key)}
                    style={{
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      justifyContent: 'center',
                      gap:            '10px',
                      padding:        '20px 12px',
                      background:     active ? 'rgba(37,99,235,0.12)' : '#1f2937',
                      border:         `1.5px solid ${active ? '#2563eb' : '#374151'}`,
                      borderRadius:   '12px',
                      cursor:         'pointer',
                      transition:     'all 0.15s',
                    }}>
                    <span style={{ fontSize: '24px' }}>{sig.icon}</span>
                    <span style={{
                      fontSize:   '13px',
                      fontWeight: 500,
                      color:      active ? '#93c5fd' : '#d1d5db',
                      textAlign:  'center',
                      lineHeight: '1.4',
                    }}>
                      {sig.label}
                    </span>
                    <span style={{
                      fontSize:     '11px',
                      padding:      '3px 10px',
                      borderRadius: '20px',
                      background:   active ? 'rgba(37,99,235,0.2)' : '#111827',
                      color:        active ? '#60a5fa' : '#4b5563',
                      fontWeight:   500,
                    }}>
                      {active ? '✓ Selected' : 'Click to select'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 5. TIMELINE ─────────────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Timeline & Budget</p>
            <div style={grid3}>
              <div>
                <label style={fieldLabel}>Project Timeline</label>
                <div style={{ position: 'relative' }}>
                  <select name="timeline" value={form.timeline}
                    onChange={handleChange} {...focus('timeline')}
                    style={inputBase('timeline')}>
                    <option value="">Not specified</option>
                    {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6b7280',
                    pointerEvents: 'none', fontSize: '12px',
                  }}>▼</span>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Budget Range</label>
                <div style={{ position: 'relative' }}>
                  <select name="budget" value={form.budget}
                    onChange={handleChange} {...focus('budget')}
                    style={inputBase('budget')}>
                    <option value="">Not specified</option>
                    {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6b7280',
                    pointerEvents: 'none', fontSize: '12px',
                  }}>▼</span>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Team Size</label>
                <div style={{ position: 'relative' }}>
                  <select name="team_size" value={form.team_size}
                    onChange={handleChange} {...focus('team_size')}
                    style={inputBase('team_size')}>
                    <option value="">Not specified</option>
                    {TEAM_SIZES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6b7280',
                    pointerEvents: 'none', fontSize: '12px',
                  }}>▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 6. MESSAGE ──────────────────────────── */}
          <div style={card}>
            <p style={sectionLabel}>Message / Notes</p>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '-12px', marginBottom: '14px' }}>
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
              style={{
                ...inputBase('message'),
                resize:     'vertical',
                lineHeight: '1.7',
              }}
              required
            />
            {/* Word count progress */}
            <div style={{ marginTop: '10px' }}>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                fontSize:       '12px',
                marginBottom:   '6px',
              }}>
                <span style={{ color: barColor, fontWeight: 500 }}>
                  {wordCount} words — {wordHint}
                </span>
                <span style={{ color: '#374151' }}>50+ for best results</span>
              </div>
              <div style={{
                height:       '3px',
                background:   '#1f2937',
                borderRadius: '4px',
                overflow:     'hidden',
              }}>
                <div style={{
                  height:     '100%',
                  width:      barWidth,
                  background: barColor,
                  borderRadius: '4px',
                  transition: 'width 0.2s, background 0.3s',
                }} />
              </div>
            </div>
          </div>

          {/* ── ACTIONS ─────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <Link href="/leads" style={{
              flex:           1,
              textAlign:      'center',
              padding:        '14px',
              background:     'transparent',
              border:         '1.5px solid #374151',
              borderRadius:   '12px',
              color:          '#9ca3af',
              fontSize:       '15px',
              fontWeight:     500,
              textDecoration: 'none',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              Cancel
            </Link>
            <button type="submit" disabled={loading} style={{
              flex:           2,
              padding:        '14px',
              background:     loading ? '#1e3a5f' : '#1d4ed8',
              border:         'none',
              borderRadius:   '12px',
              color:          '#fff',
              fontSize:       '15px',
              fontWeight:     600,
              cursor:         loading ? 'not-allowed' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '8px',
              transition:     'background 0.15s',
            }}>
              {loading ? (
                <>
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24"
                    className="animate-spin">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"/>
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