'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function SluzbaPage() {
  const { slug } = useParams();
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('web_sections').select('*').eq('slug', slug).single()
      .then(({ data }) => { setSection(data || null); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-zinc-600 font-black uppercase text-xs tracking-widest animate-pulse">Načítavam...</div>
    </div>
  );

  if (!section) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      <p className="text-6xl mb-6">🔧</p>
      <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-4">Sekcia nenájdená</h1>
      <Link href="/#sluzby" className="text-red-600 font-black uppercase text-xs tracking-widest hover:underline">← Späť na služby</Link>
    </div>
  );

  const items = Array.isArray(section.items) ? section.items : [];
  const images = Array.isArray(section.image_urls) ? section.image_urls.filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
        <div className="flex items-center justify-between px-6 md:px-12 py-4">
          <Link href="/" className="text-xl font-black uppercase italic tracking-tighter hover:opacity-80 transition-all">
            Auto<span className="text-red-600">Alma</span>
          </Link>
          <Link href="/#sluzby" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
            ← Späť na služby
          </Link>
        </div>
        <div className="nav-stripe" />
      </nav>

      {/* HERO */}
      <section className="pt-36 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-transparent to-transparent pointer-events-none" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600 mb-4 italic">Naše služby</p>
        <div className="text-6xl mb-6">{section.icon}</div>
        <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter mb-6">
          <span className="text-red-600">{section.name}</span>
        </h1>
        {section.description && (
          <p className="text-zinc-400 text-base md:text-lg font-bold max-w-2xl mx-auto leading-relaxed">
            {section.description}
          </p>
        )}
      </section>

      {/* OBRÁZKY */}
      {images.length > 0 && (
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((url, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden border border-zinc-900 ${i === 0 && images.length > 2 ? 'col-span-2 row-span-2' : ''}`}>
                <img src={url} alt="" className="w-full h-full object-cover aspect-video" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* POLOŽKY */}
      {items.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-8 text-center">Čo zahŕňa táto služba</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item, i) => {
                const title = typeof item === 'string' ? item : item.title;
                const desc = typeof item === 'string' ? '' : item.desc;
                return (
                  <div key={i} className="bg-zinc-950 border border-zinc-900 hover:border-red-600/30 p-7 rounded-[2rem] transition-all group">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-2 h-2 bg-red-600 rounded-full shrink-0 mt-2" />
                      <h2 className="text-base font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors">
                        {title}
                      </h2>
                    </div>
                    {desc && <p className="text-zinc-500 text-sm font-bold leading-relaxed pl-5">{desc}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-6 border-t border-zinc-900 text-center">
        <p className="text-zinc-500 font-bold mb-2 text-sm">Potrebujete túto službu?</p>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-8">
          Zavolajte alebo príďte <span className="text-red-600">osobne</span>
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="tel:0940449449"
            className="bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl shadow-red-600/20 hover:scale-105">
            📞 0940 449 449
          </a>
          <Link href="/login"
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all">
            🏎️ Moja Garáž
          </Link>
        </div>
        <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest mt-6">
          Bratislava · Svornosti 119 · Po–Pi 8:00–17:00
        </p>
      </section>

    </div>
  );
}
