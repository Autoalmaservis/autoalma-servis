'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ZakazkyZoznamPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('filter');
      if (param) return decodeURIComponent(param);
    }
    return 'Prebieha';
  });

  // --- LOGIKA NOTIFIKÁCIÍ S PAMÄŤOU (localStorage) ---
  const [notifState, setNotifState] = useState({
    'Prebieha': { isNew: false, count: 0 },
    'Čaká na schválenie': { isNew: false, count: 0 }, // DOPLNENÉ
    'Dokončené': { isNew: false, count: 0 }
  });

  useEffect(() => {
    fetchJobs();

    // --- REAL-TIME LOGIKA: AKTUALIZÁCIA PRI ZMENE V DATABÁZE ---
    const channel = supabase
      .channel('public:job_tickets_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_tickets' },
        () => {
          console.log('Zmena v zákazkách detegovaná! Aktualizujem...');
          fetchJobs(); // Pri zmene (napr. mechanik prepne stav) znova načítame zoznam a prepočítame blikanie
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'price_offers' },
        () => {
          console.log('Zmena v ponukách detegovaná! Aktualizujem...');
          fetchJobs(); // Dôležité pre stav "Čaká na schválenie"
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_tickets')
        .select('*, job_items(quantity, unit_price, type), price_offers(status)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const jobsWithPrices = data.map(job => {
        const materialSubtotal = job.job_items?.filter(i => i.type === 'Materiál').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0) || 0;
        const workSubtotal = job.job_items?.filter(i => i.type === 'Práca').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0) || 0;
        const subtotal = materialSubtotal + workSubtotal;
        
        const offerStatus = job.price_offers && job.price_offers.length > 0 
          ? job.price_offers[job.price_offers.length - 1].status 
          : null;

        return { 
          ...job, 
          materialPrice: materialSubtotal * 1.23,
          workPrice: workSubtotal * 1.23,
          totalPrice: subtotal * 1.23,
          offerStatus: offerStatus 
        };
      });

      // Kontrola nových zákaziek voči localStorage
      const updatedNotifState = {};
      ['Prebieha', 'Čaká na schválenie', 'Dokončené'].forEach(status => {
        const currentCount = jobsWithPrices.filter(j => (j.status || 'Prebieha') === status).length;
        const savedCount = parseInt(localStorage.getItem(`lastCount_${status}`)) || 0;

        updatedNotifState[status] = {
          count: currentCount,
          isNew: currentCount > savedCount
        };
      });
      
      setNotifState(updatedNotifState);
      setJobs(jobsWithPrices);
    } catch (err) {
      console.error("Chyba:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    
    if (notifState[status]?.isNew) {
      localStorage.setItem(`lastCount_${status}`, notifState[status].count.toString());
      setNotifState(prev => ({
        ...prev,
        [status]: { ...prev[status], isNew: false }
      }));
    }
  };

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, jobId: null, customerName: '' });

  const confirmDelete = (job) => {
    setDeleteModal({ isOpen: true, jobId: job.id, customerName: job.customer_name });
  };

  const executeDelete = async () => {
    try {
      const { error } = await supabase.from('job_tickets').delete().eq('id', deleteModal.jobId);
      if (error) throw error;
      setJobs(jobs.filter(j => j.id !== deleteModal.jobId));
      setDeleteModal({ isOpen: false, jobId: null, customerName: '' });
    } catch (err) {
      alert("Chyba pri mazaní: " + err.message);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = 
      (job.customer_name || '').toLowerCase().includes(s) ||
      (job.plate_number || '').toLowerCase().includes(s) ||
      (job.technician_name || '').toLowerCase().includes(s);
    
    const matchesFilter = filterStatus === 'Všetky' || (job.status || 'Prebieha') === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const materialSum = filteredJobs.reduce((acc, j) => acc + (j.materialPrice || 0), 0);
  const workSum = filteredJobs.reduce((acc, j) => acc + (j.workPrice || 0), 0);
  const totalSum = materialSum + workSum;

  const getStatusColor = (status) => {
    switch(status) {
      case 'Prebieha': return 'bg-blue-600';
      case 'Čaká na schválenie': return 'bg-purple-600'; // FIALOVÁ PRE PONUKY
      case 'Dokončené': return 'bg-green-600';
      case 'Archivované': return 'bg-zinc-700 text-zinc-400';
      default: return 'bg-zinc-700';
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center font-black text-red-600 uppercase tracking-widest animate-pulse">Načítavam Workflow...</div>;

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans relative">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
            Workflow <span className="text-red-600">Dielne</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Správa servisných procesov</p>
        </div>

        {/* NAVIGÁCIA - PRIDANÉ TLAČIDLO ČAKÁ NA SCHVÁLENIE */}
        <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 shadow-2xl relative flex-wrap gap-1">
          {['Prebieha', 'Čaká na schválenie', 'Dokončené', 'Archivované', 'Všetky'].map((status) => {
            const isNew = notifState[status]?.isNew && filterStatus !== status;
            
            return (
              <button
                key={status}
                onClick={() => handleFilterChange(status)}
                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 relative ${
                  filterStatus === status ? getStatusColor(status) : 'text-zinc-500 hover:text-white'
                } ${isNew ? 'animate-pulse ring-2 ring-red-600 ring-offset-2 ring-offset-black' : ''}`}
              >
                {status}
                {isNew && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* STATS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[2.5rem] shadow-xl">
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-1 font-bold">Materiál</p>
          <p className="text-2xl font-black italic">{materialSum.toFixed(2)}€</p>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[2.5rem] shadow-xl">
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-1 font-bold">Práca</p>
          <p className="text-2xl font-black italic">{workSum.toFixed(2)}€</p>
        </div>
        <div className="bg-red-600/10 border border-red-600/20 p-6 rounded-[2.5rem] shadow-xl">
          <p className="text-red-600/60 text-[9px] font-black uppercase tracking-widest mb-1 font-bold italic">Obrat {filterStatus}</p>
          <p className="text-2xl font-black italic">{totalSum.toFixed(2)}€</p>
        </div>
      </div>

      <div className="mb-8">
        <input 
          type="text" 
          placeholder="Hľadať (Meno, ŠPZ, Mechanik)..." 
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-red-600 transition-all w-full max-w-md font-bold italic shadow-inner"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ZOZNAM ZÁKAZIEK */}
      <div className="space-y-4">
        {filteredJobs.map(job => (
          <div
            key={job.id}
            onClick={() => router.push(`/zakazky/${job.id}`)}
            className={`
              cursor-pointer p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between group transition-all relative overflow-hidden gap-6 shadow-lg border hover:border-red-600
              ${job.offerStatus === 'Schválené' ? 'bg-blue-900/10 border-blue-600/30' : 'bg-zinc-900/40 border-zinc-800'}
              ${job.status === 'Dokončené' ? 'border-green-600/30 bg-green-900/5' : ''}
              ${job.status === 'Čaká na schválenie' ? 'border-purple-600/30 bg-purple-900/5' : ''}
            `}
          >
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className={`w-1.5 h-16 rounded-full ${getStatusColor(job.status || 'Prebieha')}`} />
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-red-500 font-black italic text-sm uppercase tracking-wider">{job.plate_number}</span>
                  
                  {job.offerStatus && (
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border ${
                      job.offerStatus === 'Schválené' ? 'bg-blue-600 text-white border-blue-400' : 'bg-amber-600/20 text-amber-500 border-amber-600/50'
                    }`}>
                      {job.offerStatus === 'Schválené' ? '✅ Zákazník sa vyjadril' : '📩 Ponuka Odoslaná'}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">
                    <span className="text-[10px]">👤</span>
                    <span className="text-[8px] font-black uppercase text-blue-400">
                      {job.technician_name || 'Nepiradený'}
                    </span>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${getStatusColor(job.status || 'Prebieha')}`}>
                    {job.status || 'Prebieha'}
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase italic tracking-tight leading-none mb-1">{job.customer_name}</h3>
                <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">{job.car_brand_model}</p>
              </div>
            </div>

            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
              <div className="hidden sm:block text-right border-r border-zinc-800 pr-6">
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Mat / Práca</p>
                <p className="text-[11px] font-black italic text-zinc-400 font-bold">
                  {job.materialPrice.toFixed(2)}€ / {job.workPrice.toFixed(2)}€
                </p>
              </div>

              <div className="text-right min-w-[120px]">
                <p className="text-3xl font-black italic text-white leading-none tracking-tighter">
                  {job.totalPrice.toFixed(2)}<span className="text-red-600 text-sm ml-0.5">€</span>
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); confirmDelete(job); }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all border border-zinc-800 text-zinc-700 hover:border-red-600 hover:text-red-600"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODÁLNE OKNO PRE POTVRDENIE MAZANIA */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-md w-full text-center shadow-2xl border-t-4 border-t-red-600">
            <div className="text-6xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">Odstrániť zákazku?</h3>
            <p className="text-zinc-500 text-xs mb-8 font-bold uppercase tracking-widest leading-relaxed">
              Naozaj chcete vymazať zákazku pre klienta <span className="text-white">{deleteModal.customerName}</span>? <br /> Táto akcia je nevratná.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setDeleteModal({ isOpen: false, jobId: null, customerName: '' })}
                className="w-full bg-zinc-800 text-zinc-400 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all"
              >
                Zrušiť
              </button>
              <button 
                onClick={executeDelete}
                className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-red-900/20 hover:bg-red-500 transition-all"
              >
                Áno, vymazať
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}