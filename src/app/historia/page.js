'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams } from 'next/navigation';

export default function HistoriaVozidla() {
  const { id } = useParams(); // Získame ID auta z adresy (URL)
  const [vozidlo, setVozidlo] = useState(null);
  const [opravy, setOpravy] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nacinatData = async () => {
      setLoading(true);
      
      // 1. Načítame info o aute
      const { data: auto } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();
      setVozidlo(auto);

      // 2. Načítame všetky opravy pre toto auto
      const { data: zoznamOprav } = await supabase
        .from('job_tickets')
        .select('*')
        .eq('vehicle_id', id) // Predpokladáme, že v job_tickets máš stĺpec vehicle_id
        .order('created_at', { ascending: false });
      
      setOpravy(zoznamOprav || []);
      setLoading(false);
    };

    if (id) nacinatData();
  }, [id]);

  if (loading) return <div className="p-10 text-white uppercase font-black animate-pulse">Načítavam históriu...</div>;

  return (
    <div className="p-8 bg-black min-h-screen text-white">
      {/* HLAVIČKA S INFO O AUTE */}
      <header className="mb-12 border-l-4 border-red-600 pl-6">
        <h1 className="text-4xl font-black uppercase italic italic">{vozidlo?.plate_number}</h1>
        <p className="text-zinc-500 uppercase text-sm tracking-widest">{vozidlo?.brand} {vozidlo?.model}</p>
      </header>

      <div className="space-y-6">
        <h2 className="text-xl font-bold uppercase tracking-tighter text-zinc-400">História servisných úkonov</h2>
        
        {opravy.length === 0 ? (
          <p className="text-zinc-600 italic">Pre toto vozidlo zatiaľ neboli evidované žiadne opravy.</p>
        ) : (
          opravy.map((oprava) => (
            <div key={oprava.id} className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl hover:border-zinc-600 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black bg-red-600 px-2 py-1 rounded uppercase mr-3">
                    {new Date(oprava.created_at).toLocaleDateString()}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${oprava.status === 'Hotová' ? 'bg-green-600' : 'bg-zinc-700'}`}>
                    {oprava.status}
                  </span>
                </div>
                <p className="text-xl font-black text-white">{oprava.total_price?.toFixed(2)} €</p>
              </div>
              <h3 className="text-lg font-bold uppercase mb-2">{oprava.customer_name}</h3>
              <p className="text-zinc-500 text-sm">{oprava.description || 'Bez popisu úkonov.'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}