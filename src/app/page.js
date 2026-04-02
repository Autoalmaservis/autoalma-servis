'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Link from 'next/link';

export default function Home() {
  const [sluzby, setSluzby] = useState([]);
  const [zakazky, setZakazky] = useState([]); // Nový stav pre autá v dielni
  const [nacitavam, setNacitavam] = useState(true);

  useEffect(() => {
    const ziskajData = async () => {
      try {
        setNacitavam(true);
        
        // 1. Načítame katalóg služieb
        const { data: dataSluzieb } = await supabase
          .from('services_catalog')
          .select('*')
          .order('name', { ascending: true });

        // 2. Načítame aktívne zákazky (tie, ktoré si pridal cez /prijem)
        const { data: dataZakaziek } = await supabase
          .from('job_tickets')
          .select('*')
          .order('created_at', { ascending: false });

        setSluzby(dataSluzieb || []);
        setZakazky(dataZakaziek || []);
        
      } catch (err) {
        console.error('Chyba pri načítaní:', err);
      } finally {
        setNacitavam(false);
      }
    };

    ziskajData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 md:p-10">
      
      {/* HLAVIČKA */}
      <header className="max-w-6xl mx-auto mb-10 border-b border-zinc-800 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic text-red-600 uppercase tracking-tighter">
            AutoAlma <span className="text-white">Servis</span>
          </h1>
          <p className="text-zinc-500 text-xs font-mono tracking-[0.2em] mt-1">MANAGEMENT DASHBOARD v1.1</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-zinc-500 text-[10px] uppercase font-bold">Status systému</p>
          <p className="text-green-500 text-xs font-bold animate-pulse">● ONLINE / DATABÁZA PRIPOJENÁ</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEVÝ STĹPEC: NAVIGÁCIA A ZAKÁZKY (2/3 šírky) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* RÝCHLE AKCIE */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/prijem" className="bg-red-600 hover:bg-red-700 p-6 rounded-xl transition-all flex items-center justify-between group">
              <div>
                <span className="text-white/60 text-xs font-bold uppercase">Nový vstup</span>
                <h2 className="text-xl font-black uppercase text-white">Príjem vozidla</h2>
              </div>
              <span className="text-3xl group-hover:scale-110 transition-transform">➕</span>
            </Link>
            
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-zinc-500 text-xs font-bold uppercase">Prehľad</span>
                <h2 className="text-xl font-black uppercase text-zinc-300">Dielňa</h2>
              </div>
              <span className="text-3xl opacity-50">🏎️</span>
            </div>
          </section>

          {/* TABUĽKA AKTÍVNYCH ZAKÁZIEK */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-1 bg-red-600"></div>
              <h2 className="text-lg font-black uppercase tracking-widest">Aktuálne v servise</h2>
            </div>

            {nacitavam ? (
               <div className="p-10 text-center bg-zinc-900/20 rounded-xl border border-zinc-800">Načítavam dielňu...</div>
            ) : zakazky.length === 0 ? (
              <div className="p-10 text-center bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-sm italic">
                V dielni momentálne nie sú žiadne vozidlá.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-widest">
                      <th className="p-4 border-b border-zinc-800">ŠPZ</th>
                      <th className="p-4 border-b border-zinc-800">Vozidlo</th>
                      <th className="p-4 border-b border-zinc-800">Zákazník</th>
                      <th className="p-4 border-b border-zinc-800">Stav</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {zakazky.map((z) => (
                      <tr key={z.id} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-black text-red-500 font-mono text-base">{z.plate_number}</td>
                        <td className="p-4 text-zinc-300 font-bold">{z.car_model}</td>
                        <td className="p-4 text-zinc-400">{z.customer_name}</td>
                        <td className="p-4">
                          <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                            {z.status || 'Otvorená'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* PRAVÝ STĹPEC: KATALÓG SLUŽIEB (1/3 šírky) */}
        <aside className="bg-zinc-900/50 border-l border-zinc-800 p-6 rounded-xl lg:rounded-none lg:bg-transparent lg:border-l lg:border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-4 w-1 bg-red-600"></div>
            <h2 className="text-lg font-black uppercase tracking-widest">Cenník</h2>
          </div>

          <div className="space-y-3">
            {sluzby.map((s) => (
              <div key={s.id} className="p-3 bg-zinc-900/80 rounded border border-zinc-800 hover:border-zinc-700 transition-all">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter truncate">{s.name}</p>
                <div className="flex justify-between items-end mt-1">
                  <span className="text-xs text-zinc-600 font-mono">{s.norm_hours} NH</span>
                  <span className="text-lg font-black text-white">{s.price_excl_vat?.toFixed(2)}€</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

      </div>

      <footer className="max-w-6xl mx-auto mt-20 text-center opacity-20 text-[10px] uppercase tracking-[5px]">
        AutoAlma System Engine &copy; 2026
      </footer>
    </div>
  );
}