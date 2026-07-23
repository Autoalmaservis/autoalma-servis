'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';

function StatCard({ href, title, value, unit, sub, accent = 'zinc', pulse = false, loading }) {
  const borders = {
    red: 'hover:border-red-600/40',
    green: 'hover:border-green-600/40',
    yellow: 'hover:border-yellow-500/40',
    zinc: 'hover:border-zinc-600',
  };
  const labels = {
    red: 'group-hover:text-red-500',
    green: 'group-hover:text-green-500',
    yellow: 'group-hover:text-yellow-400',
    zinc: 'group-hover:text-white',
  };
  const dots = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    zinc: 'bg-zinc-600',
  };

  return (
    <Link href={href} className={`bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl ${borders[accent]} transition-all group block`}>
      <p className={`text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 ${labels[accent]} transition-colors`}>{title}</p>
      <div className="flex items-baseline gap-2 mb-6">
        <p className="text-5xl font-black text-white italic leading-none">{loading ? '…' : value}</p>
        <span className="text-zinc-600 font-bold uppercase text-xs tracking-tighter">{unit}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dots[accent]} ${pulse ? 'animate-pulse' : ''} shrink-0`} />
        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">{sub}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    inProgress: 0,
    pendingCalendar: 0,
    unconfirmedTickets: 0,
    completedMonth: 0,
    weekReservations: 0,
    weekCash: 0,
    totalJobs: 0,
    vehiclesCount: 0,
    activeWorkers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const dayOfWeek = today.getDay();

        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + daysToSunday);
        const sundayStr = sunday.toISOString().split('T')[0];

        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);
        const mondayStr = monday.toISOString().split('T')[0];

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];

        const [
          { count: inProgressCount },
          { count: pendingCalendarCount },
          { count: unconfirmedTicketsCount },
          { count: completedMonthCount },
          { count: weekCount },
          { count: totalJobsCount },
          { count: vehiclesCount },
          { count: activeWorkersCount },
          { data: kasaData },
        ] = await Promise.all([
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }).eq('status', 'Prebieha'),
          supabase.from('calendar_events').select('*', { count: 'exact', head: true }).eq('is_confirmed', false).neq('plate_number', 'BLOK'),
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }).eq('status', 'Čaká na schválenie'),
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }).in('status', ['Dokončené', 'Archivované']).gte('created_at', `${monthStartStr}T00:00:00`),
          supabase.from('calendar_events').select('*', { count: 'exact', head: true }).gte('start_datetime', `${todayStr}T00:00:00`).lte('start_datetime', `${sundayStr}T23:59:59`).neq('plate_number', 'BLOK').eq('is_blocked', false),
          supabase.from('job_tickets').select('*', { count: 'exact', head: true }),
          supabase.from('vehicles').select('*', { count: 'exact', head: true }),
          supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
          supabase.from('kasa_entries').select('amount').eq('type', 'prijem').gte('date', mondayStr).lte('date', sundayStr),
        ]);

        const weekCash = kasaData ? kasaData.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) : 0;

        setStats({
          inProgress: inProgressCount || 0,
          pendingCalendar: pendingCalendarCount || 0,
          unconfirmedTickets: unconfirmedTicketsCount || 0,
          completedMonth: completedMonthCount || 0,
          weekReservations: weekCount || 0,
          weekCash,
          totalJobs: totalJobsCount || 0,
          vehiclesCount: vehiclesCount || 0,
          activeWorkers: activeWorkersCount || 0,
        });
      } catch (err) {
        console.error('Chyba pri načítaní štatistík:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white select-none">

      <header className="mb-12 border-l-4 border-red-600 pl-6 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">
            AutoAlma <span className="text-red-600">Dashboard</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
            Prevádzkový prehľad systému v1.2
          </p>
        </div>
        <div className="hidden md:block text-right">
          <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Stav Servera</p>
            <p className="text-green-500 text-[10px] font-bold animate-pulse uppercase mt-1">● Systém Online</p>
          </div>
        </div>
      </header>

      {/* RAD 1 — živý stav */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          href="/zakazky"
          title="Práve v oprave"
          value={stats.inProgress}
          unit="vozidlá"
          sub="Zákazky so statusom Prebieha"
          accent="red"
          pulse
          loading={loading}
        />
        <StatCard
          href="/kalendar"
          title="Čaká na schválenie"
          value={stats.pendingCalendar}
          unit="rezervácií"
          sub="Online objednávky bez potvrdenia"
          accent="yellow"
          pulse
          loading={loading}
        />
        <StatCard
          href="/zakazky"
          title="Nepotvrdené žiadosti"
          value={stats.unconfirmedTickets}
          unit="zákaziek"
          sub="Zákazky čakajúce na schválenie"
          accent="yellow"
          pulse
          loading={loading}
        />
      </div>

      {/* RAD 2 — tento týždeň / mesiac */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          href="/zakazky"
          title="Dokončené tento mesiac"
          value={stats.completedMonth}
          unit="zákaziek"
          sub="Dokončené / Archivované v tomto mesiaci"
          accent="zinc"
          loading={loading}
        />
        <StatCard
          href="/kalendar"
          title="Rezervácie tento týždeň"
          value={stats.weekReservations}
          unit="termínov"
          sub="Naplánované od dnes do nedele"
          accent="zinc"
          loading={loading}
        />
        <StatCard
          href="/faktury"
          title="Hotovosť tento týždeň"
          value={stats.weekCash.toLocaleString('sk-SK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          unit="€"
          sub="Prijaté v hotovosti od pondelka"
          accent="green"
          loading={loading}
        />
      </div>

      {/* RAD 3 — databázové štatistiky */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          href="/zakazky"
          title="Celkovo zákaziek"
          value={stats.totalJobs}
          unit="zákaziek"
          sub="Všetky zákazky v systéme od začiatku"
          accent="zinc"
          loading={loading}
        />
        <StatCard
          href="/klienti"
          title="Vozidlá v databáze"
          value={stats.vehiclesCount}
          unit="vozidlá"
          sub="Celkový počet evidovaných vozidiel"
          accent="zinc"
          loading={loading}
        />
        <StatCard
          href="/nastavenia"
          title="Aktívni mechanici"
          value={stats.activeWorkers}
          unit="osoby"
          sub="Aktuálne aktívni zamestnanci"
          accent="zinc"
          loading={loading}
        />
      </div>

      <footer className="mt-20 pb-10 text-center">
        <p className="text-[9px] font-bold text-zinc-800 uppercase tracking-[0.5em]">
          AutoAlma Engine &copy; 2026 | All rights reserved
        </p>
      </footer>
    </div>
  );
}
