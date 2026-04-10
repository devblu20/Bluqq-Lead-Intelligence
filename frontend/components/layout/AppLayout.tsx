import { useState } from 'react';
import Sidebar from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  children: React.ReactNode;
  title?:   string;
  greeting?: string;
}

export default function AppLayout({ children, title, greeting }: Props) {
  const { toggle, isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        .app-shell {
          display:    flex;
          height:     100vh;
          overflow:   hidden;
          background: #0e1320;
        }

        .app-main {
          flex:           1;
          display:        flex;
          flex-direction: column;
          min-width:      0;
          height:         100vh;
          overflow:       hidden;
        }

        /* ── Topbar ── */
        .app-topbar {
          height:          54px;
          background:      #111827;
          border-bottom:   1px solid rgba(255,255,255,0.07);
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         0 28px;
          flex-shrink:     0;
          gap:             12px;
        }

        .app-topbar-left {
          display:     flex;
          align-items: center;
          gap:         10px;
          min-width:   0;
        }

        .app-topbar-title {
          font-family:  'Sora', sans-serif;
          font-size:    19px;
          font-weight:  800;
          color:        #fff;
          letter-spacing: -0.5px;
          white-space:  nowrap;
        }

        .app-topbar-greeting {
          font-family: 'Inter', sans-serif;
          font-size:   13px;
          font-weight: 400;
          color:       rgba(255,255,255,0.32);
          white-space: nowrap;
        }

        .app-topbar-right {
          display:     flex;
          align-items: center;
          gap:         10px;
          flex-shrink: 0;
        }

        .app-date-pill {
          display:      flex;
          align-items:  center;
          gap:          7px;
          background:   rgba(255,255,255,0.05);
          border:       1px solid rgba(255,255,255,0.1);
          border-radius: 9px;
          padding:      7px 14px;
          font-family:  'Inter', sans-serif;
          font-size:    13px;
          color:        rgba(255,255,255,0.5);
        }

        .app-icon-btn {
          width:         36px;
          height:        36px;
          border-radius: 9px;
          background:    rgba(255,255,255,0.05);
          border:        1px solid rgba(255,255,255,0.1);
          display:       flex;
          align-items:   center;
          justify-content: center;
          cursor:        pointer;
          transition:    background 0.15s, border-color 0.15s;
          flex-shrink:   0;
        }

        .app-icon-btn:hover {
          background:   rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.18);
        }

        /* Hamburger — mobile only */
        .hamburger-btn {
          display:         none;
          align-items:     center;
          justify-content: center;
          width:           36px;
          height:          36px;
          border-radius:   8px;
          background:      rgba(255,255,255,0.05);
          border:          1px solid rgba(255,255,255,0.1);
          cursor:          pointer;
          color:           rgba(255,255,255,0.5);
          flex-shrink:     0;
          transition:      all 0.15s;
        }
        .hamburger-btn:hover { border-color: rgba(0,194,168,0.4); color: #00c2a8; }

        /* ── Content ── */
        .app-content {
          flex:       1;
          overflow-y: auto;
          overflow-x: hidden;
          background: #0e1320;
          padding:    24px 28px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.12) transparent;
        }

        .app-content::-webkit-scrollbar { width: 4px; }
        .app-content::-webkit-scrollbar-track { background: transparent; }
        .app-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }

        /* ── Mobile responsive ── */
        @media (max-width: 768px) {
          .hamburger-btn   { display: flex; }
          .app-topbar      { padding: 0 16px; }
          .app-topbar-title { font-size: 16px; }
          .app-topbar-greeting { display: none; }
          .app-date-pill   { display: none; }
          .app-content     { padding: 16px; }
        }

        @media (max-width: 480px) {
          .app-content { padding: 12px; }
        }
      `}</style>

      <div className="app-shell">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="app-main">
          <div className="app-topbar">
            <div className="app-topbar-left">
              <button
                className="hamburger-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <span className="app-topbar-title">{title || ''}</span>
              {greeting && (
                <span className="app-topbar-greeting">· {greeting}</span>
              )}
            </div>

            <div className="app-topbar-right">
              {/* Date pill */}
              <div className="app-date-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {today}
              </div>

              {/* Notification bell */}
              <div className="app-icon-btn" title="Notifications">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>

              {/* Theme toggle */}
              <div
                className="app-icon-btn"
                onClick={toggle}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ fontSize: 15, cursor: 'pointer' }}
              >
                {isDark ? '☀️' : '🌙'}
              </div>
            </div>
          </div>

          <div className="app-content">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}