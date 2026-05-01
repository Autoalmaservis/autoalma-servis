'use client';
import Link from 'next/link';

const services = [
  {
    icon: '🔧',
    name: 'Mechanické práce',
    items: ['Výmena oleja', 'Výmena pneu', 'Výmena bŕzd', 'Rozvodový remeň', 'Spojka a prevodovka'],
  },
  {
    icon: '⚡',
    name: 'Elektro a diagnostika',
    items: ['Diagnostika', 'Chiptuning', 'Oprava ABS', 'Oprava AdBlue', 'Oprava alternátora'],
  },
  {
    icon: '✨',
    name: 'Doplnkové služby',
    items: ['Čistenie DPF/CAT', 'Dekarbonizácia', 'Ozonizácia', 'Plnenie klimatizácie', 'RJM oprava'],
  },
];

const slogans = [
  { main: 'Férovosť, ktorú cítite', sub: 'nie len čítate' },
  { main: 'Servis, ktorý komunikuje', sub: 'nie iba účtuje' },
  { main: 'Transparentná diagnostika', sub: 'bez technického žargónu' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* NAVIGÁCIA */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 bg-black/80 backdrop-blur-md border-b border-zinc-900">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">
          Auto<span className="text-red-600">Alma</span>
        </h1>
        <div className="flex items-center gap-3 md:gap-5">
          <a
            href="tel:0940449449"
            className="hidden md:block text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
          >
            0940 449 449
          </a>
          <Link
            href="/system"
            className="text-zinc-700 hover:text-zinc-400 transition-all text-xl"
            title="Pre zamestnancov"
          >
            ⚙
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-transparent to-transparent pointer-events-none" />

        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600 mb-8 italic">
          Bratislava · Svornosti 119
        </p>

        <h1 className="text-7xl md:text-[10rem] font-black uppercase italic tracking-tighter leading-none mb-8">
          Auto<span className="text-red-600">Alma</span>
        </h1>

        <p className="text-zinc-400 text-lg md:text-xl font-bold max-w-lg mb-4 leading-relaxed">
          Máme možno prvý autoservis,
        </p>
        <p className="text-white text-xl md:text-2xl font-black italic max-w-lg mb-12">
          ktorému budete veriť.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/login"
            className="bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl shadow-red-600/20 hover:shadow-red-600/40 hover:scale-105"
          >
            🏎️ Moja Garáž — Prihlásiť sa
          </Link>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-700 animate-bounce">
          <span className="text-[9px] uppercase tracking-widest font-black">Viac info</span>
          <span className="text-sm">↓</span>
        </div>
      </section>

      {/* SLOGANY */}
      <section className="py-14 px-6 border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {slogans.map((s, i) => (
            <div key={i}>
              <p className="text-white font-black uppercase italic text-lg tracking-tight">{s.main}</p>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SLUŽBY */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Čo robíme</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Naše Služby</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <div
                key={i}
                className="bg-zinc-950 border border-zinc-900 p-8 rounded-[2rem] hover:border-red-600/30 transition-all group"
              >
                <span className="text-5xl mb-6 block">{s.icon}</span>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 group-hover:text-red-600 transition-colors">
                  {s.name}
                </h3>
                <ul className="space-y-2">
                  {s.items.map((item, j) => (
                    <li key={j} className="text-zinc-500 text-sm font-bold flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section className="py-24 px-6 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Kde nás nájdete</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Kontakt</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href="tel:0940449449"
              className="bg-black border border-zinc-900 hover:border-red-600/30 p-8 rounded-[2rem] text-center transition-all group cursor-pointer"
            >
              <span className="text-4xl mb-4 block">📞</span>
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-3">Telefón</p>
              <p className="text-white font-black text-xl tracking-widest group-hover:text-red-500 transition-colors">
                0940 449 449
              </p>
              <p className="text-zinc-500 font-bold text-sm mt-2">0908 647 227</p>
            </a>

            <a
              href="https://maps.google.com/?q=Svornosti+119,+Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black border border-zinc-900 hover:border-red-600/30 p-8 rounded-[2rem] text-center transition-all group cursor-pointer"
            >
              <span className="text-4xl mb-4 block">📍</span>
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-3">Adresa</p>
              <p className="text-white font-black text-xl group-hover:text-red-500 transition-colors">
                Svornosti 119
              </p>
              <p className="text-zinc-500 font-bold text-sm mt-2">821 06 Bratislava</p>
            </a>

            <a
              href="mailto:autoalma@autoalma.sk"
              className="bg-black border border-zinc-900 hover:border-red-600/30 p-8 rounded-[2rem] text-center transition-all group cursor-pointer"
            >
              <span className="text-4xl mb-4 block">✉️</span>
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-3">E-mail</p>
              <p className="text-white font-black text-base break-all group-hover:text-red-500 transition-colors">
                autoalma@autoalma.sk
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">
          © 2025 Autoalma s.r.o. · IČO: 46044876
        </p>
        <Link
          href="/system"
          className="text-zinc-800 hover:text-zinc-500 text-[9px] font-black uppercase tracking-widest transition-all"
        >
          Pre zamestnancov →
        </Link>
      </footer>

    </div>
  );
}
