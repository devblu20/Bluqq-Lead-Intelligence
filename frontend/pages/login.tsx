import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authAPI } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm]         = useState({ email: '', password: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authAPI.login({ email: form.email, password: form.password });
      login(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed.';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lg-root {
          min-height: 100vh; display: flex;
          background: #0F172A; font-family: 'Inter', sans-serif;
        }

        .lg-left {
          display: none; width: 48%; position: relative;
          flex-direction: column; justify-content: center;
          padding: 64px 60px; overflow: hidden;
          background: #0F172A;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        @media(min-width:1024px){ .lg-left { display: flex; } }
        .lg-left::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 50% at 0% 30%, rgba(37,99,235,0.14) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 100% 70%, rgba(96,165,250,0.07) 0%, transparent 55%);
        }
        .lg-left::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .lg-left-inner { position: relative; z-index: 2; }

        .lg-brand { display: flex; align-items: center; gap: 11px; margin-bottom: 56px; }
        .lg-brand-mark {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #1D4ED8, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px; font-weight: 800; color: #fff;
        }
        .lg-brand-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 700; color: #E2E8F0; }

        .lg-headline {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 36px; font-weight: 800; line-height: 1.15;
          color: #F1F5F9; letter-spacing: -0.8px; margin-bottom: 16px;
        }
        .lg-headline em {
          font-style: normal;
          background: linear-gradient(135deg, #3B82F6, #93C5FD);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lg-sub { font-size: 14px; color: #64748B; line-height: 1.7; max-width: 340px; margin-bottom: 44px; }

        .lg-features { display: flex; flex-direction: column; gap: 16px; margin-bottom: 44px; }
        .lg-feature  { display: flex; align-items: flex-start; gap: 12px; }
        .lg-feature-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.15);
          display: flex; align-items: center; justify-content: center; font-size: 15px;
        }
        .lg-feature-title { font-size: 13px; font-weight: 600; color: #CBD5E1; margin-bottom: 2px; }
        .lg-feature-sub   { font-size: 12px; color: #475569; line-height: 1.5; }

        .lg-trust {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 18px 20px;
        }
        .lg-trust-stars { color: #3B82F6; font-size: 12px; letter-spacing: 2px; margin-bottom: 10px; }
        .lg-trust-quote { font-size: 13px; color: #475569; line-height: 1.7; font-style: italic; margin-bottom: 14px; }
        .lg-trust-author { display: flex; align-items: center; gap: 10px; }
        .lg-trust-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #1D4ED8, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lg-trust-name { font-size: 12px; font-weight: 600; color: #94A3B8; }
        .lg-trust-role { font-size: 11px; color: #475569; }

        /* RIGHT */
        .lg-right {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 40px 24px; background: #0F172A; position: relative;
        }
        .lg-right::before {
          content: ''; position: absolute; top: 0; right: 0;
          width: 280px; height: 280px; pointer-events: none;
          background: radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 60%);
        }

        .lg-form-wrap { width: 100%; max-width: 380px; position: relative; z-index: 2; }

        .lg-mobile-logo { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 30px; }
        @media(min-width:1024px){ .lg-mobile-logo { display: none; } }
        .lg-mobile-mark {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #1D4ED8, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; color: #fff;
        }
        .lg-mobile-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 700; color: #F1F5F9; }

        .lg-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.15);
          border-radius: 99px; padding: 5px 12px; margin-bottom: 20px;
        }
        .lg-badge-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #3B82F6;
          animation: lg-pulse 2s infinite;
        }
        @keyframes lg-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .lg-badge-text { font-size: 11px; font-weight: 500; color: #60A5FA; letter-spacing: 0.3px; }

        .lg-header { margin-bottom: 22px; }
        .lg-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 24px; font-weight: 700; color: #F1F5F9;
          letter-spacing: -0.4px; margin-bottom: 5px;
        }
        .lg-subtitle { font-size: 13px; color: #475569; }

        .lg-card {
          background: #111827;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 28px 26px;
        }

        .lg-error {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 13px; margin-bottom: 16px;
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18);
          border-radius: 8px; color: #FCA5A5; font-size: 12px; line-height: 1.5;
        }

        .lg-fields { display: flex; flex-direction: column; gap: 14px; }
        .lg-group  { display: flex; flex-direction: column; gap: 5px; }
        .lg-label-row { display: flex; justify-content: space-between; align-items: center; }
        .lg-label {
          font-size: 11px; font-weight: 600;
          color: #475569; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .lg-forgot { font-size: 11px; color: #3B82F6; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .lg-forgot:hover { color: #93C5FD; }

        .lg-field { position: relative; }
        .lg-field-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: #334155; pointer-events: none; display: flex; align-items: center;
        }
        .lg-field-action {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: #334155;
          transition: color 0.2s; font-family: 'Inter', sans-serif; padding: 3px 5px;
        }
        .lg-field-action:hover { color: #60A5FA; }

        .lg-input {
          width: 100%; padding: 11px 13px 11px 38px;
          background: #1E293B; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9px; color: #E2E8F0;
          font-family: 'Inter', sans-serif; font-size: 14px;
          outline: none; transition: all 0.2s;
        }
        .lg-input::placeholder { color: #334155; }
        .lg-input:focus {
          border-color: rgba(59,130,246,0.4);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
        }
        .lg-input.pr { padding-right: 48px; }

        .lg-submit {
          width: 100%; padding: 12px; border: none; border-radius: 9px;
          background: linear-gradient(135deg, #1D4ED8, #3B82F6);
          color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; margin-top: 2px;
        }
        .lg-submit:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(29,78,216,0.35); }
        .lg-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .lg-btn-inner { display: flex; align-items: center; justify-content: center; gap: 7px; }

        @keyframes lg-spin { to { transform: rotate(360deg); } }
        .lg-spin { animation: lg-spin 0.8s linear infinite; }

        .lg-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
        .lg-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.05); }
        .lg-divider-text { font-size: 11px; color: #334155; letter-spacing: 1px; text-transform: uppercase; }

        .lg-link-row { text-align: center; font-size: 13px; color: #334155; }
        .lg-link { color: #3B82F6; font-weight: 500; text-decoration: none; margin-left: 4px; transition: color 0.2s; }
        .lg-link:hover { color: #93C5FD; }

        .lg-footer { text-align: center; font-size: 11px; color: #1E293B; margin-top: 20px; }

        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1E293B inset !important;
          -webkit-text-fill-color: #E2E8F0 !important;
          border-color: rgba(59,130,246,0.3) !important;
        }
      `}</style>

      <div className="lg-root">

        {/* LEFT */}
        <div className="lg-left">
          <div className="lg-left-inner">

            <div className="lg-brand">
              <div className="lg-brand-mark">B</div>
              <span className="lg-brand-name">BluQQ</span>
            </div>

            <h2 className="lg-headline">
              Close deals<br />
              <em>smarter &</em><br />
              faster
            </h2>
            <p className="lg-sub">
              AI-powered lead intelligence that helps your team prioritize smarter and close more — every day.
            </p>

            <div className="lg-features">
              {[
                { icon: '🎯', title: 'Instant Lead Scoring',  sub: 'Rank every lead automatically with AI precision.' },
                { icon: '🤖', title: 'GPT-4 Analysis',        sub: 'Deep insights powered by the latest language models.' },
                { icon: '⚡', title: 'Next Best Action',      sub: 'Know exactly what to do next on every deal.' },
              ].map((f, i) => (
                <div className="lg-feature" key={i}>
                  <div className="lg-feature-icon">{f.icon}</div>
                  <div>
                    <div className="lg-feature-title">{f.title}</div>
                    <div className="lg-feature-sub">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg-trust">
              <div className="lg-trust-stars">★★★★★</div>
              <p className="lg-trust-quote">
                "BluQQ cut our lead qualification time in half. Our reps now focus on leads that actually close."
              </p>
              <div className="lg-trust-author">
                <div className="lg-trust-avatar">MR</div>
                <div>
                  <div className="lg-trust-name">Marcus R.</div>
                  <div className="lg-trust-role">VP of Sales, TechCorp</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT */}
        <div className="lg-right">
          <div className="lg-form-wrap">

            <div className="lg-mobile-logo">
              <div className="lg-mobile-mark">B</div>
              <span className="lg-mobile-name">BluQQ</span>
            </div>

            <div>
              <div className="lg-badge">
                <div className="lg-badge-dot" />
                <span className="lg-badge-text">Secure sign in</span>
              </div>
            </div>

            <div className="lg-header">
              <h1 className="lg-title">Welcome back</h1>
              <p className="lg-subtitle">Sign in to your BluQQ account to continue</p>
            </div>

            <div className="lg-card">
              {error && (
                <div className="lg-error">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="lg-fields">

                  <div className="lg-group">
                    <label className="lg-label">Email Address</label>
                    <div className="lg-field">
                      <span className="lg-field-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                      </span>
                      <input type="email" name="email" value={form.email}
                        onChange={handleChange} placeholder="you@company.com"
                        className="lg-input" required />
                    </div>
                  </div>

                  <div className="lg-group">
                    <div className="lg-label-row">
                      <label className="lg-label">Password</label>
                      <Link href="/forgot-password" className="lg-forgot">Forgot password?</Link>
                    </div>
                    <div className="lg-field">
                      <span className="lg-field-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </span>
                      <input type={showPass ? 'text' : 'password'} name="password"
                        value={form.password} onChange={handleChange}
                        placeholder="••••••••"
                        className="lg-input pr" required />
                      <button type="button" className="lg-field-action"
                        onClick={() => setShowPass(!showPass)}>
                        {showPass ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="lg-submit">
                    {loading ? (
                      <span className="lg-btn-inner">
                        <svg className="lg-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        <span>Signing in...</span>
                      </span>
                    ) : (
                      <span className="lg-btn-inner">
                        <span>Sign in</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </span>
                    )}
                  </button>

                </div>
              </form>

              <div className="lg-divider">
                <div className="lg-divider-line" />
                <span className="lg-divider-text">or</span>
                <div className="lg-divider-line" />
              </div>
              <p className="lg-link-row">
                Don&apos;t have an account?
                <Link href="/signup" className="lg-link">Create one free →</Link>
              </p>
            </div>

            <p className="lg-footer">© 2026 BluQQ — Build For Continuity</p>
          </div>
        </div>

      </div>
    </>
  );
}