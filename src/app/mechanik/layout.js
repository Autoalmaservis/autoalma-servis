'use client';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MechanikLayout({ children }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans font-bold">
      <nav className="border-b border-zinc-800 p-4 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
          <span className="uppercase italic tracking-tighter font-black text-xl">AutoAlma <span className="text-red-600">Dielňa</span></span>
        </div>
        <button onClick={handleLogout} className="text-[10px] uppercase font-black text-zinc-500 hover:text-white transition-colors">Odhlásiť sa</button>
      </nav>
      <main>{children}</main>
    </div>
  );
}