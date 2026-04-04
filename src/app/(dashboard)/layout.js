'use client';
import '../globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase'; 
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const pathname = usePathname();

  // REAL-TIME sledovanie nových požiadaviek
  useEffect(() => {
    fetchPendingCount();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          table: 'calendar_events',
          schema: 'public',
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      
      {/* BOČNÉ MENU */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-zinc-950 border-r border-zinc-800 p-4 flex-shrink-0 hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300`}>
        
        {/* TLAČIDLO NA ZBALENIE */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-red-600 rounded-full w-6 h-6 flex items-center justify-center border-2 border-black hover:scale-110 transition-all z-50 shadow-lg shadow-red-600/40"
        >
          <span className="text-[10px] text-white font-bold">{isCollapsed ? '→' : '←'}</span>
        </button>

        {/* LOGO */}
        <div className={`mb-10 transition-all ${isCollapsed ? 'text-center' : 'px-2'}`}>
          <Link href="/">
            <h1 className={`font-black italic text-red-600 uppercase tracking-tighter transition-all ${isCollapsed ? 'text-xl' : 'text-2xl'}`}>
              A{isCollapsed ? '' : 'utoAlma'}
            </h1>
            {!isCollapsed && <p className="text-[8px] text-zinc-600 font-mono tracking-[0.3em] uppercase ml-1">Service OS</p>}
          </Link>
        </div>
        
        {/* HLAVNÁ NAVIGÁCIA */}
        <nav className="space-y-2 flex-grow">
          {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2">Hlavné Menu</p>}
          
          <MenuLink href="/" icon="🏠" label="Prehľad" collapsed={isCollapsed} active={pathname === '/'} />
          <MenuLink href="/klienti" icon="👥" label="Klienti a Vozidlá" collapsed={isCollapsed} active={pathname === '/klienti'} />
          
          <MenuLink 
            href="/kalendar" 
            icon="📅" 
            label="Kalendár / Plán" 
            collapsed={isCollapsed} 
            active={pathname === '/kalendar'}
            badge={pendingCount} 
          />

          <MenuLink href="/zakazky" icon="🛠️" label="Zoznam Zákaziek" collapsed={isCollapsed} active={pathname === '/zakazky'} />
          
          <div className={`pt-4 mt-4 border-t border-zinc-900`}>
            {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2">Správa</p>}
            <MenuLink href="/nastavenia" icon="⚙️" label="Nastavenia tímu" collapsed={isCollapsed} active={pathname === '/nastavenia'} />
            <MenuLink href="#" icon="📦" label="Sklad (v príprave)" collapsed={isCollapsed} />
          </div>
        </nav>

        {/* PROFIL UŽÍVATEĽA */}
        <div className={`mt-auto pt-4 border-t border-zinc-900 transition-all ${isCollapsed ? 'items-center' : ''}`}>
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
        </div>
      </aside>

      {/* HLAVNÝ OBSAH */}
      <main className="flex-grow overflow-y-auto bg-black transition-all duration-300">
        <div className="w-full h-full p-0">
          {children}
        </div>
      </main>
    </div>
  );
}

// Pomocný komponent MenuLink ostáva rovnaký ako predtým
function MenuLink({ href, icon, label, collapsed, active, badge }) {
  return (
    <Link href={href} className={`flex items-center justify-between p-3 rounded-xl transition-all group ${active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'} ${collapsed ? 'px-0 justify-center' : ''}`}>
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
           <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-md min-w-[18px] text-center">{badge}</span>
        </div>
      )}
      {collapsed && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </Link>
  );
}