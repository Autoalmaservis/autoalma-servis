'use client';
import './globals.css';
import Link from 'next/link';
import { useState } from 'react';

export default function RootLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <html lang="sk" suppressHydrationWarning>
      <body className="bg-black text-white flex min-h-screen font-sans" suppressHydrationWarning>
        
        {/* BOČNÉ MENU - SIDEBAR s dynamickou šírkou */}
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
            
            <MenuLink href="/" icon="🏠" label="Prehľad" collapsed={isCollapsed} />
            <MenuLink href="/klienti" icon="👥" label="Klienti a Vozidlá" collapsed={isCollapsed} />
            <MenuLink href="/kalendar" icon="📅" label="Kalendár / Plán" collapsed={isCollapsed} />
            
            <div className={`pt-4 mt-4 border-t border-zinc-900`}>
              {!isCollapsed && <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-2">Správa</p>}
              <MenuLink href="/nastavenia" icon="⚙️" label="Nastavenia tímu" collapsed={isCollapsed} />
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
          <div className="w-full h-full">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}

// Pomocný komponent pre linky v menu
function MenuLink({ href, icon, label, collapsed }) {
  return (
    <Link href={href} className={`flex items-center gap-4 p-3 rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all group ${collapsed ? 'justify-center' : ''}`}>
      <span className="text-xl group-hover:scale-110 transition-transform shrink-0">{icon}</span> 
      {!collapsed && <span className="font-bold text-sm whitespace-nowrap tracking-tight">{label}</span>}
    </Link>
  );
}