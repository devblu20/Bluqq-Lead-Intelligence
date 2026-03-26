interface Props {
  label:    string;
  value:    string | number;
  icon:     string;
  accent:   string;
  subtext?: string;
}

const accentColors: Record<string, string> = {
  blue:   '#00c2a8',
  red:    '#f87171',
  amber:  '#fbbf24',
  green:  '#4ade80',
  purple: '#a78bfa',
};

const SvgIcon = ({ type, color }: { type: string; color: string }) => {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === '👥') return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === '🔴') return <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  if (type === '🟡') return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>;
  if (type === '📅') return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (type === '⭐') return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  return <span style={{ fontSize: 20 }}>{type}</span>;
};

export default function StatsCard({ label, value, icon, accent, subtext }: Props) {
  const color = accentColors[accent] ?? accentColors['blue'];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '22px 22px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
    }}>

      {/* Subtle glow blob top-right */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color,
        opacity: 0.07,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + '18',
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <SvgIcon type={icon} color={color} />
      </div>

      {/* Text */}
      <div>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.38)',
          textTransform: 'uppercase', letterSpacing: '0.9px',
          margin: '0 0 8px',
        }}>
          {label}
        </p>
        <p style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 36, fontWeight: 800,
          color: '#fff',
          lineHeight: 1,
          letterSpacing: '-1.5px',
          margin: '0 0 6px',
        }}>
          {value}
        </p>
        {subtext && (
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13, color: 'rgba(255,255,255,0.22)',
            margin: 0,
          }}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}