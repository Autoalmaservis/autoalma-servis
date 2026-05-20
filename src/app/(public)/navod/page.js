'use client';
import Link from 'next/link';
import { useState } from 'react';

/* ---------- VIZUÁLNE MOCKUPY každého kroku ---------- */

function MockStep1() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px]">
      {/* Browser bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><div className="w-2 h-2 rounded-full bg-yellow-500"/><div className="w-2 h-2 rounded-full bg-green-500"/></div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-zinc-500 font-mono">autoalmaservis.sk</div>
      </div>
      {/* Hero */}
      <div className="bg-black p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[8px] text-red-600 font-black uppercase tracking-widest mb-1">AutoAlma Servis</div>
            <div className="text-white font-black italic text-sm uppercase leading-tight">Autoservis<br/>Bratislava</div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="text-zinc-500 text-[9px] font-bold">Služby</div>
            <div className="text-zinc-500 text-[9px] font-bold">Galéria</div>
            <div className="text-zinc-500 text-[9px] font-bold">Kontakt</div>
            <div className="bg-red-600 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase animate-pulse">Moja Garáž</div>
          </div>
        </div>
        <div className="border border-zinc-800 rounded-xl p-3 text-zinc-600 text-[9px] font-bold">
          🔧 Mechanické práce · ⚡ Elektrodiagnostika · ❄️ Klimatizácia · 🛞 Pneuservis
        </div>
      </div>
    </div>
  );
}

function MockStep2() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px]">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><div className="w-2 h-2 rounded-full bg-yellow-500"/><div className="w-2 h-2 rounded-full bg-green-500"/></div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-zinc-500 font-mono">autoalmaservis.sk</div>
      </div>
      <div className="bg-black p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white font-black italic text-sm uppercase">AutoAlma</div>
          <div className="flex gap-2 items-center">
            <div className="text-zinc-500 text-[9px] font-bold">Služby</div>
            <div className="text-zinc-500 text-[9px] font-bold">Galéria</div>
            <div className="text-zinc-500 text-[9px] font-bold">Kontakt</div>
            {/* Highlighted button */}
            <div className="relative">
              <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ring-2 ring-red-400 ring-offset-1 ring-offset-black">
                Moja Garáž →
              </div>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                Kliknite tu ↓
              </div>
            </div>
          </div>
        </div>
        <div className="text-center py-6 text-zinc-700 text-[9px] font-bold border border-dashed border-zinc-800 rounded-xl">
          Hlavná stránka · obsah webu
        </div>
      </div>
    </div>
  );
}

function MockStep3() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px]">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><div className="w-2 h-2 rounded-full bg-yellow-500"/><div className="w-2 h-2 rounded-full bg-green-500"/></div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-zinc-500 font-mono">autoalmaservis.sk/registracia</div>
      </div>
      <div className="bg-black p-5 space-y-2">
        <div className="text-white font-black italic text-sm uppercase mb-3">Registrácia</div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-zinc-600">✉</span>
          <span className="text-zinc-500">Email</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-zinc-600">👤</span>
          <span className="text-zinc-500">Meno a priezvisko</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-zinc-600">📱</span>
          <span className="text-zinc-500">Telefón</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-zinc-600">🔒</span>
          <span className="text-zinc-500">Heslo</span>
        </div>
        <div className="bg-red-600 text-white text-center py-2 rounded-xl font-black uppercase text-[9px] tracking-widest mt-3">
          Vytvoriť účet →
        </div>
      </div>
    </div>
  );
}

