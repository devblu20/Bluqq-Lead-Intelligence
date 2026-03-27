import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { href: '/leads', label: 'Leads', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { href: '/leads/new', label: 'Add Lead', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )},
];

const SETTINGS_NAV = [
  { href: '/settings/channels', label: 'Channels', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  )},
  { href: '/settings/ai-settings', label: 'AI Settings', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  )},
  { href: '/settings/knowledge', label: 'Knowledge Base', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
];

export default function Sidebar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <>
      <style>{`
        .sidebar {
          width: 240px; min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex; flex-direction: column; flex-shrink: 0;
          transition: background 0.25s ease, border-color 0.25s ease;
        }
        .sidebar-logo {
          padding: 20px 20px 18px;
          border-bottom: 1px solid var(--sidebar-border);
        }
        .sidebar-menu-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--sidebar-label);
          padding: 20px 20px 8px;
          font-family: 'Inter', sans-serif;
          transition: color 0.25s ease;
        }
        .sidebar-nav { padding: 0 10px; }
        .sidebar-link {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px;
          font-size: 13px; font-weight: 500;
          color: var(--sidebar-link);
          text-decoration: none;
          transition: all 0.15s ease;
          margin-bottom: 2px;
          font-family: 'Inter', sans-serif;
          border: 1px solid transparent;
        }
        .sidebar-link:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-link.active {
          background:   var(--sidebar-active-bg);
          color:        var(--sidebar-active-color);
          border-color: var(--sidebar-active-border);
        }
        .sidebar-link.active svg { stroke: var(--sidebar-active-color); }
        .sidebar-footer {
          padding: 16px 10px;
          border-top: 1px solid var(--sidebar-border);
          margin-top: auto;
        }
        .sidebar-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px; margin-bottom: 4px;
        }
        .sidebar-avatar {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #1E40AF, #2563EB);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif; flex-shrink: 0;
        }
        .sidebar-user-name  {
          font-size: 13px; font-weight: 600;
          color: var(--text-primary);
          font-family: 'Inter', sans-serif;
          transition: color 0.25s ease;
        }
        .sidebar-user-email {
          font-size: 11px; color: var(--text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;
          transition: color 0.25s ease;
        }
        .sidebar-logout {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 9px 12px; border-radius: 8px;
          background: none; border: none; cursor: pointer;
          color: var(--text-hint); font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif; transition: all 0.15s; text-align: left;
        }
        .sidebar-logout:hover { background: rgba(239,68,68,0.08); color: #EF4444; }
      `}</style>

      <aside className="sidebar">
        <div className="sidebar-logo">
          <Image src="/bluqq-logo.png" alt="BluQQ" width={130} height={50} style={{display:'block'}} />
        </div>

        <div>
          <p className="sidebar-menu-label">Menu</p>
          <nav className="sidebar-nav">
            {NAV.map(item => (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${router.pathname === item.href ? 'active' : ''}`}>
                {item.icon}{item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="sidebar-menu-label">Settings</p>
          <nav className="sidebar-nav">
            {SETTINGS_NAV.map(item => (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${router.pathname === item.href ? 'active' : ''}`}>
                {item.icon}{item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div style={{flex:1, minWidth:0}}>
              <div className="sidebar-user-name">{user?.name || 'User'}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}