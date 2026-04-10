interface Props {
  label:    string;
  value:    string | number;
  icon:     string;
  accent:   string;
  subtext?: string;
  badge?:   string;
}

const accentColors: Record<string, string> = {
  blue:   '#3b82f6',
  red:    '#ef4444',
  amber:  '#f59e0b',
  green:  '#10b981',
  purple: '#a78bfa',
};

const accentLight: Record<string, string> = {
  blue:   '#60a5fa',
  red:    '#f87171',
  amber:  '#fbbf24',
  green:  '#34d399',
  purple: '#c4b5fd',
};

const badgeColors: Record<string, { bg: string; color: string; border: string }> = {
  blue:   { bg: 'rgba(74,222,128,0.12)',  color: '#86efac', border: 'rgba(74,222,128,0.2)' },
  red:    { bg: 'rgba(239,68,68,0.12)',   color: '#fca5a5', border: 'rgba(239,68,68,0.2)' },
  amber:  { bg: 'rgba(245,158,11,0.12)',  color: '#fde68a', border: 'rgba(245,158,11,0.2)' },
  green:  { bg: 'rgba(16,185,129,0.12)',  color: '#6ee7b7', border: 'rgba(16,185,129,0.2)' },
  purple: { bg: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: 'rgba(167,139,250,0.2)' },
};

const SvgIcon = ({ type, color }: { type: string; color: string }) => {
  const p = {
    width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  if (type === '👥') return (
    <svg {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
  if (type === '🔴') return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
  if (type === '🟡') return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
  if (type === '📅') return (
    <svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (type === '⭐') return (
    <svg {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  return <span style={{ fontSize: 18 }}>{type}</span>;
};

export default function StatsCard({ label, value, icon, accent, subtext, badge }: Props) {
  const base  = accentColors[accent]  ?? accentColors['blue'];
  const light = accentLight[accent]   ?? accentLight['blue'];
  const bdg   = badgeColors[accent]   ?? badgeColors['blue'];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 18,
      padding: '20px 20px 16px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top row: icon + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: base + '20',
          border: `1px solid ${base}38`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <SvgIcon type={icon} color={light} />
        </div>

        {badge && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            padding: '4px 9px',
            borderRadius: 7,
            background: bdg.bg,
            color: bdg.color,
            border: `1px solid ${bdg.border}`,
            lineHeight: 1.35,
            textAlign: 'right',
          }}>
            {badge}
          </div>
        )}
      </div>

      {/* Label */}
      <p style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 10, fontWeight: 700,
        color: 'rgba(255,255,255,0.30)',
        textTransform: 'uppercase',
        letterSpacing: '0.9px',
        margin: '0 0 7px',
      }}>
        {label}
      </p>

      {/* Value */}
      <p style={{
        fontFamily: 'Sora, sans-serif',
        fontSize: 36, fontWeight: 800,
        color: '#fff',
        lineHeight: 1,
        letterSpacing: '-1.5px',
        margin: '0 0 5px',
      }}>
        {value}
      </p>

      {/* Subtext */}
      {subtext && (
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          color: 'rgba(255,255,255,0.22)',
          margin: 0,
        }}>
          {subtext}
        </p>
      )}

      {/* Bottom accent bar */}
      <div style={{
        height: 3,
        borderRadius: 99,
        background: base,
        opacity: 0.55,
        marginTop: 18,
      }} />
    </div>
  );
}