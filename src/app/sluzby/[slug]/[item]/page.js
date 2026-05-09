'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const toSlug = (str) =>
  str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

export default function ItemDetailPage() {
  const { slug, item: itemSlug } = useParams();
  const [section, setSection] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    supabase.from('web_sections').select('*').eq('slug', slug).single()
      .then(({ data }) => {
        if (data) {
          setSection(data);
          const found = (data.items || []).find(i => toSlug(i.title || i) === itemSlug);
          if (found) setItemData(typeof found === 'string' ? { title: found, desc: '', image_urls: [] } : found);
        }
        setLoading(false);
      });
  }, [slug, itemSlug]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!itemData) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      <p className="text-5xl mb-6">🔧</p>
      <h1 className="text-2xl font-black uppercase italic text-white mb-4">Služba nenájdená</h1>
      <Link href="/#sluzby" className="text-red-600 font-black uppercase text-xs tracking-widest hover:underline">← Späť</Link>
    </div>
  );

  const images = itemData.image_urls?.filter(Boolean) || [];
  const paragraphs = (itemData.desc || '').split('\n').filter(p => p.trim());

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25">
        <div className="nav-stripe" />
        <div className="flex items-center justify-between px-6 md:px-12 py-4">
          <Link href="/" className="text-xl font-black uppercase italic tracking-tighter hover:opacity-80 transition-all">
            Auto<span className="text-red-600">Alma</span>
          </Link>
          <div className="flex items-center gap-4">
            {section && (
              <Link href={`/#sluzby`} className="hidden md:block text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">
                {section.icon} {section.name}
              </Link>
            )}
            <Link href="/#sluzby" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl">
              ← Späť
            </Link>
          </div>
        </div>
        <div className="nav-stripe" />
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-12 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/8 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          {section && (
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-3 italic">
              {section.icon} {section.name}
            </p>
          )}
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none mb-6">
            <span className="text-white">{itemData.title.split(' ')[0]}</span>
            {itemData.title.split(' ').length > 1 && (
              <> <span className="text-red-600">{itemData.title.split(' ').slice(1).join(' ')}</span></>
            )}
          </h1>
          {/* DEKORATÍVNA ČIARA */}
          <div className="flex items-center gap-4 mt-8">
            <div className="h-[2px] w-12 bg-red-600" />
            <div className="h-[1px] flex-grow bg-gradient-to-r from-zinc-800 to-transparent" />
          </div>
        </div>
      </section>

      {/* HLAVNÝ OBSAH */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 pb-24">

        <div className={`grid gap-12 ${images.length > 0 ? 'lg:grid-cols-[1fr_380px]' : 'grid-cols-1 max-w-3xl'}`}>

          {/* TEXT */}
          {paragraphs.length > 0 && (
            <div className="space-y-0">
              {paragraphs.map((p, i) => {
                const isBold = p.startsWith('**') && p.endsWith('**');
                const text = isBold ? p.slice(2, -2) : p;
                if (isBold) return (
                  <div key={i} className={`${i > 0 ? 'mt-8' : ''}`}>
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-red-500 mb-3 flex items-center gap-3">
                      <span className="w-5 h-[2px] bg-red-600 shrink-0" />
                      {text}
                    </h2>
                  </div>
                );
                return (
                  <p key={i} className="text-zinc-400 text-base font-bold leading-relaxed pl-8">
                    {text}
                  </p>
                );
              })}
            </div>
          )}

          {!paragraphs.length && images.length === 0 && (
            <div className="py-16 border-2 border-dashed border-zinc-900 rounded-[2rem] text-center text-zinc-700 font-black uppercase text-xs tracking-widest italic">
              Popis tejto služby čoskoro doplníme
            </div>
          )}

          {/* FOTKY — bočný stĺpec alebo plná šírka */}
          {images.length > 0 && (
            <div className="space-y-3">
              {images.map((url, i) => (
                <div key={i} onClick={() => setLightbox(url)}
                  className="relative rounded-2xl overflow-hidden border border-zinc-900 hover:border-blue-500/30 cursor-zoom-in transition-all group">
                  <img src={url} alt="" className="w-full object-cover aspect-video group-hover:scale-[1.02] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              ))}
            </div>
          )}
        </div>


        {/* CTA */}
        <div className="mt-16 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-2">Máte záujem o túto službu?</p>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                Príďte alebo <span className="text-red-600">zavolajte</span>
              </h3>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-1">Bratislava · Svornosti 119 · Po–Pi 8:00–17:00</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href="tel:0940449449"
                className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105 text-center">
                📞 0940 449 449
              </a>
              <Link href="/login"
                className="bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-blue-500/30 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
                🏎️ Moja Garáž
              </Link>
            </div>
          </div>
        </div>

      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[600] bg-black/97 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white text-xl transition-all">✕</button>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}
