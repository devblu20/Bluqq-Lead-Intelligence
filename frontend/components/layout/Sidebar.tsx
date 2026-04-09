import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useState, useEffect } from 'react';
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

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Close drawer on route change
  useEffect(() => { onClose(); }, [router.pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (href: string) => router.pathname === href;

  const sidebarContent = (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Image src="/bluqq-logo.png" alt="BluQQ" width={110} height={42} style={{display:'block'}} />
        {/* Close button — mobile only */}
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="sidebar-body">
        <p className="sidebar-menu-label">Menu</p>
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}>
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <p className="sidebar-menu-label">Settings</p>
        <nav className="sidebar-nav">
          {SETTINGS_NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}>
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="sidebar-user-info">
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
          <span className="sidebar-link-label">Sign out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        /* ── Desktop sidebar ── */
        .sidebar {
          width: 240px;
          min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          transition: background 0.25s ease, border-color 0.25s ease;
          position: relative;
          z-index: 10;
        }
        .sidebar-logo {
          padding: 18px 20px 16px;
          border-bottom: 1px solid var(--sidebar-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sidebar-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 4px;
          border-radius: 6px;
          line-height: 1;
        }
        .sidebar-close:hover { color: var(--text-primary); }
        .sidebar-body { flex: 1; overflow-y: auto; }
        .sidebar-menu-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--sidebar-label);
          padding: 18px 20px 8px;
          font-family: 'Inter', sans-serif;
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
          white-space: nowrap;
        }
        .sidebar-link:hover { background: var(--bg-hover); color: var(--text-primary); }
        .sidebar-link.active {
          background: var(--sidebar-active-bg);
          color: var(--sidebar-active-color);
          border-color: var(--sidebar-active-border);
        }
        .sidebar-link.active svg { stroke: var(--sidebar-active-color); }
        .sidebar-icon { display: flex; align-items: center; flex-shrink: 0; }
        .sidebar-link-label { flex: 1; }
        .sidebar-footer {
          padding: 16px 10px;
          border-top: 1px solid var(--sidebar-border);
        }
        .sidebar-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px; margin-bottom: 4px;
        }
        .sidebar-user-info { flex: 1; min-width: 0; }
        .sidebar-avatar {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #1E40AF, #2563EB);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .sidebar-user-name { font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: 'Inter', sans-serif; }
        .sidebar-user-email { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-logout {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 9px 12px; border-radius: 8px;
          background: none; border: none; cursor: pointer;
          color: var(--text-hint); font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif; transition: all 0.15s; text-align: left;
        }
        .sidebar-logout:hover { background: rgba(239,68,68,0.08); color: #EF4444; }

        /* ── Mobile overlay ── */
        .sidebar-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 40;
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .sidebar-drawer {
          display: none;
          position: fixed;
          top: 0; left: 0;
          height: 100vh;
          width: 280px;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          overflow-y: auto;
        }

        /* ── Tablet (768px – 1024px): icon-only sidebar ── */
        @media (max-width: 1024px) and (min-width: 769px) {
          .sidebar { width: 64px; }
          .sidebar-logo { padding: 18px 12px 16px; justify-content: center; }
          .sidebar-logo img { width: 32px !important; height: 32px !important; object-fit: contain; }
          .sidebar-menu-label { padding: 16px 8px 6px; text-align: center; font-size: 8px; }
          .sidebar-nav { padding: 0 6px; }
          .sidebar-link { padding: 10px; justify-content: center; gap: 0; }
          .sidebar-link-label { display: none; }
          .sidebar-user { padding: 8px; justify-content: center; }
          .sidebar-user-info { display: none; }
          .sidebar-logout { padding: 10px; justify-content: center; }
          .sidebar-logout span { display: none; }
          .sidebar-footer { padding: 12px 6px; }
        }

        /* ── Mobile (<= 768px): drawer ── */
        @media (max-width: 768px) {
          .sidebar { display: none; }

          .sidebar-overlay {
            display: block;
            opacity: ${mobileOpen ? '1' : '0'};
            pointer-events: ${mobileOpen ? 'auto' : 'none'};
          }

          .sidebar-drawer {
            display: flex;
            flex-direction: column;
            transform: translateX(${mobileOpen ? '0' : '-100%'});
            background: var(--sidebar-bg);
            border-right: 1px solid var(--sidebar-border);
          }

          .sidebar-drawer .sidebar {
            display: flex;
            width: 280px;
            min-height: 100vh;
            position: static;
          }

          .sidebar-close { display: flex; }
        }
      `}</style>

      {/* Desktop + Tablet: static sidebar */}
      {sidebarContent}

      {/* Mobile: drawer + overlay */}
      <div className="sidebar-overlay" onClick={onClose} />
      <div className="sidebar-drawer">
        {sidebarContent}
      </div>
    </>
  );
}
