import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { authAPI } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

type Step = 'form' | 'verify';

const getStrength = (p: string) => {
  if (!p) return null;
  if (p.length < 6)  return { label: 'Too short', color: '#EF4444', w: '20%' };
  if (p.length < 10) return { label: 'Weak',      color: '#F97316', w: '45%' };
  if (p.length < 14) return { label: 'Good',      color: '#EAB308', w: '70%' };
  return               { label: 'Strong',     color: '#22C55E', w: '100%' };
};

export default function Signup() {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep]   = useState<Step>('form');
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirm: '' });
  const [code, setCode]   = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = getStrength(form.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Step 1 — validate + send code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim())          { setError('Please enter your full name'); return; }
    if (form.password.length < 6)   { setError('Password must be at least 6 characters'); return; }
    if (form.password.length > 70)  { setError('Password must be under 70 characters'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await authAPI.sendCode(form.email);
      setStep('verify');
      toast.success('Verification code sent!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify code + create account
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }

    setLoading(true);
    try {
      await authAPI.verifyCode(form.email, code);
      const res = await authAPI.signup({
        name: form.name, email: form.email, password: form.password,
      });
      login(res.data.access_token, res.data.user);
      toast.success('Welcome to BluQQ! 🎉');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authAPI.sendCode(form.email);
      toast.success('New code sent!');
      setCode('');
      setError('');
    } catch (err: any) {
      toast.error('Failed to resend');
    } finally {
      setResending(false);
    }
  };

  // ── Shared input style ──────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px 12px 42px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#F9FAFB',
    fontFamily: 'Inter, sans-serif', fontSize: '14px',
    outline: 'none', transition: 'all 0.2s',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sg-root { min-height: 100vh; display: flex; background: #0F172A; font-family: 'Inter', sans-serif; }

        /* Left panel */
        .sg-left {
          display: none; width: 50%; position: relative; overflow: hidden;
          background: linear-gradient(160deg, #0F172A 0%, #0F1F3D 100%);
          flex-direction: column; justify-content: center;
          align-items: flex-start; padding: 64px 72px;
        }
        @media(min-width:1024px){ .sg-left { display: flex; } }
        .sg-left::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 15% 25%, rgba(37,99,235,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 80% 75%, rgba(96,165,250,0.12) 0%, transparent 50%);
          pointer-events: none;
        }
        .sg-left::after {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px);
          background-size: 52px 52px; pointer-events: none;
        }
        .sg-orb-1 { position: absolute; top: -100px; right: -100px; width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 65%); pointer-events: none; }
        .sg-orb-2 { position: absolute; bottom: -80px; left: -60px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 65%); pointer-events: none; }
        .sg-left-content { position: relative; z-index: 2; width: 100%; }

        .sg-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 52px; }
        .sg-brand-mark {
          width: 42px; height: 42px; border-radius: 11px;
          background: linear-gradient(135deg, #2563EB, #60A5FA);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 18px; font-weight: 800; color: #fff;
        }
        .sg-brand-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 700; color: #F9FAFB; }

        .sg-headline { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 40px; font-weight: 800; line-height: 1.1; color: #F9FAFB; letter-spacing: -1px; margin-bottom: 18px; }
        .sg-headline em { font-style: normal; background: linear-gradient(135deg, #2563EB, #60A5FA); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .sg-sub { font-size: 15px; color: rgba(255,255,255,0.45); line-height: 1.7; max-width: 360px; margin-bottom: 48px; font-weight: 300; }

        .sg-features { display: flex; flex-direction: column; gap: 18px; margin-bottom: 48px; }
        .sg-feature { display: flex; align-items: flex-start; gap: 14px; }
        .sg-feature-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .sg-feature-title { font-size: 13px; font-weight: 600; color: #F9FAFB; margin-bottom: 2px; }
        .sg-feature-sub   { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.5; }

        .sg-stats { display: flex; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.02); }
        .sg-stat { flex: 1; padding: 18px 16px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06); }
        .sg-stat:last-child { border-right: none; }
        .sg-stat-val { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 700; color: #60A5FA; margin-bottom: 3px; }
        .sg-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; }

        /* Right panel */
        .sg-right {
          width: 100%; display: flex; align-items: center; justify-content: center;
          padding: 32px 24px; background: #070F1A; position: relative;
        }
        @media(min-width:1024px){ .sg-right { width: 50%; } }
        .sg-right::before {
          content: ''; position: absolute; top: 0; right: 0;
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 60%);
          pointer-events: none;
        }

        .sg-form-wrap { width: 100%; max-width: 420px; position: relative; z-index: 2; }

        .sg-mobile-logo { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 32px; }
        @media(min-width:1024px){ .sg-mobile-logo { display: none; } }
        .sg-mobile-brand-mark {
          width: 34px; height: 34px; border-radius: 8px;
          background: linear-gradient(135deg, #2563EB, #60A5FA);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800; color: #fff;
        }
        .sg-mobile-brand-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 700; color: #F9FAFB; }

        /* Step indicator */
        .sg-steps { display: flex; align-items: center; gap: 0; margin-bottom: 28px; }
        .sg-step {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 500;
        }
        .sg-step-circle {
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          transition: all 0.3s;
        }
        .sg-step-circle.done   { background: #2563EB; color: #fff; }
        .sg-step-circle.active { background: rgba(37,99,235,0.15); border: 1.5px solid #2563EB; color: #60A5FA; }
        .sg-step-circle.pending{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #4B5563; }
        .sg-step-label.done    { color: #6B7280; }
        .sg-step-label.active  { color: #93C5FD; font-weight: 600; }
        .sg-step-label.pending { color: #374151; }
        .sg-step-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); margin: 0 10px; }

        /* Form header */
        .sg-header { margin-bottom: 24px; }
        .sg-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 26px; font-weight: 700; color: #F9FAFB; letter-spacing: -0.5px; margin-bottom: 6px; }
        .sg-subtitle { font-size: 13px; color: #6B7280; }

        /* Card */
        .sg-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px; padding: 32px 28px;
        }

        .sg-label {
          display: block; font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.45); text-transform: uppercase;
          letter-spacing: 0.4px; margin-bottom: 7px;
        }
        .sg-field { position: relative; }
        .sg-field-icon {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          color: rgba(255,255,255,0.22); pointer-events: none;
          display: flex; align-items: center;
        }
        .sg-field-action {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: #4B5563; transition: color 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .sg-field-action:hover { color: #60A5FA; }
        .sg-field-indicator {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
        }

        .sg-input {
          width: 100%; padding: 12px 14px 12px 40px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #F9FAFB;
          font-family: 'Inter', sans-serif; font-size: 14px;
          outline: none; transition: all 0.2s;
        }
        .sg-input::placeholder { color: rgba(255,255,255,0.18); }
        .sg-input:focus {
          border-color: rgba(37,99,235,0.5);
          background: rgba(37,99,235,0.04);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
        }
        .sg-input.pr { padding-right: 52px; }

        .sg-strength-track { height: 3px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; margin-top: 8px; }
        .sg-strength-fill  { height: 100%; border-radius: 99px; transition: all 0.35s; }
        .sg-strength-lbl   { font-size: 11px; color: rgba(255,255,255,0.28); margin-top: 4px; }

        /* OTP input */
        .sg-otp-wrap { display: flex; gap: 10px; justify-content: center; margin: 8px 0; }
        .sg-otp-digit {
          width: 50px; height: 58px; text-align: center;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #F9FAFB;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px; font-weight: 700;
          outline: none; transition: all 0.2s; caret-color: #60A5FA;
        }
        .sg-otp-digit:focus {
          border-color: #2563EB;
          background: rgba(37,99,235,0.08);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .sg-otp-digit.filled { border-color: rgba(37,99,235,0.4); color: #93C5FD; }

        /* Submit */
        .sg-submit {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #2563EB, #60A5FA);
          border: none; border-radius: 10px; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; position: relative; overflow: hidden;
        }
        .sg-submit::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, #1E40AF, #2563EB);
          opacity: 0; transition: opacity 0.3s;
        }
        .sg-submit:hover::before { opacity: 1; }
        .sg-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.4); }
        .sg-submit:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
        .sg-submit span, .sg-submit svg { position: relative; z-index: 1; }
        .sg-btn-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }

        .sg-error {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 14px; margin-bottom: 18px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 9px; color: #FCA5A5; font-size: 12px; line-height: 1.5;
        }

        .sg-divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; }
        .sg-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .sg-divider-text { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 1px; text-transform: uppercase; }

        .sg-link-row { text-align: center; font-size: 13px; color: rgba(255,255,255,0.3); }
        .sg-link { color: #60A5FA; font-weight: 500; text-decoration: none; margin-left: 4px; transition: color 0.2s; }
        .sg-link:hover { color: #93C5FD; }

        .sg-footer { text-align: center; font-size: 11px; color: rgba(255,255,255,0.12); margin-top: 22px; letter-spacing: 0.3px; }

        @keyframes sg-spin { to { transform: rotate(360deg); } }
        .sg-spin { animation: sg-spin 0.8s linear infinite; }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0d1a2e inset !important;
          -webkit-text-fill-color: #F9FAFB !important;
          border-color: rgba(37,99,235,0.35) !important;
        }
      `}</style>

      <div className="sg-root">

        {/* ── LEFT PANEL ── */}
        <div className="sg-left">
          <div className="sg-orb-1" /><div className="sg-orb-2" />
          <div className="sg-left-content">

            <div className="sg-brand">
              <div className="sg-brand-mark">B</div>
              <span className="sg-brand-name">BluQQ</span>
            </div>

            <h2 className="sg-headline">
              Qualify leads<br />
              <em>10x faster</em><br />
              with AI
            </h2>
            <p className="sg-sub">
              Advanced AI automation for modern sales teams. Stop guessing, start closing.
            </p>

            <div className="sg-features">
              {[
                { icon: '⚡', title: 'Instant AI Qualification', sub: 'Score and prioritize every lead with GPT-4 powered analysis.' },
                { icon: '📊', title: 'Real-time Dashboard', sub: 'Track pipeline health and conversion rates live.' },
                { icon: '🎯', title: 'Hybrid Scoring', sub: 'Business rules + AI combined for accurate lead scores.' },
              ].map((f, i) => (
                <div className="sg-feature" key={i}>
                  <div className="sg-feature-icon">{f.icon}</div>
                  <div>
                    <div className="sg-feature-title">{f.title}</div>
                    <div className="sg-feature-sub">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sg-stats">
              {[
                { v: '50+',   l: 'Leads Analyzed' },
                { v: 'GPT-4', l: 'AI Powered'     },
                { v: '4×',    l: 'Faster Qualify' },
              ].map((s, i) => (
                <div className="sg-stat" key={i}>
                  <div className="sg-stat-val">{s.v}</div>
                  <div className="sg-stat-lbl">{s.l}</div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="sg-right">
          <div className="sg-form-wrap">

            {/* Mobile logo */}
            <div className="sg-mobile-logo">
              <div className="sg-mobile-brand-mark">B</div>
              <span className="sg-mobile-brand-name">BluQQ</span>
            </div>

            {/* Step indicator */}
            <div className="sg-steps">
              <div className="sg-step">
                <div className={`sg-step-circle ${step === 'form' ? 'active' : 'done'}`}>
                  {step === 'form' ? '1' : '✓'}
                </div>
                <span className={`sg-step-label ${step === 'form' ? 'active' : 'done'}`}>
                  Account details
                </span>
              </div>
              <div className="sg-step-line" />
              <div className="sg-step">
                <div className={`sg-step-circle ${step === 'verify' ? 'active' : 'pending'}`}>2</div>
                <span className={`sg-step-label ${step === 'verify' ? 'active' : 'pending'}`}>
                  Verify email
                </span>
              </div>
            </div>

            {/* Header */}
            <div className="sg-header">
              <h1 className="sg-title">
                {step === 'form' ? 'Create your account' : 'Check your inbox'}
              </h1>
              <p className="sg-subtitle">
                {step === 'form'
                  ? 'Start qualifying leads with AI in minutes'
                  : `We sent a 6-digit code to ${form.email}`
                }
              </p>
            </div>

            {/* ── STEP 1: Form ── */}
            {step === 'form' && (
              <div className="sg-card">
                {error && (
                  <div className="sg-error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSendCode}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Name */}
                    <div>
                      <label className="sg-label">Full Name</label>
                      <div className="sg-field">
                        <span className="sg-field-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                        </span>
                        <input type="text" name="name" value={form.name}
                          onChange={handleChange} placeholder="John Smith"
                          className="sg-input" required />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="sg-label">Email Address</label>
                      <div className="sg-field">
                        <span className="sg-field-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </span>
                        <input type="email" name="email" value={form.email}
                          onChange={handleChange} placeholder="you@company.com"
                          className="sg-input" required />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="sg-label">Password</label>
                      <div className="sg-field">
                        <span className="sg-field-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </span>
                        <input type={showPass ? 'text' : 'password'} name="password"
                          value={form.password} onChange={handleChange}
                          placeholder="Min. 6 characters"
                          className="sg-input pr" required />
                        <button type="button" className="sg-field-action"
                          onClick={() => setShowPass(!showPass)}>
                          {showPass ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {strength && (
                        <div>
                          <div className="sg-strength-track">
                            <div className="sg-strength-fill" style={{ width: strength.w, background: strength.color }} />
                          </div>
                          <p className="sg-strength-lbl">
                            Strength: <span style={{ color: strength.color }}>{strength.label}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm */}
                    <div>
                      <label className="sg-label">Confirm Password</label>
                      <div className="sg-field">
                        <span className="sg-field-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </span>
                        <input type={showConfirm ? 'text' : 'password'} name="confirm"
                          value={form.confirm} onChange={handleChange}
                          placeholder="Repeat password"
                          className="sg-input pr" required />
                        {form.confirm ? (
                          <span className="sg-field-indicator">
                            {form.password === form.confirm ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5"/>
                                <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.12)" stroke="#EF4444" strokeWidth="1.5"/>
                                <path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                              </svg>
                            )}
                          </span>
                        ) : (
                          <button type="button" className="sg-field-action"
                            onClick={() => setShowConfirm(!showConfirm)}>
                            {showConfirm ? 'Hide' : 'Show'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Submit */}
                    <button type="submit" className="sg-submit" disabled={loading} style={{ marginTop: '4px' }}>
                      {loading ? (
                        <span className="sg-btn-inner">
                          <svg className="sg-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                          <span>Sending code...</span>
                        </span>
                      ) : (
                        <span className="sg-btn-inner">
                          <span>Continue</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </span>
                      )}
                    </button>

                  </div>
                </form>

                <div className="sg-divider">
                  <div className="sg-divider-line" />
                  <span className="sg-divider-text">or</span>
                  <div className="sg-divider-line" />
                </div>
                <p className="sg-link-row">
                  Already have an account?
                  <Link href="/login" className="sg-link">Sign in →</Link>
                </p>
              </div>
            )}

            {/* ── STEP 2: Verify ── */}
            {step === 'verify' && (
              <div className="sg-card">
                {/* Email badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', marginBottom: '24px',
                  background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)',
                  borderRadius: '10px',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#93C5FD', fontWeight: 500 }}>
                    {form.email}
                  </span>
                  <button onClick={() => { setStep('form'); setCode(''); setError(''); }}
                    style={{ marginLeft: 'auto', fontSize: '11px', color: '#4B5563', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Change
                  </button>
                </div>

                {error && (
                  <div className="sg-error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerify}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div>
                      <label className="sg-label" style={{ textAlign: 'center', display: 'block', marginBottom: '14px' }}>
                        Enter 6-digit verification code
                      </label>
                      {/* OTP input — single field styled as 6 boxes */}
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={code}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, '');
                            setCode(v);
                            setError('');
                          }}
                          placeholder="000000"
                          style={{
                            width: '100%', padding: '16px 20px',
                            background: 'rgba(255,255,255,0.05)',
                            border: `1.5px solid ${code.length === 6 ? '#2563EB' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '12px', color: '#F9FAFB',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: '28px', fontWeight: 700,
                            letterSpacing: '0.35em', textAlign: 'center',
                            outline: 'none', transition: 'all 0.2s',
                          }}
                          onFocus={e => {
                            (e.target as HTMLElement).style.borderColor = '#2563EB';
                            (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                          }}
                          onBlur={e => {
                            if (code.length !== 6) {
                              (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                              (e.target as HTMLElement).style.boxShadow = 'none';
                            }
                          }}
                          required
                        />
                        {code.length === 6 && (
                          <div style={{
                            position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5"/>
                              <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#4B5563', textAlign: 'center', marginTop: '10px' }}>
                        Code expires in 15 minutes
                      </p>
                    </div>

                    <button type="submit" className="sg-submit" disabled={loading || code.length !== 6}>
                      {loading ? (
                        <span className="sg-btn-inner">
                          <svg className="sg-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                          <span>Verifying...</span>
                        </span>
                      ) : (
                        <span className="sg-btn-inner">
                          <span>Verify & Create Account</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </span>
                      )}
                    </button>

                    {/* Resend */}
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', color: '#4B5563', marginBottom: '6px' }}>
                        Didn't receive the code?
                      </p>
                      <button type="button" onClick={handleResend} disabled={resending}
                        style={{
                          background: 'none', border: 'none', cursor: resending ? 'not-allowed' : 'pointer',
                          fontSize: '12px', fontWeight: 600, color: resending ? '#374151' : '#60A5FA',
                          transition: 'color 0.2s',
                        }}>
                        {resending ? 'Sending...' : 'Resend code →'}
                      </button>
                    </div>

                  </div>
                </form>
              </div>
            )}

            <p className="sg-footer">© 2026 BluQQ — Build For Continuity</p>
          </div>
        </div>

      </div>
    </>
  );
}
