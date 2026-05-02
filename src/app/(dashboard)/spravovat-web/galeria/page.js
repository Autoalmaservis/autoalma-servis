'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GaleriaPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  useEffect(() => { fetchPhotos(); }, []);

  const fetchPhotos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error && error.code === '42P01') {
      setDbReady(false);
      setLoading(false);
      return;
    }
    if (!error && data) setPhotos(data);
    setLoading(false);
  };

  const uploadPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `gallery/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('web-images')
        .upload(path, file, { contentType: file.type });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('web-images').getPublicUrl(path);
        await supabase.from('gallery_photos').insert({
          url: publicUrl,
          caption: '',
          sort_order: photos.length + idx,
        });
      }
    }

    fileRef.current.value = '';
    setUploading(false);
    fetchPhotos();
  };

  const deletePhoto = async (photo) => {
    if (!confirm('Zmazať túto fotku?')) return;
    setDeleting(photo.id);
    const urlParts = photo.url.split('/web-images/');
    if (urlParts.length > 1) {
      await supabase.storage.from('web-images').remove([urlParts[1]]);
    }
    await supabase.from('gallery_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setDeleting(null);
  };

  const updateCaption = async (photo, caption) => {
    await supabase.from('gallery_photos').update({ caption }).eq('id', photo.id);
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, caption } : p));
  };

  const movePhoto = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const updated = [...photos];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setPhotos(updated);
    await Promise.all(updated.map((p, idx) =>
      supabase.from('gallery_photos').update({ sort_order: idx }).eq('id', p.id)
    ));
  };

  if (!dbReady) return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => router.push('/spravovat-web')} className="text-zinc-600 hover:text-white transition-all text-lg mb-6 block">← Späť</button>
      <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-6">Galéria</h1>
      <div className="bg-amber-600/10 border border-amber-600/40 rounded-2xl p-6">
        <p className="text-amber-400 font-black uppercase text-sm mb-4">⚠️ Tabuľka neexistuje</p>
        <p className="text-zinc-400 text-xs font-bold mb-4">Spustite v Supabase → SQL Editor:</p>
        <pre className="bg-black p-4 rounded-xl text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE gallery_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON gallery_photos
  FOR SELECT USING (true);
CREATE POLICY "Auth write" ON gallery_photos
  FOR ALL USING (auth.role() = 'authenticated');`}</pre>
        <button onClick={fetchPhotos} className="mt-4 bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest">
          Skúsiť znova
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => router.push('/spravovat-web')} className="text-zinc-600 hover:text-white transition-all text-lg">←</button>
        <div className="flex-grow">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Správa webu</p>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
            Galéria <span className="text-zinc-600 font-bold text-base normal-case italic">({photos.length} fotiek)</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <a href="/#galeria" target="_blank" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
            🌐 Web
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            {uploading ? 'Nahrávam...' : '↑ Pridať fotky'}
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={uploadPhotos} />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-32 border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-[2rem] text-zinc-700 hover:text-zinc-500 flex flex-col items-center gap-4 transition-all"
        >
          <span className="text-5xl">📸</span>
          <span className="text-xs font-black uppercase tracking-widest italic">Kliknite sem a nahrajte prvé fotky z dielne</span>
          <span className="text-[10px] text-zinc-800">Podporuje JPG, PNG, WEBP — naraz môžete nahrať viac súborov</span>
        </button>
      ) : (
        <>
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 mb-6 text-[10px] font-black uppercase tracking-widest text-zinc-600">
            💡 Poradie zmeníte šípkami ← → · Kliknite na fotku pre náhľad · Popis pridáte kliknutím na text pod fotkou
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo, i) => (
              <div key={photo.id} className="group bg-zinc-950 border border-zinc-900 hover:border-zinc-700 rounded-[1.5rem] overflow-hidden transition-all">
                <div
                  className="aspect-video relative cursor-pointer"
                  onClick={() => setLightbox(photo)}
                >
                  <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); movePhoto(i, -1); }}
                      disabled={i === 0}
                      className="bg-white/10 hover:bg-white/25 disabled:opacity-20 text-white w-9 h-9 rounded-full font-black text-sm transition-all flex items-center justify-center"
                    >←</button>
                    <button
                      onClick={e => { e.stopPropagation(); deletePhoto(photo); }}
                      disabled={deleting === photo.id}
                      className="bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white w-9 h-9 rounded-full font-black text-sm transition-all flex items-center justify-center"
                    >{deleting === photo.id ? '…' : '✕'}</button>
                    <button
                      onClick={e => { e.stopPropagation(); movePhoto(i, 1); }}
                      disabled={i === photos.length - 1}
                      className="bg-white/10 hover:bg-white/25 disabled:opacity-20 text-white w-9 h-9 rounded-full font-black text-sm transition-all flex items-center justify-center"
                    >→</button>
                  </div>
                  <span className="absolute top-2 left-2 bg-black/70 text-zinc-400 text-[9px] font-black px-2 py-0.5 rounded-lg">
                    #{i + 1}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <input
                    defaultValue={photo.caption}
                    onBlur={e => updateCaption(photo, e.target.value)}
                    placeholder="Popis fotky (voliteľné)..."
                    className="w-full bg-transparent text-zinc-500 text-[11px] font-bold outline-none placeholder:text-zinc-800 focus:text-zinc-300 transition-colors"
                  />
                </div>
              </div>
            ))}

            {/* PRIDAŤ ďalšie */}
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-video rounded-[1.5rem] border-2 border-dashed border-zinc-800 hover:border-red-600/40 flex flex-col items-center justify-center gap-2 text-zinc-700 hover:text-zinc-400 transition-all"
            >
              <span className="text-3xl">+</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Pridať fotky</span>
            </button>
          </div>
        </>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption} className="w-full rounded-2xl object-contain max-h-[80vh]" />
            {lightbox.caption && (
              <p className="text-center text-zinc-400 font-bold text-sm mt-4">{lightbox.caption}</p>
            )}
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-2xl font-black">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