function MockStep4() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px]">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><div className="w-2 h-2 rounded-full bg-yellow-500"/><div className="w-2 h-2 rounded-full bg-green-500"/></div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-zinc-500 font-mono">autoalmaservis.sk/garaz</div>
      </div>
      <div className="bg-black p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-black italic text-sm uppercase">Moja Garáž</div>
          <div className="relative">
            <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ring-2 ring-red-400 ring-offset-1 ring-offset-black">
              + Pridať vozidlo
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
              Kliknite tu ↓
            </div>
          </div>
        </div>
        <div className="border border-dashed border-zinc-800 rounded-xl p-4 text-center text-zinc-700 text-[9px] font-bold mb-2">
          🚗 Žiadne vozidlá · kliknite + Pridať vozidlo
        </div>
        {/* Formulár vozidla */}
        <div className="space-y-1.5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-500">ŠPZ — napr. BA123AB</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-500">Značka a model</div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-500">Rok výroby</div>
          </div>
          <div className="bg-red-600/80 text-white text-center py-1.5 rounded-lg font-black uppercase text-[9px]">Uložiť vozidlo</div>
        </div>
      </div>
    </div>
  );
}

function MockStep5() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px]">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><div className="w-2 h-2 rounded-full bg-yellow-500"/><div className="w-2 h-2 rounded-full bg-green-500"/></div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-zinc-500 font-mono">autoalmaservis.sk/garaz</div>
      </div>
      <div className="bg-black p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white font-black italic text-xs uppercase">BA123AB</div>
            <div className="text-zinc-500 text-[9px]">Škoda Octavia · 2019</div>
          </div>
          <div className="relative">
            <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ring-2 ring-red-400 ring-offset-1 ring-offset-black whitespace-nowrap">
              📅 Objednať servis
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
              Kliknite tu ↓
            </div>
          </div>
        </div>
        {/* Kalendár mini */}
        <div className="border border-zinc-800 rounded-xl p-3">
          <div className="text-zinc-400 font-black uppercase text-[9px] mb-2">Vyberte termín — Jún 2025</div>
          <div className="grid grid-cols-7 gap-1">
            {['Po','Ut','St','Št','Pi','So','Ne'].map(d => <div key={d} className="text-center text-zinc-700 text-[8px] font-black">{d}</div>)}
            {[2,3,4,5,6,7,8].map(n => (
              <div key={n} className={`text-center py-1 rounded-lg text-[8px] font-black ${n === 5 ? 'bg-red-600 text-white' : n === 6 || n === 7 ? 'bg-zinc-800 text-zinc-600' : 'bg-green-600/20 text-green-400'}`}>{n}</div>
            ))}
          </div>
          <div className="mt-2 text-[8px] flex gap-2">
            <span className="text-green-400">● Voľné</span>
            <span className="text-red-400">● Vybrané</span>
            <span className="text-zinc-600">● Obsadené</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- KROKY ---------- */

const STEPS = [
  {
    num: '01', icon: '🌐', title: 'Navštívte náš web',
    desc: 'Otvorte hlavnú stránku autoservisu. Nájdete tu všetky služby, ceny a možnosť prihlásenia do zákazníckej zóny.',
    detail: 'Webová stránka je dostupná 24/7. Funguje na mobile aj počítači.',
    action: null,
    Mock: MockStep1,
  },
  {
    num: '02', icon: '🔑', title: 'Kliknite na „Moja Garáž"',
    desc: 'V hornom menu nájdete červené tlačidlo „Moja Garáž". Toto je váš osobný priestor — prehľad vozidiel, histórie opráv a objednávok.',
    detail: 'Ak ešte nemáte účet, budete presmerovaní na registráciu.',
    action: null,
    Mock: MockStep2,
  },
  {
    num: '03', icon: '📝', title: 'Vytvorte si účet',
    desc: 'Vyplňte registračný formulár: meno, email, telefón a heslo. Ak ste firma, môžete zadať IČO a fakturačné údaje.',
    detail: 'Po registrácii dostanete potvrdzovací email. Kliknite na odkaz a účet sa aktivuje.',
    action: { label: 'Prejsť na registráciu', href: '/registracia' },
    Mock: MockStep3,
  },
  {
    num: '04', icon: '🚗', title: 'Pridajte svoje vozidlo',
    desc: 'Po prihlásení kliknite na „+ Pridať vozidlo". Zadajte ŠPZ, značku a model. Môžete pridať aj VIN, rok výroby a počet km.',
    detail: 'Vozidlo sa uloží trvalo. Pri ďalšej návšteve ho už nemusíte znovu zadávať.',
    action: { label: 'Prejsť do garáže', href: '/garaz' },
    Mock: MockStep4,
  },
  {
    num: '05', icon: '📅', title: 'Objednajte sa na servis',
    desc: 'Pri svojom vozidle kliknite „Objednať servis". Vyberte práce zo zoznamu alebo popíšte problém. Potom zvoľte voľný termín v kalendári.',
    detail: 'Objednávku potvrdíme SMS-kou alebo telefonicky. Stav zákazky sledujete priamo v Garáži.',
    action: { label: 'Moja Garáž', href: '/garaz' },
    Mock: MockStep5,
  },
];

