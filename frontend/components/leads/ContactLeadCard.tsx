import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';

interface Props {
  lead: any;
  onMessageSent?: () => void;
}

interface Message {
  direction: string;
  message: string;
  platform: string;
  created_at: string;
}

interface Channel {
  platform: string;
  is_active: boolean;
}

type ActiveView = null | 'compose' | 'call';

// ✅ Fixed: added 'busy' and 'no-answer' to match what Twilio actually returns
type CallStatus = 'idle' | 'initiating' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';

export default function ContactLeadCard({ lead, onMessageSent }: Props) {
  const [channels, setChannels]     = useState<Channel[]>([]);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [platform, setPlatform]     = useState<string | null>(null);
  const [msgText, setMsgText]       = useState('');
  const [sending, setSending]       = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(null);

  // ── Call state ───────────────────────────────────────────────
  const [callStatus, setCallStatus]     = useState<CallStatus>('idle');
  const [callSid, setCallSid]           = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes]       = useState('');
  const [callLogging, setCallLogging]   = useState(false);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/messages/channels').then(r => setChannels(r.data)).catch(() => {});
    api.get(`/messages/conversations/${lead.id}`).then(r => setMessages(r.data)).catch(() => {});
  }, [lead.id]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current)  clearInterval(pollRef.current);
  }, []);

  const hasWhatsApp  = channels.some(c => c.platform === 'whatsapp'  && c.is_active);
  const hasInstagram = channels.some(c => c.platform === 'instagram' && c.is_active);
  const hasPhone     = !!lead.phone;

  // ── Messaging ────────────────────────────────────────────────
  const openCompose = (pl: string) => {
    setPlatform(pl);
    setActiveView('compose');
    setMsgText(
      `Hi ${lead.name}, thanks for reaching out! I came across your enquiry about ${lead.service_interest || 'our services'} and wanted to follow up. Looking forward to connecting with you.`
    );
  };

  const handleSend = async () => {
    if (!platform || !msgText.trim()) return;
    setSending(true);
    try {
      await api.post('/messages/send', { lead_id: lead.id, platform, message: msgText });
      toast.success(`Message sent via ${platform}!`);
      setMsgText('');
      setActiveView(null);
      setPlatform(null);
      const r = await api.get(`/messages/conversations/${lead.id}`);
      setMessages(r.data);
      onMessageSent?.();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ── Call ─────────────────────────────────────────────────────
  const openCall = () => {
    setCallStatus('idle');
    setCallSid(null);
    setCallDuration(0);
    setCallNotes('');
    setActiveView('call');
  };

  const startTwilioCall = async () => {
    if (!lead.phone) {
      toast.error('No phone number for this lead!');
      return;
    }
    setCallStatus('initiating');
    try {
      const response = await api.post('/calls/outbound', {
        lead_phone: lead.phone,
        lead_name:  lead.name  || '',
        lead_id:    lead.id?.toString() || '',
      });

      const sid = response.data.call_sid;
      setCallSid(sid);
      setCallStatus('ringing');
      toast.success(`📞 Calling ${lead.name || lead.phone}...`);

      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/calls/status/${sid}`);
          // ✅ Cast to CallStatus — now includes 'busy' and 'no-answer'
          const status = statusRes.data.status as CallStatus;
          setCallStatus(status);

          if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }

            if (status === 'completed')  toast.success('Call completed!');
            else if (status === 'busy')      toast.error(`${lead.name} is busy`);
            else if (status === 'no-answer') toast.error(`${lead.name} did not answer`);
            else                             toast.error('Call failed');
          }
        } catch {
          // Poll error — ignore silently
        }
      }, 3000);

    } catch (err: any) {
      setCallStatus('failed');
      toast.error(err.response?.data?.detail || 'Could not place call');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ✅ Fully typed — no more ts(2367) overlap error
  const callStatusDisplay: Record<CallStatus, { color: string; text: string; emoji: string }> = {
    idle:          { color: '#374151', text: 'Ready to call', emoji: '📞' },
    initiating:    { color: '#F59E0B', text: 'Connecting...',  emoji: '⏳' },
    ringing:       { color: '#60A5FA', text: 'Ringing...',     emoji: '🔔' },
    'in-progress': { color: '#4ADE80', text: '● Live call',    emoji: '🎙️' },
    completed:     { color: '#4ADE80', text: '✓ Call ended',   emoji: '✅' },
    failed:        { color: '#F87171', text: '✗ Call failed',  emoji: '❌' },
    busy:          { color: '#F87171', text: '✗ Line busy',    emoji: '🔴' },
    'no-answer':   { color: '#F87171', text: '✗ No answer',    emoji: '📵' },
  };

  const isCallActive = callStatus === 'in-progress' || callStatus === 'ringing';
  const isCallDone   = callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer';
  const canLogCall   = isCallDone && callStatus === 'completed' && callDuration > 0;
  const canStartCall = callStatus === 'idle' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer';

  const handleLogCall = async () => {
    setCallLogging(true);
    try {
      await api.post(`/leads/${lead.id}/events`, {
        event_type: 'call_made',
        metadata: {
          duration_seconds: callDuration,
          notes:            callNotes.trim() || null,
          call_sid:         callSid,
          via:              'twilio_outbound',
        },
      });

      if (lead.status === 'new') {
        await api.patch(`/leads/${lead.id}`, { status: 'contacted' });
      }

      toast.success('Call logged!');
      setActiveView(null);
      setCallDuration(0);
      setCallNotes('');
      setCallSid(null);
      setCallStatus('idle');
      onMessageSent?.();
    } catch {
      toast.error('Failed to log call');
    } finally {
      setCallLogging(false);
    }
  };

  const cancelCall = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    setActiveView(null);
    setCallDuration(0);
    setCallNotes('');
    setCallSid(null);
    setCallStatus('idle');
  };

  return (
    <>
      <style>{`
        .clc-wrap { background: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 24px; margin-top: 24px; }
        .clc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .clc-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: #F9FAFB; }
        .clc-count { font-size: 11px; color: #4B5563; }
        .clc-channels { display: flex; gap: 12px; flex-wrap: wrap; }
        .clc-ch-btn { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-radius: 12px; border: 1px solid; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; background: transparent; font-family: 'Plus Jakarta Sans', sans-serif; flex: 1; min-width: 140px; justify-content: center; }
        .clc-ch-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .clc-wa   { border-color: rgba(34,197,94,0.3);   background: rgba(34,197,94,0.06);   color: #4ADE80; }
        .clc-wa:hover:not(:disabled)   { background: rgba(34,197,94,0.14);  border-color: rgba(34,197,94,0.5);  transform: translateY(-1px); }
        .clc-ig   { border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.06); color: #C4B5FD; }
        .clc-ig:hover:not(:disabled)   { background: rgba(167,139,250,0.14); border-color: rgba(167,139,250,0.5); transform: translateY(-1px); }
        .clc-call { border-color: rgba(251,146,60,0.3);  background: rgba(251,146,60,0.06);  color: #FB923C; }
        .clc-call:hover:not(:disabled) { background: rgba(251,146,60,0.14); border-color: rgba(251,146,60,0.5);  transform: translateY(-1px); }
        .clc-ch-label { display: flex; flex-direction: column; align-items: flex-start; }
        .clc-ch-name  { font-size: 14px; font-weight: 700; }
        .clc-ch-sub   { font-size: 10px; font-weight: 400; opacity: 0.6; margin-top: 1px; }
        .clc-not-connected { font-size: 11px; color: #4B5563; margin-top: 12px; display: flex; align-items: center; gap: 8px; }
        .clc-not-connected a { color: #3B82F6; font-weight: 500; text-decoration: none; }
        .clc-compose { display: flex; flex-direction: column; gap: 14px; }
        .clc-compose-header { display: flex; align-items: center; gap: 10px; }
        .clc-platform-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .clc-to-info { font-size: 12px; color: #4B5563; }
        .clc-textarea { width: 100%; padding: 14px; background: #1E293B; border: 1px solid #374151; border-radius: 10px; color: #F9FAFB; font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.6; resize: vertical; outline: none; transition: all 0.2s; min-height: 110px; box-sizing: border-box; }
        .clc-textarea:focus { border-color: rgba(37,99,235,0.4); box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
        .clc-char { font-size: 11px; color: #374151; }
        .clc-actions { display: flex; gap: 10px; }
        .clc-cancel { padding: 11px 20px; background: transparent; border: 1px solid #374151; border-radius: 9px; color: #6B7280; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .clc-cancel:hover { border-color: #6B7280; color: #F9FAFB; }
        .clc-send-btn { flex: 1; padding: 11px; border: none; border-radius: 9px; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .clc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .clc-send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .clc-call-view { display: flex; flex-direction: column; gap: 16px; }
        .clc-call-header { display: flex; align-items: center; justify-content: space-between; }
        .clc-call-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; color: #F9FAFB; display: flex; align-items: center; gap: 8px; }
        .clc-timer-box { background: #0D1117; border-radius: 12px; padding: 20px; text-align: center; transition: border-color 0.3s; }
        .clc-timer-digits { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 40px; font-weight: 800; letter-spacing: 0.06em; transition: color 0.3s; line-height: 1; }
        .clc-timer-status { font-size: 12px; margin-top: 6px; transition: color 0.3s; }
        .clc-timer-btns { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
        .clc-dial-btn { display: flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: none; font-family: 'Plus Jakarta Sans', sans-serif; }
        .clc-dial-btn.ready { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #4ADE80; }
        .clc-dial-btn.ready:hover { background: rgba(34,197,94,0.25); transform: translateY(-1px); }
        .clc-dial-btn.calling { background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.3); color: #60A5FA; cursor: not-allowed; }
        .clc-dial-btn.active { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: #4ADE80; cursor: not-allowed; }
        .clc-sid { font-size: 10px; color: #374151; font-family: monospace; background: #0D1117; padding: 4px 8px; border-radius: 4px; margin-top: 8px; display: inline-block; }
        .clc-notes-label { font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 8px; }
        .clc-notes-area { width: 100%; padding: 12px; background: #1E293B; border: 1px solid #374151; border-radius: 10px; color: #F9FAFB; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; resize: vertical; outline: none; transition: all 0.2s; box-sizing: border-box; }
        .clc-notes-area:focus { border-color: rgba(251,146,60,0.4); box-shadow: 0 0 0 3px rgba(251,146,60,0.06); }
        .clc-info-banner { display: flex; align-items: center; gap: 8px; background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.15); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #60A5FA; }
        .clc-log-btn { flex: 2; padding: 11px; border: none; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .clc-log-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        @keyframes clc-spin { to { transform: rotate(360deg); } }
        .clc-spin { animation: clc-spin 0.8s linear infinite; }
        @keyframes clc-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .clc-pulse { animation: clc-pulse 1.5s ease-in-out infinite; }
        .clc-divider { height: 1px; background: #1F2937; margin: 20px 0; }
        .clc-history-label { font-size: 11px; font-weight: 600; color: #4B5563; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .clc-history-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
        .clc-msg { padding: 10px 14px; border-radius: 9px; }
        .clc-msg-out { background: rgba(37,99,235,0.07); border: 1px solid rgba(37,99,235,0.15); }
        .clc-msg-in  { background: rgba(255,255,255,0.02); border: 1px solid #1F2937; }
        .clc-msg-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .clc-msg-who  { font-size: 11px; font-weight: 600; }
        .clc-msg-time { font-size: 10px; color: #374151; }
        .clc-msg-text { font-size: 13px; color: #D1D5DB; line-height: 1.55; margin: 0; }
      `}</style>

      <div className="clc-wrap">

        <div className="clc-top">
          <span className="clc-title">Contact Lead</span>
          {messages.length > 0 && (
            <span className="clc-count">{messages.length} message{messages.length !== 1 ? 's' : ''} sent</span>
          )}
        </div>

        {/* ── Channel picker ── */}
        {activeView === null && (
          <>
            <div className="clc-channels">
              <button className="clc-ch-btn clc-wa" disabled={!hasWhatsApp || !hasPhone} onClick={() => openCompose('whatsapp')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" fill="#4ADE80"/>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#4ADE80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
                <span className="clc-ch-label">
                  <span className="clc-ch-name">WhatsApp</span>
                  <span className="clc-ch-sub">{!hasWhatsApp ? 'Not connected' : !hasPhone ? 'No phone number' : 'Send message'}</span>
                </span>
              </button>

              <button className="clc-ch-btn clc-ig" disabled={!hasInstagram} onClick={() => openCompose('instagram')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="#C4B5FD" stroke="none"/>
                </svg>
                <span className="clc-ch-label">
                  <span className="clc-ch-name">Instagram</span>
                  <span className="clc-ch-sub">{!hasInstagram ? 'Not connected' : 'Send DM'}</span>
                </span>
              </button>

              <button className="clc-ch-btn clc-call" disabled={!hasPhone} onClick={openCall}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                <span className="clc-ch-label">
                  <span className="clc-ch-name">Call Lead</span>
                  <span className="clc-ch-sub">{hasPhone ? lead.phone : 'No phone number'}</span>
                </span>
              </button>
            </div>

            {!hasWhatsApp && !hasInstagram && (
              <p className="clc-not-connected">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                No channels connected. <a href="/settings/channels">Connect WhatsApp or Instagram →</a>
              </p>
            )}
          </>
        )}

        {/* ── Compose box ── */}
        {activeView === 'compose' && (
          <div className="clc-compose">
            <div className="clc-compose-header">
              <span className="clc-platform-pill" style={{
                background: platform === 'whatsapp' ? 'rgba(34,197,94,0.1)' : 'rgba(167,139,250,0.1)',
                border: platform === 'whatsapp' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(167,139,250,0.2)',
                color: platform === 'whatsapp' ? '#4ADE80' : '#C4B5FD',
              }}>
                {platform === 'whatsapp' ? '💬 WhatsApp' : '📸 Instagram'}
              </span>
              <span className="clc-to-info">
                Sending to <strong style={{ color: '#F9FAFB' }}>{lead.name}</strong>
                {lead.phone ? ` · ${lead.phone}` : ''}
              </span>
            </div>
            <textarea className="clc-textarea" value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Write your message here..." rows={4} />
            <p className="clc-char">{msgText.length} characters</p>
            <div className="clc-actions">
              <button className="clc-cancel" onClick={() => { setActiveView(null); setPlatform(null); }}>Cancel</button>
              <button
                className="clc-send-btn"
                style={{ background: platform === 'whatsapp' ? 'linear-gradient(135deg, #15803D, #22C55E)' : 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
                onClick={handleSend}
                disabled={sending || !msgText.trim()}
              >
                {sending
                  ? <><svg className="clc-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Sending...</>
                  : `Send via ${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'} →`}
              </button>
            </div>
          </div>
        )}

        {/* ── Call view ── */}
        {activeView === 'call' && (
          <div className="clc-call-view">
            <div className="clc-call-header">
              <span className="clc-call-title">
                <span style={{ fontSize: '16px' }}>📞</span>
                Call via Priya (AI)
              </span>
              <span style={{ fontSize: '12px', color: '#4B5563' }}>
                {lead.name}{lead.phone ? ` · ${lead.phone}` : ''}
              </span>
            </div>

            <div className="clc-timer-box" style={{
              border: `1px solid ${isCallActive ? 'rgba(34,197,94,0.3)' : isCallDone ? 'rgba(34,197,94,0.15)' : '#1F2937'}`
            }}>
              <p className="clc-timer-digits" style={{ color: callStatusDisplay[callStatus].color }}>
                {formatDuration(callDuration)}
              </p>
              <p className={`clc-timer-status ${isCallActive ? 'clc-pulse' : ''}`} style={{ color: callStatusDisplay[callStatus].color }}>
                {callStatusDisplay[callStatus].emoji} {callStatusDisplay[callStatus].text}
              </p>
              {callSid && <span className="clc-sid">SID: {callSid.slice(0, 20)}...</span>}
              <div className="clc-timer-btns">
                {canStartCall && (
                  <button className="clc-dial-btn ready" onClick={startTwilioCall}>
                    📞 Call {lead.name || lead.phone}
                  </button>
                )}
                {callStatus === 'initiating' && (
                  <button className="clc-dial-btn calling" disabled>
                    <svg className="clc-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(96,165,250,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Connecting...
                  </button>
                )}
                {(callStatus === 'ringing' || callStatus === 'in-progress') && (
                  <button className="clc-dial-btn active" disabled>
                    {callStatus === 'ringing' ? '🔔 Ringing...' : '🎙️ Live with Priya'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="clc-notes-label">Call Notes</label>
              <textarea
                className="clc-notes-area"
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
                placeholder="What was discussed? Any follow-ups needed?"
                rows={3}
              />
            </div>

            {lead.status === 'new' && (
              <div className="clc-info-banner">
                <span>ℹ️</span>
                <p>Status will automatically update to <strong>Contacted</strong> when logged.</p>
              </div>
            )}

            <div className="clc-actions">
              <button className="clc-cancel" onClick={cancelCall}>Cancel</button>
              <button
                className="clc-log-btn"
                disabled={callLogging || !canLogCall}
                onClick={handleLogCall}
                style={{
                  background: canLogCall ? 'rgba(251,146,60,0.85)' : '#1F2937',
                  color:      canLogCall ? '#fff' : '#4B5563',
                }}
              >
                {callLogging
                  ? <><svg className="clc-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Logging...</>
                  : isCallActive       ? '⏳ Wait for call to end'
                  : callStatus === 'idle'   ? '📞 Start a call first'
                  : callStatus === 'failed' ? '✗ Call failed — retry?'
                  : '✓ Log Call'}
              </button>
            </div>
          </div>
        )}

        {/* ── Message history ── */}
        {messages.length > 0 && (
          <>
            <div className="clc-divider" />
            <p className="clc-history-label">Message history</p>
            <div className="clc-history-list">
              {messages.map((msg, i) => (
                <div key={i} className={`clc-msg ${msg.direction === 'outbound' ? 'clc-msg-out' : 'clc-msg-in'}`}>
                  <div className="clc-msg-meta">
                    <span className="clc-msg-who" style={{ color: msg.direction === 'outbound' ? '#60A5FA' : '#9CA3AF' }}>
                      {msg.direction === 'outbound' ? `You → ${msg.platform}` : `Lead via ${msg.platform}`}
                    </span>
                    <span className="clc-msg-time">
                      {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="clc-msg-text">{msg.message}</p>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </>
  );
}