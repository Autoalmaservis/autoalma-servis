'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

const DEFAULT_SECTIONS = [
  { slug: 'mechanicke-prace', icon: '🔧', name: 'Mechanické práce' },
  { slug: 'elektro-diagnostika', icon: '⚡', name: 'Elektro a diagnostika' },
  { slug: 'klimatizacia', icon: '❄️', name: 'Klimatizácia' },
];

export default function SpravovatWebPage() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ slug: '', icon: '🔧', name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSections(); }, []);

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('web_sections').select('*').order('sort_order');
    if (error && error.code === '42P01') {
      setDbReady(false);
      setLoading(false);
      return;
    }
    if (!error && data) {
      const existing = data.map(s => s.slug);
      const merged = [
        ...data,
        ...DEFAULT_SECTIONS.filter(d => !existing.includes(d.slug)).map(d => ({ ...d, id: null, items: [], image_urls: [], description: '' })),
      ];
      setSections(merged);
    }
    setLoading(false);
  };

  const createSection = async () => {
    if (!newForm.name) return;
    setSaving(true);
    const raw = newForm.slug || newForm.name;
    const slug = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await supabase.from('web_sections').upsert({ slug, icon: newForm.icon, name: newForm.name, items: [], image_urls: [], description: '', sort_order: sections.length });
    setNewOpen(false);
    setNewForm({ slug: '', icon: '🔧', name: '' });
    setSaving(false);
    fetchSections();
  };

  if (!dbReady) return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-6">Spravovať web</h1>
      <div className="bg-amber-600/10 border border-amber-600/40 rounded-2xl p-6">
        <p className="text-amber-400 font-black uppercase text-sm mb-4">⚠️ Databázová tabuľka neexistuje</p>
        <p className="text-zinc-400 text-xs font-bold mb-4">Spustite tento SQL v Supabase → SQL Editor:</p>
        <pre className="bg-black p-4 rounded-xl text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE web_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '🔧',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  items JSONB DEFAULT '[]',
  image_urls JSONB DEFAULT '[]',
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
        <button onClick={fetchSections} className="mt-4 bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest">
          Skúsiť znova
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Správa webu</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Sekcie služieb</h1>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            🌐 Otvoriť web
          </a>
          <button onClick={() => setNewOpen(true)} className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            + Nová sekcia
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* GALÉRIA — pevná karta */}
          <button
            onClick={() => router.push('/spravovat-web/galeria')}
            className="bg-zinc-950 border border-zinc-900 hover:border-red-600/40 p-7 rounded-[2rem] text-left transition-all group"
          >
            <span className="text-4xl mb-4 block">📸</span>
            <h2 className="text-base font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors mb-2">
              Galéria
            </h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-4">
              Fotky z dielne · hlavná stránka
            </p>
            <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-red-500 transition-colors">Spravovať</span>
              <span className="text-zinc-700 group-hover:text-red-500 transition-all group-hover:translate-x-1 inline-block">→</span>
            </div>
          </button>

          {/* CENNÍK — pevná karta */}
          <button
            onClick={() => router.push('/spravovat-web/cennik')}
            className="bg-zinc-950 border border-zinc-900 hover:border-red-600/40 p-7 rounded-[2rem] text-left transition-all group"
          >
            <span className="text-4xl mb-4 block">💰</span>
            <h2 className="text-base font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors mb-2">
              Cenník
            </h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-4">
              Orientačné ceny · hlavná stránka
            </p>
            <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-red-500 transition-colors">Spravovať</span>
              <span className="text-zinc-700 group-hover:text-red-500 transition-all group-hover:translate-x-1 inline-block">→</span>
            </div>
          </button>

          {sections.map((s, i) => (
            <button
              key={s.slug}
              onClick={() => router.push(`/spravovat-web/${s.slug}`)}
              className="bg-zinc-950 border border-zinc-900 hover:border-red-600/40 p-7 rounded-[2rem] text-left transition-all group"
            >
              <span className="text-4xl mb-4 block">{s.icon}</span>
              <h2 className="text-base font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors mb-2">
                {s.name}
              </h2>
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-4">
                {Array.isArray(s.items) ? s.items.length : 0} položiek ·{' '}
                {Array.isArray(s.image_urls) ? s.image_urls.length : 0} obrázkov
              </p>
              {!s.id && (
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                  Ešte neuložené
                </span>
              )}
              <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-red-500 transition-colors">Upraviť</span>
                <span className="text-zinc-700 group-hover:text-red-500 transition-all group-hover:translate-x-1 inline-block">→</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* MODAL — NOVÁ SEKCIA */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-md">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-6">Nová sekcia</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Ikona (emoji)</label>
                <input value={newForm.icon} onChange={e => setNewForm(p => ({ ...p, icon: e.target.value }))}
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black outline-none transition-all text-2xl" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Názov sekcie</label>
                <input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="napr. Pneuservis"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black outline-none transition-all text-sm uppercase italic" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">URL slug (generuje sa automaticky)</label>
                <input value={newForm.slug || newForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                  onChange={e => setNewForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="napr. pneuservis"
                  className="w-full bg-black border border-zinc-800 focus:border-zinc-600 p-3 rounded-xl text-zinc-500 font-mono outline-none transition-all text-xs" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setNewOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all">Zrušiť</button>
              <button onClick={createSection} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
                {saving ? 'Ukladám...' : 'Vytvoriť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
