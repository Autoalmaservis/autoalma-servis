'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function BanneryPage() {
  const router = useRouter();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editBanner, setEditBanner] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', image_url: '', button_text: '', button_url: '', phone_number: '', phone_button_text: 'Zavolať', discount_percent: '', active: true, sort_order: 0 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    setLoading(true);
    const { data } = await supabase.from('banners').select('*').order('sort_order');
    setBanners(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditBanner(null);
    setForm({ title: '', description: '', image_url: '', button_text: '', button_url: '', active: true, sort_order: banners.length });
    setModal(true);
  };

  const openEdit = (b) => {
    setEditBanner(b);
    setForm({ title: b.title, description: b.description || '', image_url: b.image_url || '', button_text: b.button_text || '', button_url: b.button_url || '', phone_number: b.phone_number || '', phone_button_text: b.phone_button_text || 'Zavolať', discount_percent: b.discount_percent || '', active: b.active, sort_order: b.sort_order });
    setModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `banners/banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('web-images').upload(path, file);
    if (error) { alert('Chyba uploadu: ' + error.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('web-images').getPublicUrl(path);
    setForm(p => ({ ...p, image_url: publicUrl }));
    setUploading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { alert('Zadajte názov bannera'); return; }
    setSaving(true);
    if (editBanner) {
      await supabase.from('banners').update(form).eq('id', editBanner.id);
    } else {
      await supabase.from('banners').insert([form]);
    }
    setSaving(false);
    setModal(false);
    fetchBanners();
  };

  const toggleActive = async (b) => {
    await supabase.from('banners').update({ active: !b.active }).eq('id', b.id);
    fetchBanners();
  };

  const deleteBanner = async (b) => {
    if (!confirm(`Zmazať banner "${b.title}"?`)) return;
    await supabase.from('banners').delete().eq('id', b.id);
    fetchBanners();
  };

  const moveUp = async (b, i) => {
    if (i === 0) return;
    const prev = banners[i - 1];
    await supabase.from('banners').update({ sort_order: prev.sort_order }).eq('id', b.id);
    await supabase.from('banners').update({ sort_order: b.sort_order }).eq('id', prev.id);
    fetchBanners();
  };

  const moveDown = async (b, i) => {
    if (i === banners.length - 1) return;
    const next = banners[i + 1];
    await supabase.from('banners').update({ sort_order: next.sort_order }).eq('id', b.id);
    await supabase.from('banners').update({ sort_order: b.sort_order }).eq('id', next.id);
    fetchBanners();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto min-h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <button onClick={() => router.push('/spravovat-web')} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors mb-3 flex items-center gap-2">
            ← Späť
          </button>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Bannery <span className="text-red-600">/ Akcie</span></h1>
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">Vyskakovacie okná na hlavnej stránke</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            🌐 Zobraziť web
          </a>
          <button onClick={openNew} className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            + Nový banner
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 mb-8 flex items-start gap-4">
        <span className="text-2xl shrink-0">💡</span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-white mb-1">Ako fungujú bannery</p>
          <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">Aktívne bannery sa zobrazia každému návštevníkovi hlavnej stránky hneď po načítaní. Môžeš mať viacero aktívnych bannerov — zákazník môže prepínať medzi nimi šípkami.</p>
        </div>
      </div>

      {/* ZOZNAM */}
      {loading ? (
        <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
      ) : banners.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem]">
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-zinc-600 font-black uppercase text-xs tracking-widest">Žiadne bannery · klikni + Nový banner</p>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((b, i) => (
            <div key={b.id} className={`flex gap-5 bg-zinc-950 border rounded-[2rem] p-5 transition-all ${b.active ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-900 opacity-50'}`}>

              {/* Obrázok preview */}
              <div className="w-36 h-24 rounded-2xl overflow-hidden shrink-0 bg-zinc-900 flex items-center justify-center border border-zinc-800">
                {b.image_url ? (
                  <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-30">🖼️</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-black uppercase italic tracking-tight text-white truncate">{b.title}</h3>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${b.active ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-zinc-800 text-zinc-600 border border-zinc-700'}`}>
                    {b.active ? 'Aktívny' : 'Neaktívny'}
                  </span>
                </div>
                {b.description && <p className="text-[11px] text-zinc-500 font-bold line-clamp-1 mb-2">{b.description}</p>}
                {b.button_text && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">CTA: {b.button_text} → {b.button_url}</p>}
              </div>

              {/* Akcie */}
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex gap-2">
                  <button onClick={() => moveUp(b, i)} disabled={i === 0} className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 hover:text-white text-xs disabled:opacity-20 transition-all">↑</button>
                  <button onClick={() => moveDown(b, i)} disabled={i === banners.length - 1} className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 hover:text-white text-xs disabled:opacity-20 transition-all">↓</button>
                </div>
                <button onClick={() => toggleActive(b)} className={`text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border transition-all ${b.active ? 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-500' : 'bg-green-600/10 border-green-600/30 text-green-500 hover:bg-green-600/20'}`}>
                  {b.active ? 'Vypnúť' : 'Zapnúť'}
                </button>
                <button onClick={() => openEdit(b)} className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-xl transition-all">
                  ✏️ Editovať
                </button>
                <button onClick={() => deleteBanner(b)} className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-500 rounded-xl transition-all">
                  🗑️ Zmazať
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-2xl my-auto shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-8">
              {editBanner ? 'Upraviť banner' : 'Nový banner'}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">

              {/* Náhľad */}
              <div className="relative w-full h-48 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden group">
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <span className="text-5xl opacity-20">🖼️</span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Žiadny obrázok</p>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                  <span className="bg-red-600 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest">
                    {uploading ? 'Nahrávam...' : '📷 Zmeniť obrázok'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>

              {!form.image_url && (
                <label className="flex items-center justify-center gap-3 border-2 border-dashed border-zinc-800 hover:border-red-600/50 rounded-2xl p-5 cursor-pointer transition-all group">
                  <span className="text-zinc-600 group-hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-colors">
                    {uploading ? 'Nahrávam...' : '+ Nahrať obrázok bannera'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Názov / Titulok akcie *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="napr. Letná akcia — 20% zľava na klimatizáciu!"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-4 rounded-2xl text-white font-black outline-none transition-all italic uppercase text-sm" />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Popis (voliteľný)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Krátky popis akcie alebo podmienky..."
                  className="w-full bg-black border border-zinc-800 focus:border-zinc-600 p-4 rounded-2xl text-white font-bold outline-none transition-all resize-none text-sm" />
              </div>

              {/* Zľava */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-red-600 block mb-2">Zľava v % (voliteľné — zobrazí trojuholník)</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="0" max="99" value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))}
                    placeholder="napr. 20"
                    className="w-32 bg-black border border-red-600/30 focus:border-red-600 p-4 rounded-2xl text-white font-black outline-none transition-all text-xl text-right" />
                  <span className="text-zinc-500 font-black text-lg">%</span>
                  <span className="text-[10px] text-zinc-600 font-bold">— ak je 0 alebo prázdne, trojuholník sa nezobrazí</span>
                </div>
              </div>

              {/* CTA tlačidlo */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">CTA tlačidlo (voliteľné)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.button_text} onChange={e => setForm(p => ({ ...p, button_text: e.target.value }))}
                    placeholder="Text tlačidla (napr. Objednať sa)"
                    className="w-full bg-black border border-zinc-800 focus:border-red-600 p-4 rounded-2xl text-white font-bold outline-none transition-all text-sm" />
                  <input value={form.button_url} onChange={e => setForm(p => ({ ...p, button_url: e.target.value }))}
                    placeholder="URL (napr. /objednavka)"
                    className="w-full bg-black border border-zinc-800 focus:border-zinc-600 p-4 rounded-2xl text-white font-mono outline-none transition-all text-sm" />
                </div>
              </div>

              {/* Telefónne tlačidlo */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">📞 Telefónne tlačidlo (voliteľné)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))}
                    placeholder="Telefón (napr. 0940 449 449)"
                    className="w-full bg-black border border-zinc-800 focus:border-zinc-600 p-4 rounded-2xl text-white font-mono outline-none transition-all text-sm" />
                  <input value={form.phone_button_text} onChange={e => setForm(p => ({ ...p, phone_button_text: e.target.value }))}
                    placeholder="Text (napr. Zavolať)"
                    className="w-full bg-black border border-zinc-800 focus:border-zinc-600 p-4 rounded-2xl text-white font-bold outline-none transition-all text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <button type="button" onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${form.active ? 'bg-green-600' : 'bg-zinc-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.active ? 'left-7' : 'left-1'}`} />
                </button>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white">Banner {form.active ? 'aktívny' : 'neaktívny'}</p>
                  <p className="text-[10px] text-zinc-600 font-bold">{form.active ? 'Zobrazí sa na hlavnej stránke' : 'Skrytý — nezobrazí sa zákazníkom'}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                  Zrušiť
                </button>
                <button type="submit" disabled={saving || uploading}
                  className="flex-[2] bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-600/20">
                  {saving ? 'Ukladám...' : (editBanner ? 'Uložiť zmeny' : 'Vytvoriť banner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
