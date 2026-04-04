'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function ZakazkyPage() {
  const [zakazky, setZakazky] = useState([]);
  const [allCount, setAllCount] = useState(0); // Celkový počet v DB pre kontrolu
  const [loading, setLoading] = useState(true);
  // Stavy: 'Prebieha', 'Dokončené', 'Archivované'
  const [filter, setFilter] = useState('Prebieha'); 

  useEffect(() => {
    fetchZakazky();
  }, [filter]);

  const fetchZakazky = async () => {
    setLoading(true);
    console.log("Hľadám zákazky so statusom:", filter);

    // Sťahujeme VŠETKY dáta bez filtra statusu, aby sme videli, či vôbec chodia
    const { data, error } = await supabase
      .from('job_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Chyba Supabase:", error);
    } else {
      console.log("Všetky dáta z DB:", data);
      setAllCount(data?.length || 0);
      
      // Filtrujeme dáta v aplikácii. Ak status chýba (null), 
      // priradíme ho do Archívu, aby sa dáta nestratili v "ničote".
      const filteredData = (data || []).filter(z => {
        const s = z.status || 'Archivované';
        // Porovnávame bez ohľadu na veľkosť písmen a medzery
        return s.trim().toLowerCase() === filter.toLowerCase();
      });

      setZakazky(filteredData);
    }
    setLoading(false);
  };

  const zmenStav = async (id, novyStav) => {
    const { error } = await supabase
      .from('job_tickets')
      .update({ status: novyStav, updated_at: new Date() })
      .eq('id', id);

    if (!error) {
      fetchZakazky();
    } else {
      alert("Chyba pri zmene stavu: " + error.message);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none">
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">
            Správa <span className="text-red-600 text-4xl">Zákaziek</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
            Zobrazené: {zakazky.length} | Celkovo v systéme: {allCount}
          </p>
        </div>
        
        {/* Prepínač filtrov - 3 Stavy */}
        <div className="flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800 shadow-2xl">
          <button 
            onClick={() => setFilter('Prebieha')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'Prebieha' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            ⚙️ Prebieha
          </button>
          <button 
            onClick={() => setFilter('Dokončené')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'Dokončené' ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            ✅ Dokončené
          </button>
          <button 
            onClick={() => setFilter('Archivované')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'Archivované' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            📁 Archív
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-20 text-zinc-700 font-black uppercase animate-pulse tracking-widest text-sm">
          Načítavam zoznam zákaziek...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {zakazky.length > 0 ? (
            zakazky.map((z) => (
              <div key={z.id} className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-center group hover:border-zinc-700 transition-all shadow-xl relative overflow-hidden">
                
                {/* Dekoratívny pás podľa stavu */}
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${filter === 'Prebieha' ? 'bg-amber-500' : filter === 'Dokončené' ? 'bg-green-600' : 'bg-zinc-700'}`}></div>

                <div className="flex flex-col md:flex-row items-center gap-8 w-full">
                  {/* ŠPZ */}
                  <div className="bg-white text-black px-6 py-3 rounded-2xl font-black text-2xl tracking-widest shadow-2xl min-w-[160px] text-center italic">
                    {z.plate_number}
                  </div>

                  {/* INFO O ZÁKAZNÍKOVI A AUTE */}
                  <div className="flex-grow space-y-1 text-center md:text-left">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-white">
                      {z.customer_name}
                    </h3>
                    <p className="text-red-600 text-xs font-black uppercase tracking-widest">
                      {z.car_brand_model || 'Vozidlo v dielni'} • <span className="font-mono text-[11px] text-zinc-400">{z.vin_number || 'Bez VIN'}</span>
                    </p>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-3">
                      <span className="text-base bg-black/50 px-3 py-1 rounded-full text-zinc-400 font-bold border border-zinc-800 uppercase">
                        📞 {z.customer_phone || '---'}
                      </span>
                      {z.city && (
                        <span className="text-[10px] bg-black/50 px-3 py-1 rounded-full text-zinc-400 font-bold border border-zinc-800 uppercase">
                          📍 {z.city}
                        </span>
                      )}
                      {z.client_type === 'Firma' && (
                        <span className="text-[10px] bg-zinc-800/50 px-3 py-1 rounded-full text-blue-400 font-black border border-blue-900/30 uppercase tracking-tighter">
                          Firma
                        </span>
                      )}
                    </div>
                  </div>

                  {/* POPIS ZÁVADY */}
                  <div className="hidden xl:block border-l border-zinc-800 pl-8 max-w-sm">
                    <p className="text-zinc-500 text-[9px] font-black uppercase mb-1 tracking-widest">Závada / Poznámka:</p>
                    <p className="text-zinc-300 text-xs italic line-clamp-2 leading-relaxed">
                      "{z.issue_description || z.description || 'Bez popisu prác...'}"
                    </p>
                  </div>
                </div>

                {/* AKCIE */}
                <div className="flex flex-wrap gap-3 mt-8 lg:mt-0 w-full lg:w-auto">
                  {filter === 'Prebieha' && (
                    <button 
                      onClick={() => zmenStav(z.id, 'Dokončené')}
                      className="flex-1 lg:flex-none bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg"
                    >
                      ✓ Dokončiť
                    </button>
                  )}
                  {filter === 'Dokončené' && (
                    <button 
                      onClick={() => zmenStav(z.id, 'Archivované')}
                      className="flex-1 lg:flex-none bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg"
                    >
                      📁 Archivovať
                    </button>
                  )}
                  {filter === 'Archivované' && (
                    <button 
                      onClick={() => zmenStav(z.id, 'Prebieha')}
                      className="flex-1 lg:flex-none bg-red-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg"
                    >
                      🚀 Spustiť
                    </button>
                  )}
                  <Link 
                    href={`/zakazky/${z.id}`} 
                    className="flex-1 lg:flex-none bg-white text-black hover:bg-red-600 hover:text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all text-center shadow-lg"
                  >
                    📋 Detail
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-32 border-2 border-dashed border-zinc-900 rounded-[4rem]">
              <div className="text-5xl mb-4 opacity-20 text-zinc-500">📂</div>
              <p className="text-zinc-700 uppercase font-black tracking-[0.5em] text-sm italic">
                Zákazky so stavom "{filter}" sa nenašli
              </p>
              <p className="text-zinc-600 text-[10px] mt-4 font-black uppercase tracking-widest">
                Klikni na iný stav alebo skontroluj archív.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}