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
    name text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
  );
  -- Ak tabuľka contacts_entries už existuje zo starej verzie:
  -- ALTER TABLE contacts_entries ADD COLUMN IF NOT EXISTS fields jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE contacts_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth full access" ON contacts_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CAT_COLORS = [
  { bg: 'bg-red-600',     text: 'text-white', dot: 'bg-red-500'     },
  { bg: 'bg-blue-600',    text: 'text-white', dot: 'bg-blue-500'    },
  { bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500',   text: 'text-black', dot: 'bg-amber-400'   },
  { bg: 'bg-purple-600',  text: 'text-white', dot: 'bg-purple-500'  },
  { bg: 'bg-cyan-600',    text: 'text-white', dot: 'bg-cyan-500'    },
  { bg: 'bg-pink-600',    text: 'text-white', dot: 'bg-pink-500'    },
  { bg: 'bg-orange-600',  text: 'text-white', dot: 'bg-orange-500'  },
];
const catColor = idx => CAT_COLORS[idx % CAT_COLORS.length];

const FIELD_SUGGESTIONS = ['web', 'meno', 'heslo', 'email', 'telefón', 'adresa', 'API kľúč', 'poznámka'];

const fieldIcon = label => {
  const l = nd(label);
  if (l.includes('web') || l.includes('url') || l.includes('stranka') || l.includes('link')) return '🌐';
  if (l.includes('hes') || l.includes('pass') || l.includes('pwd')) return '🔒';
  if (l.includes('men') || l.includes('login') || l.includes('user') || l.includes('pouziv')) return '👤';
  if (l.includes('mail')) return '📧';
  if (l.includes('tel') || l.includes('phone')) return '📞';
  if (l.includes('adres')) return '📍';
  if (l.includes('api') || l.includes('kluc') || l.includes('key') || l.includes('token')) return '🔑';
  if (l.includes('poz') || l.includes('note')) return '📝';
  return '📌';
};

const isPassword = label => /hes|pass|pwd|kluc|key|token/i.test(nd(label || ''));
const isUrl = v => /^(https?:\/\/|www\.)/i.test((v || '').trim());

function FieldValue({ label, value, revealed, onToggle }) {
  if (isPassword(label)) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-mono text-zinc-300 select-all">{revealed ? value : '••••••••'}</span>
        <button onClick={onToggle} className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
          {revealed ? '🙈' : '👁️'}
        </button>
      </span>
    );
  }
  if (isUrl(value)) {
    const url = value.startsWith('http') ? value : `https://${value}`;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all transition-colors">
        {value}
      </a>
    );
  }
  return <span className="text-zinc-300 break-words whitespace-pre-wrap">{value}</span>;
}

