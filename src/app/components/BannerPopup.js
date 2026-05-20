'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function BannerPopup() {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase.from('banners').select('*').eq('active', true).order('sort_order').then(({ data }) => {
      if (data?.length) { setBanners(data); setVisible(true); }
    });
  }, []);

  const prev = useCallback(() => setIndex(i => (i - 1 + banners.length) % banners.length), [banners.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % banners.length), [banners.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (!visible) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, prev, next]);

  if (!visible || !banners.length) return null;

  const current = banners[index];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-3 md:p-4"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl shadow-black flex flex-col w-full"
        style={{ height: '90vh', maxWidth: '960px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Zavrieť */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 md:top-5 md:right-5 z-20 w-9 h-9 md:w-10 md:h-10 bg-black/70 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-full flex items-center justify-center text-white font-black text-sm transition-all"
        >✕</button>

        {/* Počítadlo */}
        {banners.length > 1 && (
          <div className="absolute top-3 left-3 md:top-5 md:left-5 z-20 bg-black/70 backdrop-blur border border-zinc-700 rounded-full px-3 py-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{index + 1} / {banners.length}</p>
          </div>
        )}

        {/* OBRÁZOK */}
        <div className="relative flex-1 overflow-hidden min-h-0">
          {current.image_url ? (
            <img src={current.image_url} alt={current.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <span className="text-8xl opacity-20">🚗</span>
            </div>
          )}

          {/* Gradient do textu */}
          <div className="absolute inset-x-0 bottom-0 h-24 md:h-32 bg-gradient-to-t from-zinc-950 to-transparent" />

          {/* ZĽAVOVÝ TROJUHOLNÍK — ľavý horný roh */}
          {!!current.discount_percent && (
            <div className="absolute top-0 left-0 w-28 h-28 md:w-36 md:h-36 overflow-hidden z-10">
              <div className="absolute top-7 -left-9 md:top-9 md:-left-10 bg-red-600 text-white text-center py-2 w-36 md:w-44 -rotate-45 shadow-xl">
                <span className="text-lg md:text-2xl font-black leading-none block">-{current.discount_percent}%</span>
                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">zľava</span>
              </div>
            </div>
          )}

          {/* Šípky */}
          {banners.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-xl flex items-center justify-center text-white font-black transition-all">←</button>
              <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-xl flex items-center justify-center text-white font-black transition-all">→</button>
            </>
          )}
        </div>

        {/* TEXT + TLAČIDLÁ */}
        <div className="px-4 md:px-8 py-4 md:py-5 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6">

            {/* Titulok + popis */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-tight line-clamp-2">
                {current.title}
              </h2>
              {current.description && (
                <p className="text-zinc-400 text-xs md:text-sm font-bold mt-1 leading-relaxed line-clamp-2">
                  {current.description}
                </p>
              )}
            </div>

            {/* Tlačidlá + dots */}
            <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0">

              {/* Riadok s tlačidlami */}
              <div className="flex gap-2">
                {/* Telefónne tlačidlo */}
                {current.phone_number && (
                  <a
                    href={`tel:${current.phone_number.replace(/\s/g, '')}`}
                    className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-black px-4 md:px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all whitespace-nowrap"
                  >
                    <span>📞</span>
                    <span className="hidden md:inline">{current.phone_button_text || 'Zavolať'}</span>
                    <span className="md:hidden">{current.phone_number}</span>
                  </a>
                )}

                {/* CTA tlačidlo */}
                {current.button_text && current.button_url && (
                  <a
                    href={current.button_url}
                    className="flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-black px-4 md:px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-600/30 whitespace-nowrap"
                  >
                    {current.button_text}
                  </a>
                )}
              </div>

              {/* Dots */}
              {banners.length > 1 && (
                <div className="flex gap-1.5 items-center justify-end">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setIndex(i)}
                      className={`rounded-full transition-all duration-300 ${i === index ? 'w-6 h-2 bg-red-600' : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-500'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
