'use client';
/*
  SQL — spusti v Supabase SQL editore:

  CREATE TABLE contacts_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE contacts_categories ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth full access" ON contacts_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE contacts_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES contacts_categories(id) ON DELETE CASCADE,
    type text NOT NULL,
    name text,
    value text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE contacts_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth full access" ON contacts_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const CAT_COLORS = [
  { bg: 'bg-red-600', text: 'text-white', border: 'border-red-500', light: 'bg-red-600/10 border-red-600/30 text-red-400' },
  { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-500', light: 'bg-blue-600/10 border-blue-600/30 text-blue-400' },
  { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-500', light: 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400' },
  { bg: 'bg-amber-500', text: 'text-black', border: 'border-amber-400', light: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500', light: 'bg-purple-600/10 border-purple-600/30 text-purple-400' },
  { bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-500', light: 'bg-cyan-600/10 border-cyan-600/30 text-cyan-400' },
  { bg: 'bg-pink-600', text: 'text-white', border: 'border-pink-500', light: 'bg-pink-600/10 border-pink-600/30 text-pink-400' },
  { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-500', light: 'bg-orange-600/10 border-orange-600/30 text-orange-400' },
];

const TYPE_META = {
  web:   { icon: '🌐', label: 'Web', color: 'text-blue-400 bg-blue-600/10 border-blue-600/30' },
  phone: { icon: '📞', label: 'Telefón', color: 'text-green-400 bg-green-600/10 border-green-600/30' },
  note:  { icon: '📝', label: 'Poznámka', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

const formatValue = (type, value) => {
  if (type === 'web') {
    const url = value.startsWith('http') ? value : `https://${value}`;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all transition-colors">
        {value}
      </a>
    );
  }
  if (type === 'phone') {
    return (
      <a href={`tel:${value.replace(/\s/g, '')}`}
        className="text-green-400 hover:text-green-300 font-mono tracking-widest transition-colors">
        {value}
      </a>
    );
  }
  return <span className="text-zinc-300 break-words">{value}</span>;
};

export default function KontaktyPage() {
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [loading, setLoading] = useState(true);

  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [newEntry, setNewEntry] = useState({ type: 'web', name: '', value: '' });
  const [addingEntry, setAddingEntry] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (activeCat) fetchEntries(activeCat.id); }, [activeCat]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts_categories').select('*').order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  const fetchEntries = async (catId) => {
    const { data } = await supabase.from('contacts_entries').select('*').eq('category_id', catId).order('created_at');
    if (data) setEntries(data);
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const { error } = await supabase.from('contacts_categories').insert([{ name }]);
    if (!error) { setNewCatName(''); setAddingCat(false); fetchCategories(); }
    else alert('Chyba: ' + error.message);
  };

  const deleteCategory = (cat) => {
    setConfirmModal({
      message: `Vymazať kategóriu "${cat.name}" a všetky kontakty v nej?`,
      onConfirm: async () => {
        await supabase.from('contacts_categories').delete().eq('id', cat.id);
        if (activeCat?.id === cat.id) setActiveCat(null);
        fetchCategories();
        setConfirmModal(null);
      },
    });
  };

  const addEntry = async () => {
    const value = newEntry.value.trim();
    if (!value || !activeCat) return;
    const { error } = await supabase.from('contacts_entries').insert([{
      category_id: activeCat.id,
      type: newEntry.type,
      name: newEntry.name.trim() || null,
      value,
    }]);
    if (!error) { setNewEntry({ type: newEntry.type, name: '', value: '' }); setAddingEntry(false); fetchEntries(activeCat.id); }
    else alert('Chyba: ' + error.message);
  };

  const deleteEntry = (entry) => {
    setConfirmModal({
      message: `Vymazať "${entry.name || entry.value}"?`,
      onConfirm: async () => {
        await supabase.from('contacts_entries').delete().eq('id', entry.id);
        fetchEntries(activeCat.id);
        setConfirmModal(null);
      },
    });
  };

  const catColor = (idx) => CAT_COLORS[idx % CAT_COLORS.length];

  if (activeCat) {
    const idx = categories.findIndex(c => c.id === activeCat.id);
    const col = catColor(idx);
    return (
      <div className="min-h-screen bg-black text-white p-6 md:p-10 select-none">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => setActiveCat(null)}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-black text-lg">
            ←
          </button>
          <div className={`flex-1 flex items-center gap-4 p-5 rounded-[2rem] ${col.bg}`}>
            <span className={`text-2xl font-black uppercase italic tracking-tighter ${col.text}`}>{activeCat.name}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${col.text} opacity-60 ml-auto`}>{entries.length} položiek</span>
          </div>
        </div>

        {/* Entries */}
        <div className="space-y-3 mb-6">
          {entries.map(e => {
            const meta = TYPE_META[e.type] || TYPE_META.note;
            return (
              <div key={e.id} className={`flex items-start gap-4 p-4 rounded-2xl border ${meta.color} group`}>
                <span className="text-xl shrink-0 mt-0.5">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  {e.name && <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-0.5">{e.name}</p>}
                  <div className="text-sm font-bold">{formatValue(e.type, e.value)}</div>
                </div>
                <button onClick={() => deleteEntry(e)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all text-sm font-black">
                  ✕
                </button>
              </div>
            );
          })}
          {entries.length === 0 && !addingEntry && (
            <div className="py-12 text-center text-zinc-700 font-black uppercase text-xs tracking-widest italic">
              Žiadne kontakty — pridaj prvý
            </div>
          )}
        </div>

        {/* Add entry form */}
        {addingEntry ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-4">
            {/* Type selector */}
            <div className="flex gap-2">
              {Object.entries(TYPE_META).map(([k, m]) => (
                <button key={k} type="button" onClick={() => setNewEntry(p => ({ ...p, type: k }))}
                  className={`flex-1 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${newEntry.type === k ? m.color + ' border' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-white'}`}>
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
            {/* Name (optional label) */}
            <input type="text" placeholder={`Popis / Meno (nepovinné) — napr. "Autoservis Novák"`}
              value={newEntry.name}
              onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-600" />
            {/* Value */}
            <input
              type={newEntry.type === 'phone' ? 'tel' : 'text'}
              placeholder={newEntry.type === 'web' ? 'https://example.com alebo example.com' : newEntry.type === 'phone' ? '+421 900 000 000' : 'Text poznámky...'}
              value={newEntry.value}
              onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addEntry()}
              className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600 font-mono" />
            <div className="flex gap-3">
              <button onClick={() => { setAddingEntry(false); setNewEntry({ type: newEntry.type, name: '', value: '' }); }}
                className="flex-1 py-3 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                Zrušiť
              </button>
              <button onClick={addEntry}
                className="flex-[2] py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg">
                Pridať
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingEntry(true)}
            className="w-full py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 font-black text-xs uppercase tracking-widest transition-all">
            + Pridať kontakt / web / poznámku
          </button>
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400] flex items-center justify-center p-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center">
              <p className="text-white font-black text-lg uppercase italic tracking-tighter mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 rounded-2xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors">Nie</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-colors">Vymazať</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 select-none">
      <header className="mb-10 border-l-4 border-red-600 pl-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
            Kontakty <span className="text-red-600 text-4xl">& Weby</span>
          </h1>
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Telefóny · Webové stránky · Poznámky</p>
        </div>
      </header>

      {/* Category list */}
      <div className="space-y-3 mb-6">
        {loading && <p className="text-zinc-700 font-black uppercase text-xs tracking-widest text-center py-8">Načítavam...</p>}
        {!loading && categories.length === 0 && !addingCat && (
          <div className="py-16 text-center text-zinc-800 font-black uppercase text-sm tracking-widest italic">
            Žiadne kategórie — vytvor prvú
          </div>
        )}
        {categories.map((cat, idx) => {
          const col = catColor(idx);
          return (
            <div key={cat.id} className="relative group">
              <button onClick={() => setActiveCat(cat)}
                className={`w-full text-left p-5 rounded-2xl ${col.bg} hover:opacity-90 transition-all flex items-center justify-between`}>
                <span className={`text-xl font-black uppercase italic tracking-tighter ${col.text}`}>{cat.name}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${col.text} opacity-50`}>→</span>
              </button>
              <button onClick={e => { e.stopPropagation(); deleteCategory(cat); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-xl bg-black/30 text-white hover:bg-black/60 transition-all font-black text-sm">
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add category */}
      {addingCat ? (
        <div className="flex gap-3">
          <input type="text" placeholder="Názov kategórie..." autoFocus
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }}
            className="flex-1 bg-zinc-950 border border-zinc-700 p-4 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600" />
          <button onClick={addCategory} className="px-6 py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all">Pridať</button>
          <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="px-4 py-4 rounded-2xl bg-zinc-900 text-zinc-500 font-black text-xs hover:bg-zinc-800 transition-colors">✕</button>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)}
          className="w-full py-4 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-600 font-black text-xs uppercase tracking-widest transition-all">
          + Nová kategória
        </button>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400] flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <p className="text-white font-black text-lg uppercase italic tracking-tighter mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 rounded-2xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors">Nie</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-colors">Vymazať</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
