'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({ activeJobs: 0, todayReservations: 0, customers: 0, inProgress: 0, weekReservations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRealStats = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Koniec týždňa (nedeľa)
        const dayOfWeek = today.getDay(); // 0=ned, 1=po, ...
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + daysToSunday);
        const sundayStr = sunday.toISOString().split('T')[0];

        const [
          { count: customerCount },
          { count: todayCount },
          { count: jobsCount },
          { count: inProgressCount },
          { count: weekCount },
        ] = await Promise.all([
          supabase.from('user_profiles').select('*', { count: 'exact', head: true }).or('role.eq.zakaznik,role.eq.klient'),
          supabase.from('calendar_events').select('*', { count: 'exact', head: true }).gte('start_datetime', `${todayStr}T00:00:00`).lte('start_datetime', `${todayStr}T23:59:59`),
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }).in('status', ['Čaká na schválenie', 'Prebieha', 'Dokončené']),
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }).eq('status', 'Prebieha'),
          supabase.from('calendar_events').select('*', { count: 'exact', head: true }).gte('start_datetime', `${todayStr}T00:00:00`).lte('start_datetime', `${sundayStr}T23:59:59`).neq('plate_number', 'BLOK').eq('is_blocked', false),
        ]);

        setStats({
          activeJobs: jobsCount || 0,
          todayReservations: todayCount || 0,
          customers: customerCount || 0,
          inProgress: inProgressCount || 0,
          weekReservations: weekCount || 0,
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
          <p className="text-[10px] text-zinc-500 mt-6 uppercase font-bold tracking-tight">Vozidlá s aktívnym listom</p>
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

      {/* DRUHÝ RAD ŠTATISTÍK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <Link href="/zakazky" className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl hover:border-red-600/40 transition-all group block">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-red-500 transition-colors">Práve v oprave</p>
          <div className="flex items-baseline gap-2 mb-6">
            <p className="text-6xl font-black text-white italic leading-none">
              {loading ? '...' : stats.inProgress}
            </p>
            <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">vozidlá</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Zákazky so statusom Prebieha</p>
          </div>
        </Link>

        <Link href="/kalendar" className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl hover:border-zinc-600 transition-all group block">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-white transition-colors">Rezervácie tento týždeň</p>
          <div className="flex items-baseline gap-2 mb-6">
            <p className="text-6xl font-black text-white italic leading-none">
              {loading ? '...' : stats.weekReservations}
            </p>
            <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">termínov</span>
          </div>
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Naplánované od dnes do nedele</p>
        </Link>

      </div>

      <footer className="mt-20 pb-10 text-center">
        <p className="text-[9px] font-bold text-zinc-800 uppercase tracking-[0.5em]">
          AutoAlma Engine &copy; 2026 | All rights reserved
        </p>
      </footer>
    </div>
  );
}