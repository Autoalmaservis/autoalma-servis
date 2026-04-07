'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function HistoriaVozidlaPage() {
  const { spz } = useParams();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketPhotos, setTicketPhotos] = useState([]); // Nový stav pre fotky konkrétnej zákazky

  useEffect(() => {
    if (spz) fetchHistory();
  }, [spz]);

  // Keď zákazník klikne na detail zákazky, načítame k nej prislúchajúce fotky
  useEffect(() => {
    if (selectedTicket) {
      fetchTicketPhotos(selectedTicket.id);
    } else {
      setTicketPhotos([]);
    }
  }, [selectedTicket]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('job_tickets')
      .select('*')
      .eq('plate_number', spz.toUpperCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const formattedData = await Promise.all(data.map(async (t) => {
      const { data: items } = await supabase.from('job_items').select('*').eq('job_id', t.id);
      const { data: tasks } = await supabase.from('job_tasks').select('*').eq('job_id', t.id);
      const subtotal = items?.reduce((acc, item) => acc + (Number(item.unit_price) * Number(item.quantity)), 0) || 0;
      
      return { 
        ...t, 
        job_items: items || [], 
        job_tasks: tasks || [],
        total_price: subtotal * 1.23 
      };
    }));

    setTickets(formattedData);
    setLoading(false);
  };

  const fetchTicketPhotos = async (jobId) => {
    const { data, error } = await supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTicketPhotos(data);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-bold">
      <div className="text-red-600 font-black animate-pulse uppercase tracking-widest">Načítavam históriu opráv...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10 font-sans font-bold">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10">
          <button 
            onClick={() => router.push('/garaz')} 
            className="text-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em]"
          >
            ← Späť do garáže
          </button>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">
            Servisná kniha <span className="text-red-600">{spz.toUpperCase()}</span>
          </h1>
        </div>

        {/* ZOZNAM RIADKOV */}
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-4 px-8 text-zinc-500 text-[10px] font-black uppercase tracking-widest italic mb-2">
            <span>Dátum</span>
            <span>Popis závady / Úkony</span>
            <span className="text-right">Suma (DPH)</span>
            <span className="text-center">Stav</span>
          </div>

          {tickets.length > 0 ? tickets.map((t) => (
            <div 
              key={t.id} 
              onClick={() => setSelectedTicket(t)}
              className="bg-zinc-900/30 border border-zinc-800 p-6 md:p-8 rounded-[2rem] hover:border-red-600/50 transition-all cursor-pointer grid grid-cols-1 md:grid-cols-4 items-center gap-4 group"
            >
              <div className="text-zinc-400 text-sm italic">
                {new Date(t.created_at).toLocaleDateString('sk-SK')}
              </div>
              <div className="md:col-span-1">
                <p className="text-white text-sm line-clamp-1 uppercase italic">
                  {t.job_tasks?.length > 0 ? t.job_tasks.map(task => task.task_description).join(', ') : 'Servisná prehliadka'}
                </p>
              </div>
              <div className="text-right text-xl font-black italic tracking-tighter text-white">
                {t.total_price.toFixed(2)} €
              </div>
              <div className="flex justify-center">
                <span className={`text-[9px] px-4 py-1.5 rounded-full border font-black uppercase ${
                  t.status === 'Dokončené' ? 'border-green-600 text-green-500 bg-green-600/5' : 'border-amber-600 text-amber-500 bg-amber-600/5'
                }`}>
                  {t.status}
                </span>
              </div>
            </div>
          )) : (
            <div className="p-20 text-center text-zinc-800 uppercase font-black tracking-widest text-xs border-2 border-dashed border-zinc-900 rounded-[3rem]">
              Zatiaľ neboli evidované žiadne opravy
            </div>
          )}
        </div>
      </div>

      {/* MODAL: DETAIL ZÁKAZKY */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] p-8 md:p-12 shadow-2xl relative custom-scrollbar">
            
            <button 
              onClick={() => setSelectedTicket(null)}
              className="absolute top-10 right-10 text-zinc-500 hover:text-white text-3xl font-black transition-all"
            >✕</button>

            <header className="border-b border-zinc-800 pb-10 mb-10 flex justify-between items-end italic">
              <div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Archív <span className="text-red-600">Zákazky</span></h2>
                <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mt-4">
                  Dátum: {new Date(selectedTicket.created_at).toLocaleString('sk-SK')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase font-black mb-1">Evidenčné číslo</p>
                <p className="text-2xl font-black italic">#{selectedTicket.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </header>

            <div className="grid md:grid-cols-2 gap-12 font-bold italic uppercase">
              {/* --- STĽPEC 1: ÚKONY A ZÁVADY --- */}
              <div className="space-y-10">
                <div className="space-y-6">
                  <h3 className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] italic ml-2">Vykonané úkony</h3>
                  <div className="space-y-3">
                    {selectedTicket.job_tasks?.map((task) => (
                      <div key={task.id} className="bg-black/30 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${task.is_completed ? 'bg-green-600 border-green-600' : 'border-zinc-700'}`}>
                          {task.is_completed && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <span className="text-xs font-black text-zinc-300">{task.task_description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTicket.complaints && (
                  <div className="space-y-6">
                    <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] italic ml-2">Zistené závady (Neopravené)</h3>
                    <div className="bg-amber-600/5 border border-amber-600/20 p-6 rounded-[2rem]">
                      <pre className="text-[11px] font-sans text-amber-200/70 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.complaints}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* --- NOVÁ SEKČIA: FOTODOKUMENTÁCIA --- */}
                {ticketPhotos.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] italic ml-2">Fotodokumentácia z opravy</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {ticketPhotos.map((photo) => (
                        <a 
                          key={photo.id} 
                          href={photo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black group"
                        >
                          <img 
                            src={photo.url} 
                            alt="Foto z opravy" 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[8px] font-black uppercase tracking-widest bg-white text-black px-3 py-1 rounded-full">Zväčšiť 🔍</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* --- STĽPEC 2: ROZPIS CIEN --- */}
              <div className="space-y-6">
                <h3 className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] italic ml-2">Materiál a položky</h3>
                <div className="bg-black/20 rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-inner">
                  <div className="divide-y divide-zinc-800/50">
                    {selectedTicket.job_items?.map((item) => (
                      <div key={item.id} className="flex justify-between p-5 text-[10px]">
                        <span className="text-zinc-400">{item.name}</span>
                        <span className="text-white font-black">{item.quantity} {item.unit} • {Number(item.unit_price).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-8 bg-zinc-800/20 text-right">
                    <p className="text-zinc-500 text-[10px] uppercase font-black mb-2 tracking-widest">Finálna suma s DPH</p>
                    <p className="text-5xl font-black italic tracking-tighter text-white">
                      {selectedTicket.total_price.toFixed(2)} €
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-10 border-t border-zinc-800 text-center">
              <button 
                onClick={() => setSelectedTicket(null)}
                className="bg-white text-black px-12 py-5 rounded-2xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-xl"
              >
                Zavrieť detailný výpis
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
      `}</style>
    </div>
  );
}