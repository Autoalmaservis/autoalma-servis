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
  return d.toISOString().split('T')[0];
}

export default function KasaPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalDay, setModalDay] = useState(null);
  const [form, setForm] = useState({ type: 'vydaj', amount: '', description: '', spz: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

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

  const openModal = (day) => {
    setModalDay(day);
    setForm({ type: 'vydaj', amount: '', description: '', spz: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !modalDay) return;
    setSaving(true);
    await supabase.from('kasa_entries').insert([{
      date: toDateStr(modalDay),
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description || null,
      spz: form.spz || null,
    }]);
    setSaving(false);
    setShowModal(false);
    fetchEntries();
  };

  const handleDelete = async (id) => {
    await supabase.from('kasa_entries').delete().eq('id', id);
    setDeleteId(null);
    fetchEntries();
  };

  const weekLabel = `${fDate(days[0])} – ${fDate(days[4])}.${days[0].getFullYear()}`;
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getMonday(new Date()));

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 font-sans font-bold">
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
        <div className="grid grid-cols-3 gap-4 mb-6">
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
        </div>

        {/* 5-stĺpcová tabuľka */}
        {loading ? (
          <div className="text-center text-zinc-600 uppercase tracking-widest text-[10px] py-20 animate-pulse">Načítavam...</div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {days.map((day, idx) => {
              const de = dayEntries(day);
              const dayPrijem = de.filter(e => e.type === 'prijem').reduce((s, e) => s + Number(e.amount), 0);
              const dayVydaj  = de.filter(e => e.type === 'vydaj').reduce((s, e) => s + Number(e.amount), 0);
              const dayNet    = dayPrijem - dayVydaj;
              const isToday   = toDateStr(day) === toDateStr(new Date());

              return (
                <div key={idx} className={`rounded-[1.5rem] border flex flex-col ${isToday ? 'border-red-600/50 bg-red-600/5' : 'border-zinc-800 bg-zinc-900'}`}>
                  {/* Hlavička dňa */}
                  <div className={`px-3 py-3 text-center border-b ${isToday ? 'border-red-600/30' : 'border-zinc-800'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-red-400' : 'text-zinc-500'}`}>{DAY_SHORT[idx]}</p>
                    <p className="text-sm font-black">{fDate(day)}</p>
                  </div>

                  {/* Záznamy */}
                  <div className="flex-1 p-2 space-y-1.5 min-h-[160px]">
                    {de.map(entry => (
                      <div
                        key={entry.id}
                        onClick={() => setDeleteId(deleteId === entry.id ? null : entry.id)}
                        className={`rounded-xl p-2 text-[10px] font-black cursor-pointer transition-all ${entry.type === 'prijem' ? 'bg-green-600/10 border border-green-600/20 hover:border-green-500/50' : 'bg-red-600/10 border border-red-600/20 hover:border-red-500/50'}`}
                      >
                        {entry.spz && <p className="text-zinc-200 uppercase tracking-wider text-[11px]">{entry.spz}</p>}
                        {entry.description && <p className="text-zinc-400 truncate">{entry.description}</p>}
                        <p className={`font-black text-[13px] mt-0.5 ${entry.type === 'prijem' ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.type === 'prijem' ? '+' : '−'}{Number(entry.amount).toFixed(2)} €
                        </p>
                        {deleteId === entry.id && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className="mt-1 w-full bg-red-600 hover:bg-red-500 text-white text-[9px] py-1 rounded-lg uppercase tracking-widest transition-all"
                          >Vymazať</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Deň súčet + tlačidlo */}
                  <div className="p-2 border-t border-zinc-800 space-y-1.5">
                    {(dayPrijem > 0 || dayVydaj > 0) && (
                      <div className="text-[9px] font-black uppercase space-y-0.5 px-1">
                        {dayPrijem > 0 && <div className="flex justify-between text-green-500"><span>In:</span><span>+{dayPrijem.toFixed(2)} €</span></div>}
                        {dayVydaj  > 0 && <div className="flex justify-between text-red-400"><span>Out:</span><span>−{dayVydaj.toFixed(2)} €</span></div>}
                        <div className={`flex justify-between border-t border-zinc-800 pt-0.5 ${dayNet >= 0 ? 'text-white' : 'text-orange-400'}`}>
                          <span>=</span><span>{dayNet >= 0 ? '+' : ''}{dayNet.toFixed(2)} €</span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => openModal(day)}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >+ Záznam</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: pridať záznam */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-1">Nový záznam</h3>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-6">{modalDay ? DAY_NAMES[days.indexOf(days.find(d => toDateStr(d) === toDateStr(modalDay)))] + ', ' + fDate(modalDay) : ''}</p>

            <div className="flex gap-2 mb-5">
              <button onClick={() => setForm(f => ({ ...f, type: 'vydaj' }))} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'vydaj' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>− Výdaj</button>
              <button onClick={() => setForm(f => ({ ...f, type: 'prijem' }))} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'prijem' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>+ Príjem</button>
            </div>

            <div className="space-y-3 mb-6">
              <input
                type="number" min="0" step="0.01"
                placeholder="Suma v €"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none"
                autoFocus
              />
              <input
                type="text"
                placeholder="Popis (napr. Benzín, Drobný nákup...)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none"
              />
              <input
                type="text"
                placeholder="ŠPZ (nepovinné)"
                value={form.spz}
                onChange={e => setForm(f => ({ ...f, spz: e.target.value.toUpperCase() }))}
                className="w-full bg-black border border-zinc-700 focus:border-red-500 p-4 rounded-2xl text-white text-sm font-bold outline-none uppercase tracking-widest"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Zrušiť</button>
              <button onClick={handleSave} disabled={saving || !form.amount} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                {saving ? 'Ukladám...' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
