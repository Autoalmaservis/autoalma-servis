'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';

const ICONS = ['📁','📝','🔧','🚗','💡','🏠','💰','📞','🎯','✅','⭐','🔑','🛒','📅','🏋️','🍕','💊','✈️','🎵','📦'];

export default function ZapisnikPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryCounts, setEntryCounts] = useState({});

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');

  const [addingType, setAddingType] = useState(null);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

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
      const { data: counts } = await supabase
        .from('notes_entries')
        .select('category_id')
        .in('category_id', cats.map(c => c.id));
      const map = {};
      (counts || []).forEach(r => { map[r.category_id] = (map[r.category_id] || 0) + 1; });
      setEntryCounts(map);
    }
    setLoading(false);
  };

  const fetchEntries = async (catId) => {
    const { data } = await supabase.from('notes_entries').select('*').eq('category_id', catId).order('created_at');
    setEntries(data || []);
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (selectedCat) fetchEntries(selectedCat.id); }, [selectedCat]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const { data } = await supabase.from('notes_categories').insert([{ name: newCatName.trim(), icon: newCatIcon }]).select().single();
    if (data) setCategories(p => [...p, data]);
    setNewCatName(''); setNewCatIcon('📁'); setShowNewCat(false);
  };

  const deleteCategory = async (id) => {
    if (!confirm('Vymazať kategóriu aj so všetkými položkami?')) return;
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
      setEntryCounts(p => ({ ...p, [selectedCat.id]: (p[selectedCat.id] || 0) + 1 }));
    }
    setNewContent(''); setAddingType(null); setSaving(false);
  };

  const toggleCheck = async (entry) => {
    const checked = !entry.checked;
    setEntries(p => p.map(e => e.id === entry.id ? { ...e, checked } : e));
    await supabase.from('notes_entries').update({ checked }).eq('id', entry.id);
  };

  const deleteEntry = async (id) => {
    setEntries(p => p.filter(e => e.id !== id));
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
        const { error: upErr } = await supabase.storage.from('voice-notes').upload(fileName, blob);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName);
          const { data: entry } = await supabase.from('notes_entries').insert([{
            category_id: selectedCat.id, type: 'voice', audio_url: urlData.publicUrl,
          }]).select().single();
          if (entry) {
            setEntries(p => [...p, entry]);
            setEntryCounts(p => ({ ...p, [selectedCat.id]: (p[selectedCat.id] || 0) + 1 }));
          }
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

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest font-black">
      Načítavam...
    </div>
  );

  // ── CATEGORY DETAIL ──
  if (selectedCat) {
    const tasks = entries.filter(e => e.type === 'task');
    const texts = entries.filter(e => e.type === 'text');
    const voices = entries.filter(e => e.type === 'voice');
    const doneTasks = tasks.filter(t => t.checked).length;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => { setSelectedCat(null); setAddingType(null); setNewContent(''); }}
            className="bg-zinc-900 hover:bg-zinc-800 p-3 rounded-2xl transition-all text-base shrink-0"
          >←</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black uppercase italic tracking-tighter truncate">{selectedCat.icon} {selectedCat.name}</h1>
            {tasks.length > 0 && (
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{doneTasks}/{tasks.length} splnených</p>
            )}
          </div>
          <button onClick={() => deleteCategory(selectedCat.id)} className="text-zinc-700 hover:text-red-600 transition-all p-2 text-sm shrink-0">🗑️</button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-6 pb-36 overflow-y-auto">

          {/* TASKS */}
          {tasks.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">Úlohy</p>
              <div className="space-y-2">
                {tasks.map(e => (
                  <div key={e.id} className="flex items-center gap-3 bg-zinc-950 border border-zinc-900 p-4 rounded-2xl group">
                    <button
                      onClick={() => toggleCheck(e)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${e.checked ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 hover:border-red-600'}`}
                    >{e.checked && <span className="text-[10px] font-black">✓</span>}</button>
                    <span className={`flex-1 font-bold text-sm leading-snug ${e.checked ? 'line-through text-zinc-600' : 'text-white'}`}>{e.content}</span>
                    <button onClick={() => deleteEntry(e.id)} className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-600 transition-all text-xs shrink-0 p-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TEXT NOTES */}
          {texts.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">Poznámky</p>
              <div className="space-y-3">
                {texts.map(e => (
                  <div key={e.id} className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl group relative">
                    <p className="text-sm text-zinc-200 font-bold whitespace-pre-wrap leading-relaxed pr-6">{e.content}</p>
                    <p className="text-[9px] text-zinc-700 mt-3 uppercase">{fmtDate(e.created_at)}</p>
                    <button onClick={() => deleteEntry(e.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-600 transition-all text-xs p-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VOICE */}
          {voices.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">Hlasové záznamy</p>
              <div className="space-y-3">
                {voices.map(e => (
                  <div key={e.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl group">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">🎙️</span>
                      <p className="text-[9px] text-zinc-700 uppercase">{fmtDate(e.created_at)}</p>
                      <button onClick={() => deleteEntry(e.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-600 transition-all text-xs p-1">✕</button>
                    </div>
                    <audio src={e.audio_url} controls className="w-full" style={{ height: '36px' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="text-center py-20 text-zinc-800 uppercase text-xs tracking-widest font-black">
              Prázdna kategória.<br/>Pridajte prvú položku.
            </div>
          )}
        </div>

        {/* ADD PANEL — fixed bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 p-4 space-y-3 z-20">

          {addingType === 'text' && (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Napíšte poznámku..."
                rows={3}
                className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl p-4 text-white text-sm outline-none resize-none font-bold"
              />
              <div className="flex gap-2">
                <button onClick={() => addEntry('text')} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest transition-all">Uložiť</button>
                <button onClick={() => { setAddingType(null); setNewContent(''); }} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black py-3 px-5 rounded-2xl text-xs transition-all">✕</button>
              </div>
            </div>
          )}

          {addingType === 'task' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEntry('task')}
                  placeholder="Nová úloha..."
                  className="flex-1 bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-4 py-3 text-white text-sm outline-none font-bold"
                />
                <button onClick={() => addEntry('task')} disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 px-5 rounded-2xl text-xs uppercase transition-all">+</button>
                <button onClick={() => { setAddingType(null); setNewContent(''); }} className="bg-zinc-900 text-zinc-400 py-3 px-4 rounded-2xl text-xs transition-all">✕</button>
              </div>
            </div>
          )}

          {addingType === 'voice' && (
            <div className="text-center space-y-3">
              {uploadingVoice ? (
                <p className="text-zinc-400 font-black text-sm uppercase tracking-widest animate-pulse">Ukladám nahrávku...</p>
              ) : isRecording ? (
                <>
                  <p className="text-red-500 font-black text-sm animate-pulse uppercase tracking-widest">🔴 Nahrávam... {fmtTime(recordingSeconds)}</p>
                  <button onClick={stopRecording} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">⏹ Zastaviť a uložiť</button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button onClick={startRecording} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all">🎤 Začať nahrávať</button>
                  <button onClick={() => setAddingType(null)} className="bg-zinc-900 text-zinc-400 py-4 px-5 rounded-2xl text-xs transition-all">✕</button>
                </div>
              )}
            </div>
          )}

          {!addingType && (
            <div className="flex gap-2">
              <button onClick={() => setAddingType('task')} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">☑ Úloha</button>
              <button onClick={() => setAddingType('text')} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">📝 Text</button>
              <button onClick={() => setAddingType('voice')} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">🎤 Hlas</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN — category list ──
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-8 pt-4">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">📒 Zápisník</h1>
          <p className="text-zinc-600 text-xs uppercase tracking-widest mt-1">Osobné poznámky a úlohy</p>
        </div>

        {showNewCat ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 mb-6 space-y-4">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Nová kategória</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setNewCatIcon(ic)}
                  className={`text-xl p-2 rounded-xl transition-all ${newCatIcon === ic ? 'bg-red-600 scale-110' : 'bg-zinc-900 hover:bg-zinc-800'}`}>
                  {ic}
                </button>
              ))}
            </div>
            <input
              autoFocus
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="Názov kategórie..."
              className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-4 py-4 text-white font-bold outline-none text-sm"
            />
            <div className="flex gap-2">
              <button onClick={addCategory} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">Vytvoriť</button>
              <button onClick={() => { setShowNewCat(false); setNewCatName(''); }} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black py-4 px-6 rounded-2xl text-xs transition-all">Zrušiť</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNewCat(true)}
            className="w-full border-2 border-dashed border-zinc-800 hover:border-red-600 text-zinc-600 hover:text-red-500 font-black py-5 rounded-[2rem] text-xs uppercase tracking-widest transition-all mb-6">
            + Nová kategória
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCat(cat)}
              className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-700 p-6 rounded-[2rem] text-left transition-all group active:scale-95">
              <span className="text-3xl mb-4 block">{cat.icon}</span>
              <h3 className="font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors leading-tight text-sm">{cat.name}</h3>
              {entryCounts[cat.id] > 0 && (
                <p className="text-[10px] text-zinc-700 mt-2 uppercase tracking-widest">{entryCounts[cat.id]} položiek</p>
              )}
            </button>
          ))}
        </div>

        {categories.length === 0 && !showNewCat && (
          <div className="text-center py-20 text-zinc-800 uppercase text-xs tracking-widest font-black">
            Zatiaľ žiadne kategórie.<br/>Vytvorte prvú.
          </div>
        )}
      </div>
    </div>
  );
}
