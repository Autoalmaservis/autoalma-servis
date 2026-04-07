'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';

export default function VerejnaPonukaPage() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (id) fetchOffer();
  }, [id]);

  const fetchOffer = async () => {
    const { data } = await supabase.from('price_offers').select('*, job_tickets(*)').eq('id', id).single();
    if (data) {
      setOffer(data);
      // Inicializujeme položky a zabezpečíme, aby každá mala is_selected (predvolene true)
      const initialItems = data.items_json.map(item => ({
        ...item,
        is_selected: item.is_selected !== undefined ? item.is_selected : true
      }));
      setItems(initialItems);
    }
    setLoading(false);
  };

  // Prepínanie výberu celej skupiny
  const toggleGroup = (groupName) => {
    const groupItems = items.filter(i => i.group_name === groupName);
    const currentlyAllSelected = groupItems.every(i => i.is_selected);
    
    const newItems = items.map(item => {
      if (item.group_name === groupName) {
        return { ...item, is_selected: !currentlyAllSelected };
      }
      return item;
    });
    setItems(newItems);
  };

  // Výpočet sumy len za vybraté položky
  const calculateSelectedTotal = () => {
    const subtotal = items
      .filter(i => i.is_selected)
      .reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
    return subtotal * 1.23; // Celkom s DPH
  };

  const handleResponse = async () => {
    const selectedCount = items.filter(i => i.is_selected).length;
    const message = selectedCount === 0 
      ? "Naozaj chcete zamietnuť všetky položky ponuky?" 
      : `Potvrdzujete vybraté opravy v celkovej hodnote ${calculateSelectedTotal().toFixed(2)}€?`;

    if (!confirm(message)) return;

    const finalStatus = selectedCount === 0 ? 'Zamietnuté' : 'Schválené';

    const { error } = await supabase
      .from('price_offers')
      .update({ 
        status: finalStatus,
        items_json: items // Ukladáme finálny stav aj s informáciou, čo bolo vybraté
      })
      .eq('id', id);

    if (!error) {
      setResponded(true);
      setOffer({ ...offer, status: finalStatus });
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam ponuku...</div>;
  if (!offer) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Ponuka neexistuje</div>;

  // Zoskupenie položiek pre prehľadné zobrazenie zákazníkovi
  const groupedItems = items.reduce((groups, item) => {
    const group = groups[item.group_name] || [];
    group.push(item);
    groups[item.group_name] = group;
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-12 font-sans font-bold">
      <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl">
        
        {/* HLAVIČKA - MODRÁ */}
        <div className="bg-blue-600 p-8 text-center">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Cenová ponuka</h1>
          <p className="text-blue-200 text-[10px] uppercase tracking-widest mt-2 font-black italic">Prehľad a schválenie servisných úkonov</p>
        </div>

        <div className="p-8 space-y-8">
          {/* INFO O AUTE */}
          <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Vozidlo</p>
              <p className="text-xl font-black uppercase italic text-blue-400">{offer.job_tickets?.car_brand_model}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">ŠPZ</p>
              <p className="text-xl font-black uppercase tracking-widest">{offer.job_tickets?.plate_number}</p>
            </div>
          </div>

          {/* SKUPINY OPRÁV */}
          <div className="space-y-6">
            <p className="text-[10px] text-blue-500 uppercase tracking-[0.2em] italic font-black">Vyberte úkony, ktoré si želáte realizovať:</p>
            
            {Object.keys(groupedItems).map((groupName) => {
              const isSelected = groupedItems[groupName].every(i => i.is_selected);
              return (
                <div key={groupName} className={`rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-blue-600 bg-blue-600/5' : 'border-zinc-800 bg-black/20 opacity-60'}`}>
                  <div className="p-5 flex justify-between items-center bg-zinc-800/30">
                    <h3 className={`font-black uppercase italic tracking-wider ${isSelected ? 'text-white' : 'text-zinc-500'}`}>📂 {groupName}</h3>
                    <button 
                      disabled={responded || offer.status !== 'Odoslané'}
                      onClick={() => toggleGroup(groupName)}
                      className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      {isSelected ? 'Vybraté ✓' : 'Vynechať ✕'}
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {groupedItems[groupName].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-black uppercase italic">{item.name}</p>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{item.quantity} {item.unit} • {item.unit_price.toFixed(2)}€ / j</p>
                        </div>
                        <p className="text-lg font-black italic tracking-tighter">{(item.quantity * item.unit_price).toFixed(2)}€</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* REKAPITULÁCIA SUMY */}
          <div className="bg-white text-black p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
            <span className="text-xl font-black uppercase italic leading-none">Suma vybratých opráv:</span>
            <div className="text-right">
              <p className="text-4xl font-black italic leading-none tracking-tighter">{calculateSelectedTotal().toFixed(2)}€</p>
              <p className="text-[9px] uppercase font-black tracking-widest mt-1 opacity-50">Vrátane DPH 23%</p>
            </div>
          </div>

          {/* HLAVNÉ AKČNÉ TLAČIDLO */}
          {!responded && offer.status === 'Odoslané' ? (
            <button 
              onClick={handleResponse}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-7 rounded-[2rem] uppercase text-sm tracking-[0.2em] italic transition-all shadow-2xl shadow-blue-900/40"
            >
              Odoslať vyjadrenie do servisu
            </button>
          ) : (
            <div className={`p-8 rounded-[2.5rem] text-center font-black uppercase tracking-widest italic border-2 ${offer.status === 'Schválené' ? 'bg-green-600/10 text-green-500 border-green-600/50' : 'bg-red-600/10 text-red-500 border-red-600/50'}`}>
              {offer.status === 'Schválené' ? '✓ Vaše vyjadrenie bolo odoslané. Servis začína na prácach.' : '✕ Ponuka bola odmietnutá.'}
            </div>
          )}
        </div>
      </div>
      <p className="text-center mt-8 text-zinc-600 text-[9px] uppercase tracking-[0.4em] font-black italic">AutoAlma Servis • Profesionálna starostlivosť o vaše vozidlo</p>
    </div>
  );
}