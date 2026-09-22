'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

// Mriežka fotiek z dielne + zväčšenie po kliknutí.
// Fotky spravuje admin v /spravovat-web/galeria; poradie určuje sort_order.
export default function GaleriaMriezka() {
  const [fotky, setFotky] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [zvacsena, setZvacsena] = useState(null);

  useEffect(() => {
    supabase
      .from('gallery_photos')
      .select('id, url, caption')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setFotky(data || []);
        setNacitava(false);
      });
  }, []);

  // Zväčšenú fotku zavrie aj Escape — na notebooku je to rýchlejšie ako trafiť krížik
  useEffect(() => {
    if (!zvacsena) return;
    const naKlaves = (e) => { if (e.key === 'Escape') setZvacsena(null); };
    window.addEventListener('keydown', naKlaves);
    return () => window.removeEventListener('keydown', naKlaves);
  }, [zvacsena]);

  if (nacitava) {
    return (
      <p className="text-center text-zinc-600 font-black uppercase tracking-[0.3em] text-xs py-20 animate-pulse">
        Načítavam fotky…
      </p>
    );
  }

  if (!fotky.length) {
    return (
      <p className="text-center text-zinc-600 font-bold text-sm py-20">
        Zatiaľ sme sem nepridali žiadne fotky.
      </p>
    );
  }

  return (
    <>
      <div className="columns-2 md:columns-3 gap-4">
        {fotky.map((foto, i) => (
          <button
            key={foto.id}
            onClick={() => setZvacsena(foto)}
            className="break-inside-avoid mb-4 w-full rounded-2xl overflow-hidden cursor-zoom-in group relative block text-left"
          >
            <img
              src={foto.url}
              alt={foto.caption || 'AutoAlma servis Bratislava — fotka z dielne'}
              // Prvé fotky sú hneď viditeľné, zvyšok sa načíta až pri rolovaní
              loading={i < 4 ? 'eager' : 'lazy'}
              decoding="async"
              className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {foto.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-all">
                <p className="text-white text-xs font-bold">{foto.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {zvacsena && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-center justify-center p-4"
          onClick={() => setZvacsena(null)}
        >
          <div className="max-w-4xl w-full relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={zvacsena.url}
              alt={zvacsena.caption || 'AutoAlma servis Bratislava'}
              className="w-full rounded-2xl object-contain max-h-[85vh]"
            />
            {zvacsena.caption && (
              <p className="text-center text-zinc-400 font-bold text-sm mt-4">{zvacsena.caption}</p>
            )}
            <button
              onClick={() => setZvacsena(null)}
              aria-label="Zavrieť"
              className="absolute -top-10 right-0 text-zinc-500 hover:text-white text-2xl font-black transition-colors"
            >✕</button>
          </div>
        </div>
      )}
    </>
  );
}
