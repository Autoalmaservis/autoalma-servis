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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black flex flex-col"
        style={{ width: '90vw', height: '90vh', maxWidth: '960px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Zavrieť */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-5 right-5 z-20 w-10 h-10 bg-black/70 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-full flex items-center justify-center text-white font-black text-sm transition-all"
        >
          ✕
        </button>

        {/* Počítadlo */}
        {banners.length > 1 && (
          <div className="absolute top-5 left-5 z-20 bg-black/70 backdrop-blur border border-zinc-700 rounded-full px-3 py-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{index + 1} / {banners.length}</p>
          </div>
        )}

        {/* OBRÁZOK */}
        <div className="relative flex-1 overflow-hidden">
          {current.image_url ? (
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full h-full object-cover transition-all duration-500"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <span className="text-8xl opacity-20">🚗</span>
            </div>
          )}
          {/* Gradient do textu */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent" />

          {/* Šípky (na obrázku) */}
          {banners.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-2xl flex items-center justify-center text-white font-black text-lg transition-all"
              >←</button>
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur border border-zinc-700 hover:bg-red-600 hover:border-red-600 rounded-2xl flex items-center justify-center text-white font-black text-lg transition-all"
              >→</button>
            </>
          )}
        </div>

        {/* TEXT + NAVIGÁCIA */}
        <div className="px-8 py-6 flex items-end justify-between gap-6 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-tight line-clamp-2">
              {current.title}
            </h2>
            {current.description && (
              <p className="text-zinc-400 text-sm font-bold mt-1.5 leading-relaxed line-clamp-2">
                {current.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* CTA tlačidlo */}
            {current.button_text && current.button_url && (
              <a
                href={current.button_url}
                className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-600/30 whitespace-nowrap"
              >
                {current.button_text}
              </a>
            )}

            {/* Dots */}
            {banners.length > 1 && (
              <div className="flex gap-1.5 items-center">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === index ? 'w-6 h-2 bg-red-600' : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-500'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
