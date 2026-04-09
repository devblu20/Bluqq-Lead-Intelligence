import { useState } from 'react';
import Sidebar from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  children: React.ReactNode;
  title?:   string;
}

export default function AppLayout({ children, title }: Props) {
  const { toggle, isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <style>{`
        .app-shell {
          display:    flex;
          min-height: 100vh;
          background: var(--bg-root);
          transition: background 0.25s ease;
        }
        .app-main {
          flex:           1;
          display:        flex;
          flex-direction: column;
          min-width:      0;
          overflow:       hidden;
        }
        .app-topbar {
          height:          56px;
          background:      var(--topbar-bg);
          border-bottom:   1px solid var(--topbar-border);
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         0 20px;
          flex-shrink:     0;
          gap:             12px;
          transition:      background 0.25s ease, border-color 0.25s ease;
        }
        .app-topbar-left {
          display:     flex;
          align-items: center;
          gap:         12px;
          min-width:   0;
        }
        .app-topbar-title {
          font-family:   var(--font-heading);
          font-size:     15px;
          font-weight:   600;
          color:         var(--text-primary);
          white-space:   nowrap;
          overflow:      hidden;
          text-overflow: ellipsis;
          transition:    color 0.25s ease;
        }
        .app-topbar-right {
          display:     flex;
          align-items: center;
          gap:         8px;
          flex-shrink: 0;
        }
        .app-content {
          flex:       1;
          overflow-y: auto;
          background: var(--bg-root);
          transition: background 0.25s ease;
          /* Prevent horizontal overflow on mobile */
          overflow-x: hidden;
        }
        /* Hamburger — mobile only */
        .hamburger-btn {
          display:         none;
          align-items:     center;
          justify-content: center;
          width:           36px;
          height:          36px;
          border-radius:   8px;
          background:      var(--bg-card);
          border:          1px solid var(--border);
          cursor:          pointer;
          color:           var(--text-secondary);
          flex-shrink:     0;
          transition:      all 0.15s ease;
        }
        .hamburger-btn:hover { border-color: var(--blue-primary); color: var(--blue-primary); }
        /* Theme toggle */
        .theme-btn {
          display:         flex;
          align-items:     center;
          justify-content: center;
          width:           36px;
          height:          36px;
          border-radius:   8px;
          background:      var(--bg-card);
          border:          1px solid var(--border);
          cursor:          pointer;
          font-size:       16px;
          transition:      all 0.2s ease;
          line-height:     1;
          flex-shrink:     0;
        }
        .theme-btn:hover { border-color: var(--blue-primary); background: var(--blue-glow); }

        /* ── Mobile responsive ── */
        @media (max-width: 768px) {
          .hamburger-btn { display: flex; }
          .app-topbar { padding: 0 14px; }
          .app-topbar-title { font-size: 14px; }
          .app-content { padding-bottom: 16px; }
        }

        @media (max-width: 400px) {
          .app-topbar-title { font-size: 13px; }
        }
      `}</style>

      <div className="app-shell">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="app-main">
          <div className="app-topbar">
            <div className="app-topbar-left">
              {/* Hamburger — only visible on mobile */}
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
            </div>

            <div className="app-topbar-right">
              <button
                className="theme-btn"
                onClick={toggle}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
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
