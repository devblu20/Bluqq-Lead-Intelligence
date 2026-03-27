import Sidebar from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  children: React.ReactNode;
  title?:   string;
}

export default function AppLayout({ children, title }: Props) {
  const { theme, toggle, isDark } = useTheme();

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
          flex:       1;
          display:    flex;
          flex-direction: column;
          min-width:  0;
          overflow:   hidden;
        }
        .app-topbar {
          height:          56px;
          background:      var(--topbar-bg);
          border-bottom:   1px solid var(--topbar-border);
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         0 24px;
          flex-shrink:     0;
          transition:      background 0.25s ease, border-color 0.25s ease;
        }
        .app-topbar-title {
          font-family:  var(--font-heading);
          font-size:    16px;
          font-weight:  600;
          color:        var(--text-primary);
          transition:   color 0.25s ease;
        }
        .app-topbar-right {
          display:     flex;
          align-items: center;
          gap:         10px;
        }
        .app-content {
          flex:       1;
          overflow-y: auto;
          background: var(--bg-root);
          transition: background 0.25s ease;
        }
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
          font-size:       17px;
          transition:      all 0.2s ease;
          line-height:     1;
        }
        .theme-btn:hover {
          border-color: var(--blue-primary);
          background:   var(--blue-glow);
        }
      `}</style>

      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <div className="app-topbar">
            <span className="app-topbar-title">{title || ''}</span>
            <div className="app-topbar-right">
              {/* Theme toggle */}
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