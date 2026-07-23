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
    username text,
    password text,
    notes text,
    created_at timestamptz DEFAULT now()
  );
  -- Ak tabuľka už existuje, pridaj stĺpce:
  -- ALTER TABLE contacts_entries ADD COLUMN IF NOT EXISTS username text;
  -- ALTER TABLE contacts_entries ADD COLUMN IF NOT EXISTS password text;
  -- ALTER TABLE contacts_entries ADD COLUMN IF NOT EXISTS notes text;
  ALTER TABLE contacts_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth full access" ON contacts_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CAT_COLORS = [
  { bg: 'bg-red-600', text: 'text-white', dot: 'bg-red-500' },
  { bg: 'bg-blue-600', text: 'text-white', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500', text: 'text-black', dot: 'bg-amber-400' },
  { bg: 'bg-purple-600', text: 'text-white', dot: 'bg-purple-500' },
  { bg: 'bg-cyan-600', text: 'text-white', dot: 'bg-cyan-500' },
  { bg: 'bg-pink-600', text: 'text-white', dot: 'bg-pink-500' },
  { bg: 'bg-orange-600', text: 'text-white', dot: 'bg-orange-500' },
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
  const [allEntries, setAllEntries] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [newEntry, setNewEntry] = useState({ type: 'web', name: '', value: '', username: '', password: '', notes: '' });
  const [showPassword, setShowPassword] = useState({});
  const [addingEntry, setAddingEntry] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null);

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryForm, setEditingEntryForm] = useState({ type: 'web', name: '', value: '', username: '', password: '', notes: '' });

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (activeCat) fetchEntries(activeCat.id); }, [activeCat]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts_categories').select('*').order('name');
    if (data) {
      setCategories(data);
      if (data.length) {
        const { data: allE } = await supabase.from('contacts_entries').select('*').in('category_id', data.map(c => c.id)).order('created_at');
        setAllEntries(allE || []);
      }
    }
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

  const saveCategory = async (id) => {
    if (!editingCatName.trim()) return;
    await supabase.from('contacts_categories').update({ name: editingCatName.trim() }).eq('id', id);
    setCategories(p => p.map(c => c.id === id ? { ...c, name: editingCatName.trim() } : c));
    if (activeCat?.id === id) setActiveCat(p => ({ ...p, name: editingCatName.trim() }));
    setEditingCatId(null);
  };

  const deleteCategory = (cat) => {
    setConfirmModal({
      message: `Vymazať kategóriu "${cat.name}" a všetky kontakty v nej?`,
      onConfirm: async () => {
        await supabase.from('contacts_categories').delete().eq('id', cat.id);
        setAllEntries(p => p.filter(e => e.category_id !== cat.id));
        if (activeCat?.id === cat.id) setActiveCat(null);
        fetchCategories();
        setConfirmModal(null);
      },
    });
  };

  const addEntry = async () => {
    const value = newEntry.value.trim();
    if (!value || !activeCat) return;
    const row = {
      category_id: activeCat.id, type: newEntry.type,
      name: newEntry.name.trim() || null, value,
      username: newEntry.username.trim() || null,
      password: newEntry.password.trim() || null,
      notes: newEntry.notes.trim() || null,
    };
    const { data, error } = await supabase.from('contacts_entries').insert([row]).select().single();
    if (!error && data) {
      setNewEntry({ type: newEntry.type, name: '', value: '' });
      setAddingEntry(false);
      setEntries(p => [...p, data]);
      setAllEntries(p => [...p, data]);
    } else if (error) alert('Chyba: ' + error.message);
  };

  const saveEntry = async (id) => {
    if (!editingEntryForm.value.trim()) return;
    const update = {
      type: editingEntryForm.type,
      name: editingEntryForm.name.trim() || null,
      value: editingEntryForm.value.trim(),
      username: editingEntryForm.username.trim() || null,
      password: editingEntryForm.password.trim() || null,
      notes: editingEntryForm.notes.trim() || null,
    };
    await supabase.from('contacts_entries').update(update).eq('id', id);
    setEntries(p => p.map(e => e.id === id ? { ...e, ...update } : e));
    setAllEntries(p => p.map(e => e.id === id ? { ...e, ...update } : e));
    setEditingEntryId(null);
  };

  const deleteEntry = (entry) => {
    setConfirmModal({
      message: `Vymazať "${entry.name || entry.value}"?`,
      onConfirm: async () => {
        await supabase.from('contacts_entries').delete().eq('id', entry.id);
        setEntries(p => p.filter(e => e.id !== entry.id));
        setAllEntries(p => p.filter(e => e.id !== entry.id));
        setConfirmModal(null);
      },
    });
  };

  const catColor = (idx) => CAT_COLORS[idx % CAT_COLORS.length];

  const ConfirmModal = () => !confirmModal ? null : (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400] flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center">
        <p className="text-white font-black text-lg uppercase italic tracking-tighter mb-6">{confirmModal.message}</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 rounded-2xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors">Nie</button>
          <button onClick={confirmModal.onConfirm} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-colors">Vymazať</button>
        </div>
      </div>
    </div>
  );

  const EntryEditForm = ({ onSave, onCancel }) => (
    <div className="space-y-3 p-4 bg-zinc-900/60 rounded-2xl border border-zinc-700">
      <div className="flex gap-2">
        {Object.entries(TYPE_META).map(([k, m]) => (
          <button key={k} type="button" onClick={() => setEditingEntryForm(p => ({ ...p, type: k }))}
            className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${editingEntryForm.type === k ? m.color + ' border' : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-white'}`}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>
      <input type="text" placeholder="Popis / Meno (nepovinné)"
        value={editingEntryForm.name}
        onChange={ev => setEditingEntryForm(p => ({ ...p, name: ev.target.value }))}
        className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold text-sm outline-none focus:border-zinc-500" />
      <input type={editingEntryForm.type === 'phone' ? 'tel' : 'text'}
        placeholder={editingEntryForm.type === 'web' ? 'https://example.com' : editingEntryForm.type === 'phone' ? '+421 900 000 000' : 'Text...'}
        value={editingEntryForm.value}
        onChange={ev => setEditingEntryForm(p => ({ ...p, value: ev.target.value }))}
        className="w-full bg-black border border-zinc-600 p-3 rounded-xl text-white font-black text-sm outline-none focus:border-red-600 font-mono" />
      {editingEntryForm.type === 'web' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder="Prihlasovacie meno"
            value={editingEntryForm.username}
            onChange={ev => setEditingEntryForm(p => ({ ...p, username: ev.target.value }))}
            className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold text-sm outline-none focus:border-blue-600" />
          <input type="text" placeholder="Heslo"
            value={editingEntryForm.password}
            onChange={ev => setEditingEntryForm(p => ({ ...p, password: ev.target.value }))}
            className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-mono text-sm outline-none focus:border-blue-600" />
        </div>
      )}
      <textarea placeholder="Poznámka (nepovinné)"
        value={editingEntryForm.notes}
        onChange={ev => setEditingEntryForm(p => ({ ...p, notes: ev.target.value }))}
        rows={2}
        className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold text-sm outline-none focus:border-zinc-500 resize-none" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors">Zrušiť</button>
        <button onClick={onSave} className="flex-[2] py-2.5 rounded-xl bg-green-700 text-white font-black text-xs uppercase tracking-widest hover:bg-green-600 transition-all">Uložiť</button>
      </div>
    </div>
  );

  // ── DETAIL KATEGÓRIE ──
  if (activeCat) {
    const idx = categories.findIndex(c => c.id === activeCat.id);
    const col = catColor(idx);
    return (
      <div className="min-h-screen bg-black text-white p-6 md:p-10 select-none">
        <ConfirmModal />
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => { setActiveCat(null); setEditingCatId(null); setEditingEntryId(null); }}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-black text-lg">
            ←
          </button>
          {editingCatId === activeCat.id ? (
            <div className={`flex-1 flex items-center gap-3 p-4 rounded-[2rem] ${col.bg}`}>
              <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveCategory(activeCat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                className={`flex-1 bg-black/20 border border-white/30 rounded-xl px-3 py-2 font-black text-xl uppercase italic tracking-tighter outline-none ${col.text}`} />
              <button onClick={() => saveCategory(activeCat.id)} className="px-4 py-2 bg-black/30 hover:bg-black/50 rounded-xl font-black text-xs uppercase text-white transition-all">OK</button>
              <button onClick={() => setEditingCatId(null)} className={`text-sm px-2 ${col.text} opacity-70`}>✕</button>
            </div>
          ) : (
            <div className={`flex-1 flex items-center gap-4 p-5 rounded-[2rem] ${col.bg} group`}>
              <span className={`text-2xl font-black uppercase italic tracking-tighter ${col.text}`}>{activeCat.name}</span>
              <button onClick={() => { setEditingCatId(activeCat.id); setEditingCatName(activeCat.name); }}
                className={`opacity-0 group-hover:opacity-100 text-sm px-2 transition-all ${col.text} opacity-60 hover:opacity-100`}>✏️</button>
              <span className={`text-[10px] font-black uppercase tracking-widest ${col.text} opacity-60 ml-auto`}>{entries.length} položiek</span>
            </div>
          )}
        </div>

        {/* Entries */}
        <div className="space-y-3 mb-6">
          {entries.map(e => {
            const meta = TYPE_META[e.type] || TYPE_META.note;
            return (
              <div key={e.id}>
                {editingEntryId === e.id ? (
                  <EntryEditForm
                    e={e}
                    onSave={() => saveEntry(e.id)}
                    onCancel={() => setEditingEntryId(null)}
                  />
                ) : (
                  <div className={`p-4 rounded-2xl border ${meta.color} group`}>
                    <div className="flex items-start gap-4">
                      <span className="text-xl shrink-0 mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        {e.name && <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-0.5">{e.name}</p>}
                        <div className="text-sm font-bold">{formatValue(e.type, e.value)}</div>
                        {e.type === 'web' && (e.username || e.password) && (
                          <div className="mt-2 space-y-1">
                            {e.username && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest w-14 shrink-0">Login</span>
                                <span className="text-xs font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-lg select-all">{e.username}</span>
                              </div>
                            )}
                            {e.password && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest w-14 shrink-0">Heslo</span>
                                <span className="text-xs font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-lg select-all">
                                  {showPassword[e.id] ? e.password : '••••••••'}
                                </span>
                                <button onClick={() => setShowPassword(p => ({ ...p, [e.id]: !p[e.id] }))}
                                  className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">
                                  {showPassword[e.id] ? '🙈' : '👁️'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {e.notes && (
                          <p className="mt-2 text-xs text-zinc-500 font-bold leading-relaxed border-t border-white/10 pt-2">{e.notes}</p>
                        )}
                      </div>
                      <button onClick={() => { setEditingEntryId(e.id); setEditingEntryForm({ type: e.type, name: e.name || '', value: e.value, username: e.username || '', password: e.password || '', notes: e.notes || '' }); }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 transition-all text-sm">
                        ✏️
                      </button>
                      <button onClick={() => deleteEntry(e)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all text-sm font-black">
                        ✕
                      </button>
                    </div>
                  </div>
                )}
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
            <div className="flex gap-2">
              {Object.entries(TYPE_META).map(([k, m]) => (
                <button key={k} type="button" onClick={() => setNewEntry(p => ({ ...p, type: k }))}
                  className={`flex-1 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${newEntry.type === k ? m.color + ' border' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-white'}`}>
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
            <input type="text" placeholder={`Popis / Meno (nepovinné)`}
              value={newEntry.name}
              onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-600" />
            <input
              type={newEntry.type === 'phone' ? 'tel' : 'text'}
              placeholder={newEntry.type === 'web' ? 'https://example.com alebo example.com' : newEntry.type === 'phone' ? '+421 900 000 000' : 'Text poznámky...'}
              value={newEntry.value}
              onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addEntry()}
              className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600 font-mono" />
            {newEntry.type === 'web' && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Prihlasovacie meno"
                  value={newEntry.username}
                  onChange={e => setNewEntry(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-600 font-mono" />
                <input type="text" placeholder="Heslo"
                  value={newEntry.password}
                  onChange={e => setNewEntry(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-600 font-mono" />
              </div>
            )}
            <textarea placeholder="Poznámky (nepovinné)" rows={2}
              value={newEntry.notes}
              onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-600 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setAddingEntry(false); setNewEntry({ type: newEntry.type, name: '', value: '', username: '', password: '', notes: '' }); }}
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
      </div>
    );
  }

  // ── ZOZNAM KATEGÓRIÍ ──
  const q = nd(search.trim());
  const searchResults = q
    ? allEntries
        .filter(e => nd(e.name || '').includes(q) || nd(e.value || '').includes(q))
        .map(e => {
          const idx = categories.findIndex(c => c.id === e.category_id);
          return { ...e, cat: categories[idx], col: catColor(idx) };
        })
    : [];
  const catNameHits = q ? categories.filter(c => nd(c.name).includes(q)) : [];

  const highlight = (text) => {
    if (!q || !text) return text;
    const parts = text.split(new RegExp(`(${search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => nd(p) === q
      ? <mark key={i} className="bg-red-600/40 text-red-200 rounded px-0.5">{p}</mark>
      : p
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 select-none">
      <ConfirmModal />
      <header className="mb-8 border-l-4 border-red-600 pl-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
            Kontakty <span className="text-red-600 text-4xl">& Weby</span>
          </h1>
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Telefóny · Webové stránky · Poznámky</p>
        </div>
      </header>

      {/* SEARCH */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Hľadať vo všetkých kategóriách..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-600 rounded-2xl px-5 py-3.5 text-white font-bold text-sm outline-none transition-all pr-10"
        />
        {search ? (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors text-sm">✕</button>
        ) : (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 text-sm">🔍</span>
        )}
      </div>

      {/* VÝSLEDKY HĽADANIA */}
      {q && (
        <div className="mb-6 space-y-2">
          {searchResults.length === 0 && catNameHits.length === 0 && (
            <div className="text-center py-10 text-zinc-700 uppercase text-xs tracking-widest font-black">Žiadne výsledky pre „{search}"</div>
          )}
          {catNameHits.length > 0 && (
            <>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Kategórie</p>
              {catNameHits.map((cat) => {
                const idx = categories.findIndex(c => c.id === cat.id);
                const col = catColor(idx);
                return (
                  <button key={cat.id} onClick={() => { setActiveCat(cat); setSearch(''); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left ${col.bg} hover:opacity-90 transition-all`}>
                    <span className={`text-lg font-black uppercase italic tracking-tighter ${col.text}`}>{highlight(cat.name)}</span>
                    <span className={`ml-auto text-xs font-black uppercase tracking-widest ${col.text} opacity-60`}>→</span>
                  </button>
                );
              })}
            </>
          )}
          {searchResults.length > 0 && (
            <>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-4 mb-2">Kontakty ({searchResults.length})</p>
              {searchResults.map(e => {
                const meta = TYPE_META[e.type] || TYPE_META.note;
                return (
                  <button key={e.id} onClick={() => { setActiveCat(e.cat); setSearch(''); }}
                    className="w-full text-left bg-zinc-950 border border-zinc-800 hover:border-zinc-600 p-4 rounded-2xl transition-all">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${e.col?.dot || 'bg-zinc-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{e.cat?.name}</span>
                      <span className="ml-auto text-zinc-600 text-xs">{meta.icon}</span>
                    </div>
                    {e.name && <p className="text-[10px] font-black uppercase text-zinc-600 mb-0.5">{highlight(e.name)}</p>}
                    <p className="text-sm font-bold text-zinc-300 truncate">{highlight(e.value)}</p>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ZOZNAM KATEGÓRIÍ */}
      {!q && (
        <>
          <div className="space-y-3 mb-6">
            {loading && <p className="text-zinc-700 font-black uppercase text-xs tracking-widest text-center py-8">Načítavam...</p>}
            {!loading && categories.length === 0 && !addingCat && (
              <div className="py-16 text-center text-zinc-800 font-black uppercase text-sm tracking-widest italic">
                Žiadne kategórie — vytvor prvú
              </div>
            )}
            {categories.map((cat, idx) => {
              const col = catColor(idx);
              const isEditing = editingCatId === cat.id;
              return (
                <div key={cat.id} className="relative group">
                  {isEditing ? (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl ${col.bg}`}>
                      <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                        className={`flex-1 bg-black/20 border border-white/30 rounded-xl px-3 py-2 font-black text-xl uppercase italic tracking-tighter outline-none ${col.text}`} />
                      <button onClick={() => saveCategory(cat.id)} className="px-4 py-2 bg-black/30 hover:bg-black/50 rounded-xl font-black text-xs uppercase text-white transition-all shrink-0">Uložiť</button>
                      <button onClick={() => setEditingCatId(null)} className={`text-sm px-1 ${col.text} opacity-70 shrink-0`}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setActiveCat(cat)}
                      className={`w-full text-left p-5 rounded-2xl ${col.bg} hover:opacity-90 transition-all flex items-center justify-between`}>
                      <span className={`text-xl font-black uppercase italic tracking-tighter ${col.text}`}>{cat.name}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${col.text} opacity-50`}>→</span>
                    </button>
                  )}
                  {!isEditing && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-xl bg-black/30 text-white hover:bg-black/60 transition-all font-black text-sm">
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteCategory(cat); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-xl bg-black/30 text-white hover:bg-black/60 transition-all font-black text-sm">
                        ✕
                      </button>
                    </>
                  )}
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
        </>
      )}
    </div>
  );
}
