'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({ activeJobs: 0, todayReservations: 0, customers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRealStats = async () => {
      setLoading(true);
      try {
        // 1. Získame počet unikátnych klientov
        const { count: customerCount } = await supabase
          .from('job_tickets')
          .select('customer_name', { count: 'exact', head: true });

        // 2. Získame počet dnešných rezervácií z kalendára
        const today = new Date().toISOString().split('T')[0];
        const { count: todayCount } = await supabase
          .from('calendar_events')
          .select('*', { count: 'exact', head: true })
          .gte('start_datetime', `${today}T00:00:00`)
          .lte('start_datetime', `${today}T23:59:59`);

        // 3. Získame počet aktívnych zákaziek (stav 'Otvorená')
        const { count: jobsCount } = await supabase
          .from('job_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Otvorená');

        setStats({
          activeJobs: jobsCount || 0,
          todayReservations: todayCount || 0,
          customers: customerCount || 0
        });
      } catch (err) {
        console.error('Chyba pri načítaní štatistík:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRealStats();
  }, []);

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white select-none">
      
      {/* HLAVIČKA DASHBOARDU */}
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">
            AutoAlma <span className="text-red-600">Dashboard</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
            Prevádzkový prehľad systému v1.1
          </p>
        </div>
        <div className="hidden md:block text-right">
          <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Stav Servera</p>
            <p className="text-green-500 text-[10px] font-bold animate-pulse uppercase mt-1">● Systém Online</p>
          </div>
        </div>
      </header>

      {/* HLAVNÉ KARTY ŠTATISTÍK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        
        {/* KARTA: DNES V SERVISE */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl hover:border-red-600/30 transition-all group">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-red-500 transition-colors">Dnes v servise</p>
          <div className="flex items-baseline gap-2">
            <p className="text-6xl font-black text-white italic leading-none">
              {loading ? '...' : stats.todayReservations}
            </p>
            <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">vozidlá</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-6 uppercase font-bold tracking-tight">Naplánované na dnešný deň</p>
        </div>
        
        {/* KARTA: AKTÍVNE ZAKÁZKY */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl hover:border-zinc-700 transition-all group">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-white transition-colors">V rozpracovaní</p>
          <div className="flex items-baseline gap-2">
            <p className="text-6xl font-black text-white italic leading-none">
              {loading ? '...' : stats.activeJobs}
            </p>
            <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">zákazky</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-6 uppercase font-bold tracking-tight">Vozidlá s otvoreným listom</p>
        </div>

        {/* KARTA: REGISTROVANÍ KLIENTI */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl hover:border-zinc-700 transition-all group">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-white transition-colors">Databáza klientov</p>
          <div className="flex items-baseline gap-2">
            <p className="text-6xl font-black text-white italic leading-none">
              {loading ? '...' : stats.customers}
            </p>
            <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">osoby</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-6 uppercase font-bold tracking-tight">Celkový počet unikátnych klientov</p>
        </div>
      </div>

      {/* RÝCHLE AKCIE / NAVIGATION HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="bg-zinc-950 border border-dashed border-zinc-800 p-12 rounded-[3.5rem] flex flex-col items-center justify-center text-center group hover:bg-zinc-900/20 transition-all">
          <div className="w-20 h-20 bg-red-600 rounded-[1.5rem] flex items-center justify-center text-4xl mb-8 shadow-2xl shadow-red-600/30 group-hover:scale-110 transition-transform">
            📅
          </div>
          <h3 className="text-2xl font-black uppercase mb-3 tracking-tighter">Potrebujete prijať auto?</h3>
          <p className="text-zinc-500 text-sm mb-10 max-w-xs leading-relaxed">
            Nový príjem vozidla sa realizuje priamo v <span className="text-white font-bold">Kalendári</span> výberom voľného termínu u mechanika.
          </p>
          <Link href="/kalendar" className="bg-white text-black font-black px-10 py-5 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all shadow-xl">
            Otvoriť Plánovač
          </Link>
        </div>

        <div className="bg-zinc-950 border border-dashed border-zinc-800 p-12 rounded-[3.5rem] flex flex-col items-center justify-center text-center group hover:bg-zinc-900/20 transition-all">
          <div className="w-20 h-20 bg-zinc-800 rounded-[1.5rem] flex items-center justify-center text-4xl mb-8 shadow-2xl group-hover:scale-110 transition-transform">
            👥
          </div>
          <h3 className="text-2xl font-black uppercase mb-3 tracking-tighter">Hľadáte históriu?</h3>
          <p className="text-zinc-500 text-sm mb-10 max-w-xs leading-relaxed">
            Prehľadajte <span className="text-white font-bold">Zoznam klientov</span> pre informácie o vozidlách, VIN číslach a predošlých opravách.
          </p>
          <Link href="/klienti" className="bg-zinc-800 text-white font-black px-10 py-5 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-zinc-700 transition-all border border-zinc-700 shadow-xl">
            Zobraziť Databázu
          </Link>
        </div>
        
      </div>

      <footer className="mt-20 pb-10 text-center">
        <p className="text-[9px] font-bold text-zinc-800 uppercase tracking-[0.5em]">
          AutoAlma Engine &copy; 2026 | All rights reserved
        </p>
      </footer>
    </div>
  );
}