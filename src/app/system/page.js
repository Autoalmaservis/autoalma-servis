'use client';
import { useRouter } from 'next/navigation';

export default function StaffGatewayPage() {
  const router = useRouter();

  const handleRoleSelection = (role) => {
    if (role === 'prijem') {
      router.push('/login?role=admin');
    } else if (role === 'mechanik') {
      router.push('/mechanik/login');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-20">
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none font-bold">
            AutoAlma <span className="text-red-600 font-bold">OS</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.6em] mt-6 italic font-bold">
            Interný operačný systém | Zamestnanecká zóna
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PRIJÍMACÍ TECHNIK */}
          <button
            onClick={() => handleRoleSelection('prijem')}
            className="group relative p-12 rounded-[4rem] border border-red-900/30 bg-zinc-950/50 transition-all duration-500 hover:scale-105 hover:border-red-600 text-left h-[400px] flex flex-col justify-between overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div>
              <span className="text-6xl mb-8 block font-bold">📋</span>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4 group-hover:text-red-600 transition-colors font-bold text-white">Technik</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase leading-relaxed">Príjem a Kalendár</p>
            </div>
            <div className="relative z-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-red-600 font-bold">
              <span>Vstúpiť</span>
              <span className="group-hover:translate-x-3 transition-transform">→</span>
            </div>
          </button>

          {/* MECHANIK */}
          <button 
            onClick={() => handleRoleSelection('mechanik')} 
            className="group relative p-12 rounded-[4rem] border border-zinc-900 bg-zinc-950/50 transition-all duration-500 hover:scale-105 hover:border-red-600 text-left h-[400px] flex flex-col justify-between overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div>
              <span className="text-6xl mb-8 block font-bold">🔧</span>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4 group-hover:text-red-600 transition-colors font-bold text-white">Mechanik</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase leading-relaxed">Terminál dielne</p>
            </div>
            <div className="relative z-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-red-600 font-bold">
              <span>Vstúpiť</span>
              <span className="group-hover:translate-x-3 transition-transform">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}