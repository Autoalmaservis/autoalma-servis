'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';

export default function VerejnaPonukaPage() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (id) fetchOffer();
  }, [id]);

  const fetchOffer = async () => {
    const { data } = await supabase.from('price_offers').select('*, job_tickets(*)').eq('id', id).single();
    if (data) setOffer(data);
    setLoading(false);
  };

  const handleResponse = async (status) => {
    const { error } = await supabase.from('price_offers').update({ status }).eq('id', id);
    if (!error) {
      setResponded(true);
      setOffer({...offer, status});
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam ponuku...</div>;
  if (!offer) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Ponuka neexistuje</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-12 font-sans font-bold">
      <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl">
        
        {/* HLAVIČKA PONUKY */}
        <div className="bg-red-600 p-8 text-center">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Cenová ponuka</h1>
          <p className="text-red-200 text-[10px] uppercase tracking-widest mt-2 font-black">AutoAlma Servis • #{offer.id.slice(0,8)}</p>
        </div>

        <div className="p-8 space-y-8">
          {/* INFO O AUTE */}
          <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Vozidlo</p>
              <p className="text-xl font-black uppercase italic">{offer.job_tickets?.car_brand_model}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase">ŠPZ</p>
              <p className="text-xl font-black uppercase">{offer.job_tickets?.plate_number}</p>
            </div>
          </div>

          {/* POLOŽKY */}
          <div className="space-y-4">
            <p className="text-[10px] text-red-500 uppercase tracking-widest italic">Predbežný rozpočet prác a dielov:</p>
            <div className="bg-black/40 rounded-3xl border border-zinc-800 p-6 space-y-4">
              {offer.items_json.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-black uppercase italic">{item.name}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{item.type} • {item.quantity} {item.unit}</p>
                  </div>
                  <p className="text-lg font-black italic">{(item.quantity * item.unit_price).toFixed(2)} €</p>
                </div>
              ))}
            </div>
          </div>

          {/* CELKOVÁ SUMA */}
          <div className="bg-white text-black p-8 rounded-[2.5rem] flex justify-between items-center">
            <span className="text-xl font-black uppercase italic leading-none">Celkom s DPH:</span>
            <span className="text-4xl font-black italic leading-none">{(offer.total_amount * 1.23).toFixed(2)} €</span>
          </div>

          {/* AKCIE */}
          {!responded && offer.status === 'Odoslané' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              <button onClick={() => handleResponse('Schválené')} className="bg-green-600 hover:bg-green-500 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-widest transition-all shadow-xl shadow-green-900/20">
                ✅ Schváliť ponuku
              </button>
              <button onClick={() => handleResponse('Zamietnuté')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black py-6 rounded-3xl uppercase text-xs tracking-widest transition-all">
                ✕ Zamietnuť
              </button>
            </div>
          ) : (
            <div className={`p-6 rounded-3xl text-center font-black uppercase tracking-widest ${offer.status === 'Schválené' ? 'bg-green-600/20 text-green-500 border border-green-600/50' : 'bg-red-600/20 text-red-500 border border-red-600/50'}`}>
              {offer.status === 'Schválené' ? 'Ponuka bola schválená. Ďakujeme!' : 'Ponuka bola zamietnutá.'}
            </div>
          )}
        </div>
      </div>
      <p className="text-center mt-8 text-zinc-600 text-[9px] uppercase tracking-[0.4em]">Tento odkaz je platný len pre majiteľa vozidla.</p>
    </div>
  );
}