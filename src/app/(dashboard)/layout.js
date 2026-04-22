'use client';
import '../globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase'; 
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [jobUpdateCount, setJobUpdateCount] = useState(0); // Stav pre bodku pri zákazkách
  const pathname = usePathname();

  // REAL-TIME sledovanie zmien v systéme
  useEffect(() => {
    fetchPendingCount();

    const channel = supabase
      .channel('dashboard-global-updates')
      // 1. Sledovanie kalendára (Upozornenia na nové požiadavky)
      .on(
        'postgres_changes',
        {
          event: '*', // Reaguje na zápis, úpravu aj VYMAZANIE
          table: 'calendar_events',
          schema: 'public',
        },
        () => {
          fetchPendingCount(); // Okamžitá aktualizácia počítadla pri kalendári
        }
      )
      // 2. Sledovanie zmien v zákazkách (Pohyby v workflow)
      .on(
        'postgres_changes',
        {
          event: '*',
          table: 'job_tickets',
          schema: 'public',
        },
        (payload) => {
          console.log('Zmena v zákazke zachytená:', payload);
          // Ak nie sme práve na stránke zákaziek, rozsvietime upozornenie
          if (!window.location.pathname.startsWith('/zakazky')) {
            setJobUpdateCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Automatické vynulovanie bodky zákaziek, ak na ne používateľ klikne
  useEffect(() => {
    if (pathname.startsWith('/zakazky')) {
      setJobUpdateCount(0);
    }
    setIsMobileOpen(false);
  }, [pathname]);

  const fetchPendingCount = async () => {
    const { count, error } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .eq('is_confirmed', false);

    if (!error) {
      setPendingCount(count || 0);
    }
  };

  return (
    <div className="flex min-h-screen bg-black font-sans">
      
      {/* --- MOBILNÁ HORNÁ LIŠTA --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between z-[100] no-print">
        <h1 className="font-black italic text-red-600 uppercase tracking-tighter text-xl text-white">AutoAlma</h1>
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-xl text-white"
        >
          {isMobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      <aside className={`
        ${isCollapsed ? 'w-20' : 'w-64'} 
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
        bg-zinc-950 border-r border-zinc-800 p-4 flex-shrink-0 flex flex-col fixed md:sticky top-0 h-screen transition-all duration-300 z-[150] no-print
      `}>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-red-600 rounded-full w-6 h-6 hidden md:flex items-center justify-center border-2 border-black hover:scale-110 transition-all z-50 shadow-lg shadow-red-600/40"
        >
          <span className="text-[10px] text-white font-bold">{isCollapsed ? '→' : '←'}</span>
        </button>

        <div className={`mb-10 transition-all ${isCollapsed ? 'text-center' : 'px-2'} ${isMobileOpen ? 'mt-10 md:mt-0' : ''}`}>
          <Link href="/dashboard">
            <h1 className={`font-black italic text-red-600 uppercase tracking-tighter transition-all ${isCollapsed ? 'text-xl' : 'text-2xl'}`}>
              A{isCollapsed ? '' : 'utoAlma'}
            </h1>
            {!isCollapsed && <p className="text-[8px] text-zinc-600 font-mono tracking-[0.3em] uppercase ml-1 font-bold">Service OS</p>}
          </Link>
        </div>
        
        <nav className="space-y-2 flex-grow overflow-y-auto pr-1">
          {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2 font-bold">Hlavné Menu</p>}
          
          <MenuLink href="/dashboard" icon="🏠" label="Prehľad" collapsed={isCollapsed} active={pathname === '/dashboard'} />
          <MenuLink href="/klienti" icon="👥" label="Klienti a Vozidlá" collapsed={isCollapsed} active={pathname === '/klienti'} />
          
          <MenuLink 
            href="/kalendar" 
            icon="📅" 
            label="Kalendár / Plán" 
            collapsed={isCollapsed} 
            active={pathname === '/kalendar'}
            badge={pendingCount} 
          />

          <MenuLink 
            href="/zakazky" 
            icon="🛠️" 
            label="Zoznam Zákaziek" 
            collapsed={isCollapsed} 
            active={pathname.startsWith('/zakazky')} 
            badge={jobUpdateCount} // Červená bodka pri zmene v zákazkách
          />
          
          <MenuLink href="/CP" icon="📄" label="Cenové ponuky" collapsed={isCollapsed} active={pathname.startsWith('/ponuky')} />
          <MenuLink href="/faktury" icon="💰" label="Faktúry a Doklady" collapsed={isCollapsed} active={pathname === '/faktury'} />
          
          <div className={`pt-4 mt-4 border-t border-zinc-900`}>
            {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2 font-bold">Správa</p>}
            <MenuLink href="/databaza" icon="🗄️" label="Databáza prác/dielov" collapsed={isCollapsed} active={pathname === '/databaza'} />
            <MenuLink href="/nastavenia" icon="⚙️" label="Nastavenia tímu" collapsed={isCollapsed} active={pathname === '/nastavenia'} />
          </div>
        </nav>

        <div className={`mt-auto pt-4 border-t border-zinc-900 transition-all ${isCollapsed ? 'items-center' : ''}`}>
           <div className={`flex items-center gap-3 p-2 bg-zinc-900/40 rounded-xl border border-zinc-800/50 ${isCollapsed ? 'justify-center' : ''}`}>
             <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-900 rounded-lg flex items-center justify-center font-black text-white shrink-0 text-sm shadow-lg font-bold">M</div>
             {!isCollapsed && (
               <div className="overflow-hidden font-bold">
                 <p className="text-xs font-black uppercase tracking-tight text-white leading-none">Maros</p>
                 <div className="flex items-center gap-1 mt-1 font-bold">
                   <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                   <p className="text-[9px] text-zinc-500 font-bold uppercase">Admin</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* --- POZADIE PRE MOBIL --- */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        ></div>
      )}

      {/* --- HLAVNÝ OBSAH --- */}
      <main className={`flex-grow overflow-y-auto bg-black transition-all duration-300 ${isMobileOpen ? 'blur-sm md:blur-none' : ''}`}>
        <div className="w-full h-full p-0 mt-16 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  );
}

function MenuLink({ href, icon, label, collapsed, active, badge }) {
  return (
    <Link href={href} className={`flex items-center justify-between p-3 rounded-xl transition-all group relative ${active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 font-bold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'} ${collapsed ? 'px-0 justify-center' : ''}`}>
      <div className={`flex items-center gap-4 ${collapsed ? 'justify-center' : ''}`}>
        <span className="text-xl group-hover:scale-110 transition-transform shrink-0">{icon}</span> 
        {!collapsed && <span className="font-bold text-sm whitespace-nowrap tracking-tight">{label}</span>}
      </div>
      
      {!collapsed && badge > 0 && (
        <div className="flex items-center gap-1">
           <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
           </span>
           <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-md min-w-[18px] text-center font-bold">{badge}</span>
        </div>
      )}
      
      {collapsed && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-2 w-2 font-bold">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </Link>
  );
}