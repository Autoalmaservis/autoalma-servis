'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

const DEFAULTS = {
  'mechanicke-prace': {
    icon: '🔧',
    name: 'Mechanické práce',
    description: '',
    items: [
      'Pravidelný servis',
      'Výmena bŕzd',
      'Oprava podvozku',
      'Čistenie DPF/CAT',
      'Spojka a prevodovka',
      'Dekarbonizácia',
    ],
  },
  'elektro-diagnostika': {
    icon: '⚡',
    name: 'Elektro a diagnostika',
    description: '',
    items: [
      'Diagnostika',
      'Oprava / hľadanie elektrických závad',
      'Chiptuning',
      'Oprava ABS',
      'Oprava AdBlue',
      'Oprava budíkov',
      'Nahratie nových kľúčov',
      'RJM oprava',
    ],
  },
  'klimatizacia': {
    icon: '❄️',
    name: 'Klimatizácia',
    description: '',
    items: [
      'Čistenie ozónom',
      'Plnenie klimatizácie',
    ],
  },
};

export default function EditWebSectionPage() {
  const { slug } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const fileRefs = useRef({});

  const [form, setForm] = useState({
    icon: '',
    name: '',
    description: '',
    items: [],
  });

  useEffect(() => { fetchSection(); }, [slug]);

  const fetchSection = async () => {
    setLoading(true);
    const { data } = await supabase.from('web_sections').select('*').eq('slug', slug).single();

    const source = data || DEFAULTS[slug];
    if (source) {
      const rawItems = Array.isArray(source.items) ? source.items : [];
      setForm({
        icon: source.icon || '',
        name: source.name || '',
        description: source.description || '',
        items: rawItems.map(item =>
          typeof item === 'string'
            ? { title: item, desc: '', image_urls: [] }
            : { title: item.title || '', desc: item.desc || '', image_urls: item.image_urls || [] }
        ),
      });
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('web_sections').upsert({
      slug,
      icon: form.icon,
      name: form.name,
      description: form.description,
      items: form.items,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' });
    setSaving(false);
    if (error) {
      alert('Chyba pri ukladaní: ' + error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { title: '', desc: '', image_urls: [] }] }));
    setExpandedIdx(form.items.length);
  };

  const updateItem = (i, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  };

  const removeItem = (i) => {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
    if (expandedIdx === i) setExpandedIdx(null);
  };

  const moveItem = (i, dir) => {
    setForm(f => {
      const items = [...f.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return f;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...f, items };
    });
  };

  const uploadItemImages = async (i, files) => {
    setUploadingIdx(i);
    const urls = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `web-images/${slug}/items/${i}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('web-images').upload(path, file, { cacheControl: '3600', upsert: false });
      if (!error) {
        const { data: urlData } = supabase.storage.from('web-images').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], image_urls: [...(items[i].image_urls || []), ...urls] };
      return { ...f, items };
    });
    setUploadingIdx(null);
  };

  const removeItemImage = (i, url) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], image_urls: items[i].image_urls.filter(u => u !== url) };
      return { ...f, items };
    });
  };

  if (loading) return (
    <div className="p-10 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
  );

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => router.push('/spravovat-web')} className="text-zinc-600 hover:text-white transition-all text-lg">←</button>
        <div className="flex-grow">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Úprava sekcie</p>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">{form.name || slug}</h1>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            🌐 Web
          </a>
          <button onClick={save} disabled={saving}
            className={`px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} disabled:opacity-60`}>
            {saved ? '✓ Uložené' : saving ? 'Ukladám...' : 'Uložiť'}
          </button>
        </div>
      </div>

      <div className="space-y-5">

        {/* ZÁKLADNÉ INFO */}
        <div className="bg-zinc-950 border border-zinc-900 p-7 rounded-[2rem]">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-5">Základné informácie</p>
          <div className="grid grid-cols-[80px_1fr] gap-4 mb-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Ikona</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                className="w-full bg-black border border-zinc-800 focus:border-blue-500 p-3 rounded-xl text-white font-black outline-none transition-all text-2xl text-center" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Názov sekcie</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-black border border-zinc-800 focus:border-blue-500 p-3 rounded-xl text-white font-black italic uppercase outline-none transition-all text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Popis sekcie</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Krátky popis kategórie..."
              className="w-full bg-black border border-zinc-800 focus:border-blue-500 p-4 rounded-xl text-white font-bold outline-none transition-all text-sm resize-none leading-relaxed" />
          </div>
        </div>

        {/* POLOŽKY */}
        <div className="bg-zinc-950 border border-zinc-900 p-7 rounded-[2rem]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Položky / Služby</p>
              <p className="text-[9px] text-zinc-600 font-bold mt-1">Každá položka má vlastný popis a fotky — zákazník ich vidí po kliknutí</p>
            </div>
            <button onClick={addItem} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
              + Pridať
            </button>
          </div>

          {form.items.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-700 text-xs font-black uppercase tracking-widest italic">
              Žiadne položky — kliknite + Pridať
            </div>
          ) : (
            <div className="space-y-2">
              {form.items.map((item, i) => {
                const isOpen = expandedIdx === i;
                return (
                  <div key={i} className={`border rounded-2xl overflow-hidden transition-all ${isOpen ? 'border-blue-500/40 bg-black' : 'border-zinc-800 bg-zinc-900/40'}`}>

                    {/* RIADOK — vždy viditeľný */}
                    <div className="flex items-center gap-3 p-4">
                      <span className="text-zinc-600 font-black text-xs w-5 shrink-0 text-center">{i + 1}</span>
                      <input
                        value={item.title}
                        onChange={e => updateItem(i, 'title', e.target.value)}
                        placeholder="Názov služby..."
                        className="flex-grow bg-transparent border-none outline-none text-white font-black italic uppercase text-sm placeholder:text-zinc-700"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        {item.image_urls?.length > 0 && (
                          <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                            {item.image_urls.length} foto
                          </span>
                        )}
                        {item.desc && (
                          <span className="text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">text</span>
                        )}
                        <button onClick={() => moveItem(i, -1)} className="text-zinc-700 hover:text-white px-1.5 py-1 rounded-lg hover:bg-zinc-800 text-xs transition-all">↑</button>
                        <button onClick={() => moveItem(i, 1)} className="text-zinc-700 hover:text-white px-1.5 py-1 rounded-lg hover:bg-zinc-800 text-xs transition-all">↓</button>
                        <button
                          onClick={() => setExpandedIdx(isOpen ? null : i)}
                          className={`px-3 py-1.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${isOpen ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-white border border-zinc-700'}`}
                        >
                          {isOpen ? 'Zavrieť' : 'Upraviť'}
                        </button>
                        <button onClick={() => removeItem(i)} className="text-zinc-700 hover:text-red-500 px-1.5 py-1 rounded-lg hover:bg-red-600/10 text-xs transition-all">✕</button>
                      </div>
                    </div>

                    {/* ROZBALITEĽNÁ ČASŤ */}
                    {isOpen && (
                      <div className="px-5 pb-5 space-y-4 border-t border-zinc-800/60 pt-4">

                        {/* POPIS */}
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                            Popis — zákazník ho vidí po kliknutí na túto položku
                          </label>
                          <textarea
                            value={item.desc}
                            onChange={e => updateItem(i, 'desc', e.target.value)}
                            placeholder="Čo táto služba zahŕňa, prečo je dôležitá, čo zákazník získa..."
                            rows={3}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-4 rounded-xl text-zinc-300 font-bold outline-none transition-all text-sm resize-none leading-relaxed"
                          />
                        </div>

                        {/* FOTKY */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Fotky k tejto položke</label>
                            <button
                              onClick={() => fileRefs.current[i]?.click()}
                              disabled={uploadingIdx === i}
                              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                            >
                              {uploadingIdx === i ? 'Nahrávam...' : '↑ Pridať foto'}
                            </button>
                            <input
                              ref={el => fileRefs.current[i] = el}
                              type="file" multiple accept="image/*" className="hidden"
                              onChange={e => uploadItemImages(i, e.target.files)}
                            />
                          </div>
                          {item.image_urls?.length > 0 ? (
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                              {item.image_urls.map((url, k) => (
                                <div key={k} className="relative group aspect-video rounded-xl overflow-hidden border border-zinc-800">
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => removeItemImage(i, url)}
                                    className="absolute top-1 right-1 bg-black/80 hover:bg-red-600 text-white w-6 h-6 rounded-full font-black text-[10px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                                  >✕</button>
                                </div>
                              ))}
                              <button
                                onClick={() => fileRefs.current[i]?.click()}
                                className="aspect-video rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-all font-black text-xl"
                              >+</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => fileRefs.current[i]?.click()}
                              className="w-full py-6 border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl text-zinc-700 hover:text-zinc-500 text-[10px] font-black uppercase tracking-widest italic transition-all"
                            >
                              Kliknite sem a nahrajte fotky
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ULOŽIŤ dole */}
      <div className="flex justify-end gap-3 mt-8 pb-10">
        <button onClick={() => router.push('/spravovat-web')} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
          Späť
        </button>
        <button onClick={save} disabled={saving}
          className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} disabled:opacity-60`}>
          {saved ? '✓ Uložené' : saving ? 'Ukladám...' : 'Uložiť zmeny'}
        </button>
      </div>

    </div>
  );
}
