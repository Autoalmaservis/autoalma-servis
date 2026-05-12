'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const TABS = [
  { key: 'sablony',   label: 'Šablóny',   icon: '📋' },
  { key: 'planovane', label: 'Plánované',  icon: '📅' },
  { key: 'hromadne',  label: 'Hromadné',   icon: '📣' },
];

function fmtDt(iso) {
  return new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SmsEmailPage() {
  const [activeTab, setActiveTab] = useState('sablony');

  // --- Šablóny ---
  const [templates, setTemplates] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [newContent, setNewContent] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // --- Plánované ---
  const [scheduled, setScheduled] = useState([]);
  const [loadingSched, setLoadingSched] = useState(false);

  // --- Hromadné ---
  const [customers, setCustomers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [selTplId, setSelTplId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);

  useEffect(() => { fetchTemplates(); }, []);
  useEffect(() => {
    if (activeTab === 'planovane') fetchScheduled();
    if (activeTab === 'hromadne') fetchCustomers();
  }, [activeTab]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('sms_templates').select('*').order('label', { ascending: true });
    if (data) setTemplates(data);
  };

  const fetchScheduled = async () => {
    setLoadingSched(true);
    const { data } = await supabase.from('scheduled_sms').select('*').eq('status', 'pending').order('scheduled_for', { ascending: true });
    if (data) setScheduled(data);
    setLoadingSched(false);
  };

  const fetchCustomers = async () => {
    setLoadingCust(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, email')
      .in('role', ['zakaznik', 'klient'])
      .order('full_name', { ascending: true });
    if (data) setCustomers(data.filter(c => c.phone));
    setLoadingCust(false);
  };

  // Šablóny CRUD
  const addTemplate = async () => {
    if (!newLabel.trim() || !newContent.trim()) return;
    setSavingTpl(true);
    await supabase.from('sms_templates').insert([{ label: newLabel, content: newContent }]);
    setNewLabel(''); setNewContent('');
    fetchTemplates();
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

  const sendNow = async (sms) => {
    try {
      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sms.customer_phone, message: sms.message }),
      });
      await supabase.from('scheduled_sms').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', sms.id);
      fetchScheduled();
    } catch (err) {
      alert('Chyba: ' + err.message);
    }
  };

  // Hromadné
  const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filteredCustomers = custSearch
    ? customers.filter(c => nd(c.full_name).includes(nd(custSearch)) || (c.phone || '').includes(custSearch))
    : customers;

  const toggleCustomer = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleTplSelect = (tplId) => {
    setSelTplId(tplId);
    const t = templates.find(t => t.id.toString() === tplId);
    if (t) setBulkMessage(t.content);
  };

  const sendBulk = async () => {
    if (!bulkMessage.trim() || selectedIds.length === 0) return;
    if (!confirm(`Odoslať SMS ${selectedIds.length} zákazníkom?`)) return;
    setSending(true);
    const targets = customers.filter(c => selectedIds.includes(c.id));
    setSendProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      try {
        await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: c.phone, message: bulkMessage }),
        });
        await supabase.from('scheduled_sms').insert([{
          customer_phone: c.phone,
          customer_name: c.full_name,
          message: bulkMessage,
          scheduled_for: new Date().toISOString(),
          status: 'sent',
        }]);
      } catch {}
      setSendProgress({ done: i + 1, total: targets.length });
    }
    setSending(false);
    setSendProgress(null);
    setSelectedIds([]);
    alert('Odoslanie dokončené!');
  };

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
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-red-400">Pridať šablónu</h3>
              <input type="text" placeholder="Názov šablóny" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none" />
              <textarea placeholder="Text správy..." value={newContent} onChange={e => setNewContent(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none resize-none h-28" />
              <button onClick={addTemplate} disabled={savingTpl || !newLabel || !newContent}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                {savingTpl ? 'Ukladám...' : '+ Pridať'}
              </button>
            </div>

            <div className="space-y-3">
              {templates.length === 0 && (
                <div className="text-center text-zinc-700 font-black uppercase text-xs tracking-widest py-12 border-2 border-dashed border-zinc-900 rounded-[2rem]">Žiadne šablóny</div>
              )}
              {templates.map(t => (
                <div key={t.id} className="bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] p-5 group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <input className="bg-transparent border-none text-red-400 font-black uppercase text-xs w-full outline-none"
                        defaultValue={t.label} onBlur={e => updateTemplate(t.id, 'label', e.target.value)} />
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
            {loadingSched ? (
              <div className="text-center text-zinc-600 animate-pulse py-12 font-black uppercase text-xs">Načítavam...</div>
            ) : scheduled.length === 0 ? (
              <div className="text-center text-zinc-700 font-black uppercase text-xs tracking-widest py-16 border-2 border-dashed border-zinc-900 rounded-[2rem]">
                Žiadne naplánované správy
              </div>
            ) : scheduled.map(sms => (
              <div key={sms.id} className="bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-black text-sm text-white">{sms.customer_name || 'Neznámy'}</p>
                      {sms.plate_number && <span className="bg-white text-black text-[9px] font-black px-2 py-0.5 rounded-lg">{sms.plate_number}</span>}
                    </div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase mb-2">📅 {fmtDt(sms.scheduled_for)} · 📞 {sms.customer_phone}</p>
                    <p className="text-zinc-400 text-xs font-bold leading-relaxed line-clamp-2">{sms.message}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => sendNow(sms)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase rounded-xl transition-all">
                      Odoslať teraz
                    </button>
                    <button onClick={() => cancelScheduled(sms.id)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-red-600/20 text-zinc-400 hover:text-red-400 text-[9px] font-black uppercase rounded-xl transition-all">
                      Zrušiť
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== TAB: HROMADNÉ ===== */}
        {activeTab === 'hromadne' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Príjemcovia */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Príjemcovia</h3>
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

              <input type="text" placeholder="Hľadať zákazníka..." value={custSearch} onChange={e => setCustSearch(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-3 rounded-xl text-white text-xs font-bold outline-none mb-3" />

              {loadingCust ? (
                <div className="text-zinc-600 animate-pulse text-xs font-black uppercase py-8 text-center">Načítavam...</div>
              ) : (
                <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[380px]">
                  {filteredCustomers.map(c => (
                    <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedIds.includes(c.id) ? 'bg-red-600/10 border-red-600/30' : 'border-transparent hover:bg-zinc-900'}`}>
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCustomer(c.id)} className="accent-red-600 w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{c.full_name || '—'}</p>
                        <p className="text-[10px] font-bold text-zinc-500">{c.phone}</p>
                      </div>
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="text-zinc-700 text-xs font-black uppercase text-center py-8">Žiadni zákazníci s číslom</p>
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Správa</h3>

                <select value={selTplId} onChange={e => handleTplSelect(e.target.value)}
                  className="w-full bg-black border border-zinc-700 focus:border-red-500 p-3 rounded-2xl text-white font-black text-[10px] outline-none">
                  <option value="">— Vlastný text —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>

                <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)}
                  placeholder="Text správy pre vybraných zákazníkov..."
                  className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white font-bold outline-none resize-none h-40" />

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
                disabled={sending || !bulkMessage.trim() || selectedIds.length === 0}
                className="w-full py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                🚀 {sending ? 'Odosielam...' : `Odoslať ${selectedIds.length > 0 ? selectedIds.length + ' správ' : ''}`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
