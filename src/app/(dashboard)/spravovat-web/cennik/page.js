'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

const ICONS = ['🔧','⚡','❄️','🛞','🔩','🚗','🛠️','💡','🔋','⚙️'];

const emptyItem = () => ({ name: '', price: '', note: '' });
const emptyCategory = () => ({ icon: '🔧', name: '', items: [emptyItem()] });

export default function CennikPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('business_settings').select('value').eq('id', 'cennik').single()
      .then(({ data }) => {
        if (data?.value) {
          try { setCategories(JSON.parse(data.value)); } catch { setCategories([]); }
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const clean = categories
      .filter(c => c.name.trim())
      .map(c => ({ ...c, items: c.items.filter(i => i.name.trim()) }));
    await supabase.from('business_settings').upsert({ id: 'cennik', value: JSON.stringify(clean) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addCategory = () => setCategories(p => [...p, emptyCategory()]);
  const removeCategory = (ci) => setCategories(p => p.filter((_, i) => i !== ci));
  const updateCategory = (ci, field, val) => setCategories(p => p.map((c, i) => i === ci ? { ...c, [field]: val } : c));

  const addItem = (ci) => setCategories(p => p.map((c, i) => i === ci ? { ...c, items: [...c.items, emptyItem()] } : c));
  const removeItem = (ci, ii) => setCategories(p => p.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c));
  const updateItem = (ci, ii, field, val) => setCategories(p => p.map((c, i) => i === ci ? {
    ...c, items: c.items.map((item, j) => j === ii ? { ...item, [field]: val } : item)
  } : c));

  const moveCategory = (ci, dir) => {
    const next = [...categories];
    const swap = ci + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[ci], next[swap]] = [next[swap], next[ci]];
    setCategories(next);
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[300px]">
      <div className="text-zinc-600 font-black uppercase text-xs tracking-widest animate-pulse">Načítavam...</div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <button onClick={() => router.push('/spravovat-web')} className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all mb-2 block">
            ← Späť
          </button>
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Správa webu</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Cenník</h1>
        </div>
        <div className="flex gap-3">
          <a href="/#cennik" target="_blank" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            🌐 Náhľad
          </a>
          <button onClick={save} disabled={saving}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all min-w-[120px]">
            {saving ? 'Ukladám...' : saved ? '✓ Uložené' : 'Uložiť'}
          </button>
        </div>
      </div>

      <p className="text-zinc-500 text-sm font-bold mb-8">
        Cenník sa zobrazí na hlavnej stránke len ak má aspoň jednu kategóriu s položkami.
      </p>

      {/* KATEGÓRIE */}
      <div className="space-y-6">
        {categories.map((cat, ci) => (
          <div key={ci} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">

            {/* HEADER KATEGÓRIE */}
            <div className="px-7 py-5 border-b border-zinc-900 flex items-center gap-3">
              {/* IKONA PICKER */}
              <div className="relative group/icon">
                <button className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-800 transition-all">
                  {cat.icon}
                </button>
                <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 grid grid-cols-5 gap-1 z-10 hidden group-focus-within/icon:grid">
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => updateCategory(ci, 'icon', ic)}
                      className="w-8 h-8 text-lg flex items-center justify-center rounded-lg hover:bg-zinc-700 transition-all">
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={cat.name}
                onChange={e => updateCategory(ci, 'name', e.target.value)}
                placeholder="Názov kategórie (napr. Mechanické práce)"
                className="flex-1 bg-transparent text-white font-black uppercase italic text-sm tracking-tight outline-none placeholder:text-zinc-700 border-b border-transparent focus:border-zinc-700 pb-1 transition-all"
              />
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => moveCategory(ci, -1)} disabled={ci === 0}
                  className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-white disabled:opacity-20 transition-all text-xs">↑</button>
                <button onClick={() => moveCategory(ci, 1)} disabled={ci === categories.length - 1}
                  className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-white disabled:opacity-20 transition-all text-xs">↓</button>
                <button onClick={() => removeCategory(ci)}
                  className="w-7 h-7 flex items-center justify-center text-zinc-700 hover:text-red-500 transition-all text-sm ml-1">✕</button>
              </div>
            </div>

            {/* POLOŽKY */}
            <div className="divide-y divide-zinc-900">
              {cat.items.map((item, ii) => (
                <div key={ii} className="px-7 py-4 flex items-center gap-3">
                  <input
                    value={item.name}
                    onChange={e => updateItem(ci, ii, 'name', e.target.value)}
                    placeholder="Názov úkonu"
                    className="flex-1 bg-transparent text-zinc-300 text-sm font-bold outline-none placeholder:text-zinc-700 border-b border-transparent focus:border-zinc-700 pb-1 transition-all"
                  />
                  <input
                    value={item.note}
                    onChange={e => updateItem(ci, ii, 'note', e.target.value)}
                    placeholder="Poznámka (napr. bez materiálu)"
                    className="w-44 bg-transparent text-zinc-500 text-xs font-bold outline-none placeholder:text-zinc-700 border-b border-transparent focus:border-zinc-700 pb-1 transition-all hidden md:block"
                  />
                  <input
                    value={item.price}
                    onChange={e => updateItem(ci, ii, 'price', e.target.value)}
                    placeholder="od 35 €"
                    className="w-28 bg-transparent text-red-500 text-sm font-black text-right outline-none placeholder:text-zinc-700 border-b border-transparent focus:border-zinc-700 pb-1 transition-all"
                  />
                  <button onClick={() => removeItem(ci, ii)}
                    className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-red-500 transition-all text-sm shrink-0">✕</button>
                </div>
              ))}
            </div>

            {/* PRIDAŤ POLOŽKU */}
            <div className="px-7 py-4 border-t border-zinc-900">
              <button onClick={() => addItem(ci)}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all flex items-center gap-2">
                <span className="w-5 h-5 border border-zinc-700 rounded-md flex items-center justify-center text-xs">+</span>
                Pridať položku
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* PRIDAŤ KATEGÓRIU */}
      <button onClick={addCategory}
        className="mt-6 w-full border-2 border-dashed border-zinc-800 hover:border-red-600/40 rounded-[2rem] py-8 text-zinc-600 hover:text-white font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3">
        <span className="text-xl">+</span>
        Pridať kategóriu
      </button>

    </div>
  );
}