export default function NavodPage() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-zinc-500 hover:text-white transition-colors font-black uppercase text-[10px] tracking-widest">
          ← Späť na web
        </Link>
        <Link href="/garaz" className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
          Moja Garáž →
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-14 md:py-20">

        {/* NADPIS */}
        <div className="text-center mb-14">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-3">Zákaznícky portál</p>
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-4 leading-none">
            Ako sa<br className="md:hidden" /> zaregistrovať?
          </h1>
          <p className="text-zinc-500 font-bold text-sm md:text-base max-w-md mx-auto leading-relaxed">
            5 jednoduchých krokov — od prvej návštevy až po objednanie termínu servisu.
          </p>
        </div>

        {/* KROKY */}
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const isOpen = activeStep === i;
            const { Mock } = step;
            return (
              <div
                key={i}
                className={`border rounded-[1.5rem] transition-all duration-300 overflow-hidden ${isOpen ? 'border-red-600/50 bg-zinc-950' : 'border-zinc-900 bg-zinc-950 hover:border-zinc-700'}`}
              >
                <button
                  className="w-full text-left p-6 flex items-start gap-5"
                  onClick={() => setActiveStep(isOpen ? null : i)}
                >
                  <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs tracking-widest transition-all ${isOpen ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{step.icon}</span>
                      <h2 className={`font-black uppercase italic tracking-tight text-base md:text-lg transition-colors ${isOpen ? 'text-red-500' : 'text-white'}`}>
                        {step.title}
                      </h2>
                    </div>
                    <p className="text-zinc-400 text-xs md:text-sm font-bold leading-relaxed">{step.desc}</p>
                  </div>
                  <div className={`shrink-0 text-zinc-600 transition-transform duration-300 mt-1 ${isOpen ? 'rotate-180 text-red-500' : ''}`}>▾</div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 border-t border-zinc-800/50">
                    {/* Mockup obrázok */}
                    <div className="mt-5 mb-5">
                      <Mock />
                    </div>
                    <p className="text-zinc-300 text-sm font-bold leading-relaxed mb-4">{step.detail}</p>
                    {step.action && (
                      <Link
                        href={step.action.href}
                        className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                      >
                        {step.action.label} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-14 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 text-center">
          <span className="text-4xl block mb-4">🏁</span>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-3">
            Pripravený začať?
          </h2>
          <p className="text-zinc-500 text-sm font-bold mb-7 max-w-xs mx-auto leading-relaxed">
            Registrácia trvá menej ako 2 minúty. Váš účet aktivujeme okamžite.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/registracia" className="bg-red-600 hover:bg-red-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-600/30">
              Zaregistrovať sa
            </Link>
            <Link href="/garaz" className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
              Prihlásiť sa
            </Link>
          </div>
        </div>

        <p className="text-center text-zinc-600 text-xs font-bold mt-10">
          Máte otázky? Zavolajte nám:{' '}
          <a href="tel:+421940449449" className="text-zinc-400 hover:text-white transition-colors">0940 449 449</a>
        </p>
      </div>
    </div>
  );
}
