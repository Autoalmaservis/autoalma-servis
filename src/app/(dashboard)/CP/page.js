'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CenovePonukyPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  // --- NOVÁ PONUKA MODAL ---
  const [newOfferOpen, setNewOfferOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobResults, setJobResults] = useState([]);
  const [jobSearching, setJobSearching] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    if (!jobSearch.trim()) { setJobResults([]); return; }
    const timer = setTimeout(() => searchJobs(jobSearch), 300);
    return () => clearTimeout(timer);
  }, [jobSearch]);

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

  const searchJobs = async (term) => {
    setJobSearching(true);
    try {
      const t = term.trim().toUpperCase();
      const { data } = await supabase
        .from('job_tickets')
        .select('id, plate_number, customer_name, car_brand_model, status')
        .or(`plate_number.ilike.%${t}%,customer_name.ilike.%${term.trim()}%`)
        .neq('status', 'Archivované')
        .order('created_at', { ascending: false })
        .limit(8);
      setJobResults(data || []);
    } finally {
      setJobSearching(false);
    }
  };

  const handleDelete = async (e, offerId, offerDisplayText) => {
    e.stopPropagation();
    if (!confirm(`Naozaj chcete natrvalo vymazať ponuku ${offerDisplayText}?`)) return;
    try {
      const { error } = await supabase.from('price_offers').delete().eq('id', offerId);
      if (error) throw error;
      setOffers(offers.filter(o => o.id !== offerId));
    } catch (err) {
      alert("Chyba pri mazaní: " + err.message);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const search = searchTerm.toLowerCase();
    const offerNum = (offer.offer_number || `#${offer.id.substring(0, 8)}`).toLowerCase();
    const customer = (offer.job_tickets?.customer_name || '').toLowerCase();
    const plate = (offer.job_tickets?.plate_number || '').toLowerCase();
    const car = (offer.job_tickets?.car_brand_model || '').toLowerCase();
    return offerNum.includes(search) || customer.includes(search) || plate.includes(search) || car.includes(search);
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

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'Prebieha': return 'text-blue-400';
      case 'Čaká na schválenie': return 'text-purple-400';
      case 'Dokončené': return 'text-green-400';
      default: return 'text-zinc-500';
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

          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="flex-grow lg:w-[400px] relative group">
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

            <button
              onClick={() => { setNewOfferOpen(true); setJobSearch(''); setJobResults([]); }}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-5 rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-900/20 whitespace-nowrap"
            >
              + Nová ponuka
            </button>
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
                  const displayText = offer.offer_number || `#${offer.id.substring(0, 8)}`;
                  const isRealNumber = !!offer.offer_number;
                  return (
                    <tr key={offer.id} onClick={() => router.push(`/ponuka/${offer.id}`)} className="hover:bg-blue-600/5 transition-all group cursor-pointer">
                      <td className="p-6">
                        <p className={`text-lg font-black tracking-tighter leading-none ${isRealNumber ? 'text-white' : 'text-zinc-600 not-italic font-mono'}`}>{displayText}</p>
                        <p className="text-[9px] text-zinc-600 mt-1 font-black not-italic tracking-widest">{new Date(offer.created_at).toLocaleDateString('sk-SK')}</p>
                      </td>
                      <td className="p-6"><p className="text-zinc-300 text-sm">{offer.job_tickets?.customer_name}</p></td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="bg-white text-black px-2 py-0.5 rounded text-[10px] font-black tracking-widest not-italic">{offer.job_tickets?.plate_number}</span>
                          <span className="text-xs text-zinc-500">{offer.job_tickets?.car_brand_model}</span>
                        </div>
                      </td>
                      <td className="p-6 text-right"><p className="text-xl font-black text-white">{(offer.total_amount * 1.23).toFixed(2)} €</p></td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${getStatusStyle(offer.status)}`}>{offer.status}</span>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/ponuka/${offer.id}`); }} className="bg-zinc-800 hover:bg-blue-600 p-3 rounded-xl transition-all shadow-lg" title="Zobraziť">👁️</button>
                          <button onClick={(e) => handleDelete(e, offer.id, displayText)} className="bg-zinc-800 hover:bg-red-600 p-3 rounded-xl transition-all shadow-lg text-xs" title="Vymazať">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-20 text-center text-zinc-700 text-xs tracking-[0.3em] uppercase italic font-black">Nenašli sa žiadne ponuky</td>
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

      {/* --- MODÁL: NOVÁ PONUKA --- */}
      {newOfferOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] w-full max-w-xl shadow-2xl border-t-4 border-t-blue-600 overflow-hidden">

            <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Nová <span className="text-blue-500">Cenová Ponuka</span></h2>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1 font-black">Vyhľadajte zákazku podľa ŠPZ alebo mena</p>
              </div>
              <button onClick={() => setNewOfferOpen(false)} className="p-3 bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">✕</button>
            </div>

            <div className="p-8 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Zadajte ŠPZ alebo meno zákazníka..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  className="w-full bg-black border border-zinc-700 focus:border-blue-500 p-4 rounded-2xl text-white font-black uppercase italic outline-none transition-all text-sm tracking-wide"
                />
                {jobSearching && (
                  <span className="absolute right-4 top-4 text-blue-500 text-xs font-black uppercase animate-pulse tracking-widest">hľadám...</span>
                )}
              </div>

              {/* VÝSLEDKY */}
              {jobResults.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {jobResults.map(job => (
                    <button
                      key={job.id}
                      onClick={() => { setNewOfferOpen(false); router.push(`/zakazky/${job.id}/nova-ponuka`); }}
                      className="w-full bg-zinc-900 hover:bg-blue-600/20 border border-zinc-800 hover:border-blue-500/50 p-4 rounded-2xl text-left transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="bg-white text-black px-3 py-1 rounded-lg font-black text-sm tracking-widest">{job.plate_number}</span>
                          <div>
                            <p className="text-white font-black uppercase italic text-sm leading-none">{job.customer_name}</p>
                            <p className="text-zinc-500 text-[10px] uppercase font-black mt-0.5">{job.car_brand_model}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${getJobStatusColor(job.status)}`}>{job.status}</span>
                          <span className="text-zinc-700 group-hover:text-blue-400 transition-all font-black">→</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {jobSearch.trim() && !jobSearching && jobResults.length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">Žiadna zákazka nenájdená</p>
                  <p className="text-zinc-700 text-[9px] uppercase tracking-widest font-black mt-1">Najprv vytvorte zákazku v sekcii Workflow</p>
                  <button
                    onClick={() => { setNewOfferOpen(false); router.push('/zakazky'); }}
                    className="mt-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Prejsť na Zákazky →
                  </button>
                </div>
              )}

              {!jobSearch.trim() && (
                <p className="text-center text-zinc-700 text-[9px] uppercase tracking-widest font-black py-4">
                  Začnite písať ŠPZ alebo meno...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
