import Sidebar from './Sidebar';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: Props) {
  const { loading } = useAuth({ required: true });

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div className="bq-spinner" />
        <p style={{ fontSize: '13px', color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
          Loading BluQQ...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F172A' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {title && (
          <div style={{
            padding:      '20px 32px',
            borderBottom: '1px solid #1F2937',
            background:   '#111827',
          }}>
            <h1 style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize:   '20px',
              fontWeight: 700,
              color:      '#F9FAFB',
            }}>
              {title}
            </h1>
          </div>
        )}
        <div style={{ padding: '28px 32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}