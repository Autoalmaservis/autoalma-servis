'use client';
import '../globals.css';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { usePathname, useRouter } from 'next/navigation';


export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [jobUpdateCount, setJobUpdateCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [findingJobs, setFindingJobs] = useState([]);
  const [todoCount, setTodoCount] = useState(0);
  const jobStatusRef = useRef({});
  const pathname = usePathname();

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('done', false);
      setTodoCount(count || 0);
    };
    fetchCount();
    const channel = supabase.channel('todos-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, fetchCount)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const addStatusNotification = (notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, 8));
    if (!window.location.pathname.startsWith('/zakazky')) setJobUpdateCount(prev => prev + 1);
  };

  const pollJobStatuses = async () => {
    const { data } = await supabase.from('job_tickets').select('id, customer_name, plate_number, status, has_unread_finding').neq('status', 'Archivované');
    if (!data) return;
    const prev = jobStatusRef.current;
    const next = {};
    const findings = [];
    data.forEach(job => {
      next[job.id] = job.status;
      const oldStatus = prev[job.id];
      if (oldStatus !== undefined && oldStatus !== job.status) {
        addStatusNotification({ id: job.id, customerName: job.customer_name, plateNumber: job.plate_number, fromStatus: oldStatus, toStatus: job.status });
      }
      if (job.has_unread_finding) {
        findings.push({ id: job.id, customerName: job.customer_name, plateNumber: job.plate_number });
      }
    });
    jobStatusRef.current = next;
    setFindingJobs(findings);
  };

  useEffect(() => {
    fetchPendingCount();
    pollJobStatuses();
    const channel = supabase.channel('dashboard-global-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, fetchPendingCount)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_events' }, fetchPendingCount)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_tickets' }, pollJobStatuses)
      .subscribe();
    const pendingInterval = setInterval(fetchPendingCount, 10000);
    const jobInterval = setInterval(pollJobStatuses, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(pendingInterval); clearInterval(jobInterval); };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/zakazky')) { setJobUpdateCount(0); setNotifications([]); }
    const match = pathname.match(/\/zakazky\/([^/]+)/);
    if (match) setFindingJobs(prev => prev.filter(j => j.id !== match[1]));
    setIsMobileOpen(false);
  }, [pathname]);

  const fetchPendingCount = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count, error } = await supabase.from('calendar_events').select('*', { count: 'exact', head: true }).eq('is_confirmed', false).gte('start_datetime', today.toISOString());
    if (!error) setPendingCount(count || 0);
  };

  const statusColor = (s) => ({ 'Prebieha': 'text-blue-400', 'Čaká na schválenie': 'text-purple-400', 'Dokončené': 'text-green-400' }[s] || 'text-zinc-400');

  if (pathname === '/zapisnik') return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-black font-sans">

      {/* MOBILNÁ LIŠTA */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between z-[100] no-print">
        <h1 className="font-black italic text-red-600 uppercase tracking-tighter text-xl">AutoAlma</h1>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-xl text-white">
          {isMobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        bg-zinc-950 border-r border-zinc-800 flex-shrink-0 flex flex-col fixed md:sticky top-0 h-screen transition-all duration-300 z-[150] no-print
      `}>

        {/* Collapse button — mimo overflow kontajnera */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-red-600 rounded-full w-6 h-6 hidden md:flex items-center justify-center border-2 border-black hover:scale-110 transition-all z-50 shadow-lg shadow-red-600/40"
        >
          <span className="text-[10px] text-white font-bold">{isCollapsed ? '→' : '←'}</span>
        </button>

        <div className="flex flex-col h-full overflow-y-auto p-4">

          <div className={`mb-10 transition-all ${isCollapsed ? 'text-center' : 'px-2'} ${isMobileOpen ? 'mt-10 md:mt-0' : ''}`}>
            <Link href="/dashboard">
              <h1 className={`font-black italic text-red-600 uppercase tracking-tighter transition-all ${isCollapsed ? 'text-xl' : 'text-2xl'}`}>
                A{isCollapsed ? '' : 'utoAlma'}
              </h1>
              {!isCollapsed && <p className="text-[8px] text-zinc-600 font-mono tracking-[0.3em] uppercase ml-1 font-bold">Service OS</p>}
            </Link>
          </div>

          <nav className="space-y-2 flex-grow pr-1">
            {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2 font-bold">Hlavné Menu</p>}

            <MenuLink href="/dashboard" icon="🏠" label="Prehľad" collapsed={isCollapsed} active={pathname === '/dashboard'} />
            <MenuLink href="/klienti" icon="👥" label="Klienti a Vozidlá" collapsed={isCollapsed} active={pathname === '/klienti'} />
            <MenuLink href="/kalendar" icon="📅" label="Kalendár / Plán" collapsed={isCollapsed} active={pathname === '/kalendar'} badge={pendingCount} />
            <MenuLink href="/zakazky" icon="🛠️" label="Zoznam Zákaziek" collapsed={isCollapsed} active={pathname.startsWith('/zakazky')} badge={jobUpdateCount} findingAlert={findingJobs.length > 0} />

            {findingJobs.length > 0 && !isCollapsed && (
              <div className="mx-1 space-y-1 pb-1">
                {findingJobs.map(f => (
                  <Link key={f.id} href={`/zakazky/${f.id}`} className="flex items-center gap-2.5 bg-yellow-950/60 border border-yellow-700/60 hover:border-yellow-500 p-2.5 rounded-xl transition-all group">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase text-yellow-300 truncate leading-none">{f.customerName}</p>
                      <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mt-0.5">{f.plateNumber} · Nové zistenie</p>
                    </div>
                    <span className="ml-auto text-yellow-500 text-xs shrink-0">→</span>
                  </Link>
                ))}
              </div>
            )}

            {findingJobs.length > 0 && isCollapsed && (
              <div className="flex justify-center">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
              </div>
            )}

            {notifications.length > 0 && !isCollapsed && (
              <div className="mx-1 space-y-1.5 pb-1">
                {notifications.slice(0, 5).map((n, i) => (
                  <Link key={i} href={`/zakazky/${n.id}`} className="block bg-black border border-zinc-800 hover:border-red-600/50 p-2.5 rounded-xl transition-all group">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-black uppercase text-white leading-none truncate">{n.customerName}</span>
                      <span className="text-[8px] font-black text-red-500 shrink-0 ml-1">{n.plateNumber}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[8px] font-black uppercase">
                      <span className={statusColor(n.fromStatus)}>{n.fromStatus}</span>
                      <span className="text-zinc-700">→</span>
                      <span className={statusColor(n.toStatus)}>{n.toStatus}</span>
                    </div>
                  </Link>
                ))}
                <button onClick={() => { setNotifications([]); setJobUpdateCount(0); }} className="w-full text-[8px] font-black uppercase text-zinc-700 hover:text-zinc-400 transition-colors py-1 tracking-widest">
                  Vymazať notifikácie ✕
                </button>
              </div>
            )}

            <MenuLink href="/CP" icon="📄" label="Cenové ponuky" collapsed={isCollapsed} active={pathname.startsWith('/ponuky')} />
            <MenuLink href="/faktury" icon="💰" label="Faktúry a Doklady" collapsed={isCollapsed} active={pathname === '/faktury'} />
            <MenuLink href="/kasa" icon="💵" label="Kasa" collapsed={isCollapsed} active={pathname === '/kasa'} />
            <MenuLink href="/kontakty" icon="📒" label="Kontakty" collapsed={isCollapsed} active={pathname === '/kontakty'} />

            <div className="pt-4 mt-4 border-t border-zinc-900">
              {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2 font-bold">Správa</p>}
              <MenuLink href="/statistiky" icon="📊" label="Štatistiky" collapsed={isCollapsed} active={pathname === '/statistiky'} />
              <MenuLink href="/sms-email" icon="📱" label="SMS / Email" collapsed={isCollapsed} active={pathname === '/sms-email'} />
              <MenuLink href="/databaza" icon="🗄️" label="Práce / Diely / Úkony" collapsed={isCollapsed} active={pathname === '/databaza'} />
              <MenuLink href="/nastavenia" icon="⚙️" label="Nastavenia" collapsed={isCollapsed} active={pathname === '/nastavenia'} />
              <MenuLink href="/spravovat-web" icon="🌐" label="Spravovať web" collapsed={isCollapsed} active={pathname.startsWith('/spravovat-web')} />
            </div>

            {/* TO-DO — stránka */}
            <div className="pt-3 mt-3 border-t border-zinc-900">
              <MenuLink href="/todo" icon="📋" label="To-Do zoznam" collapsed={isCollapsed} active={pathname === '/todo'} badge={todoCount} />
            </div>
          </nav>

          <div className={`mt-auto pt-4 border-t border-zinc-900 space-y-2 ${isCollapsed ? 'items-center' : ''}`}>
            <div className={`flex items-center gap-3 p-2 bg-zinc-900/40 rounded-xl border border-zinc-800/50 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-900 rounded-lg flex items-center justify-center font-black text-white shrink-0 text-sm shadow-lg">M</div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-black uppercase tracking-tight text-white leading-none">Maros</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase">Admin</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              className={`w-full flex items-center gap-4 p-3 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-900 transition-all group ${isCollapsed ? 'px-0 justify-center' : ''}`}
            >
              <span className="text-xl group-hover:scale-110 transition-transform shrink-0">🚪</span>
              {!isCollapsed && <span className="font-bold text-sm tracking-tight">Odhlásiť sa</span>}
            </button>
          </div>

        </div>
      </aside>

      {/* POZADIE MOBIL */}
      {isMobileOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] md:hidden" onClick={() => setIsMobileOpen(false)} />}

      {/* HLAVNÝ OBSAH */}
      <main className={`flex-grow overflow-y-auto bg-black transition-all duration-300 print:!w-full print:!max-w-none print:!flex-none print:!overflow-visible ${isMobileOpen ? 'blur-sm md:blur-none' : ''}`}>
        <div className="w-full h-full p-0 mt-16 md:mt-0 print:mt-0">
          {children}
        </div>
      </main>


      <style jsx global>{`
        @media print {
          aside { display: none !important; }
          .flex.min-h-screen { display: block !important; }
          main { width: 100% !important; max-width: none !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}

function MenuLink({ href, icon, label, collapsed, active, badge, findingAlert }) {
  return (
    <Link href={href} className={`flex items-center justify-between p-3 rounded-xl transition-all group relative ${active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'} ${collapsed ? 'px-0 justify-center' : ''}`}>
      <div className={`flex items-center gap-4 ${collapsed ? 'justify-center' : ''}`}>
        <span className="text-xl group-hover:scale-110 transition-transform shrink-0">{icon}</span>
        {!collapsed && <span className="font-bold text-sm whitespace-nowrap tracking-tight">{label}</span>}
      </div>
      {!collapsed && findingAlert && !badge && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
        </span>
      )}
      {!collapsed && badge > 0 && (
        <div className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-md min-w-[18px] text-center">{badge}</span>
        </div>
      )}
      {collapsed && (badge > 0 || findingAlert) && (
        <span className={`absolute top-2 right-2 flex h-2 w-2`}>
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${findingAlert && !badge ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${findingAlert && !badge ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
        </span>
      )}
    </Link>
  );
}
