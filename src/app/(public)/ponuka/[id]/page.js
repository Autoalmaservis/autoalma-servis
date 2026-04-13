'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function VerejnaPonukaPage() {
  const { id } = useParams();
  const router = useRouter();
  const [offer, setOffer] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (id) fetchOffer();
  }, [id]);

  const fetchOffer = async () => {
    // Rozšírený select o všetky dôležité polia zo zakázky
    const { data, error } = await supabase
      .from('price_offers')
      .select(`
        *,
        job_tickets (
          *,
          id,
          customer_id,
          customer_name,
          customer_phone,
          customer_email,
          address,
          city,
          car_brand_model,
          plate_number,
          vin_number,
          mileage
        )
      `)
      .eq('id', id)
      .single();

    if (data) {
      const ticketData = Array.isArray(data.job_tickets) ? data.job_tickets[0] : data.job_tickets;
      setOffer({ ...data, job_tickets: ticketData });
      
      const initialItems = data.items_json.map(item => ({
        ...item,
        is_selected: item.is_selected !== undefined ? item.is_selected : true
      }));
      setItems(initialItems);
    }
    setLoading(false);
  };

  const toggleGroup = (groupName) => {
    if (responded || offer.status !== 'Odoslané') return;
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

  const calculateSelectedTotal = () => {
    const subtotal = items
      .filter(i => i.is_selected)
      .reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
    return subtotal * 1.23; 
  };

  const handleResponse = async () => {
    const selectedCount = items.filter(i => i.is_selected).length;
    const finalTotal = calculateSelectedTotal();
    const message = selectedCount === 0 
      ? "Naozaj chcete zamietnuť všetky položky ponuky?" 
      : `Potvrdzujete vybraté opravy v celkovej hodnote ${finalTotal.toFixed(2)}€?`;

    if (!confirm(message)) return;

    const finalStatus = selectedCount === 0 ? 'Zamietnuté' : 'Schválené';

    const { error: updateError } = await supabase
      .from('price_offers')
      .update({ 
        status: finalStatus,
        items_json: items 
      })
      .eq('id', id);

    if (!updateError) {
      if (offer?.job_id || offer?.job_tickets?.id) {
        const jobId = offer.job_id || offer.job_tickets.id;
        const newJobStatus = finalStatus === 'Schválené' ? 'Prebieha' : 'Ponuka zamietnutá';
        await supabase.from('job_tickets').update({ status: newJobStatus }).eq('id', jobId);
      }

      const targetUserId = offer?.job_tickets?.customer_id;
      if (targetUserId) {
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          customer_id: targetUserId,
          title: finalStatus === 'Schválené' ? '✅ Ponuka schválená' : '✕ Ponuka zamietnutá',
          content: finalStatus === 'Schválené' 
            ? `Vozidlo ${offer.job_tickets.plate_number}: Schválili ste opravy za ${finalTotal.toFixed(2)}€.`
            : `Vozidlo ${offer.job_tickets.plate_number}: Ponuka bola zamietnutá.`,
          type: finalStatus === 'Schválené' ? 'success' : 'error',
          is_read: false,
          link: '/garaz'
        }]);
      }

      setResponded(true);
      setOffer({ ...offer, status: finalStatus });
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam ponuku...</div>;
  if (!offer) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Ponuka neexistuje</div>;

  const groupedItems = items.reduce((groups, item) => {
    const group = groups[item.group_name] || [];
    group.push(item);
    groups[item.group_name] = group;
    return groups;
  }, {});

  // Dátumová logika
  const dateCreated = new Date(offer.created_at);
  const dateExpiry = new Date(offer.created_at);
  dateExpiry.setDate(dateExpiry.getDate() + 14);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-12 font-sans font-bold">
      
      {/* TOP BAR - Skrytý pri tlači */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center no-print">
        <button 
          onClick={() => router.back()} 
          className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black tracking-widest shadow-xl"
        >
          ← Späť
        </button>
        <button 
          onClick={() => window.print()}
          className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl flex items-center gap-2"
        >
          🖨️ Tlačiť ponuku
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl printable-area">
        
        {/* HEADER */}
        <div className="bg-blue-600 p-10 flex justify-between items-center text-white header-bg">
          <div className="text-left">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Cenová ponuka</h1>
            <p className="text-blue-100 text-[10px] uppercase tracking-[0.3em] mt-2 font-black italic">AutoAlma Servis • #{id.slice(0,8)}</p>
          </div>
          <div className="text-right">
             <p className="text-[9px] uppercase opacity-70">Platnosť ponuky do:</p>
             <p className="text-xl font-black">{dateExpiry.toLocaleDateString('sk-SK')}</p>
          </div>
        </div>

        <div className="p-10 space-y-10 bg-zinc-900">
          
          {/* INFO O KLIENTOVI A VOZIDLE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-zinc-800 pb-10">
            <div className="space-y-4">
              <h4 className="text-blue-500 text-[10px] uppercase tracking-widest">Odberateľ</h4>
              <div>
                <p className="text-2xl font-black uppercase italic leading-none">{offer.job_tickets?.customer_name}</p>
                <p className="text-xs text-zinc-400 mt-1">{offer.job_tickets?.customer_phone} • {offer.job_tickets?.customer_email}</p>
                <p className="text-xs text-zinc-500 mt-1">{offer.job_tickets?.address}, {offer.job_tickets?.city}</p>
              </div>
            </div>
            <div className="space-y-4 md:text-right">
              <h4 className="text-blue-500 text-[10px] uppercase tracking-widest">Vozidlo</h4>
              <div>
                <p className="text-2xl font-black uppercase italic leading-none">{offer.job_tickets?.car_brand_model}</p>
                <p className="text-sm font-black text-white mt-1">ŠPZ: {offer.job_tickets?.plate_number}</p>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">VIN: {offer.job_tickets?.vin_number || '---'}</p>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase italic">Stav KM: {offer.job_tickets?.mileage} km</p>
              </div>
            </div>
          </div>

          {/* POLOŽKY */}
          <div className="space-y-8">
            <div className="flex justify-between items-end">
                <p className="text-[10px] text-blue-500 uppercase tracking-[0.2em] italic font-black">Rozpis navrhovaných prác a materiálu:</p>
                <p className="text-[10px] text-zinc-500 uppercase">Dátum vystavenia: {dateCreated.toLocaleDateString('sk-SK')}</p>
            </div>
            
            {Object.keys(groupedItems).map((groupName) => {
              const isSelected = groupedItems[groupName].every(i => i.is_selected);
              return (
                <div key={groupName} className={`rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-blue-600 bg-blue-600/5' : 'border-zinc-800 bg-black/20 opacity-60'}`}>
                  <div className="p-5 flex justify-between items-center bg-zinc-800/30 group-header">
                    <h3 className={`font-black uppercase italic tracking-wider ${isSelected ? 'text-white' : 'text-zinc-500'}`}>📂 {groupName}</h3>
                    <button 
                      disabled={responded || offer.status !== 'Odoslané'}
                      onClick={() => toggleGroup(groupName)}
                      className="px-6 py-2 rounded-2xl text-[10px] font-black uppercase transition-all no-print bg-zinc-800 text-zinc-400"
                    >
                      {isSelected ? 'Vybraté ✓' : 'Vynechať ✕'}
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {groupedItems[groupName].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
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

          {/* SUMÁR */}
          <div className="bg-white text-black p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
            <div className="text-left">
                <span className="text-xl font-black uppercase italic leading-none block">Celková suma ponuky:</span>
                <span className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-50">Vrátane DPH 23%</span>
            </div>
            <div className="text-right">
              <p className="text-6xl font-black italic leading-none tracking-tighter">{calculateSelectedTotal().toFixed(2)}€</p>
            </div>
          </div>

          {/* AKCIA - Skrytá pri tlači */}
          <div className="no-print">
              {!responded && offer.status === 'Odoslané' ? (
                <button 
                  onClick={handleResponse}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-7 rounded-[2rem] uppercase text-sm tracking-[0.2em] italic transition-all shadow-2xl shadow-blue-900/40"
                >
                  Odoslať vyjadrenie do servisu
                </button>
              ) : (
                <div className={`p-8 rounded-[2.5rem] text-center font-black uppercase tracking-widest italic border-2 ${offer.status === 'Schválené' ? 'bg-green-600/10 text-green-500 border-green-600/50' : 'bg-red-600/10 text-red-500 border-red-600/50'}`}>
                  {offer.status === 'Schválené' ? '✓ Ponuka bola schválená' : '✕ Ponuka bola odmietnutá'}
                </div>
              )}
          </div>
        </div>
      </div>

      <p className="text-center mt-8 text-zinc-600 text-[9px] uppercase tracking-[0.4em] font-black italic">AutoAlma Servis • Slovenská ulica 12, Košice • www.autoalma.sk</p>

      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .min-h-screen { background: white !important; padding: 0 !important; }
          .printable-area { 
            border: 2px solid black !important; 
            background: white !important; 
            box-shadow: none !important; 
            color: black !important; 
            border-radius: 0 !important;
            max-width: 100% !important;
          }
          .bg-zinc-900, .bg-zinc-950, .bg-black { background: white !important; color: black !important; }
          .bg-blue-600 { background: #f3f4f6 !important; border-bottom: 2px solid black !important; }
          .text-white, .text-blue-100, .text-blue-400, .text-zinc-400, .text-zinc-500 { color: black !important; }
          .border-zinc-800 { border-color: #ddd !important; }
          .header-bg { color: black !important; padding: 40px !important; }
          .bg-white { border: 2px solid black !important; }
          .group-header { background: #f9fafb !important; border-bottom: 1px solid black !important; }
        }
      `}</style>
    </div>
  );
}