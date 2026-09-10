import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import StickyCta from '@/app/components/StickyCta';
import LeadForm from '@/app/components/LeadForm';

export const metadata = {
  title: 'Diagnostika vozidla Bratislava — od 30 €',
  description: 'Svieti kontrolka motora? Zistíme presnú príčinu, nielen chybový kód. Univerzálna diagnostika 30 €, originálna 50 €. Bratislava – Podunajské Biskupice, Po–Pi 8:00–16:00.',
  alternates: { canonical: 'https://autoalma.sk/diagnostika-vozidiel' },
  openGraph: {
    title: 'Diagnostika vozidla Bratislava | AutoAlma Servis',
    description: 'Zistíme, prečo svieti kontrolka — a čo to bude stáť. Od 30 €, Bratislava – Podunajské Biskupice.',
    url: 'https://autoalma.sk/diagnostika-vozidiel',
    type: 'website',
    locale: 'sk_SK',
  },
};

/* ─────────────────────────────────────────────────────────────
   KONTROLKY NA PRÍSTROJOVEJ DOSKE
   Bežné výstražné symboly — človek podľa nich spozná, čo mu svieti,
   ešte než zdvihne telefón.
   ───────────────────────────────────────────────────────────── */
const kontrolky = [
  {
    nazov: 'Motor',
    popis: 'Chyba v riadení motora. Ak bliká, prestaňte jazdiť — hrozí poškodenie filtra.',
    farba: '#f59e0b',
    svg: (
      <g>
        <path d="M14 22 h5 l3-4 h6 l2 3 h6 v5 h4 v8 h-4 v5 h-8 l-3-4 h-6 l-2 3 h-3 z" />
        <path d="M24 22 v-4 M30 44 v3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    nazov: 'DPF filter',
    popis: 'Filter pevných častíc je zanesený. Regenerácia sa nedokončila.',
    farba: '#f59e0b',
    svg: (
      <g>
        <rect x="14" y="20" width="28" height="18" rx="4" />
        <path d="M20 24 v10 M26 24 v10 M32 24 v10 M38 24 v10" strokeLinecap="round" />
        <path d="M8 29 h6 M42 29 h6" strokeLinecap="round" />
      </g>
    ),
  },
  {
    nazov: 'ABS',
    popis: 'Protiblokovací systém je vyradený. Brzdy fungujú, ale bez ABS.',
    farba: '#f59e0b',
    svg: (
      <g>
        <circle cx="28" cy="29" r="12" />
        <path d="M28 17 v3 M28 38 v3 M16 29 h3 M37 29 h3" strokeLinecap="round" />
        <text x="28" y="33" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">ABS</text>
      </g>
    ),
  },
  {
    nazov: 'AdBlue',
    popis: 'Chyba systému AdBlue. Po čase auto nenaštartujete.',
    farba: '#f59e0b',
    svg: (
      <g>
        <path d="M22 18 h12 v6 l4 6 v14 a2 2 0 0 1-2 2 H20 a2 2 0 0 1-2-2 V30 l4-6 z" />
        <path d="M22 36 h12" strokeLinecap="round" />
      </g>
    ),
  },
  {
    nazov: 'Airbag',
    popis: 'Systém airbagov hlási poruchu — pri náraze nemusí zafungovať.',
    farba: '#ef4444',
    svg: (
      <g>
        <circle cx="20" cy="34" r="6" />
        <path d="M26 34 c4-8 12-12 18-10 M38 20 a6 6 0 1 0 8 8" />
      </g>
    ),
  },
  {
    nazov: 'Batéria',
    popis: 'Nedobíja sa. Príčinou býva alternátor, remeň alebo samotná batéria.',
    farba: '#ef4444',
    svg: (
      <g>
        <rect x="14" y="22" width="28" height="16" rx="3" />
        <path d="M20 19 v3 M34 19 v3 M21 30 h6 M33 27 v6 M30 30 h6" strokeLinecap="round" />
      </g>
    ),
  },
];

const riesime = [
  { t: 'Kontrolka motora', d: 'Chybové kódy motora, snímače, vstrekovanie, turbo, strata výkonu.' },
  { t: 'ABS a podvozok', d: 'Chyby ABS, ESP, snímače otáčok kolies, riadiace jednotky.' },
  { t: 'AdBlue a emisie', d: 'Hlásenia AdBlue, blokovanie štartu, EGR, lambda sondy.' },
  { t: 'DPF a regenerácie', d: 'Tlaky vo výfuku, nedokončené regenerácie, núdzový režim.' },
  { t: 'Elektrické závady', d: 'Hľadanie skratu, vybíjanie batérie, nefunkčná elektronika.' },
  { t: 'Kľúče a jednotky', d: 'Nahratie nových kľúčov, oprava budíkov, RJM, chiptuning.' },
];

const kroky = [
  { n: '1', t: 'Vypočujeme si vás', d: 'Kedy sa to deje, za studena či za tepla, pri akých otáčkach. Toto je polovica úspechu.' },
  { n: '2', t: 'Načítame jednotky', d: 'Nielen motor — všetky riadiace jednotky v aute a ich uložené aj aktuálne chyby.' },
  { n: '3', t: 'Overíme dáta', d: 'Pozrieme sa na živé hodnoty snímačov. Chybový kód ukazuje na okruh, nie na pokazený diel.' },
  { n: '4', t: 'Nájdeme príčinu', d: 'Meraním overíme, či je chyba v snímači, v kabeláži, alebo v mechanike.' },
  { n: '5', t: 'Povieme, čo s tým', d: 'Zrozumiteľne: čo je pokazené, čo to bude stáť a čo znesie odklad.' },
];

const porovnanie = [
  ['Prečítanie chybových kódov', true, true],
  ['Živé hodnoty snímačov', true, true],
  ['Väčšina bežných porúch', true, true],
  ['Špeciálne testy výrobcu', false, true],
  ['Kódovanie riadiacich jednotiek', false, true],
  ['Servisné funkcie a adaptácie', false, true],
  ['Novšie a zložitejšie vozidlá', false, true],
];

const faqs = [
  {
    q: 'Aký je rozdiel medzi univerzálnou a originálnou diagnostikou?',
    a: 'Univerzálna diagnostika (30 €) prečíta chyby a základné hodnoty naprieč značkami — na väčšinu porúch stačí. Originálna diagnostika (50 €) používa softvér daného výrobcu a vidí do auta rovnako ako značkový servis: špeciálne testy, kódovanie jednotiek, servisné funkcie. Pri zložitejších alebo novších autách sa oplatí ísť rovno do nej.',
  },
  {
    q: 'Zistíte príčinu vždy?',
    a: 'Väčšinu porúch odhalíme počas jednej návštevy. Chyby, ktoré sa objavujú náhodne — napríklad prerušený kontakt, ktorý sa prejaví len za jazdy v daždi — si niekedy vyžadujú dlhšie meranie. Vždy vám povieme, kde sme, čo sme vylúčili a čo je ďalší krok.',
  },
  {
    q: 'Dozviem sa cenu opravy hneď?',
    a: 'Po diagnostike vám pošleme cenovú ponuku do mobilu. Kým ju nepotvrdíte, na aute nepracujeme. Žiadne prekvapenie na faktúre.',
  },
  {
    q: 'Stačí len vymazať chybu?',
    a: 'Vymazanie kontrolky bez opravy príčiny je len odklad — chyba sa vráti a niekedy medzitým stihne poškodiť drahší diel. Preto chyby mažeme až po tom, čo je príčina odstránená.',
  },
  {
    q: 'Môžem počkať na mieste?',
    a: 'Áno, samotná diagnostika je krátka a môžete počkať priamo u nás. Ak z nej vyjde väčšia oprava, dohodneme sa na termíne — a v rámci Bratislavy vás odvezieme, kam potrebujete.',
  },
  {
    q: 'Robíte diagnostiku aj na moju značku?',
    a: 'Bežné európske aj ázijské značky riešime denne. Ak si nie ste istí, zavolajte na 0940 449 449 a povieme vám to hneď.',
  },
];

export default function DiagnostikaVozidielPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Diagnostika vozidla',
    serviceType: 'Autodiagnostika a elektroservis',
    description: 'Diagnostika vozidla v Bratislave — zistenie príčiny svietiacej kontrolky, chyby ABS, AdBlue, DPF a elektrických závad.',
    areaServed: { '@type': 'City', name: 'Bratislava' },
    offers: { '@type': 'Offer', priceCurrency: 'EUR', price: '30', description: 'Univerzálna diagnostika 30 €, originálna diagnostika 50 €' },
    provider: {
      '@type': 'AutoRepair',
      name: 'AutoAlma Servis',
      telephone: '+421940449449',
      url: 'https://autoalma.sk',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Ulica Svornosti 119',
        addressLocality: 'Bratislava',
        addressRegion: 'Podunajské Biskupice',
        postalCode: '821 06',
        addressCountry: 'SK',
      },
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      {/* HERO */}
      <section className="pt-28 md:pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.14),transparent_60%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 mb-4 italic">
              Bratislava – Podunajské Biskupice
            </p>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-black uppercase italic tracking-tighter leading-[0.95] mb-6">
              Svieti kontrolka? <span className="text-red-600">Zistíme presne prečo</span>
            </h1>
            <p className="text-zinc-200 text-base md:text-lg font-bold leading-relaxed mb-4">
              Chybový kód ukáže, kde hľadať — nie čo je pokazené. My to dohľadáme meraním
              a povieme vám to bez technického žargónu.
            </p>
            <p className="text-zinc-400 text-sm md:text-base font-bold leading-relaxed mb-8">
              Univerzálna diagnostika 30 €, originálna 50 €. Cenu prípadnej opravy schválite vopred.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-lg">
              <Link href="/objednavka"
                className="flex-1 bg-red-600 hover:bg-red-500 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl shadow-red-600/25 hover:scale-[1.03] text-center">
                📅 Objednať diagnostiku
              </Link>
              <a href="tel:0940449449"
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
                📞 0940 449 449
              </a>
            </div>
          </div>

          {/* PRÍSTROJOVÁ DOSKA */}
          <div className="bg-zinc-950/80 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-5 text-center">
              Čo vám svieti na doske
            </p>
            <div className="grid grid-cols-3 gap-3">
              {kontrolky.map((k, i) => (
                <div key={i} className="bg-black border border-zinc-900 rounded-xl p-3 text-center">
                  <svg viewBox="0 0 56 56" className="w-full h-auto max-w-[56px] mx-auto mb-2"
                    fill="none" stroke={k.farba} strokeWidth="2.2" strokeLinejoin="round" role="img"
                    aria-label={`Kontrolka ${k.nazov}`}>
                    {k.svg}
                  </svg>
                  <p className="text-white text-[10px] font-black uppercase tracking-wide">{k.nazov}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {kontrolky.slice(0, 3).map((k, i) => (
                <p key={i} className="text-zinc-400 text-xs font-bold leading-relaxed">
                  <span className="text-zinc-200">{k.nazov}:</span> {k.popis}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { v: '30 €', l: 'univerzálna diagnostika' },
            { v: '50 €', l: 'originálna, ako v značkovom servise' },
            { v: '4,6 ★', l: '148 hodnotení na Google' },
            { v: '12 mes.', l: 'záruka na vykonanú prácu' },
          ].map((p, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-6">
              <p className="text-white text-xl md:text-2xl font-black italic tracking-tight leading-none mb-2">{p.v}</p>
              <p className="text-zinc-400 text-[11px] md:text-xs font-bold leading-snug">{p.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ČO RIEŠIME */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Čo vieme nájsť</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Diagnostika nie je len čítanie kódov</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {riesime.map((p, i) => (
              <div key={i} className="bg-black border border-zinc-900 hover:border-red-600/40 rounded-2xl p-7 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/30 flex items-center justify-center mb-4">
                  <span className="text-red-500 font-black italic text-sm">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{p.t}</p>
                <p className="text-zinc-400 text-sm font-bold leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AKO TO PREBIEHA */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Krok po kroku</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Ako u nás prebieha diagnostika</h2>
          </div>
          <ol className="relative border-l border-zinc-800 ml-5 space-y-8">
            {kroky.map((s, i) => (
              <li key={i} className="relative pl-10">
                <span className="absolute -left-5 top-0 w-10 h-10 rounded-full bg-red-600 text-white font-black italic flex items-center justify-center shadow-lg shadow-red-600/30">
                  {s.n}
                </span>
                <p className="text-white font-black uppercase italic tracking-tight text-lg mb-2">{s.t}</p>
                <p className="text-zinc-400 text-sm md:text-base font-bold leading-relaxed max-w-2xl">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* POROVNANIE */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Ktorá vám stačí</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Univerzálna či originálna</h2>
          </div>
          <div className="bg-black border border-zinc-900 rounded-[2rem] overflow-hidden">
            <div className="grid grid-cols-[1fr_84px_84px] px-6 py-4 border-b border-zinc-900 bg-zinc-950">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Čo zahŕňa</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 text-center">30 €</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500 text-center">50 €</span>
            </div>
            {porovnanie.map(([t, a, b], i) => (
              <div key={i} className="grid grid-cols-[1fr_84px_84px] px-6 py-4 border-b border-zinc-900 last:border-0 items-center">
                <span className="text-zinc-300 text-sm font-bold pr-4">{t}</span>
                <span className={`text-center font-black ${a ? 'text-green-500' : 'text-zinc-700'}`}>{a ? '✓' : '—'}</span>
                <span className={`text-center font-black ${b ? 'text-green-500' : 'text-zinc-700'}`}>{b ? '✓' : '—'}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-zinc-400 text-sm font-bold mt-6">
            Neviete si vybrať? Zavolajte a podľa značky a roku výroby vám povieme, ktorá dáva zmysel.
          </p>
        </div>
      </section>

      {/* ONLINE PREDDIAGNOSTIKA */}
      <section className="px-6 py-14 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-950/50 via-zinc-950 to-zinc-950 border border-blue-900/40 rounded-[2rem] p-8 md:p-12 text-center">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.4em] mb-4">Ešte než k nám prídete</p>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter mb-4">
            Skúste našu <span className="text-blue-400">online diagnostiku</span>
          </h2>
          <p className="text-zinc-300 font-bold text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            Opíšte, čo auto robí. Systém vám položí niekoľko upresňujúcich otázok
            a napíše, čo to najpravdepodobnejšie je. Zadarmo a bez registrácie.
          </p>
          <Link href="/diagnostika"
            className="inline-block bg-zinc-900 hover:bg-zinc-800 border border-blue-500/30 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all">
            Spustiť online diagnostiku →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Než zavoláte</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Časté otázky</h2>
          </div>
          <div className="divide-y divide-zinc-900 border-y border-zinc-900">
            {faqs.map((f, i) => (
              <details key={i} className="group" open={i === 0}>
                <summary className="cursor-pointer list-none py-6 flex items-start justify-between gap-6">
                  <h3 className="text-white font-black text-base md:text-lg group-hover:text-red-500 transition-colors">{f.q}</h3>
                  <span className="text-red-600 text-xl font-black shrink-0 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-zinc-300 text-sm md:text-base font-bold leading-relaxed pb-7 pr-10">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FORMULÁR */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Neviete, čo autu je?</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Opíšte to vlastnými slovami</h2>
            <p className="text-zinc-300 font-bold text-sm mt-4">
              Ozveme sa a povieme, čo to môže byť a či to znesie odklad.
            </p>
          </div>
          <LeadForm
            sluzba="Diagnostika"
            placeholder="Napr. svieti kontrolka motora, auto trhá pri rozbehu a za studena horšie štartuje..."
          />
        </div>
      </section>

      {/* PÄTIČKA */}
      <footer className="px-6 py-12 border-t border-zinc-900 text-center bg-zinc-950">
        <p className="font-black uppercase italic tracking-tighter text-lg mb-3">
          Auto<span className="text-red-600">Alma</span>
        </p>
        <p className="text-zinc-400 text-sm font-bold">
          Ulica Svornosti 119, 821 06 Bratislava – Podunajské Biskupice<br />
          Po–Pi 8:00–16:00 · <a href="tel:0940449449" className="text-red-500 hover:underline">0940 449 449</a>
        </p>
        <Link href="/" className="inline-block mt-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
          ← Všetky naše služby
        </Link>
      </footer>

      <StickyCta source="diagnostika" />
    </div>
  );
}
