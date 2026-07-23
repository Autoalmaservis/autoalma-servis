'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CAT_COLORS = [
  { bg: 'bg-red-950/30',    border: 'border-red-800/50',    text: 'text-red-400',    dot: 'bg-red-500' },
  { bg: 'bg-blue-950/30',   border: 'border-blue-800/50',   text: 'text-blue-400',   dot: 'bg-blue-500' },
  { bg: 'bg-emerald-950/30',border: 'border-emerald-800/50',text: 'text-emerald-400',dot: 'bg-emerald-500' },
  { bg: 'bg-amber-950/30',  border: 'border-amber-800/50',  text: 'text-amber-400',  dot: 'bg-amber-500' },
  { bg: 'bg-purple-950/30', border: 'border-purple-800/50', text: 'text-purple-400', dot: 'bg-purple-500' },
  { bg: 'bg-pink-950/30',   border: 'border-pink-800/50',   text: 'text-pink-400',   dot: 'bg-pink-500' },
  { bg: 'bg-cyan-950/30',   border: 'border-cyan-800/50',   text: 'text-cyan-400',   dot: 'bg-cyan-500' },
  { bg: 'bg-orange-950/30', border: 'border-orange-800/50', text: 'text-orange-400', dot: 'bg-orange-500' },
];

export default function ZapisnikPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedCatColor, setSelectedCatColor] = useState(CAT_COLORS[0]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryCounts, setEntryCounts] = useState({});

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [addingType, setAddingType] = useState(null);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const [search, setSearch] = useState('');
  const [allEntries, setAllEntries] = useState([]);

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryContent, setEditingEntryContent] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const fetchCategories = async () => {
    const { data: cats } = await supabase.from('notes_categories').select('*').order('created_at');
    setCategories(cats || []);
    if (cats?.length) {
      const { data: allE } = await supabase.from('notes_entries').select('*').in('category_id', cats.map(c => c.id)).order('created_at');
      setAllEntries(allE || []);
      const map = {};
      (allE || []).forEach(r => { map[r.category_id] = (map[r.category_id] || 0) + 1; });
      setEntryCounts(map);
    }
    setLoading(false);
  };

  const fetchEntries = async (catId) => {
    const { data } = await supabase.from('notes_entries').select('*').eq('category_id', catId).order('created_at');
    setEntries(data || []);
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    if (selectedCat) {
      fetchEntries(selectedCat.id);
      const idx = categories.findIndex(c => c.id === selectedCat.id);
      setSelectedCatColor(CAT_COLORS[idx % CAT_COLORS.length]);
    }
  }, [selectedCat]);

  const askConfirm = (message, onConfirm) => setConfirmModal({ message, onConfirm });

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const { data, error } = await supabase.from('notes_categories').insert([{ name: newCatName.trim() }]).select().single();
    if (error) { alert('Chyba: ' + error.message); return; }
    if (data) setCategories(p => [...p, data]);
    setNewCatName(''); setShowNewCat(false);
  };

  const saveCategory = async (id) => {
    if (!editingCatName.trim()) return;
    await supabase.from('notes_categories').update({ name: editingCatName.trim() }).eq('id', id);
    setCategories(p => p.map(c => c.id === id ? { ...c, name: editingCatName.trim() } : c));
    if (selectedCat?.id === id) setSelectedCat(p => ({ ...p, name: editingCatName.trim() }));
    setEditingCatId(null);
  };

  const deleteCategory = async (id) => {
    await supabase.from('notes_entries').delete().eq('category_id', id);
    await supabase.from('notes_categories').delete().eq('id', id);
    setCategories(p => p.filter(c => c.id !== id));
    if (selectedCat?.id === id) setSelectedCat(null);
  };

  const addEntry = async (type) => {
    if (!newContent.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('notes_entries').insert([{
      category_id: selectedCat.id, type, content: newContent.trim(), checked: false,
    }]).select().single();
    if (data) {
      setEntries(p => [...p, data]);
      setAllEntries(p => [...p, data]);
      setEntryCounts(p => ({ ...p, [selectedCat.id]: (p[selectedCat.id] || 0) + 1 }));
    }
    setNewContent(''); setAddingType(null); setSaving(false);
  };

  const toggleCheck = async (entry) => {
    const checked = !entry.checked;
    setEntries(p => p.map(e => e.id === entry.id ? { ...e, checked } : e));
    await supabase.from('notes_entries').update({ checked }).eq('id', entry.id);
  };

  const saveEntry = async (id) => {
    if (!editingEntryContent.trim()) return;
    await supabase.from('notes_entries').update({ content: editingEntryContent.trim() }).eq('id', id);
    setEntries(p => p.map(e => e.id === id ? { ...e, content: editingEntryContent.trim() } : e));
    setAllEntries(p => p.map(e => e.id === id ? { ...e, content: editingEntryContent.trim() } : e));
    setEditingEntryId(null);
  };

  const deleteEntry = async (id) => {
    setEntries(p => p.filter(e => e.id !== id));
    setAllEntries(p => p.filter(e => e.id !== id));
    setEntryCounts(p => ({ ...p, [selectedCat.id]: Math.max(0, (p[selectedCat.id] || 1) - 1) }));
    await supabase.from('notes_entries').delete().eq('id', id);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setUploadingVoice(true);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `voice-${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage.from('service-images').upload(`zapisnik/${fileName}`, blob);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(`zapisnik/${fileName}`);
          const { data: entry } = await supabase.from('notes_entries').insert([{
            category_id: selectedCat.id, type: 'voice', audio_url: urlData.publicUrl,
          }]).select().single();
          if (entry) {
            setEntries(p => [...p, entry]);
            setEntryCounts(p => ({ ...p, [selectedCat.id]: (p[selectedCat.id] || 0) + 1 }));
          }
        } else {
          alert('Nahrávku sa nepodarilo uložiť: ' + upErr.message);
        }
        setUploadingVoice(false);
        setAddingType(null);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      alert('Mikrofón nie je dostupný.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ── POTVRDZOVACIE OKNO ──
  const ConfirmModal = () => !confirmModal ? null : (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-5">
        <p className="text-white font-black text-base text-center leading-snug">{confirmModal.message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >Vymazať</button>
          <button
            onClick={() => setConfirmModal(null)}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >Zrušiť</button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest font-black">Načítavam...</div>
  );

  // ── DETAIL KATEGÓRIE ──
  if (selectedCat) {
    const tasks = entries.filter(e => e.type === 'task');
    const texts = entries.filter(e => e.type === 'text');
    const voices = entries.filter(e => e.type === 'voice');
    const doneTasks = tasks.filter(t => t.checked).length;
    const c = selectedCatColor;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <ConfirmModal />
        <div className={`sticky top-0 z-10 backdrop-blur-md border-b px-4 py-4 flex items-center gap-3 ${c.bg} ${c.border}`}>
          <button onClick={() => { setSelectedCat(null); setAddingType(null); setNewContent(''); setEditingCatId(null); }}
            className="bg-black/40 hover:bg-black/60 p-3 rounded-2xl transition-all text-base shrink-0">←</button>
          <div className="flex-1 min-w-0">
            {editingCatId === selectedCat.id ? (
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveCategory(selectedCat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                  className="flex-1 bg-black/40 border border-zinc-600 focus:border-white rounded-xl px-3 py-1.5 text-white font-black text-base outline-none uppercase italic tracking-tighter" />
                <button onClick={() => saveCategory(selectedCat.id)} className="text-green-400 font-black text-xs px-3 py-1.5 bg-green-900/30 border border-green-800/40 rounded-xl shrink-0">OK</button>
                <button onClick={() => setEditingCatId(null)} className="text-zinc-500 text-xs px-2 shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                <h1 className={`text-xl font-black uppercase italic tracking-tighter truncate ${c.text}`}>{selectedCat.name}</h1>
                <button onClick={() => { setEditingCatId(selectedCat.id); setEditingCatName(selectedCat.name); }}
                  className="text-zinc-600 hover:text-zinc-300 transition-all text-sm shrink-0 p-1">✏️</button>
              </div>
            )}
            {tasks.length > 0 && <p className="text-[10px] text-zinc-600 uppercase tracking-widest ml-4">{doneTasks}/{tasks.length} splnených</p>}
          </div>
          <button onClick={() => askConfirm('Vymazať celú kategóriu aj so všetkými položkami?', () => deleteCategory(selectedCat.id))}
            className="text-zinc-700 hover:text-red-600 transition-all p-2 text-sm shrink-0">🗑️</button>
        </div>

        <div className="flex-1 p-4 space-y-6 pb-36">

          {/* ÚLOHY — modré */}
          {tasks.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">☑ Úlohy</p>
              <div className="space-y-2">
                {tasks.map(e => (
                  <div key={e.id} className="bg-blue-950/20 border border-blue-900/40 p-4 rounded-2xl">
                    {editingEntryId === e.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={editingEntryContent} onChange={ev => setEditingEntryContent(ev.target.value)}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveEntry(e.id); if (ev.key === 'Escape') setEditingEntryId(null); }}
                          className="flex-1 bg-black/40 border border-blue-700 focus:border-blue-400 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none" />
                        <button onClick={() => saveEntry(e.id)} className="text-green-400 hover:text-green-300 font-black text-xs px-3 py-2 bg-green-900/30 border border-green-800/40 rounded-xl transition-all">Uložiť</button>
                        <button onClick={() => setEditingEntryId(null)} className="text-zinc-500 hover:text-white px-2 rounded-xl transition-all text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleCheck(e)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${e.checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-blue-800 hover:border-blue-500'}`}>
                          {e.checked && <span className="text-[10px] font-black">✓</span>}
                        </button>
                        <span className={`flex-1 font-bold text-sm leading-snug ${e.checked ? 'line-through text-zinc-600' : 'text-white'}`}>{e.content}</span>
                        <button onClick={() => { setEditingEntryId(e.id); setEditingEntryContent(e.content); }}
                          className="text-zinc-600 hover:text-zinc-300 transition-all text-xs shrink-0 p-1">✏️</button>
                        <button onClick={() => askConfirm('Vymazať túto úlohu?', () => deleteEntry(e.id))}
                          className="text-zinc-600 hover:text-red-500 transition-all text-xs shrink-0 p-1">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TEXT — jantárové */}
          {texts.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">📝 Poznámky</p>
              <div className="space-y-3">
                {texts.map(e => (
                  <div key={e.id} className="bg-amber-950/20 border border-amber-900/40 p-5 rounded-2xl">
                    {editingEntryId === e.id ? (
                      <div className="space-y-2">
                        <textarea autoFocus value={editingEntryContent} onChange={ev => setEditingEntryContent(ev.target.value)}
                          rows={4}
                          className="w-full bg-black/40 border border-amber-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEntry(e.id)} className="flex-1 text-green-400 hover:text-green-300 font-black text-xs py-2 bg-green-900/30 border border-green-800/40 rounded-xl transition-all">Uložiť</button>
                          <button onClick={() => setEditingEntryId(null)} className="text-zinc-500 hover:text-white px-4 py-2 rounded-xl transition-all text-xs bg-zinc-900">Zrušiť</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-sm text-zinc-200 font-bold whitespace-pre-wrap leading-relaxed">{e.content}</p>
                          <button onClick={() => { setEditingEntryId(e.id); setEditingEntryContent(e.content); }}
                            className="text-zinc-600 hover:text-zinc-300 transition-all text-xs shrink-0 p-1 mt-0.5">✏️</button>
                          <button onClick={() => askConfirm('Vymazať túto poznámku?', () => deleteEntry(e.id))}
                            className="text-zinc-600 hover:text-red-500 transition-all text-xs shrink-0 p-1 mt-0.5">✕</button>
                        </div>
                        <p className="text-[9px] text-zinc-700 mt-3 uppercase">{fmtDate(e.created_at)}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HLAS — fialové */}
          {voices.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">🎙️ Hlasové záznamy</p>
              <div className="space-y-3">
                {voices.map(e => (
                  <div key={e.id} className="bg-purple-950/20 border border-purple-900/40 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-purple-400 text-lg">🎙️</span>
                      <p className="text-[9px] text-zinc-600 uppercase flex-1">{fmtDate(e.created_at)}</p>
                      <button onClick={() => askConfirm('Vymazať tento hlasový záznam?', () => deleteEntry(e.id))}
                        className="text-zinc-600 hover:text-red-500 transition-all text-xs p-1">✕</button>
                    </div>
                    <audio src={e.audio_url} controls className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="text-center py-20 text-zinc-800 uppercase text-xs tracking-widest font-black">
              Prázdna kategória.<br />Pridajte prvú položku.
            </div>
          )}
        </div>

        {/* ADD PANEL */}
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 p-4 space-y-3 z-20">
          {addingType === 'text' && (
            <div className="space-y-2">
              <textarea autoFocus value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder="Napíšte poznámku..." rows={3}
                className="w-full bg-black border border-amber-900/50 focus:border-amber-500 rounded-2xl p-4 text-white text-sm outline-none resize-none font-bold" />
              <div className="flex gap-2">
                <button onClick={() => addEntry('text')} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest transition-all">Uložiť</button>
                <button onClick={() => { setAddingType(null); setNewContent(''); }} className="bg-zinc-900 text-zinc-400 font-black py-3 px-5 rounded-2xl text-xs transition-all">✕</button>
              </div>
            </div>
          )}
          {addingType === 'task' && (
            <div className="flex gap-2">
              <input autoFocus value={newContent} onChange={e => setNewContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry('task')}
                placeholder="Nová úloha..."
                className="flex-1 bg-black border border-blue-900/50 focus:border-blue-500 rounded-2xl px-4 py-3 text-white text-sm outline-none font-bold" />
              <button onClick={() => addEntry('task')} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-3 px-5 rounded-2xl text-xs uppercase transition-all">+</button>
              <button onClick={() => { setAddingType(null); setNewContent(''); }} className="bg-zinc-900 text-zinc-400 py-3 px-4 rounded-2xl text-xs transition-all">✕</button>
            </div>
          )}
          {addingType === 'voice' && (
            <div className="text-center space-y-3">
              {uploadingVoice ? (
                <p className="text-purple-400 font-black text-sm uppercase tracking-widest animate-pulse">Ukladám nahrávku...</p>
              ) : isRecording ? (
                <>
                  <p className="text-red-500 font-black text-sm animate-pulse uppercase tracking-widest">🔴 Nahrávam... {fmtTime(recordingSeconds)}</p>
                  <button onClick={stopRecording} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">⏹ Zastaviť a uložiť</button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button onClick={startRecording} className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all">🎤 Začať nahrávať</button>
                  <button onClick={() => setAddingType(null)} className="bg-zinc-900 text-zinc-400 py-4 px-5 rounded-2xl text-xs transition-all">✕</button>
                </div>
              )}
            </div>
          )}
          {!addingType && (
            <div className="flex gap-2">
              <button onClick={() => setAddingType('task')} className="flex-1 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-900/50 text-blue-300 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">☑ Úloha</button>
              <button onClick={() => setAddingType('text')} className="flex-1 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-900/50 text-amber-300 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">📝 Text</button>
              <button onClick={() => setAddingType('voice')} className="flex-1 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-900/50 text-purple-300 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">🎤 Hlas</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ZOZNAM KATEGÓRIÍ ──
  const q = nd(search.trim());
  const searchResults = q
    ? allEntries
        .filter(e => e.type !== 'voice' && nd(e.content || '').includes(q))
        .map(e => {
          const idx = categories.findIndex(c => c.id === e.category_id);
          return { ...e, cat: categories[idx], color: CAT_COLORS[idx % CAT_COLORS.length] };
        })
    : [];
  const catNameHits = q ? categories.filter(c => nd(c.name).includes(q)) : [];

  const highlight = (text) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => nd(p) === q
      ? <mark key={i} className="bg-red-600/40 text-red-200 rounded px-0.5">{p}</mark>
      : p
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <ConfirmModal />
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6 pt-4">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">Zápisník</h1>
          <p className="text-zinc-600 text-xs uppercase tracking-widest mt-1">Osobné poznámky a úlohy</p>
        </div>

        {/* SEARCH */}
        <div className="relative mb-4">
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
                {catNameHits.map((cat, idx) => {
                  const c = CAT_COLORS[categories.findIndex(c2 => c2.id === cat.id) % CAT_COLORS.length];
                  return (
                    <button key={cat.id} onClick={() => { setSelectedCat(cat); setSearch(''); }}
                      className={`w-full flex items-center gap-3 px-5 py-4 border rounded-2xl text-left transition-all ${c.bg} ${c.border} hover:opacity-80`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <span className={`font-black uppercase italic tracking-tight text-base ${c.text}`}>{highlight(cat.name)}</span>
                      <span className="ml-auto text-zinc-600 text-xs">{entryCounts[cat.id] || 0} položiek</span>
                    </button>
                  );
                })}
              </>
            )}
            {searchResults.length > 0 && (
              <>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-4 mb-2">Položky ({searchResults.length})</p>
                {searchResults.map(e => {
                  const c = e.color || CAT_COLORS[0];
                  const typeIcon = e.type === 'task' ? '☑' : '📝';
                  return (
                    <button key={e.id} onClick={() => { setSelectedCat(e.cat); setSearch(''); }}
                      className="w-full text-left bg-zinc-950 border border-zinc-800 hover:border-zinc-600 p-4 rounded-2xl transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{e.cat?.name}</span>
                        <span className="ml-auto text-zinc-700 text-xs">{typeIcon}</span>
                      </div>
                      <p className="text-sm text-zinc-300 font-bold leading-snug line-clamp-2">{highlight(e.content)}</p>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {!q && (showNewCat ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-4 space-y-3">
            <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="Názov kategórie..."
              className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm" />
            <div className="flex gap-2">
              <button onClick={addCategory} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all">Vytvoriť</button>
              <button onClick={() => { setShowNewCat(false); setNewCatName(''); }} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black py-3 px-5 rounded-xl text-xs transition-all">Zrušiť</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNewCat(true)}
            className="w-full border-2 border-dashed border-zinc-800 hover:border-red-600 text-zinc-600 hover:text-red-500 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all mb-4">
            + Nová kategória
          </button>
        ))}

        {!q && (
        <div className="space-y-2">
          {categories.map((cat, idx) => {
            const c = CAT_COLORS[idx % CAT_COLORS.length];
            const isEditing = editingCatId === cat.id;
            return (
              <div key={cat.id} className={`flex items-center border rounded-2xl transition-all ${c.bg} ${c.border}`}>
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                    <input
                      autoFocus
                      value={editingCatName}
                      onChange={e => setEditingCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                      className="flex-1 bg-black/40 border border-zinc-700 focus:border-red-500 rounded-xl px-3 py-2 text-white font-black text-sm outline-none uppercase italic tracking-tight"
                    />
                    <button onClick={() => saveCategory(cat.id)} className="text-green-400 hover:text-green-300 font-black text-xs px-3 py-2 bg-green-900/30 border border-green-800/40 rounded-xl transition-all">Uložiť</button>
                    <button onClick={() => setEditingCatId(null)} className="text-zinc-500 hover:text-white px-2 py-2 rounded-xl transition-all text-xs">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setSelectedCat(cat)} className="flex-1 px-5 py-4 text-left flex items-center gap-3 active:opacity-70">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                    <h3 className={`font-black uppercase italic tracking-tight text-base ${c.text}`}>{cat.name}</h3>
                    <span className="ml-auto text-zinc-700 text-xs">{entryCounts[cat.id] || 0}</span>
                  </button>
                )}
                {!isEditing && (
                  <button onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                    className="px-3 py-4 text-zinc-600 hover:text-zinc-300 transition-all text-sm shrink-0">✏️</button>
                )}
                {!isEditing && (
                  <button onClick={() => askConfirm(`Vymazať kategóriu „${cat.name}"?`, () => deleteCategory(cat.id))}
                    className="px-4 py-4 text-zinc-700 hover:text-red-500 transition-all text-sm shrink-0">🗑️</button>
                )}
              </div>
            );
          })}
          {categories.length === 0 && !showNewCat && (
            <div className="text-center py-20 text-zinc-800 uppercase text-xs tracking-widest font-black">
              Zatiaľ žiadne kategórie.<br />Vytvorte prvú.
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