// ─── EntryCard je definovaný MIMO KontaktyPage ───────────────────────────────
// Dôvod: vnorený komponent by sa remontoval pri každom re-renderi rodiča
// a input by strácal focus po každom znaku.
function EntryCard({ entry, onUpdateFields, onDeleteEntry, onSaveName }) {
  const [editingName, setEditingName] = useState(false);
  const [editName,    setEditName]    = useState('');

  const [addingField, setAddingField] = useState(false);
  const [newLabel,    setNewLabel]    = useState('');
  const [newValue,    setNewValue]    = useState('');

  const [editIdx,   setEditIdx]   = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');

  const [showPw,  setShowPw]  = useState({});
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const fields = entry.fields || [];

  const doAddField = () => {
    const label = newLabel.trim(), value = newValue.trim();
    if (!label || !value) return;
    onUpdateFields(entry.id, [...fields, { label, value }]);
    setNewLabel(''); setNewValue(''); setAddingField(false);
  };

  const doSaveField = () => {
    const label = editLabel.trim(), value = editValue.trim();
    if (!label || !value) return;
    onUpdateFields(entry.id, fields.map((f, i) => i === editIdx ? { label, value } : f));
    setEditIdx(null);
  };

  const doDeleteField = idx => {
    onUpdateFields(entry.id, fields.filter((_, i) => i !== idx));
  };

  const doDrop = toIdx => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const arr = [...fields];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(toIdx, 0, moved);
    onUpdateFields(entry.id, arr);
    setDragIdx(null); setDragOver(null);
  };

  const doSaveName = () => {
    const name = editName.trim();
    if (!name) return;
    onSaveName(entry.id, name);
    setEditingName(false);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden group/card">

      {/* Hlavička záznamu */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/60">
        {editingName ? (
          <>
            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="flex-1 bg-black border border-zinc-700 px-3 py-1.5 rounded-xl text-white font-black text-sm outline-none focus:border-red-600" />
            <button onClick={doSaveName} className="text-xs text-green-400 font-black hover:text-green-300 shrink-0">OK</button>
            <button onClick={() => setEditingName(false)} className="text-xs text-zinc-600 font-black hover:text-zinc-400 shrink-0">✕</button>
          </>
        ) : (
          <>
            <h3 className="flex-1 text-sm font-black uppercase tracking-widest text-white truncate">{entry.name}</h3>
            <div className="opacity-0 group-hover/card:opacity-100 flex gap-1 transition-opacity shrink-0">
              <button onClick={() => { setEditingName(true); setEditName(entry.name); }}
                className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 transition-all text-sm">✏️</button>
              <button onClick={() => onDeleteEntry(entry)}
                className="w-7 h-7 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all text-xs font-black">✕</button>
            </div>
          </>
        )}
      </div>

      {/* Polia */}
      <div className="divide-y divide-zinc-800/40">
        {fields.map((f, idx) => {
          const isEditingThis = editIdx === idx;
          const isDragTarget  = dragOver === idx && dragIdx !== idx;
          return (
            <div key={idx}
              draggable={!isEditingThis}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
              onDrop={e => { e.preventDefault(); doDrop(idx); }}
              onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
              className={`group/field transition-colors ${isDragTarget ? 'border-t-2 border-red-500 bg-red-600/5' : 'hover:bg-zinc-900/40'} ${dragIdx === idx ? 'opacity-30' : ''}`}>

              {isEditingThis ? (
                <div className="px-5 py-4 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {FIELD_SUGGESTIONS.map(s => (
                      <button key={s} type="button" onClick={() => setEditLabel(s)}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editLabel === s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    placeholder="Názov poľa"
                    className="w-full bg-black border border-zinc-700 px-3 py-2 rounded-xl text-white font-bold text-xs outline-none focus:border-zinc-500" />
                  <input value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doSaveField(); if (e.key === 'Escape') setEditIdx(null); }}
                    placeholder="Hodnota"
                    className="w-full bg-black border border-zinc-700 px-3 py-2 rounded-xl text-white font-bold text-xs outline-none focus:border-zinc-500 font-mono" />
                  <div className="flex gap-3">
                    <button onClick={() => setEditIdx(null)} className="text-xs text-zinc-600 font-black hover:text-zinc-400">Zrušiť</button>
                    <button onClick={doSaveField} className="text-xs text-green-400 font-black hover:text-green-300">Uložiť</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-4 py-3">
                  <span className="text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing text-sm mt-1 select-none shrink-0 px-1" title="Presunúť">⠿</span>
                  <span className="text-base shrink-0 mt-0.5 select-none">{fieldIcon(f.label)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-0.5">{f.label}</p>
                    <div className="text-sm font-bold leading-snug">
                      <FieldValue label={f.label} value={f.value}
                        revealed={showPw[idx]}
                        onToggle={() => setShowPw(p => ({ ...p, [idx]: !p[idx] }))} />
                    </div>
                  </div>
                  <div className="opacity-0 group-hover/field:opacity-100 flex gap-1 transition-opacity shrink-0 mt-0.5">
                    <button onClick={() => { setEditIdx(idx); setEditLabel(f.label); setEditValue(f.value); setAddingField(false); }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition-all text-xs">✏️</button>
                    <button onClick={() => doDeleteField(idx)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-600 hover:text-white transition-all text-xs font-black">✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Pridať pole */}
        {addingField ? (
          <div className="px-5 py-4 space-y-3 bg-zinc-900/30">
            <div className="flex flex-wrap gap-1.5">
              {FIELD_SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => setNewLabel(s)}
                  className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${newLabel === s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'}`}>
                  {s}
                </button>
              ))}
            </div>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Vlastný názov poľa..."
              className="w-full bg-black border border-zinc-700 px-4 py-2.5 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-500" />
            <input value={newValue} onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doAddField()}
              placeholder="Hodnota"
              className="w-full bg-black border border-zinc-700 px-4 py-2.5 rounded-2xl text-white font-bold text-sm outline-none focus:border-zinc-500 font-mono" />
            <div className="flex gap-2">
              <button onClick={() => { setAddingField(false); setNewLabel(''); setNewValue(''); }}
                className="flex-1 py-2.5 rounded-2xl bg-zinc-900 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                Zrušiť
              </button>
              <button onClick={doAddField}
                className="flex-[2] py-2.5 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg">
                Pridať pole
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingField(true); setNewLabel(''); setNewValue(''); setEditIdx(null); }}
            className="w-full px-5 py-3 text-left text-[10px] text-zinc-700 hover:text-zinc-400 font-black uppercase tracking-widest transition-colors hover:bg-zinc-900/30">
            + pridať pole
          </button>
        )}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function KontaktyPage() {
  const [categories, setCategories] = useState([]);
  const [entries,    setEntries]    = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [activeCat,  setActiveCat]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [addingCat,  setAddingCat]  = useState(false);
  const [editingCatId,   setEditingCatId]   = useState(null);
  const [editingCatName, setEditingCatName] = useState('');

  const [newEntryName, setNewEntryName] = useState('');
  const [addingEntry,  setAddingEntry]  = useState(false);

  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (activeCat) fetchEntries(activeCat.id); }, [activeCat]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data: cats } = await supabase.from('contacts_categories').select('*').order('created_at');
    const { data: allE } = await supabase.from('contacts_entries').select('id, category_id, name, fields');
    setCategories(cats || []);
    setAllEntries(allE || []);
    setLoading(false);
  };

  const fetchEntries = async (catId) => {
    const { data } = await supabase.from('contacts_entries').select('*').eq('category_id', catId).order('created_at');
    setEntries(data || []);
  };

  // ── KATEGÓRIE ──

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const { data } = await supabase.from('contacts_categories').insert({ name }).select().single();
    if (data) {
      setCategories(c => [...c, data]);
      setNewCatName(''); setAddingCat(false); setActiveCat(data);
    }
  };

  const saveCategory = async (id) => {
    const name = editingCatName.trim();
    if (!name) return;
    await supabase.from('contacts_categories').update({ name }).eq('id', id);
    setCategories(c => c.map(x => x.id === id ? { ...x, name } : x));
    setEditingCatId(null);
  };

  const deleteCategory = (cat) => {
    setConfirmModal({
      message: `Vymazať kategóriu „${cat.name}" a všetky jej záznamy?`,
      onConfirm: async () => {
        await supabase.from('contacts_categories').delete().eq('id', cat.id);
        setCategories(c => c.filter(x => x.id !== cat.id));
        setAllEntries(a => a.filter(e => e.category_id !== cat.id));
        if (activeCat?.id === cat.id) setActiveCat(null);
        setConfirmModal(null);
      },
    });
  };

  // ── ZÁZNAMY ──

  const addEntry = async () => {
    const name = newEntryName.trim();
    if (!name || !activeCat) return;
    const { data } = await supabase.from('contacts_entries')
      .insert({ category_id: activeCat.id, name, fields: [] })
      .select().single();
    if (data) {
      setEntries(e => [...e, data]);
      setAllEntries(a => [...a, data]);
      setNewEntryName(''); setAddingEntry(false);
    }
  };

  const saveEntryName = async (id, name) => {
    if (!name) return;
    await supabase.from('contacts_entries').update({ name }).eq('id', id);
    setEntries(e => e.map(x => x.id === id ? { ...x, name } : x));
    setAllEntries(a => a.map(x => x.id === id ? { ...x, name } : x));
  };

  const deleteEntry = (entry) => {
    setConfirmModal({
      message: `Vymazať záznam „${entry.name}"?`,
      onConfirm: async () => {
        await supabase.from('contacts_entries').delete().eq('id', entry.id);
        setEntries(e => e.filter(x => x.id !== entry.id));
        setAllEntries(a => a.filter(x => x.id !== entry.id));
        setConfirmModal(null);
      },
    });
  };

  // ── POLIA ──

  const updateEntryFields = async (entryId, newFields) => {
    await supabase.from('contacts_entries').update({ fields: newFields }).eq('id', entryId);
    const upd = arr => arr.map(x => x.id === entryId ? { ...x, fields: newFields } : x);
    setEntries(upd);
    setAllEntries(upd);
  };

  // ── SEARCH ──

  const q = nd(search.trim());

  const searchEntryHits = q ? allEntries.filter(e =>
    nd(e.name || '').includes(q) ||
    (e.fields || []).some(f => nd(f.label || '').includes(q) || nd(f.value || '').includes(q))
  ).map(e => {
    const idx = categories.findIndex(c => c.id === e.category_id);
    return { ...e, cat: categories[idx], col: catColor(idx) };
  }) : [];

  const catNameHits = q ? categories.filter(c => nd(c.name).includes(q)) : [];

  const highlight = text => {
    if (!q || !text) return text;
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = ('' + text).split(new RegExp(`(${safe})`, 'gi'));
    return parts.map((p, i) => nd(p) === q
      ? <mark key={i} className="bg-red-600/40 text-red-200 rounded px-0.5">{p}</mark>
      : p
    );
  };

  // ── RENDERY ──

  function ConfirmModal() {
    if (!confirmModal) return null;
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-8 max-w-sm w-full space-y-6">
          <p className="text-white font-bold text-center">{confirmModal.message}</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmModal(null)}
              className="flex-1 py-3 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors">
              Zrušiť
            </button>
            <button onClick={confirmModal.onConfirm}
              className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all">
              Vymazať
            </button>
          </div>
        </div>
      </div>
    );
  }

  function CatDetail() {
    if (!activeCat) return null;
    const catIdx = categories.findIndex(c => c.id === activeCat.id);
    const col = catColor(catIdx);
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${col.bg} ${col.text}`}>
          <span className="font-black uppercase italic tracking-tighter text-lg flex-1">{activeCat.name}</span>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{entries.length} záznamov</span>
        </div>

        {entries.length === 0 && !addingEntry && (
          <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest text-center py-8">Žiadne záznamy</p>
        )}

        <div className="space-y-4">
          {entries.map(e => (
            <EntryCard key={e.id} entry={e}
              onUpdateFields={updateEntryFields}
              onDeleteEntry={deleteEntry}
              onSaveName={saveEntryName} />
          ))}
        </div>

        {addingEntry ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-5 space-y-3">
            <input autoFocus value={newEntryName} onChange={e => setNewEntryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addEntry(); if (e.key === 'Escape') { setAddingEntry(false); setNewEntryName(''); } }}
              placeholder="Názov záznamu (napr. Peugeot, Websupport...)"
              className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600" />
            <div className="flex gap-3">
              <button onClick={() => { setAddingEntry(false); setNewEntryName(''); }}
                className="flex-1 py-3 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                Zrušiť
              </button>
              <button onClick={addEntry}
                className="flex-[2] py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg">
                Vytvoriť záznam
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingEntry(true)}
            className="w-full py-4 rounded-2xl bg-zinc-900 border border-dashed border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 font-black text-xs uppercase tracking-widest transition-all">
            + Nový záznam
          </button>
        )}
      </div>
    );
  }

  function SearchResults() {
    return (
      <div className="space-y-6">
        {catNameHits.length > 0 && (
          <div>
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-3">Kategórie</p>
            <div className="space-y-2">
              {catNameHits.map(cat => {
                const col = catColor(categories.indexOf(cat));
                return (
                  <button key={cat.id} onClick={() => { setSearch(''); setActiveCat(cat); }}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-black text-sm uppercase italic tracking-tighter ${col.bg} ${col.text} hover:opacity-90`}>
                    {highlight(cat.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {searchEntryHits.length > 0 && (
          <div>
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-3">Záznamy</p>
            <div className="space-y-2">
              {searchEntryHits.map(e => (
                <button key={e.id} onClick={() => { setSearch(''); if (e.cat) setActiveCat(e.cat); }}
                  className="w-full text-left p-4 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${e.col?.dot || 'bg-zinc-600'} shrink-0`} />
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{e.cat?.name}</span>
                  </div>
                  <p className="text-sm font-black text-white">{highlight(e.name)}</p>
                  {(e.fields || [])
                    .filter(f => nd(f.label || '').includes(q) || nd(f.value || '').includes(q))
                    .map((f, i) => (
                      <div key={i} className="flex gap-2 items-baseline">
                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest shrink-0">{f.label}</span>
                        <span className="text-xs text-zinc-400 font-mono truncate">
                          {isPassword(f.label) ? '••••••••' : highlight(f.value)}
                        </span>
                      </div>
                    ))}
                </button>
              ))}
            </div>
          </div>
        )}

        {catNameHits.length === 0 && searchEntryHits.length === 0 && (
          <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest text-center py-10">Nič nenájdené</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 select-none">
      <ConfirmModal />

      <header className="mb-8 border-l-4 border-red-600 pl-6">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
          Kontakty <span className="text-red-600 text-4xl">& Weby</span>
        </h1>
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Prihlásenia · Kontakty · Poznámky</p>
      </header>

      {/* SEARCH */}
      <div className="relative mb-6">
        <input type="text" placeholder="Hľadať vo všetkých kategóriách..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-2xl px-5 py-3.5 text-white text-sm font-bold outline-none placeholder:text-zinc-700 transition-colors" />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white text-xl leading-none">×</button>
        )}
      </div>

      {q ? <SearchResults /> : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

          {/* ĽAVÝ PANEL */}
          <div className="space-y-2">
            {loading ? (
              <div className="h-10 rounded-2xl bg-zinc-900 animate-pulse" />
            ) : categories.map((cat, idx) => {
              const col = catColor(idx);
              const isActive = activeCat?.id === cat.id;
              const isEditingThis = editingCatId === cat.id;
              const count = allEntries.filter(e => e.category_id === cat.id).length;
              return (
                <div key={cat.id} className="relative group">
                  {isEditingThis ? (
                    <div className="flex gap-2 items-center">
                      <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                        className="flex-1 bg-black border border-zinc-700 px-4 py-2.5 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600" />
                      <button onClick={() => saveCategory(cat.id)} className="text-green-400 font-black text-xs hover:text-green-300">OK</button>
                      <button onClick={() => setEditingCatId(null)} className="text-zinc-600 font-black text-xs hover:text-zinc-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setActiveCat(cat); setAddingEntry(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm uppercase italic tracking-tighter transition-all text-left ${isActive ? `${col.bg} ${col.text}` : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600'}`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-white/40' : col.dot}`} />
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className={`text-[9px] font-black not-italic tracking-widest ${isActive ? 'opacity-60' : 'text-zinc-600'}`}>{count}</span>
                    </button>
                  )}
                  {!isEditingThis && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1 z-10">
                      <button onClick={e => { e.stopPropagation(); setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-black/80 text-zinc-400 hover:text-white text-xs">✏️</button>
                      <button onClick={e => { e.stopPropagation(); deleteCategory(cat); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-black/80 text-red-500 hover:bg-red-600 hover:text-white text-xs font-black">✕</button>
                    </div>
                  )}
                </div>
              );
            })}

            {addingCat ? (
              <div className="flex gap-2 items-center">
                <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }}
                  placeholder="Názov kategórie"
                  className="flex-1 bg-black border border-zinc-700 px-4 py-2.5 rounded-2xl text-white font-black text-sm outline-none focus:border-red-600" />
                <button onClick={addCategory} className="text-green-400 font-black text-xs hover:text-green-300">OK</button>
                <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="text-zinc-600 font-black text-xs hover:text-zinc-400">✕</button>
              </div>
            ) : (
              <button onClick={() => setAddingCat(true)}
                className="w-full py-2.5 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-600 font-black text-[10px] uppercase tracking-widest transition-all">
                + Nová kategória
              </button>
            )}
          </div>

          {/* PRAVÝ PANEL */}
          <div>
            {activeCat ? <CatDetail /> : (
              <div className="flex items-center justify-center h-48">
                <p className="text-zinc-800 text-[10px] font-black uppercase tracking-widest">← Vyber kategóriu</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
