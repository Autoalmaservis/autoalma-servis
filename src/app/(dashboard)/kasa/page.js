'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const DAY_NAMES = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok'];
const DAY_SHORT = ['Pon', 'Uto', 'Str', 'Štv', 'Pia'];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fDate(d) {
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function KasaPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalDay, setModalDay] = useState(null);
  const [form, setForm] = useState({ type: 'vydaj', amount: '', description: '', spz: '', isVyplata: false, employee_id: '' });
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [detailDay, setDetailDay] = useState(null);

  useEffect(() => {
    supabase.from('employees').select('id, name, color').eq('active', true)
      .then(({ data }) => { if (data) setEmployees(data); });
  }, []);

  useEffect(() => { fetchEntries(); }, [weekStart]);

  const fetchEntries = async () => {
    setLoading(true);
    const from = toDateStr(weekStart);
    const to = toDateStr(new Date(weekStart.getTime() + 4 * 86400000));
    const { data } = await supabase
      .from('kasa_entries')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('created_at', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  };

  const days = Array.from({ length: 5 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));
  const dayEntries = (day) => entries.filter(e => e.date === toDateStr(day));
  const totalPrijem = entries.filter(e => e.type === 'prijem').reduce((s, e) => s + Number(e.amount), 0);
  const totalVydaj  = entries.filter(e => e.type === 'vydaj').reduce((s, e) => s + Number(e.amount), 0);
  const zostatok    = totalPrijem - totalVydaj;
  const preneseny   = entries.filter(e => e.type === 'prijem' && e.description && e.description.startsWith('Prevod z týždňa')).reduce((s, e) => s + Number(e.amount), 0);
  const zarobene    = zostatok - preneseny;

  const openModal = (day) => {
    setModalDay(day);
    setForm({ type: 'vydaj', amount: '', description: '', spz: '', isVyplata: false, employee_id: '' });
    setShowModal(true);
  };

  const openDayDetail = (day) => {
    setDetailDay(day);
    setEditId(null);
    setShowDayDetail(true);
  };

  const handleSave = async () => {
    if (!form.amount || !modalDay) return;
    if (form.isVyplata && !form.employee_id) return;
    setSaving(true);
    const emp = form.isVyplata ? employees.find(e => e.id === form.employee_id) : null;
    const description = form.isVyplata
      ? `Výplata — ${emp?.name || ''}${form.description ? ': ' + form.description : ''}`
      : (form.description || null);
    await supabase.from('kasa_entries').insert([{
      date: toDateStr(modalDay),
      type: form.type,
      amount: parseFloat(form.amount),
      description,
      spz: form.spz || null,
      employee_id: form.isVyplata ? (form.employee_id || null) : null,
    }]);
    setSaving(false);
    setShowModal(false);
    fetchEntries();
  };

  const openEdit = (entry, e) => {
    e.stopPropagation();
    setEditId(entry.id);
    setEditForm({ amount: String(entry.amount), description: entry.description || '' });
  };

  const handleEditSave = async () => {
    if (!editForm.amount || !editId) return;
    setEditSaving(true);
    await supabase.from('kasa_entries').update({
      amount: parseFloat(editForm.amount),
      description: editForm.description || null,
    }).eq('id', editId);
    setEditSaving(false);
    setEditId(null);
    fetchEntries();
  };

  const handleDelete = async (id) => {
    if (!confirm('Naozaj chceš zmazať tento záznam?')) return;
    await supabase.from('kasa_entries').delete().eq('id', id);
    setEditId(null);
    fetchEntries();
  };

  const handleTransferToNextWeek = async () => {
    if (zostatok <= 0) return;
    if (!confirm(`Preniesť ${zostatok.toFixed(2)} € do nasledujúceho týždňa?`)) return;
    setTransferring(true);
    const nextMonday = new Date(weekStart.getTime() + 7 * 86400000);
    await supabase.from('kasa_entries').insert([{
      date: toDateStr(nextMonday),
      type: 'prijem',
      amount: zostatok,
      description: `Prevod z týždňa ${fDate(days[0])} – ${fDate(days[4])}`,
      spz: null,
    }]);
    setTransferring(false);
    setWeekStart(nextMonday);
  };

  const weekLabel = `${fDate(days[0])} – ${fDate(days[4])}.${days[0].getFullYear()}`;
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getMonday(new Date()));

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 font-sans font-bold" onClick={() => setEditId(null)}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
              Kasa <span className="text-red-600">—</span> Hotovosť
            </h1>
            {isCurrentWeek && <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Aktuálny týždeň</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart(d => new Date(d.getTime() - 7 * 86400000))} className="bg-zinc-800 hover:bg-zinc-700 w-10 h-10 rounded-xl font-black text-lg transition-all flex items-center justify-center">←</button>
            <span className="text-sm font-black text-zinc-300 uppercase tracking-widest px-2">{weekLabel}</span>
            <button onClick={() => setWeekStart(d => new Date(d.getTime() + 7 * 86400000))} className="bg-zinc-800 hover:bg-zinc-700 w-10 h-10 rounded-xl font-black text-lg transition-all flex items-center justify-center">→</button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(getMonday(new Date()))} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-4 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Dnes</button>
            )}
          </div>
        </div>

        {/* Súhrn týždňa */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-600/10 border border-green-600/30 rounded-[1.5rem] p-5 text-center">
            <p className="text-[10px] text-green-500 uppercase tracking-widest font-black mb-1">Príjmy</p>
            <p className="text-3xl font-black text-green-400 italic">+{totalPrijem.toFixed(2)} €</p>
          </div>
          <div className="bg-red-600/10 border border-red-600/30 rounded-[1.5rem] p-5 text-center">
            <p className="text-[10px] text-red-500 uppercase tracking-widest font-black mb-1">Výdaje</p>
            <p className="text-3xl font-black text-red-400 italic">−{totalVydaj.toFixed(2)} €</p>
          </div>
          <div className={`rounded-[1.5rem] p-5 text-center border ${zostatok >= 0 ? 'bg-white/5 border-white/10' : 'bg-orange-600/10 border-orange-600/30'}`}>
            <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${zostatok >= 0 ? 'text-zinc-400' : 'text-orange-400'}`}>Zostatok v kase</p>
            <p className={`text-3xl font-black italic ${zostatok >= 0 ? 'text-white' : 'text-orange-400'}`}>{zostatok >= 0 ? '+' : ''}{zostatok.toFixed(2)} €</p>
          </div>
          <div className={`rounded-[1.5rem] p-5 text-center border ${zarobene >= 0 ? 'bg-blue-600/10 border-blue-600/30' : 'bg-orange-600/10 border-orange-600/30'}`}>
            <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${zarobene >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>Zarobené tento týždeň</p>
            <p className={`text-3xl font-black italic ${zarobene >= 0 ? 'text-blue-300' : 'text-orange-400'}`}>{zarobene >= 0 ? '+' : ''}{zarobene.toFixed(2)} €</p>
            {preneseny > 0 && <p className="text-[9px] text-zinc-600 mt-1 font-black uppercase tracking-widest">bez {preneseny.toFixed(0)} € prenosu</p>}
          </div>
        </div>

        {/* 5-stĺpcová tabuľka */}
        {loading ? (
          <div className="text-center text-zinc-600 uppercase tracking-widest text-[10px] py-20 animate-pulse">Načítavam...</div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {days.map((day, idx) => {
                const de = dayEntries(day);
                const dayPrijem = de.filter(e => e.type === 'prijem').reduce((s, e) => s + Number(e.amount), 0);
                const dayVydaj  = de.filter(e => e.type === 'vydaj').reduce((s, e) => s + Number(e.amount), 0);
                const dayNet    = dayPrijem - dayVydaj;
                const isToday   = toDateStr(day) === toDateStr(new Date());

                return (
                  <div key={idx} className={`rounded-[1.5rem] border flex flex-col ${isToday ? 'border-red-600/50 bg-red-600/5' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div
                      className={`px-3 py-3 text-center border-b cursor-pointer hover:bg-white/5 transition-colors rounded-t-[1.5rem] ${isToday ? 'border-red-600/30' : 'border-zinc-800'}`}
                      onClick={() => openDayDetail(day)}
                    >
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-red-400' : 'text-zinc-500'}`}>{DAY_SHORT[idx]}</p>
                      <p className="text-sm font-black">{fDate(day)}</p>
                      {de.length > 0 && <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">zobraziť →</p>}
                    </div>

                    <div className="px-2 pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(day); }}
                        className="w-full bg-zinc-800 hover:bg-red-600 text-zinc-400 hover:text-white py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                      >+ Záznam</button>
                    </div>

                    <div className="flex-1 p-2 space-y-1.5 min-h-[140px]">
                      {de.map(entry => {
                        const isVyplata = !!entry.employee_id;
                        return (
                          <div key={entry.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(entry, e); }}
                            className={`rounded-xl p-2 text-[10px] font-black cursor-pointer transition-all ${
                              isVyplata
                                ? 'bg-amber-600/10 border border-amber-600/20 hover:border-amber-500/50'
                                : entry.type === 'prijem'
                                  ? 'bg-green-600/10 border border-green-600/20 hover:border-green-500/50'
                                  : 'bg-red-600/10 border border-red-600/20 hover:border-red-500/50'
                            }`}
                          >
                            {editId === entry.id ? (
                              <div onClick={e => e.stopPropagation()} className="space-y-1">
                                <input
                                  type="number" step="any" min="0"
                                  value={editForm.amount}
                                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                  onFocus={e => e.target.select()}
                                  className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[11px] font-black outline-none"
                                  autoFocus
                                />
                                <input
                                  type="text"
                                  value={editForm.description}
                                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                  placeholder="Popis..."
                                  className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[10px] font-bold outline-none"
                                />
                                <div className="flex gap-1 mt-1">
                                  <button onClick={handleEditSave} disabled={editSaving}
                                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest transition-all">
                                    {editSaving ? '...' : 'Uložiť'}
                                  </button>
                                  <button onClick={() => handleDelete(entry.id)}
                                    className="flex-1 bg-red-700 hover:bg-red-600 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest transition-all">
                                    Zmazať
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {entry.spz && <p className="text-zinc-200 uppercase tracking-wider text-[11px]">{entry.spz}</p>}
                                {entry.description && <p className={`truncate ${isVyplata ? 'text-amber-300' : 'text-zinc-400'}`}>{entry.description}</p>}
                                <p className={`font-black text-[13px] mt-0.5 ${
                                  isVyplata ? 'text-amber-400' : entry.type === 'prijem' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {entry.type === 'prijem' ? '+' : '−'}{Number(entry.amount).toFixed(2)} €
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(dayPrijem > 0 || dayVydaj > 0) && (
                      <div className="p-2 border-t border-zinc-800">
                        <div className="text-[9px] font-black uppercase space-y-0.5 px-1">
                          {dayPrijem > 0 && <div className="flex justify-between text-green-500"><span>In:</span><span>+{dayPrijem.toFixed(2)} €</span></div>}
                          {dayVydaj  > 0 && <div className="flex justify-between text-red-400"><span>Out:</span><span>−{dayVydaj.toFixed(2)} €</span></div>}
                          <div className={`flex justify-between border-t border-zinc-800 pt-0.5 ${dayNet >= 0 ? 'text-white' : 'text-orange-400'}`}>
                            <span>=</span><span>{dayNet >= 0 ? '+' : ''}{dayNet.toFixed(2)} €</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleTransferToNextWeek}
              disabled={transferring || zostatok <= 0}
              className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-700 hover:border-green-600 text-zinc-400 hover:text-green-400 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
            >
              <span>→</span>
              {transferring ? 'Prenášam...' : `Preniesť zostatok ${zostatok > 0 ? zostatok.toFixed(2) + ' €' : ''} do ďalšieho týždňa`}
              <span>→</span>
            </button>
          </>
        )}
      </div>

      {/* Modal: detail dňa */}
      {showDayDetail && detailDay && (() => {
        const de = dayEntries(detailDay);
        const prijmy = de.filter(e => e.type === 'prijem');
        const vydaje = de.filter(e => e.type === 'vydaj');
        const dayPrijem = prijmy.reduce((s, e) => s + Number(e.amount), 0);
        const dayVydaj  = vydaje.reduce((s, e) => s + Number(e.amount), 0);
        const dayNet = dayPrijem - dayVydaj;
        const dayIdx = days.findIndex(d => toDateStr(d) === toDateStr(detailDay));
        return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 font-bold" onClick={() => { setShowDayDetail(false); setEditId(null); }}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">
                    {dayIdx >= 0 ? DAY_NAMES[dayIdx] : ''} <span className="text-red-600">—</span> {fDate(detailDay)}
                  </h3>
                  <p className={`text-lg font-black mt-1 ${dayNet >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {dayNet >= 0 ? '+' : ''}{dayNet.toFixed(2)} € zostatok
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDayDetail(false); openModal(detailDay); }}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >+ Záznam</button>
                  <button onClick={() => { setShowDayDetail(false); setEditId(null); }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">✕</button>
                </div>
              </div>

              {/* Dve stĺpce */}
              <div className="grid grid-cols-2 divide-x divide-zinc-800 max-h-[70vh] overflow-y-auto">

                {/* Príjmy */}
                <div className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-4 flex justify-between">
                    <span>Príjmy</span>
                    <span className="text-green-400">+{dayPrijem.toFixed(2)} €</span>
                  </p>
                  {prijmy.length === 0 && <p className="text-zinc-700 text-[10px] uppercase tracking-widest italic">Žiadne príjmy</p>}
                  <div className="space-y-2">
                    {prijmy.map(entry => (
                      <div key={entry.id} onClick={(e) => { e.stopPropagation(); openEdit(entry, e); }}
                        className="bg-green-600/10 border border-green-600/20 hover:border-green-500/50 rounded-xl p-3 text-[11px] font-black cursor-pointer transition-all">
                        {editId === entry.id ? (
                          <div onClick={e => e.stopPropagation()} className="space-y-1">
                            <input type="number" step="any" min="0" value={editForm.amount}
                              onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                              onFocus={e => e.target.select()}
                              className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[11px] font-black outline-none" autoFocus />
                            <input type="text" value={editForm.description}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="Popis..." className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[10px] font-bold outline-none" />
                            <div className="flex gap-1 mt-1">
                              <button onClick={handleEditSave} disabled={editSaving}
                                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest">{editSaving ? '...' : 'Uložiť'}</button>
                              <button onClick={() => handleDelete(entry.id)}
                                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest">Zmazať</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {entry.spz && <p className="text-zinc-200 uppercase tracking-wider">{entry.spz}</p>}
                            {entry.description && <p className="text-zinc-400 text-[10px]">{entry.description}</p>}
                            <p className="text-green-400 font-black text-base mt-0.5">+{Number(entry.amount).toFixed(2)} €</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Výdaje */}
                <div className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-4 flex justify-between">
                    <span>Výdaje</span>
                    <span className="text-red-400">−{dayVydaj.toFixed(2)} €</span>
                  </p>
                  {vydaje.length === 0 && <p className="text-zinc-700 text-[10px] uppercase tracking-widest italic">Žiadne výdaje</p>}
                  <div className="space-y-2">
                    {vydaje.map(entry => {
                      const isVyplata = !!entry.employee_id;
                      return (
                        <div key={entry.id} onClick={(e) => { e.stopPropagation(); openEdit(entry, e); }}
                          className={`border rounded-xl p-3 text-[11px] font-black cursor-pointer transition-all ${isVyplata ? 'bg-amber-600/10 border-amber-600/20 hover:border-amber-500/50' : 'bg-red-600/10 border-red-600/20 hover:border-red-500/50'}`}>
                          {editId === entry.id ? (
                            <div onClick={e => e.stopPropagation()} className="space-y-1">
                              <input type="number" step="any" min="0" value={editForm.amount}
                                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                onFocus={e => e.target.select()}
                                className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[11px] font-black outline-none" autoFocus />
                              <input type="text" value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Popis..." className="w-full bg-black border border-zinc-600 text-white p-1.5 rounded-lg text-[10px] font-bold outline-none" />
                              <div className="flex gap-1 mt-1">
                                <button onClick={handleEditSave} disabled={editSaving}
                                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest">{editSaving ? '...' : 'Uložiť'}</button>
                                <button onClick={() => handleDelete(entry.id)}
                                  className="flex-1 bg-red-700 hover:bg-red-600 text-white text-[8px] py-1 rounded-lg uppercase tracking-widest">Zmazať</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {entry.spz && <p className="text-zinc-200 uppercase tracking-wider">{entry.spz}</p>}
                              {entry.description && <p className={`text-[10px] ${isVyplata ? 'text-amber-300' : 'text-zinc-400'}`}>{entry.description}</p>}
                              <p className={`font-black text-base mt-0.5 ${isVyplata ? 'text-amber-400' : 'text-red-400'}`}>−{Number(entry.amount).toFixed(2)} €</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer súhrn */}
              {de.length > 0 && (
                <div className="px-8 py-4 border-t border-zinc-800 grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-[9px] text-green-500 uppercase tracking-widest font-black">Príjmy</p><p className="text-green-400 font-black">+{dayPrijem.toFixed(2)} €</p></div>
                  <div><p className="text-[9px] text-red-400 uppercase tracking-widest font-black">Výdaje</p><p className="text-red-400 font-black">−{dayVydaj.toFixed(2)} €</p></div>
                  <div><p className={`text-[9px] uppercase tracking-widest font-black ${dayNet >= 0 ? 'text-zinc-400' : 'text-orange-400'}`}>Zostatok</p><p className={`font-black ${dayNet >= 0 ? 'text-white' : 'text-orange-400'}`}>{dayNet >= 0 ? '+' : ''}{dayNet.toFixed(2)} €</p></div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal: pridať záznam */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 font-bold" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-1">Nový záznam</h3>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-6">
              {modalDay ? `${DAY_NAMES[days.findIndex(d => toDateStr(d) === toDateStr(modalDay))]}, ${fDate(modalDay)}` : ''}
            </p>

            {/* Typ: Výdaj / Príjem */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm(f => ({ ...f, type: 'vydaj', isVyplata: false }))}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'vydaj' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                − Výdaj
              </button>
              <button onClick={() => setForm(f => ({ ...f, type: 'prijem', isVyplata: false }))}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'prijem' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                + Príjem
              </button>
            </div>

            {/* Sub-typ: Výplata (len pri vydaj) */}
            {form.type === 'vydaj' && employees.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setForm(f => ({ ...f, isVyplata: !f.isVyplata, employee_id: '' }))}
                  className={`w-full py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    form.isVyplata
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                      : 'bg-black border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  💰 Výplata mechanika
                </button>
                {form.isVyplata && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {employees.map(emp => (
                      <button key={emp.id}
                        onClick={() => setForm(f => ({ ...f, employee_id: emp.id }))}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 justify-center ${
                          form.employee_id === emp.id
                            ? 'border-amber-500 text-white'
                            : 'bg-black border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
                        }`}
                        style={form.employee_id === emp.id ? { background: emp.color || '#d97706' } : {}}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: emp.color || '#666' }} />
                        {emp.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 mb-6">
              <input
                type="number" min="0" step="any"
                placeholder="Suma v €"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                onFocus={e => e.target.select()}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none"
                autoFocus
              />
              <input
                type="text"
                placeholder={form.isVyplata ? 'Poznámka (nepovinné)' : 'Popis (napr. Benzín, Drobný nákup...)'}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none"
              />
              {!form.isVyplata && (
                <input
                  type="text"
                  placeholder="ŠPZ (nepovinné)"
                  value={form.spz}
                  onChange={e => setForm(f => ({ ...f, spz: e.target.value.toUpperCase() }))}
                  className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none uppercase tracking-widest"
                />
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                Zrušiť
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.amount || (form.isVyplata && !form.employee_id)}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                {saving ? 'Ukladám...' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
