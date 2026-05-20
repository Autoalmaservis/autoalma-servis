'use client';
import Link from 'next/link';
import { useState } from 'react';

const STEPS = [
  {
    num: '01',
    icon: '🌐',
    title: 'Navštívte náš web',
    desc: 'Otvorte hlavnú stránku autoservisu. Nájdete tu všetky služby, ceny a možnosť prihlásenia do zákazníckej zóny.',
    action: null,
    detail: 'Webová stránka je dostupná 24/7. Funguje na mobile aj počítači.',
  },
  {
    num: '02',
    icon: '🔑',
    title: 'Kliknite na „Moja Garáž"',
    desc: 'V hornom menu nájdete tlačidlo „Moja Garáž". Toto je váš osobný priestor — prehľad vozidiel, histórie opráv a objednávok.',
    action: null,
    detail: 'Ak ešte nemáte účet, budete presmerovaní na registráciu.',
  },
  {
    num: '03',
    icon: '📝',
    title: 'Vytvorte si účet',
    desc: 'Vyplňte registračný formulár: meno, email, telefón a heslo. Ak ste firma, môžete zadať IČO a fakturačné údaje.',
    action: { label: 'Prejsť na registráciu', href: '/registracia' },
    detail: 'Po registrácii dostanete potvrdzovací email. Kliknite na odkaz a účet sa aktivuje.',
  },
  {
    num: '04',
    icon: '🚗',
    title: 'Pridajte svoje vozidlo',
    desc: 'Po prihlásení kliknite na „+ Pridať vozidlo". Zadajte ŠPZ, značku a model. Môžete pridať aj VIN, rok výroby a počet km.',
    action: { label: 'Prejsť do Garážu', href: '/garaz' },
    detail: 'Vozidlo sa uloží trvalo. Pri ďalšej návšteve ho už nemusíte znovu zadávať.',
  },
  {
    num: '05',
    icon: '📅',
    title: 'Objednajte sa na servis',
    desc: 'Pri svojom vozidle kliknite „Objednať servis". Vyberte si práce zo zoznamu alebo popíšte problém vlastnými slovami. Potom zvoľte voľný termín v kalendári.',
    action: { label: 'Moja Garáž', href: '/garaz' },
    detail: 'Objednávku potvrdíme SMS-kou alebo telefonicky. Stav zákazky sledujete priamo v Garáži.',
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
            return (
              <div
                key={i}
                className={`border rounded-[1.5rem] transition-all duration-300 overflow-hidden ${isOpen ? 'border-red-600/50 bg-zinc-950' : 'border-zinc-900 bg-zinc-950 hover:border-zinc-700'}`}
              >
                <button
                  className="w-full text-left p-6 flex items-start gap-5"
                  onClick={() => setActiveStep(isOpen ? null : i)}
                >
                  {/* Číslo */}
                  <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs tracking-widest transition-all ${isOpen ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
                    {step.num}
                  </div>

                  {/* Ikona + text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{step.icon}</span>
                      <h2 className={`font-black uppercase italic tracking-tight text-base md:text-lg transition-colors ${isOpen ? 'text-red-500' : 'text-white'}`}>
                        {step.title}
                      </h2>
                    </div>
                    <p className="text-zinc-400 text-xs md:text-sm font-bold leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  {/* Šípka */}
                  <div className={`shrink-0 text-zinc-600 transition-transform duration-300 mt-1 ${isOpen ? 'rotate-180 text-red-500' : ''}`}>▾</div>
                </button>

                {/* Rozbalená časť */}
                {isOpen && (
                  <div className="px-6 pb-6 pt-0 border-t border-zinc-800/50 mt-0">
                    <div className="flex items-start gap-4 pt-5">
                      <div className="flex-1">
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
                    </div>
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
            <Link
              href="/registracia"
              className="bg-red-600 hover:bg-red-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-600/30"
            >
              Zaregistrovať sa
            </Link>
            <Link
              href="/garaz"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
            >
              Prihlásiť sa
            </Link>
          </div>
        </div>

        {/* KONTAKT */}
        <p className="text-center text-zinc-600 text-xs font-bold mt-10">
          Máte otázky? Zavolajte nám:{' '}
          <a href="tel:+421940449449" className="text-zinc-400 hover:text-white transition-colors">0940 449 449</a>
        </p>
      </div>
    </div>
  );
}
