'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';

export default function HistoriaVyhladavanie() {
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hladaj, setHladaj] = useState('');

  useEffect(() => {
    const nacitaj = async () => {
      setLoading(true);
      const [{ data: veh }, { data: tickets }] = await Promise.all([
        supabase.from('vehicles').select('license_plate, brand_model, owner_name'),
        supabase.from('job_tickets').select('plate_number, car_brand_model, customer_name, created_at').order('created_at', { ascending: false }),
      ]);

      const mapa = {};
      veh?.forEach(v => {
        if (!v.license_plate) return;
        mapa[v.license_plate] = {
          spz: v.license_plate,
          model: v.brand_model || '',
          majitel: v.owner_name || '',
          posledna: null,
          pocet: 0,
        };
      });
      tickets?.forEach(t => {
        const spz = t.plate_number;
        if (!spz) return;
        if (!mapa[spz]) mapa[spz] = { spz, model: t.car_brand_model || '', majitel: t.customer_name || '', posledna: null, pocet: 0 };
        mapa[spz].pocet += 1;
        if (!mapa[spz].posledna) mapa[spz].posledna = t.created_at;
        if (!mapa[spz].model) mapa[spz].model = t.car_brand_model || '';
        if (!mapa[spz].majitel) mapa[spz].majitel = t.customer_name || '';
      });

      setVozidla(Object.values(mapa).sort((a, b) => new Date(b.posledna || 0) - new Date(a.posledna || 0)));
      setLoading(false);
    };
    nacitaj();
  }, []);

  const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const s = nd(hladaj);
  const filtrovane = s
    ? vozidla.filter(v => nd(v.spz).includes(s) || nd(v.model).includes(s) || nd(v.majitel).includes(s))
    : vozidla;

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white font-bold">
      <Link href="/klienti" className="inline-block mb-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-600 transition-colors">← Späť na Klienti a Vozidlá</Link>

      <header className="mb-10 border-l-4 border-red-600 pl-6">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">História <span className="text-red-600 text-4xl">Vozidiel</span></h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Vyhľadaj ŠPZ, zákazníka alebo model</p>
      </header>

      <input
        type="text"
        autoFocus
        placeholder="Hľadať ŠPZ / zákazníka / model..."
        value={hladaj}
        onChange={(e) => setHladaj(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-8 shadow-inner"
      />

      {loading ? (
        <p className="text-red-600 font-black uppercase tracking-widest animate-pulse">Načítavam vozidlá...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrovane.slice(0, 120).map((v) => (
            <Link
              key={v.spz}
              href={`/historia/${encodeURIComponent(v.spz)}`}
              className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-[2rem] hover:border-red-600 transition-all block"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="bg-white text-black px-4 py-1.5 rounded-xl font-black text-lg tracking-widest uppercase">{v.spz}</span>
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest shrink-0">{v.pocet}× návšteva</span>
              </div>
              <p className="text-sm font-black uppercase italic text-white line-clamp-1">{v.model || '---'}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1 line-clamp-1">{v.majitel || 'Bez majiteľa'}</p>
              {v.posledna && (
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-3">Naposledy {new Date(v.posledna).toLocaleDateString('sk-SK')}</p>
              )}
            </Link>
          ))}
          {filtrovane.length === 0 && (
            <p className="text-[10px] uppercase text-zinc-600 font-black tracking-widest col-span-full text-center py-16">Nič sa nenašlo</p>
          )}
        </div>
      )}
    </div>
  );
}
