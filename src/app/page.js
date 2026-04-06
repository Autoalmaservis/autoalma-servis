'use client';
import { useRouter } from 'next/navigation';

export default function GatewayPage() {
  const router = useRouter();

  const handleRoleSelection = (role) => {
    if (role === 'prijem') {
      // Smerujeme na login s príznakom admina
      router.push('/login?role=admin');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6">
      <div className="max-w-6xl mx-auto py-20">
        <header className="text-center mb-20">
          <h1 className="text-7xl md:text-9xl font-black uppercase italic tracking-tighter leading-none font-bold">
            AutoAlma <span className="text-red-600">OS</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.6em] mt-6 italic">
            Zjednotený operačný systém | Vyberte zónu
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* PRIJÍMACÍ TECHNIK (ADMIN) */}
          <button
            onClick={() => handleRoleSelection('prijem')}
            className="group relative p-12 rounded-[4rem] border border-red-900/30 bg-zinc-950/50 transition-all duration-500 hover:scale-105 hover:border-red-600 text-left h-[450px] flex flex-col justify-between overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div>
              <span className="text-7xl mb-8 block">📋</span>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 group-hover:text-red-600 transition-colors font-bold text-white">Prijímací technik</h2>
              <p className="text-zinc-500 text-sm font-bold uppercase leading-relaxed font-bold">Admin prístup: Maroš Jurkovič</p>
            </div>
            <div className="relative z-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-red-600 font-bold">
              <span>Vstúpiť do OS</span>
              <span className="group-hover:translate-x-3 transition-transform">→</span>
            </div>
          </button>

          {/* OSTATNÉ ROLY (Zjednodušené) */}
          <button onClick={() => handleRoleSelection('mechanik')} className="p-12 rounded-[4rem] border border-zinc-900 bg-zinc-950/50 text-left h-[450px] flex flex-col justify-between opacity-60 hover:opacity-100 transition-all font-bold">
            <div><span className="text-7xl mb-8 block font-bold">🔧</span><h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 font-bold">Mechanik</h2></div>
          </button>
          <button onClick={() => handleRoleSelection('zakaznik')} className="p-12 rounded-[4rem] border border-zinc-900 bg-zinc-950/50 text-left h-[450px] flex flex-col justify-between opacity-60 hover:opacity-100 transition-all font-bold">
            <div><span className="text-7xl mb-8 block font-bold">🏎️</span><h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 font-bold">Moja Garáž</h2></div>
          </button>
        </div>
      </div>
    </div>
  );
}