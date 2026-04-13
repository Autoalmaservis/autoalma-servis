'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CenovePonukyPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('price_offers')
        .select(`
          *,
          job_tickets (
            plate_number,
            car_brand_model,
            customer_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error("Chyba pri načítaní ponúk:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, offerId, offerDisplayText) => {
    e.stopPropagation(); 
    
    if (!confirm(`Naozaj chcete natrvalo vymazať ponuku ${offerDisplayText}?`)) return;

    try {
      const { error } = await supabase
        .from('price_offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;
      setOffers(offers.filter(o => o.id !== offerId));
    } catch (err) {
      alert("Chyba pri mazaní: " + err.message);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const search = searchTerm.toLowerCase();
    // Hľadáme v offer_number, alebo v skrátenom ID, ak offer_number chýba
    const offerNum = (offer.offer_number || `#${offer.id.substring(0, 8)}`).toLowerCase();
    const customer = (offer.job_tickets?.customer_name || '').toLowerCase();
    const plate = (offer.job_tickets?.plate_number || '').toLowerCase();
    const car = (offer.job_tickets?.car_brand_model || '').toLowerCase();

    return offerNum.includes(search) || 
           customer.includes(search) || 
           plate.includes(search) || 
           car.includes(search);
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Schválené': return 'bg-green-600/20 text-green-500 border-green-600/30';
      case 'Zamietnuté': return 'bg-red-600/20 text-red-500 border-red-600/30';
      case 'Odoslané': return 'bg-blue-600/20 text-blue-500 border-blue-600/30';
      case 'Rozpracované': return 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30';
      default: return 'bg-zinc-800 text-zinc-500';
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-blue-500 font-black animate-pulse uppercase tracking-[0.3em] italic">Načítavam ponuky...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans font-bold">
      <div className="max-w-7xl mx-auto">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-8">
          <div>
            <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] mb-2 italic">Finančný manažment</p>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Cenové <span className="text-blue-600">Ponuky</span></h1>
          </div>

          <div className="w-full lg:w-[500px] relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-transparent rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Hľadať: Číslo, Zákazník, ŠPZ..." 
                className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl outline-none focus:border-blue-600 transition-all text-xs font-bold uppercase italic shadow-2xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute right-5 top-5 text-xl opacity-40">🔍</span>
            </div>
          </div>
        </header>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-500 tracking-widest italic border-b border-zinc-800">
              <tr>
                <th className="p-6">Číslo ponuky</th>
                <th className="p-6">Zákazník</th>
                <th className="p-6">Vozidlo</th>
                <th className="p-6 text-right">Suma s DPH</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-center">Akcia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-bold uppercase italic">
              {filteredOffers.length > 0 ? (
                filteredOffers.map((offer) => {
                  // --- LOGIKA ZOBRAZENIA ČÍSLA ---
                  // Ak existuje offer_number (PddmmrrXXX), použijeme ho. 
                  // Ak nie (stará ponuka), zobrazíme skrátené ID (#e364e967)
                  const displayText = offer.offer_number || `#${offer.id.substring(0, 8)}`;
                  const isRealNumber = !!offer.offer_number;

                  return (
                    <tr key={offer.id} onClick={() => router.push(`/ponuka/${offer.id}`)} className="hover:bg-blue-600/5 transition-all group cursor-pointer">
                      <td className="p-6">
                        <p className={`text-lg font-black tracking-tighter leading-none ${isRealNumber ? 'text-white' : 'text-zinc-600 not-italic font-mono'}`}>
                          {displayText}
                        </p>
                        <p className="text-[9px] text-zinc-600 mt-1 font-black not-italic tracking-widest">{new Date(offer.created_at).toLocaleDateString('sk-SK')}</p>
                      </td>
                      <td className="p-6">
                        <p className="text-zinc-300 text-sm">{offer.job_tickets?.customer_name}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="bg-white text-black px-2 py-0.5 rounded text-[10px] font-black tracking-widest not-italic">
                            {offer.job_tickets?.plate_number}
                          </span>
                          <span className="text-xs text-zinc-500">{offer.job_tickets?.car_brand_model}</span>
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <p className="text-xl font-black text-white">{(offer.total_amount * 1.23).toFixed(2)} €</p>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${getStatusStyle(offer.status)}`}>
                          {offer.status}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/ponuka/${offer.id}`); }}
                            className="bg-zinc-800 hover:bg-blue-600 p-3 rounded-xl transition-all shadow-lg"
                            title="Zobraziť"
                          >
                            👁️
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, offer.id, displayText)}
                            className="bg-zinc-800 hover:bg-red-600 p-3 rounded-xl transition-all shadow-lg text-xs"
                            title="Vymazať"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-20 text-center text-zinc-700 text-xs tracking-[0.3em] uppercase italic font-black">
                    Nenašli sa žiadne ponuky
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <div className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl flex items-center gap-3">
             <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
             <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Čakajúce: {offers.filter(o => o.status === 'Odoslané').length}</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl flex items-center gap-3">
             <span className="w-2 h-2 bg-green-500 rounded-full"></span>
             <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Schválené: {offers.filter(o => o.status === 'Schválené').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}