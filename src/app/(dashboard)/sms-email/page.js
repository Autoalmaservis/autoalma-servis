'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';

const TABS = [
  { key: 'sablony',   label: 'Šablóny',  icon: '📋' },
  { key: 'planovane', label: 'Plánované', icon: '📅' },
  { key: 'hromadne',  label: 'Hromadné',  icon: '📣' },
  { key: 'historia',  label: 'História',  icon: '📊' },
];

function fmtDt(iso) {
  return new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ChannelToggle({ channel, onChange }) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onChange('sms')}
        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
          channel === 'sms' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500'
        }`}
      >
        📱 SMS
      </button>
      <button
        onClick={() => onChange('email')}
        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
          channel === 'email' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500'
        }`}
      >
        ✉️ Email
      </button>
    </div>
  );
}

export default function SmsEmailPage() {
  const [activeTab, setActiveTab] = useState('sablony');
  const [channel, setChannel] = useState('sms');

  // --- Šablóny ---
  const [templates, setTemplates] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplError, setTplError] = useState(null);

  // --- Plánované ---
  const [scheduled, setScheduled] = useState([]);
  const [loadingSched, setLoadingSched] = useState(false);
  const [schedError, setSchedError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'sent'

  // --- Hromadné ---
  const [customers, setCustomers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [selTplId, setSelTplId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);

  // --- História ---
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyType, setHistoryType] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  // --- SMS rámec (úvod + záver) ---
  const DEFAULT_INTRO = 'Vazeny zakaznik p. {meno}, Vase vozidlo {spz}:';
  const DEFAULT_FOOTER = 'S pozdravom Autoalma - spolahlivy servis pre Vase vozidlo.';
  const [smsIntro, setSmsIntro] = useState('');
  const [smsFooter, setSmsFooter] = useState('');
  const [savingFrame, setSavingFrame] = useState(false);
  const [frameSaved, setFrameSaved] = useState(false);
  const [companyName, setCompanyName] = useState('AutoAlma Servis');

  useEffect(() => { fetchTemplates(); fetchCustomers(); fetchSmsFrame(); }, []);

  useEffect(() => {
    if (activeTab === 'planovane') fetchScheduled();
    if (activeTab === 'historia') fetchHistory();
  }, [activeTab, channel]);

  // Reset výberu zákazníkov a šablóny pri zmene kanála
  useEffect(() => {
    setSelectedIds([]);
    setBulkMessage('');
    setBulkSubject('');
    setSelTplId('');
    setNewLabel('');
    setNewContent('');
    setNewSubject('');
  }, [channel]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('sms_templates').select('*').order('label', { ascending: true });
    if (data) setTemplates(data);
  };

  const fetchSmsFrame = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('id, value')
      .in('id', ['sms_intro', 'sms_footer', 'company_name']);
    const introRow = data?.find(r => r.id === 'sms_intro');
    const footerRow = data?.find(r => r.id === 'sms_footer');
    setSmsIntro(introRow?.value ?? DEFAULT_INTRO);
    setSmsFooter(footerRow?.value ?? DEFAULT_FOOTER);
    setCompanyName(data?.find(r => r.id === 'company_name')?.value || 'AutoAlma Servis');
  };

  const saveSmsFrame = async () => {
    setSavingFrame(true);
    await supabase.from('business_settings').upsert([
      { id: 'sms_intro', value: smsIntro },
      { id: 'sms_footer', value: smsFooter },
    ]);
    setSavingFrame(false);
    setFrameSaved(true);
    setTimeout(() => setFrameSaved(false), 2000);
  };

  // SMS kanál: type='sms', type='one-time', type=NULL → všetko čo nie je 'email'
  const isSmsType = (t) => !t || t === 'sms' || t === 'one-time';

  const fetchScheduled = async () => {
    setLoadingSched(true);
    setSchedError(null);
    const { data, error } = await supabase
      .from('scheduled_sms').select('*')
      .order('scheduled_for', { ascending: false }); // najnovšie hore
    if (error) {
      setSchedError(error.message);
      setScheduled([]);
    } else {
      // Filtrovanie client-side — one-time/null = sms
      const filtered = (data || []).filter(s =>
        channel === 'sms' ? isSmsType(s.type) : s.type === 'email'
      );
      setScheduled(filtered);
    }
    setLoadingSched(false);
  };

  const fetchCustomers = async () => {
    setLoadingCust(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, email')
      .in('role', ['zakaznik', 'klient'])
      .order('full_name', { ascending: true });
    if (data) setCustomers(data);
    setLoadingCust(false);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('scheduled_sms')
      .select('*')
      .eq('status', 'sent')
      .order('scheduled_for', { ascending: false });
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  // Filtrovanie šablón podľa kanála (type pole, fallback na 'sms')
  const channelTemplates = templates.filter(t => (t.type || 'sms') === channel);

  // Filtrovanie zákazníkov podľa dostupnosti kontaktu
  const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const contactKey = channel === 'sms' ? 'phone' : 'email';
  const contactLabel = channel === 'sms' ? 'Telefón' : 'Email';
  const contactIcon = channel === 'sms' ? '📞' : '✉️';

  const eligibleCustomers = customers.filter(c => c[contactKey]);
  const filteredCustomers = custSearch
    ? eligibleCustomers.filter(c =>
        nd(c.full_name).includes(nd(custSearch)) ||
        (c[contactKey] || '').toLowerCase().includes(custSearch.toLowerCase())
      )
    : eligibleCustomers;

  // Šablóny CRUD
  const addTemplate = async () => {
    if (!newLabel.trim() || !newContent.trim()) return;
    setSavingTpl(true);
    setTplError(null);
    const { error } = await supabase.from('sms_templates').insert([{
      label: newLabel,
      content: newContent,
      type: channel,
      ...(channel === 'email' && newSubject ? { subject: newSubject } : {}),
    }]);
    if (error) {
      setTplError(error.message);
    } else {
      setNewLabel(''); setNewContent(''); setNewSubject('');
      fetchTemplates();
    }
    setSavingTpl(false);
  };

  const updateTemplate = async (id, field, value) => {
    await supabase.from('sms_templates').update({ [field]: value }).eq('id', id);
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Vymazať šablónu?')) return;
    await supabase.from('sms_templates').delete().eq('id', id);
    fetchTemplates();
  };

  // Plánované
  const cancelScheduled = async (id) => {
    if (!confirm('Zrušiť naplánovanú správu?')) return;
    await supabase.from('scheduled_sms').delete().eq('id', id);
    fetchScheduled();
  };

  const sendNow = async (item) => {
    try {
      if (channel === 'sms') {
        await fetchWithAuth('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: item.customer_phone, message: item.message }),
        });
      } else {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: item.customer_email, subject: item.subject || `Správa od ${companyName}`, message: item.message }),
        });
      }
      await supabase.from('scheduled_sms').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id);
      if (item.user_id) {
        await supabase.from('notifications').insert([{
          user_id: item.user_id,
          title: 'Správa zo servisu',
          content: item.message,
          is_read: false,
          type: 'info',
        }]);
      }
      fetchScheduled();
    } catch (err) {
      alert('Chyba: ' + err.message);
    }
  };

  // Hromadné
  const toggleCustomer = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleTplSelect = (tplId) => {
    setSelTplId(tplId);
    const t = channelTemplates.find(t => t.id.toString() === tplId);
    if (t) {
      setBulkMessage(t.content);
      if (t.subject) setBulkSubject(t.subject);
    }
  };

  const sendBulk = async () => {
    if (!bulkMessage.trim() || selectedIds.length === 0) return;
    if (channel === 'email' && !bulkSubject.trim()) {
      alert('Zadajte predmet emailu!');
      return;
    }
    if (!confirm(`Odoslať ${channel === 'sms' ? 'SMS' : 'Email'} ${selectedIds.length} zákazníkom?`)) return;
    setSending(true);
    const targets = eligibleCustomers.filter(c => selectedIds.includes(c.id));
    setSendProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      try {
        if (channel === 'sms') {
          await fetchWithAuth('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: c.phone, message: bulkMessage }),
          });
        } else {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: c.email, subject: bulkSubject, message: bulkMessage }),
          });
        }
        await supabase.from('scheduled_sms').insert([{
          user_id: c.id,
          customer_phone: channel === 'sms' ? c.phone : null,
          customer_email: channel === 'email' ? c.email : null,
          customer_name: c.full_name,
          message: bulkMessage,
          subject: channel === 'email' ? bulkSubject : null,
          type: channel,
          scheduled_for: new Date().toISOString(),
          status: 'sent',
        }]);
        await supabase.from('notifications').insert([{
          user_id: c.id,
          title: 'Správa zo servisu',
          content: bulkMessage,
          is_read: false,
          type: 'info',
        }]);
      } catch {}
      setSendProgress({ done: i + 1, total: targets.length });
    }
    setSending(false);
    setSendProgress(null);
    setSelectedIds([]);
    alert('Odoslanie dokončené!');
  };

  const channelAccent = channel === 'sms' ? 'text-blue-400' : 'text-purple-400';

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 font-sans font-bold">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Komunikácia</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">SMS <span className="text-red-600">/</span> Email</h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-zinc-900/30 p-2 rounded-[2rem] border border-zinc-800 w-fit">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ===== TAB: ŠABLÓNY ===== */}
        {activeTab === 'sablony' && (
          <div className="space-y-6">
            <ChannelToggle channel={channel} onChange={setChannel} />

            {/* SMS rámec — úvod a záver */}
            {channel === 'sms' && (
              <div className="bg-zinc-900/40 border-2 border-blue-600/30 rounded-[2rem] p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
                  <span className="text-xl">📱</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Štruktúra SMS správy</p>
                    <p className="text-[9px] text-zinc-500 font-bold mt-0.5">Úvod a záver sú spoločné pre všetky SMS. Použite <span className="text-blue-300 font-black">{'{meno}'}</span> a <span className="text-blue-300 font-black">{'{spz}'}</span> ako zástupné symboly.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Úvod správy</label>
                  <textarea
                    value={smsIntro}
                    onChange={e => setSmsIntro(e.target.value)}
                    rows={2}
                    className="w-full bg-black border border-blue-600/30 focus:border-blue-500 p-4 rounded-2xl text-white font-bold outline-none resize-none text-sm"
                  />
                  <p className="text-[9px] text-zinc-600 font-bold ml-1">→ Zobrazí sa ako: <span className="text-zinc-400">{smsIntro.replace('{meno}', 'Ján Novák').replace('{spz}', 'BA123AB')}</span></p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Záver správy</label>
                  <textarea
                    value={smsFooter}
                    onChange={e => setSmsFooter(e.target.value)}
                    rows={2}
                    className="w-full bg-black border border-blue-600/30 focus:border-blue-500 p-4 rounded-2xl text-white font-bold outline-none resize-none text-sm"
                  />
                </div>

                {/* Náhľad celej správy */}
                <div className="bg-black/60 border border-zinc-800 rounded-2xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Náhľad celej správy</p>
                  <p className="text-xs text-zinc-300 font-bold leading-relaxed whitespace-pre-line">
                    <span className="text-blue-400">{smsIntro.replace('{meno}', 'Ján Novák').replace('{spz}', 'BA123AB')}</span>
                    {' '}[text šablóny]{'\n'}
                    <span className="text-blue-400">{smsFooter}</span>
                  </p>
                </div>

                <button
                  onClick={saveSmsFrame}
                  disabled={savingFrame}
                  className={`px-8 py-3 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all ${
                    frameSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white'
                  }`}
                >
                  {frameSaved ? '✓ Uložené' : savingFrame ? 'Ukladám...' : '💾 Uložiť úvod a záver'}
                </button>
              </div>
            )}

            <div className="border-t border-zinc-800/50 pt-2" />

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${channelAccent}`}>
                Pridať {channel === 'sms' ? 'SMS' : 'Email'} šablónu
              </h3>
              <input type="text" placeholder="Názov šablóny" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none" />
              {channel === 'email' && (
                <input type="text" placeholder="Predmet emailu" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  className="w-full bg-black border border-zinc-700 focus:border-purple-500 p-4 rounded-2xl text-white font-bold outline-none" />
              )}
              <textarea
                placeholder={channel === 'sms' ? 'Text SMS správy...' : 'Obsah emailu...'}
                value={newContent} onChange={e => setNewContent(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none resize-none h-28" />
              <button onClick={addTemplate} disabled={savingTpl || !newLabel || !newContent}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                {savingTpl ? 'Ukladám...' : '+ Pridať'}
              </button>
              {tplError && (
                <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-4 space-y-2">
                  <p className="text-red-400 font-black text-xs uppercase tracking-widest">Chyba uloženia šablóny</p>
                  <p className="text-zinc-400 text-xs font-mono">{tplError}</p>
                  {tplError.includes('subject') && (
                    <div>
                      <p className="text-zinc-500 text-[10px] font-bold mb-1">Spusti v Supabase SQL editore:</p>
                      <code className="block bg-black text-green-400 text-[10px] font-mono p-3 rounded-xl select-all">
                        ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS subject text;
                      </code>
                    </div>
                  )}
                  {(tplError.includes('type') || tplError.includes('column')) && !tplError.includes('subject') && (
                    <div>
                      <p className="text-zinc-500 text-[10px] font-bold mb-1">Spusti v Supabase SQL editore:</p>
                      <code className="block bg-black text-green-400 text-[10px] font-mono p-3 rounded-xl select-all whitespace-pre">
{`ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'sms';
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS subject text;`}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {channelTemplates.length === 0 && (
                <div className="text-center text-zinc-700 font-black uppercase text-xs tracking-widest py-12 border-2 border-dashed border-zinc-900 rounded-[2rem]">
                  Žiadne {channel === 'sms' ? 'SMS' : 'Email'} šablóny
                </div>
              )}
              {channelTemplates.map(t => (
                <div key={t.id} className="bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${channel === 'sms' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>
                          {channel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                        <input className="bg-transparent border-none text-red-400 font-black uppercase text-xs flex-1 outline-none"
                          defaultValue={t.label} onBlur={e => updateTemplate(t.id, 'label', e.target.value)} />
                      </div>
                      {t.subject && (
                        <p className="text-purple-300 text-[10px] font-bold">Predmet: {t.subject}</p>
                      )}
                      <textarea className="bg-transparent border-none text-zinc-300 text-sm w-full outline-none resize-none h-16 font-bold"
                        defaultValue={t.content} onBlur={e => updateTemplate(t.id, 'content', e.target.value)} />
                    </div>
                    <button onClick={() => deleteTemplate(t.id)}
                      className="p-2.5 bg-zinc-800 hover:bg-red-600/20 rounded-xl text-zinc-500 hover:text-red-400 transition-all shrink-0">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== TAB: PLÁNOVANÉ ===== */}
        {activeTab === 'planovane' && (
          <div className="space-y-4">
            <ChannelToggle channel={channel} onChange={setChannel} />

            {schedError && (
              <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-5 mb-4">
                <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-2">Chyba načítania tabuľky scheduled_sms</p>
                <p className="text-zinc-400 text-xs font-mono mb-3">{schedError}</p>
                <p className="text-zinc-500 text-[10px] font-bold">Spusti v Supabase SQL editore:</p>
                <code className="block bg-black text-green-400 text-[10px] font-mono p-3 rounded-xl mt-2 select-all">
                  ALTER TABLE scheduled_sms DISABLE ROW LEVEL SECURITY;
                </code>
              </div>
            )}

            {/* Status filter */}
            {!schedError && (
              <div className="flex gap-2 mb-4">
                {[['all','Všetky'],['pending','Čakajúce'],['sent','Odoslané']].map(([key, label]) => (
                  <button key={key} onClick={() => setStatusFilter(key)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                      statusFilter === key ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-black border-zinc-800 text-zinc-600 hover:text-zinc-300'
                    }`}>
                    {label}
                    <span className="ml-1.5 text-zinc-500">
                      {key === 'all' ? scheduled.length : scheduled.filter(s => s.status === key).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {loadingSched ? (
              <div className="text-center text-zinc-600 animate-pulse py-12 font-black uppercase text-xs">Načítavam...</div>
            ) : (() => {
              const visible = statusFilter === 'all' ? scheduled : scheduled.filter(s => s.status === statusFilter);
              if (visible.length === 0 && !schedError) return (
                <div className="text-center text-zinc-700 font-black uppercase text-xs tracking-widest py-16 border-2 border-dashed border-zinc-900 rounded-[2rem]">
                  Žiadne {statusFilter === 'pending' ? 'čakajúce' : statusFilter === 'sent' ? 'odoslané' : ''} záznamy
                </div>
              );
              return visible.map(item => (
                <div key={item.id} className={`border rounded-[1.5rem] p-5 mb-3 ${item.status === 'pending' ? 'bg-zinc-900/40 border-zinc-700' : 'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${item.status === 'pending' ? 'bg-amber-600/20 text-amber-400' : 'bg-green-600/20 text-green-400'}`}>
                          {item.status === 'pending' ? '⏳ Čaká' : '✓ Odoslaná'}
                        </span>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${channel === 'sms' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>
                          {channel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                        <p className="font-black text-sm text-white">{item.customer_name || 'Neznámy'}</p>
                        {item.plate_number && <span className="bg-white text-black text-[9px] font-black px-2 py-0.5 rounded-lg">{item.plate_number}</span>}
                      </div>
                      <p className="text-zinc-500 text-[10px] font-black uppercase mb-1">
                        📅 {fmtDt(item.scheduled_for)} · {contactIcon} {channel === 'sms' ? item.customer_phone : item.customer_email}
                      </p>
                      {item.subject && <p className="text-purple-300 text-[10px] font-bold mb-1">Predmet: {item.subject}</p>}
                      <p className="text-zinc-400 text-xs font-bold leading-relaxed line-clamp-3">{item.message}</p>
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => sendNow(item)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase rounded-xl transition-all">
                          Odoslať teraz
                        </button>
                        <button onClick={() => cancelScheduled(item.id)}
                          className="px-4 py-2 bg-zinc-800 hover:bg-red-600/20 text-zinc-400 hover:text-red-400 text-[9px] font-black uppercase rounded-xl transition-all">
                          Zrušiť
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* ===== TAB: HROMADNÉ ===== */}
        {activeTab === 'hromadne' && (
          <div className="space-y-6">
            <ChannelToggle channel={channel} onChange={setChannel} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Príjemcovia */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Príjemcovia <span className={`${channelAccent}`}>({contactLabel})</span>
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedIds(filteredCustomers.map(c => c.id))}
                      className="text-[9px] font-black uppercase px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all text-zinc-300">
                      Všetci
                    </button>
                    <button onClick={() => setSelectedIds([])}
                      className="text-[9px] font-black uppercase px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all text-zinc-500">
                      Žiaden
                    </button>
                  </div>
                </div>

                <input type="text" placeholder={`Hľadať podľa mena alebo ${contactLabel.toLowerCase()}...`}
                  value={custSearch} onChange={e => setCustSearch(e.target.value)}
                  className="w-full bg-black border border-zinc-700 focus:border-red-500 p-3 rounded-xl text-white text-xs font-bold outline-none mb-3" />

                {loadingCust ? (
                  <div className="text-zinc-600 animate-pulse text-xs font-black uppercase py-8 text-center">Načítavam...</div>
                ) : (
                  <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[360px]">
                    {filteredCustomers.map(c => (
                      <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedIds.includes(c.id) ? 'bg-red-600/10 border-red-600/30' : 'border-transparent hover:bg-zinc-900'}`}>
                        <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCustomer(c.id)} className="accent-red-600 w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{c.full_name || '—'}</p>
                          <p className="text-[10px] font-bold text-zinc-500 truncate">{c[contactKey]}</p>
                        </div>
                      </label>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="text-zinc-700 text-xs font-black uppercase text-center py-8">
                        Žiadni zákazníci s {channel === 'sms' ? 'telefónnym číslom' : 'emailom'}
                      </p>
                    )}
                  </div>
                )}

                {selectedIds.length > 0 && (
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-3 border-t border-zinc-800 pt-3">
                    Vybraných: {selectedIds.length} zákazníkov
                  </p>
                )}
              </div>

              {/* Správa + odoslanie */}
              <div className="space-y-4">
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {channel === 'sms' ? 'SMS správa' : 'Email správa'}
                  </h3>

                  <select value={selTplId} onChange={e => handleTplSelect(e.target.value)}
                    className="w-full bg-black border border-zinc-700 focus:border-red-500 p-3 rounded-2xl text-white font-black text-[10px] outline-none">
                    <option value="">— Vlastný text —</option>
                    {channelTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>

                  {channel === 'email' && (
                    <input type="text" placeholder="Predmet emailu *"
                      value={bulkSubject} onChange={e => setBulkSubject(e.target.value)}
                      className="w-full bg-black border border-zinc-700 focus:border-purple-500 p-4 rounded-2xl text-white font-bold outline-none" />
                  )}

                  <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)}
                    placeholder={channel === 'sms' ? 'Text SMS správy...' : 'Obsah emailu...'}
                    className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none resize-none h-36" />

                  <div className="flex items-center justify-between text-[9px] font-black text-zinc-600 uppercase">
                    <span>{bulkMessage.length} znakov</span>
                    <span>{selectedIds.length} príjemcov</span>
                  </div>
                </div>

                {sendProgress && (
                  <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4 text-center">
                    <p className="text-blue-400 font-black uppercase text-[10px] tracking-widest mb-2">Odosielam...</p>
                    <div className="w-full bg-zinc-900 rounded-full h-2 mb-2">
                      <div className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${(sendProgress.done / sendProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-zinc-400 text-[9px] font-black">{sendProgress.done} / {sendProgress.total}</p>
                  </div>
                )}

                <button onClick={sendBulk}
                  disabled={sending || !bulkMessage.trim() || selectedIds.length === 0 || (channel === 'email' && !bulkSubject.trim())}
                  className={`w-full py-5 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${
                    channel === 'sms' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'
                  }`}>
                  {channel === 'sms' ? '📱' : '✉️'} {sending ? 'Odosielam...' : `Odoslať ${selectedIds.length > 0 ? selectedIds.length + (channel === 'sms' ? ' SMS' : ' emailov') : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: HISTÓRIA ===== */}
        {activeTab === 'historia' && (
          <div className="space-y-6">

            {/* KPI karty */}
            {!loadingHistory && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Odoslaných SMS', count: history.filter(h => !h.type || h.type === 'sms' || h.type === 'one-time').length, color: 'text-blue-400', bg: 'bg-blue-600/10 border-blue-600/30' },
                  { label: 'Odoslaných emailov', count: history.filter(h => h.type === 'email').length, color: 'text-purple-400', bg: 'bg-purple-600/10 border-purple-600/30' },
                  { label: 'Spolu správ', count: history.length, color: 'text-white', bg: 'bg-zinc-800/60 border-zinc-700' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} className={`border rounded-[1.5rem] p-5 text-center ${bg}`}>
                    <p className={`text-3xl font-black italic ${color}`}>{count}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filter + search */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-2">
                {[['all', 'Všetky'], ['sms', '📱 SMS'], ['email', '✉️ Email']].map(([key, label]) => (
                  <button key={key} onClick={() => setHistoryType(key)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                      historyType === key ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-black border-zinc-800 text-zinc-600 hover:text-zinc-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Hľadať podľa mena alebo ŠPZ..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-black border border-zinc-700 focus:border-zinc-500 p-3 rounded-xl text-white text-xs font-bold outline-none"
              />
            </div>

            {/* Zoznam */}
            {loadingHistory ? (
              <div className="text-center text-zinc-600 animate-pulse py-12 font-black uppercase text-xs">Načítavam...</div>
            ) : (() => {
              const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
              const q = nd(historySearch);
              const visible = history.filter(h => {
                const typeOk = historyType === 'all'
                  || (historyType === 'sms' && (!h.type || h.type === 'sms' || h.type === 'one-time'))
                  || (historyType === 'email' && h.type === 'email');
                const searchOk = !q || nd(h.customer_name).includes(q) || nd(h.plate_number).includes(q);
                return typeOk && searchOk;
              });

              if (visible.length === 0) return (
                <div className="text-center text-zinc-700 font-black uppercase text-xs tracking-widest py-16 border-2 border-dashed border-zinc-900 rounded-[2rem]">
                  Žiadne odoslané správy
                </div>
              );

              return (
                <div className="space-y-2">
                  {visible.map(item => {
                    const isSms = !item.type || item.type === 'sms' || item.type === 'one-time';
                    return (
                      <div key={item.id} className="bg-zinc-950 border border-zinc-800 rounded-[1.5rem] p-4">
                        <div className="flex items-start gap-3">
                          <span className={`shrink-0 text-[8px] font-black px-2 py-1 rounded border mt-0.5 ${isSms ? 'bg-blue-600/20 text-blue-400 border-blue-800' : 'bg-purple-600/20 text-purple-400 border-purple-800'}`}>
                            {isSms ? '📱 SMS' : '✉️ Email'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-black text-sm text-white">{item.customer_name || '—'}</span>
                              {item.plate_number && <span className="bg-white text-black text-[9px] font-black px-2 py-0.5 rounded-lg">{item.plate_number}</span>}
                              <span className="text-zinc-600 text-[10px] font-black ml-auto">{fmtDt(item.scheduled_for)}</span>
                            </div>
                            <p className="text-zinc-500 text-[10px] font-black uppercase mb-1">
                              {isSms ? `📞 ${item.customer_phone || '—'}` : `✉️ ${item.customer_email || '—'}`}
                            </p>
                            {item.subject && <p className="text-purple-300 text-[10px] font-bold mb-1">Predmet: {item.subject}</p>}
                            <p className="text-zinc-400 text-xs font-bold leading-relaxed line-clamp-2">{item.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
