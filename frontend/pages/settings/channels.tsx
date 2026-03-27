import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import toast from 'react-hot-toast';
import api from '@/services/api';

interface Channel {
  id: string;
  platform: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
}

interface TwilioConfig {
  account_sid:  string;
  is_active:    boolean;
  phone_number: string;
  created_at:   string;
}

export default function ChannelsSettings() {
  const [channels, setChannels]           = useState<Channel[]>([]);
  const [twilioConfig, setTwilioConfig]   = useState<TwilioConfig | null>(null);
  const [loading, setLoading]             = useState(true);
  const [showWAForm, setShowWAForm]       = useState(false);
  const [showIGForm, setShowIGForm]       = useState(false);
  const [showTwilioForm, setShowTwilioForm] = useState(false);
  const [saving, setSaving]               = useState(false);

  const [waForm, setWaForm] = useState({
    access_token:    '',
    phone_number_id: '',
    account_name:    '',
  });

  const [igForm, setIgForm] = useState({
    access_token:  '',
    ig_account_id: '',
    account_name:  '',
  });

  const [twilioForm, setTwilioForm] = useState({
    account_sid:   '',
    auth_token:    '',
    phone_number:  '',
    twiml_app_sid: '',
  });

  useEffect(() => {
    loadChannels();
    loadTwilioConfig();
  }, []);

  const loadChannels = async () => {
    try {
      const res = await api.get('/messages/channels');
      setChannels(res.data);
    } catch {
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const loadTwilioConfig = async () => {
    try {
      const res = await api.get('/calls/config');
      setTwilioConfig(res.data);
    } catch {
      // Not configured yet — that's fine
    }
  };

  const connectWhatsApp = async () => {
    if (!waForm.access_token || !waForm.phone_number_id) {
      toast.error('Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      await api.post('/messages/channels/connect', {
        platform:        'whatsapp',
        access_token:    waForm.access_token,
        phone_number_id: waForm.phone_number_id,
        account_name:    waForm.account_name || 'WhatsApp Business',
      });
      toast.success('WhatsApp connected successfully!');
      setShowWAForm(false);
      setWaForm({ access_token: '', phone_number_id: '', account_name: '' });
      loadChannels();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect WhatsApp');
    } finally {
      setSaving(false);
    }
  };

  const connectInstagram = async () => {
    if (!igForm.access_token || !igForm.ig_account_id) {
      toast.error('Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      await api.post('/messages/channels/connect', {
        platform:      'instagram',
        access_token:  igForm.access_token,
        ig_account_id: igForm.ig_account_id,
        account_name:  igForm.account_name || 'Instagram Business',
      });
      toast.success('Instagram connected successfully!');
      setShowIGForm(false);
      setIgForm({ access_token: '', ig_account_id: '', account_name: '' });
      loadChannels();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect Instagram');
    } finally {
      setSaving(false);
    }
  };

  const saveTwilioConfig = async () => {
    if (!twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.phone_number) {
      toast.error('Account SID, Auth Token aur Phone Number required hain');
      return;
    }
    setSaving(true);
    try {
      await api.post('/calls/config', {
        account_sid:   twilioForm.account_sid.trim(),
        auth_token:    twilioForm.auth_token.trim(),
        phone_number:  twilioForm.phone_number.trim(),
        twiml_app_sid: twilioForm.twiml_app_sid.trim() || null,
      });
      toast.success('Twilio configured successfully!');
      setShowTwilioForm(false);
      setTwilioForm({ account_sid: '', auth_token: '', phone_number: '', twiml_app_sid: '' });
      loadTwilioConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save Twilio config');
    } finally {
      setSaving(false);
    }
  };

  const isConnected    = (platform: string) => channels.some(c => c.platform === platform && c.is_active);
  const getChannel     = (platform: string) => channels.find(c => c.platform === platform);
  const twilioActive   = twilioConfig?.is_active === true;

  return (
    <AppLayout>
      <style>{`
        .ch-page   { padding: 32px; max-width: 720px; }
        .ch-title  { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 700; color: #F9FAFB; margin-bottom: 6px; }
        .ch-sub    { font-size: 14px; color: #6B7280; margin-bottom: 32px; }

        .ch-card   { background: #111827; border: 1px solid #1F2937; border-radius: 14px; padding: 24px; margin-bottom: 16px; }
        .ch-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; }
        .ch-info   { display: flex; align-items: center; gap: 14px; }
        .ch-icon   { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .ch-name   { font-size: 15px; font-weight: 600; color: #F9FAFB; margin-bottom: 3px; }
        .ch-desc   { font-size: 12px; color: #6B7280; }

        .ch-badge-connected { padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; background: rgba(34,197,94,0.1); color: #4ADE80; border: 1px solid rgba(34,197,94,0.2); }
        .ch-badge-not       { padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.05); color: #6B7280; border: 1px solid #1F2937; }

        .ch-btn-connect { margin-top: 16px; width: 100%; padding: 11px; background: linear-gradient(135deg, #1D4ED8, #3B82F6); border: none; border-radius: 9px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s; }
        .ch-btn-connect:hover { opacity: 0.9; transform: translateY(-1px); }
        .ch-btn-update  { margin-top: 16px; padding: 8px 16px; background: transparent; border: 1px solid #374151; border-radius: 8px; color: #9CA3AF; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .ch-btn-update:hover { border-color: #6B7280; color: #F9FAFB; }

        .ch-form   { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
        .ch-label  { font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; }
        .ch-input  { width: 100%; padding: 11px 14px; background: #1E293B; border: 1px solid #374151; border-radius: 9px; color: #F9FAFB; font-size: 14px; font-family: 'Inter', sans-serif; outline: none; transition: all 0.2s; box-sizing: border-box; }
        .ch-input:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
        .ch-input::placeholder { color: #374151; }
        .ch-hint   { font-size: 11px; color: #4B5563; margin-top: 4px; line-height: 1.5; }

        .ch-actions { display: flex; gap: 10px; margin-top: 4px; }
        .ch-btn-save { flex: 1; padding: 11px; background: linear-gradient(135deg, #1D4ED8, #3B82F6); border: none; border-radius: 9px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s; }
        .ch-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
        .ch-btn-save:hover:not(:disabled) { opacity: 0.9; }
        .ch-btn-cancel { padding: 11px 20px; background: transparent; border: 1px solid #374151; border-radius: 9px; color: #6B7280; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .ch-btn-cancel:hover { border-color: #6B7280; color: #F9FAFB; }

        .ch-connected-info { margin-top: 14px; padding: 12px 14px; background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.1); border-radius: 9px; font-size: 12px; color: #6B7280; }

        /* ── TWILIO SPECIFIC ── */
        .ch-twilio-connected {
          margin-top: 14px; padding: 14px 16px;
          background: rgba(251,146,60,0.05);
          border: 1px solid rgba(251,146,60,0.15);
          border-radius: 10px;
        }
        .ch-twilio-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .ch-twilio-row:last-child { margin-bottom: 0; }
        .ch-twilio-key { font-size: 11px; color: #6B7280; font-weight: 500; }
        .ch-twilio-val { font-size: 12px; color: #D1D5DB; font-weight: 600; font-family: monospace; }

        .ch-optional-badge {
          font-size: 10px; color: #4B5563; background: #1F2937;
          border: 1px solid #374151; border-radius: 4px;
          padding: 1px 6px; margin-left: 6px; vertical-align: middle;
        }

        .ch-divider { height: 1px; background: #1F2937; margin: 32px 0; }
        .ch-section-label { font-size: 11px; font-weight: 700; color: #4B5563; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px; }

        .ch-help       { background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.1); border-radius: 12px; padding: 20px 24px; }
        .ch-help-title { font-size: 13px; font-weight: 600; color: #93C5FD; margin-bottom: 12px; }
        .ch-help-step  { font-size: 12px; color: #6B7280; margin-bottom: 8px; line-height: 1.6; }
        .ch-help-step span { color: #93C5FD; font-weight: 600; }

        .ch-twilio-help { background: rgba(251,146,60,0.04); border: 1px solid rgba(251,146,60,0.1); border-radius: 12px; padding: 20px 24px; margin-top: 16px; }
        .ch-twilio-help-title { font-size: 13px; font-weight: 600; color: #FCA86C; margin-bottom: 12px; }
      `}</style>

      <div className="ch-page">
        <h1 className="ch-title">Connected Channels</h1>
        <p className="ch-sub">
          Connect WhatsApp, Instagram, and Twilio to contact leads directly from BluQQ.
        </p>

        {/* ── MESSAGING SECTION ── */}
        <p className="ch-section-label">💬 Messaging</p>

        {/* WHATSAPP CARD */}
        <div className="ch-card">
          <div className="ch-card-top">
            <div className="ch-info">
              <div className="ch-icon" style={{ background: 'rgba(34,197,94,0.1)' }}>📱</div>
              <div>
                <div className="ch-name">WhatsApp Business</div>
                <div className="ch-desc">
                  {isConnected('whatsapp') ? `Connected — ${getChannel('whatsapp')?.account_name}` : 'Not connected'}
                </div>
              </div>
            </div>
            <span className={isConnected('whatsapp') ? 'ch-badge-connected' : 'ch-badge-not'}>
              {isConnected('whatsapp') ? '✓ Connected' : 'Not connected'}
            </span>
          </div>

          {isConnected('whatsapp') && !showWAForm && (
            <div className="ch-connected-info">
              Connected on {new Date(getChannel('whatsapp')!.created_at).toLocaleDateString()}
              &nbsp;·&nbsp; You can now send WhatsApp messages to leads
            </div>
          )}

          {!showWAForm && (
            isConnected('whatsapp') ? (
              <button className="ch-btn-update" onClick={() => setShowWAForm(true)}>Update credentials</button>
            ) : (
              <button className="ch-btn-connect" onClick={() => setShowWAForm(true)}>Connect WhatsApp</button>
            )
          )}

          {showWAForm && (
            <div className="ch-form">
              <div>
                <label className="ch-label">Account Name</label>
                <input className="ch-input" placeholder="e.g. BluQQ Sales" value={waForm.account_name} onChange={e => setWaForm({ ...waForm, account_name: e.target.value })} />
              </div>
              <div>
                <label className="ch-label">Phone Number ID</label>
                <input className="ch-input" placeholder="e.g. 123456789012345" value={waForm.phone_number_id} onChange={e => setWaForm({ ...waForm, phone_number_id: e.target.value })} />
                <p className="ch-hint">Found at developers.facebook.com → Your App → WhatsApp → API Setup</p>
              </div>
              <div>
                <label className="ch-label">Access Token</label>
                <input className="ch-input" type="password" placeholder="EAABsbCS4ZA..." value={waForm.access_token} onChange={e => setWaForm({ ...waForm, access_token: e.target.value })} />
                <p className="ch-hint">Temporary token expires in 24hrs. Get a permanent one from Meta System Users.</p>
              </div>
              <div className="ch-actions">
                <button className="ch-btn-cancel" onClick={() => setShowWAForm(false)}>Cancel</button>
                <button className="ch-btn-save" onClick={connectWhatsApp} disabled={saving}>{saving ? 'Connecting...' : 'Save & Connect'}</button>
              </div>
            </div>
          )}
        </div>

        {/* INSTAGRAM CARD */}
        <div className="ch-card">
          <div className="ch-card-top">
            <div className="ch-info">
              <div className="ch-icon" style={{ background: 'rgba(139,92,246,0.1)' }}>📸</div>
              <div>
                <div className="ch-name">Instagram Business</div>
                <div className="ch-desc">
                  {isConnected('instagram') ? `Connected — ${getChannel('instagram')?.account_name}` : 'Not connected'}
                </div>
              </div>
            </div>
            <span className={isConnected('instagram') ? 'ch-badge-connected' : 'ch-badge-not'}>
              {isConnected('instagram') ? '✓ Connected' : 'Not connected'}
            </span>
          </div>

          {isConnected('instagram') && !showIGForm && (
            <div className="ch-connected-info">
              Connected on {new Date(getChannel('instagram')!.created_at).toLocaleDateString()}
              &nbsp;·&nbsp; You can now send Instagram DMs to leads
            </div>
          )}

          {!showIGForm && (
            isConnected('instagram') ? (
              <button className="ch-btn-update" onClick={() => setShowIGForm(true)}>Update credentials</button>
            ) : (
              <button className="ch-btn-connect" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }} onClick={() => setShowIGForm(true)}>Connect Instagram</button>
            )
          )}

          {showIGForm && (
            <div className="ch-form">
              <div>
                <label className="ch-label">Account Name</label>
                <input className="ch-input" placeholder="e.g. @yourbusiness" value={igForm.account_name} onChange={e => setIgForm({ ...igForm, account_name: e.target.value })} />
              </div>
              <div>
                <label className="ch-label">Instagram Account ID</label>
                <input className="ch-input" placeholder="e.g. 17841234567890" value={igForm.ig_account_id} onChange={e => setIgForm({ ...igForm, ig_account_id: e.target.value })} />
                <p className="ch-hint">Found at developers.facebook.com → Your App → Instagram → API Setup</p>
              </div>
              <div>
                <label className="ch-label">Access Token</label>
                <input className="ch-input" type="password" placeholder="EAABsbCS4ZA..." value={igForm.access_token} onChange={e => setIgForm({ ...igForm, access_token: e.target.value })} />
              </div>
              <div className="ch-actions">
                <button className="ch-btn-cancel" onClick={() => setShowIGForm(false)}>Cancel</button>
                <button className="ch-btn-save" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }} onClick={connectInstagram} disabled={saving}>{saving ? 'Connecting...' : 'Save & Connect'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="ch-divider" />

        {/* ── CALLING SECTION ── */}
        <p className="ch-section-label">📞 Calling</p>

        {/* TWILIO CARD */}
        <div className="ch-card">
          <div className="ch-card-top">
            <div className="ch-info">
              <div className="ch-icon" style={{ background: 'rgba(251,146,60,0.1)' }}>
                {/* Twilio logo SVG */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#FB923C" strokeWidth="1.8"/>
                  <circle cx="8.5"  cy="9"  r="1.5" fill="#FB923C"/>
                  <circle cx="15.5" cy="9"  r="1.5" fill="#FB923C"/>
                  <circle cx="8.5"  cy="15" r="1.5" fill="#FB923C"/>
                  <circle cx="15.5" cy="15" r="1.5" fill="#FB923C"/>
                </svg>
              </div>
              <div>
                <div className="ch-name">Twilio — AI Calling</div>
                <div className="ch-desc">
                  {twilioActive
                    ? `Active — ${twilioConfig?.phone_number}`
                    : 'Not configured — Priya AI calls use this'}
                </div>
              </div>
            </div>
            <span className={twilioActive ? 'ch-badge-connected' : 'ch-badge-not'}>
              {twilioActive ? '✓ Active' : 'Not configured'}
            </span>
          </div>

          {/* Connected info */}
          {twilioActive && !showTwilioForm && (
            <div className="ch-twilio-connected">
              <div className="ch-twilio-row">
                <span className="ch-twilio-key">Account SID</span>
                <span className="ch-twilio-val">{twilioConfig?.account_sid?.slice(0, 8)}••••••••</span>
              </div>
              <div className="ch-twilio-row">
                <span className="ch-twilio-key">Phone Number</span>
                <span className="ch-twilio-val">{twilioConfig?.phone_number}</span>
              </div>
              <div className="ch-twilio-row">
                <span className="ch-twilio-key">Connected on</span>
                <span className="ch-twilio-val">
                  {twilioConfig?.created_at ? new Date(twilioConfig.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          )}

          {!showTwilioForm && (
            twilioActive ? (
              <button className="ch-btn-update" onClick={() => setShowTwilioForm(true)}>Update credentials</button>
            ) : (
              <button
                className="ch-btn-connect"
                style={{ background: 'linear-gradient(135deg, #C2410C, #FB923C)' }}
                onClick={() => setShowTwilioForm(true)}
              >
                Configure Twilio
              </button>
            )
          )}

          {showTwilioForm && (
            <div className="ch-form">
              <div>
                <label className="ch-label">Account SID</label>
                <input
                  className="ch-input"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioForm.account_sid}
                  onChange={e => setTwilioForm({ ...twilioForm, account_sid: e.target.value })}
                />
                <p className="ch-hint">Starts with "AC" — found at console.twilio.com dashboard</p>
              </div>
              <div>
                <label className="ch-label">Auth Token</label>
                <input
                  className="ch-input"
                  type="password"
                  placeholder="Your Twilio Auth Token"
                  value={twilioForm.auth_token}
                  onChange={e => setTwilioForm({ ...twilioForm, auth_token: e.target.value })}
                />
                <p className="ch-hint">Found next to Account SID on your Twilio console dashboard</p>
              </div>
              <div>
                <label className="ch-label">Twilio Phone Number</label>
                <input
                  className="ch-input"
                  placeholder="+1234567890"
                  value={twilioForm.phone_number}
                  onChange={e => setTwilioForm({ ...twilioForm, phone_number: e.target.value })}
                />
                <p className="ch-hint">
                  E.164 format — e.g. +14155552671. Buy one at console.twilio.com → Phone Numbers
                </p>
              </div>
              <div>
                <label className="ch-label">
                  TwiML App SID
                  <span className="ch-optional-badge">Optional</span>
                </label>
                <input
                  className="ch-input"
                  placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioForm.twiml_app_sid}
                  onChange={e => setTwilioForm({ ...twilioForm, twiml_app_sid: e.target.value })}
                />
                <p className="ch-hint">
                  Only needed if you're using Twilio's browser-based calling (TwiML Apps).
                  Leave blank for standard outbound calls.
                </p>
              </div>
              <div className="ch-actions">
                <button className="ch-btn-cancel" onClick={() => setShowTwilioForm(false)}>Cancel</button>
                <button
                  className="ch-btn-save"
                  style={{ background: 'linear-gradient(135deg, #C2410C, #FB923C)' }}
                  onClick={saveTwilioConfig}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save & Activate'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ch-divider" />

        {/* ── HELP BOXES ── */}
        <div className="ch-help">
          <p className="ch-help-title">Where to get your WhatsApp credentials</p>
          <p className="ch-help-step"><span>Step 1</span> — Go to developers.facebook.com and log in</p>
          <p className="ch-help-step"><span>Step 2</span> — Click My Apps → open your BluQQ app</p>
          <p className="ch-help-step"><span>Step 3</span> — On the left sidebar click WhatsApp → API Setup</p>
          <p className="ch-help-step"><span>Step 4</span> — Copy the Phone Number ID and Access Token from that page</p>
          <p className="ch-help-step"><span>Step 5</span> — Paste them above and click Save & Connect</p>
        </div>

        <div className="ch-twilio-help">
  <p className="ch-twilio-help-title">Where to get your Twilio credentials</p>
  <p className="ch-help-step"><span style={{color:'#FCA86C'}}>Step 1</span> — Go to <strong style={{color:'#D1D5DB'}}>console.twilio.com</strong> and sign in or create a free account</p>
  <p className="ch-help-step"><span style={{color:'#FCA86C'}}>Step 2</span> — On the dashboard you will find your <strong style={{color:'#D1D5DB'}}>Account SID</strong> and <strong style={{color:'#D1D5DB'}}>Auth Token</strong> directly</p>
  <p className="ch-help-step"><span style={{color:'#FCA86C'}}>Step 3</span> — Go to Phone Numbers → Manage → Buy a Number to get a Twilio phone number</p>
  <p className="ch-help-step"><span style={{color:'#FCA86C'}}>Step 4</span> — The number must be in E.164 format — e.g. <strong style={{color:'#D1D5DB'}}>+14155552671</strong></p>
  <p className="ch-help-step"><span style={{color:'#FCA86C'}}>Step 5</span> — Fill in the form above and click Save & Activate</p>
  <p className="ch-help-step" style={{marginTop:'10px', padding:'10px 12px', background:'rgba(251,146,60,0.06)', borderRadius:'8px', border:'1px solid rgba(251,146,60,0.1)'}}>
    <span style={{color:'#FCA86C'}}>Note</span> — For Priya AI calls to work, you must also set <strong style={{color:'#D1D5DB'}}>TWILIO_ACCOUNT_SID</strong>, <strong style={{color:'#D1D5DB'}}>TWILIO_AUTH_TOKEN</strong>, and <strong style={{color:'#D1D5DB'}}>TWILIO_PHONE_NUMBER</strong> in your backend <strong style={{color:'#D1D5DB'}}>.env</strong> file
  </p>
</div>

      </div>
    </AppLayout>
  );
}