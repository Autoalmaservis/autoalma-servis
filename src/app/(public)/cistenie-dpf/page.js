import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import StickyCta from '@/app/components/StickyCta';
import LeadForm from '@/app/components/LeadForm';
import FotoMiesto from '@/app/components/FotoMiesto';

export const metadata = {
  title: 'Čistenie DPF filtra Bratislava — od 130 €',
  description: 'Vyčistíme zanesený DPF filter, katalyzátor aj EGR bez výmeny za nový. Bratislava – Podunajské Biskupice, od 130 €. Meriame priepustnosť pred aj po čistení. Objednajte sa online.',
  alternates: { canonical: 'https://autoalma.sk/cistenie-dpf' },
  openGraph: {
    title: 'Čistenie DPF filtra Bratislava | AutoAlma Servis',
    description: 'Zanesený DPF vyčistíme namiesto výmeny za nový. Od 130 €, Bratislava – Podunajské Biskupice.',
    url: 'https://autoalma.sk/cistenie-dpf',
    type: 'website',
    locale: 'sk_SK',
  },
};

/* ─────────────────────────────────────────────────────────────
   SCHÉMA FILTRA — rez stenovým DPF filtrom.
   Výfukové plyny vchádzajú do kanálikov, ktoré sú na konci zaslepené,
   takže musia prejsť cez poréznu stenu. Sadze a popol zostanú vnútri.
   Ľavý obrázok ukazuje zanesený filter, pravý vyčistený.
   ───────────────────────────────────────────────────────────── */
function SchemaFiltra({ zaneseny }) {
  const kanaliky = [0, 1, 2, 3, 4, 5];
  const vyskaKanalika = 15;
  // Hrúbka usadenín na stene kanálika. Rozdiel musí byť viditeľný na prvý pohľad.
  const sadze = zaneseny ? 5.4 : 1;
  const akcent = zaneseny ? '#b91c1c' : '#15803d';

  return (
    <svg viewBox="0 0 340 132" className="w-full h-auto" role="img"
      aria-label={zaneseny ? 'Rez zaneseným DPF filtrom — kanáliky zúžené vrstvou sadzí' : 'Rez vyčisteným DPF filtrom — kanáliky voľne priechodné'}>
      {/* keramické teleso */}
      <rect x="52" y="14" width="236" height="104" rx="10" fill="#18181b" stroke={akcent} strokeWidth="2" />

      {kanaliky.map((i) => {
        const y = 20 + i * (vyskaKanalika + 2);
        const zatkaVzadu = i % 2 === 0;
        return (
          <g key={i}>
            {/* voľný priechod pre plyn */}
            <rect x="58" y={y + sadze} width="224" height={vyskaKanalika - sadze * 2} fill="#d4d4d8" />
            {/* usadené sadze a popol na stenách */}
            <rect x="58" y={y} width="224" height={sadze} fill="#57534e" />
            <rect x="58" y={y + vyskaKanalika - sadze} width="224" height={sadze} fill="#57534e" />
            {/* zátka — núti plyn prejsť cez poréznu stenu */}
            {zatkaVzadu
              ? <rect x="272" y={y} width="10" height={vyskaKanalika} fill="#dc2626" />
              : <rect x="58" y={y} width="10" height={vyskaKanalika} fill="#dc2626" />}
          </g>
        );
      })}

      {/* vstup a výstup */}
      <path d="M14 60 h32 M14 72 h32" stroke="#71717a" strokeWidth="2.5" />
      <polygon points="52,66 40,58 40,74" fill="#71717a" />
      <path d="M294 60 h32 M294 72 h32" stroke="#71717a" strokeWidth="2.5" />
      <polygon points="340,66 328,58 328,74" fill="#71717a" />

      <text x="14" y="10" fill={akcent} fontSize="10" fontWeight="700" letterSpacing="1">
        {zaneseny ? 'ZANESENÝ FILTER' : 'PO VYČISTENÍ'}
      </text>
      <text x="14" y="128" fill="#71717a" fontSize="9" fontWeight="700">VÝFUKOVÉ PLYNY</text>
      <text x="252" y="128" fill="#71717a" fontSize="9" fontWeight="700">VÝSTUP</text>
    </svg>
  );
}

/* Malá legenda k schéme */
function LegendaSchemy() {
  const polozky = [
    { farba: '#d4d4d8', text: 'voľný priechod' },
    { farba: '#57534e', text: 'sadze a popol' },
    { farba: '#dc2626', text: 'zátka kanálika' },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-4">
      {polozky.map((p, i) => (
        <span key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
          <span className="w-3 h-3 rounded-sm" style={{ background: p.farba }} />
          {p.text}
        </span>
      ))}
    </div>
  );
}

/* Ikony príznakov — jednoduché, aby fungovali aj v malej veľkosti */
const Ikona = ({ d, viacCiar }) => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
    {viacCiar && viacCiar.map((c, i) => <path key={i} d={c} />)}
  </svg>
);

const priznaky = [
  {
    title: 'Svieti kontrolka DPF',
    desc: 'Alebo kontrolka motora, ktorá sa po chvíli jazdy vráti.',
    d: 'M12 3 L21 19 H3 Z',
    viacCiar: ['M12 10 v4', 'M12 16.5 v.01'],
  },
  {
    title: 'Auto stratilo výkon',
    desc: 'Nezrýchľuje ako predtým, prípadne spadne do núdzového režimu.',
    d: 'M3 18 h18',
    viacCiar: ['M5 18 V13', 'M10 18 V10', 'M15 18 V14', 'M20 18 V16'],
  },
  {
    title: 'Vyššia spotreba',
    desc: 'Motor sa neustále pokúša o regeneráciu a spaľuje palivo navyše.',
    d: 'M6 21 V6 a2 2 0 0 1 2-2 h4 a2 2 0 0 1 2 2 v15',
    viacCiar: ['M4 21 h12', 'M16 10 h2 a2 2 0 0 1 2 2 v5 a1.5 1.5 0 0 0 3 0 V9 l-3-3'],
  },
  {
    title: 'Časté regenerácie',
    desc: 'Ventilátor beží aj po vypnutí motora a cítiť horúci zápach.',
    d: 'M12 4 a8 8 0 1 1-8 8',
    viacCiar: ['M4 5 v7 h7'],
  },
  {
    title: 'Stúpa hladina oleja',
    desc: 'Nedokončené regenerácie riedia olej naftou — to už je vážne.',
    d: 'M12 3 c4 5 6 7.5 6 10.5 a6 6 0 0 1-12 0 C6 10.5 8 8 12 3 Z',
    viacCiar: ['M9 14 h6'],
  },
  {
    title: 'Dymí z výfuku',
    desc: 'Čierny alebo modrastý dym pri akcelerácii.',
    d: 'M4 18 h13 a3 3 0 0 0 0-6 h-1',
    viacCiar: ['M4 13 h6 a2.5 2.5 0 0 0 0-5', 'M4 8 h3'],
  },
];

const kroky = [
  { n: '1', t: 'Diagnostika', d: 'Načítame chybové kódy a hodnoty zo snímačov tlaku — či je problém naozaj vo filtri, alebo len v snímači.' },
  { n: '2', t: 'Demontáž', d: 'Filter vyberieme z auta. Chemikália naliata do výfuku za jazdy zanesený filter nezachráni.' },
  { n: '3', t: 'Vyčistenie', d: 'Vymontovaný filter prečistíme a prepláchneme, kým z neho neodíde usadený popol a sadze.' },
  { n: '4', t: 'Kontrola', d: 'Zmeriame, či filter naozaj pustí vzduch tak, ako má. Ak nie, poviem vám to rovno.' },
  { n: '5', t: 'Montáž', d: 'Vrátime filter, vymažeme chyby a vynulujeme adaptácie regenerácie.' },
  { n: '6', t: 'Testovacia jazda', d: 'Overíme, že tlaky sedia a auto ide tak, ako má.' },
];

const cennik = [
  { name: 'Čistenie DPF — menšie', note: 'vymontované z auta', price: '130 €' },
  { name: 'Čistenie DPF — väčšie', note: 'vymontované z auta', price: '150 €' },
  { name: 'Čistenie katalyzátora', note: 'vymontované z auta', price: '110 €' },
  { name: 'Čistenie EGR chladiča', note: 'vymontované z auta', price: '60 €' },
  { name: 'Diagnostika', note: 'univerzálna / originálna', price: '30 € / 50 €' },
];

const faqs = [
  {
    q: 'Oplatí sa čistenie, alebo mám kúpiť nový filter?',
    a: 'Vo väčšine prípadov sa filter dá vyčistiť a vydrží ďalšie desaťtisíce kilometrov — za zlomok ceny nového dielu. Vyčistenie nemá zmysel len vtedy, keď je teleso prasknuté alebo je keramická vložka roztavená či rozpadnutá. To zistíme pri demontáži a povieme vám to skôr, než začneme čistiť.',
  },
  {
    q: 'Ako dlho to trvá?',
    a: 'Bežne to zvládneme v priebehu jedného dňa. Presnejšie to vieme povedať po diagnostike a demontáži — záleží na tom, ako je filter v aute umiestnený a v akom je stave.',
  },
  {
    q: 'Prečo nestačí prípravok z benzínky?',
    a: 'Prípravky liate do nádrže alebo do výfuku pomôžu nanajvýš pri filtri, ktorý je mierne zanesený sadzami. Popol z prísad v oleji sa nimi neodstráni — a práve ten filter po čase upchá. Preto filter vyberáme a čistíme mimo auta.',
  },
  {
    q: 'Nemôžete mi DPF radšej vyradiť softvérovo?',
    a: 'Vozidlo s odstráneným filtrom neprejde emisnou kontrolou a jazda s ním po ceste nie je legálna. Preto filtre čistíme a opravujeme, nie odstraňujeme.',
  },
  {
    q: 'Riešite aj AdBlue a EGR?',
    a: 'Áno. Chyby AdBlue systému, EGR ventil aj EGR chladič sú u nás bežná práca — často idú ruka v ruke so zaneseným DPF.',
  },
  {
    q: 'Ako sa dozviem cenu vopred?',
    a: 'Po diagnostike vám pošleme cenovú ponuku do mobilu. Kým ju nepotvrdíte, nezačneme pracovať. Na vykonanú prácu dávame záruku 12 mesiacov.',
  },
];

export default function CistenieDpfPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Čistenie DPF filtra',
    serviceType: 'Čistenie DPF filtra, katalyzátora a EGR',
    description: 'Čistenie zaneseného DPF filtra, katalyzátora a EGR chladiča bez výmeny za nový diel. Bratislava – Podunajské Biskupice.',
    areaServed: { '@type': 'City', name: 'Bratislava' },
    offers: { '@type': 'Offer', priceCurrency: 'EUR', price: '130', description: 'Čistenie DPF filtra od 130 €' },
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(220,38,38,0.14),transparent_60%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 mb-4 italic">
              Bratislava – Podunajské Biskupice
            </p>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-black uppercase italic tracking-tighter leading-[0.95] mb-6">
              Čistenie DPF filtra <span className="text-red-600">bez výmeny za nový</span>
            </h1>
            <p className="text-zinc-200 text-base md:text-lg font-bold leading-relaxed mb-4">
              Filter vyberieme z auta, prečistíme a zmeriame, či naozaj pustí vzduch tak, ako má.
              Od 130 € — namiesto ceny nového dielu.
            </p>
            <p className="text-zinc-400 text-sm md:text-base font-bold leading-relaxed mb-8">
              Ak sa filter zachrániť nedá, poviem vám to hneď po demontáži — nie až po zaplatení.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-lg">
              <Link href="/objednavka"
                className="flex-1 bg-red-600 hover:bg-red-500 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl shadow-red-600/25 hover:scale-[1.03] text-center">
                📅 Objednať termín
              </Link>
              <a href="tel:0940449449"
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
                📞 0940 449 449
              </a>
            </div>
          </div>

          {/* SCHÉMA — pred a po */}
          <div className="bg-zinc-950/80 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-5 text-center">
              Čo sa vo filtri deje
            </p>
            <div className="space-y-4">
              <div className="rounded-2xl bg-black border border-red-900/40 p-4">
                <SchemaFiltra zaneseny />
              </div>
              <div className="rounded-2xl bg-black border border-green-900/40 p-4">
                <SchemaFiltra />
              </div>
            </div>
            <LegendaSchemy />
            <p className="text-zinc-400 text-xs font-bold leading-relaxed mt-5">
              Kanáliky filtra sú striedavo zaslepené <span className="text-red-500">(červené zátky)</span>, takže
              výfukové plyny musia prejsť cez poréznu stenu. Sadze a popol zostanú vnútri a postupne
              zúžia priechod. Čistením sa tá vrstva odstráni.
            </p>
          </div>
        </div>

        {/* DÔKAZY */}
        <div className="max-w-6xl mx-auto mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { v: 'od 130 €', l: 'čistenie DPF filtra' },
            { v: '4,6 ★', l: '148 hodnotení na Google' },
            { v: '12 mes.', l: 'záruka na vykonanú prácu' },
            { v: 'Meranie', l: 'priepustnosti po čistení' },
          ].map((p, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-6">
              <p className="text-white text-xl md:text-2xl font-black italic tracking-tight leading-none mb-2">{p.v}</p>
              <p className="text-zinc-400 text-[11px] md:text-xs font-bold leading-snug">{p.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRÍZNAKY */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Podľa čoho to spoznáte</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Zanesený DPF sa ozve takto</h2>
            <p className="text-zinc-300 text-sm font-bold mt-4 max-w-xl mx-auto">
              Ak vám sedí čo i len jeden bod, oplatí sa to riešiť skôr, než filter upchá úplne.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {priznaky.map((p, i) => (
              <div key={i} className="bg-black border border-zinc-900 hover:border-red-600/40 rounded-2xl p-7 transition-colors">
                <div className="text-red-500 mb-4"><Ikona d={p.d} viacCiar={p.viacCiar} /></div>
                <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{p.title}</p>
                <p className="text-zinc-400 text-sm font-bold leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AKO TO PREBIEHA */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Krok po kroku</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Ako u nás čistíme DPF</h2>
          </div>

          <ol className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {kroky.map((s, i) => (
              <li key={i} className="relative bg-zinc-950 border border-zinc-900 rounded-2xl p-7 pl-20">
                <span className="absolute left-6 top-7 w-9 h-9 rounded-full bg-red-600 text-white font-black italic text-base flex items-center justify-center shadow-lg shadow-red-600/30">
                  {s.n}
                </span>
                <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{s.t}</p>
                <p className="text-zinc-400 text-sm font-bold leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FOTKY Z DIELNE */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Naša práca</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Ako to u nás vyzerá</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FotoMiesto
              nazov="dpf-vymontovany"
              popis="Vymontovaný zanesený filter položený na pracovnom stole"
              alt="Vymontovaný zanesený DPF filter — AutoAlma Bratislava"
            />
            <FotoMiesto
              nazov="dpf-cistenie"
              popis="Filter v čistiacom zariadení počas prania"
              alt="Čistenie DPF filtra v zariadení — AutoAlma Bratislava"
            />
            <FotoMiesto
              nazov="dpf-po-cisteni"
              popis="Ten istý filter po vyčistení a vysušení"
              alt="DPF filter po vyčistení — AutoAlma Bratislava"
            />
          </div>
          <div className="mt-5">
            <FotoMiesto
              nazov="dpf-meranie"
              popis="Meranie priepustnosti filtra — displej prístroja s nameranou hodnotou"
              alt="Meranie priepustnosti DPF filtra — AutoAlma Bratislava"
              pomer="aspect-[21/9]"
            />
          </div>
        </div>
      </section>

      {/* ČISTIŤ ALEBO VYMENIŤ */}
      <section className="py-20 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Rozhodnutie</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Vyčistiť, alebo vymeniť?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-black border border-green-900/40 rounded-[2rem] p-8">
              <p className="text-green-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Vyčistenie</p>
              <p className="text-white font-black italic text-2xl tracking-tight mb-5">Vo väčšine prípadov</p>
              <ul className="space-y-3">
                {[
                  'Filter je zanesený sadzami a popolom, ale celý',
                  'Keramická vložka nie je popraskaná ani roztavená',
                  'Teleso je bez trhlín a netesností',
                  'Priepustnosť sa po čistení vráti na použiteľnú hodnotu',
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 text-zinc-300 text-sm font-bold leading-relaxed">
                    <span className="text-green-500 shrink-0">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-black border border-red-900/40 rounded-[2rem] p-8">
              <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Výmena</p>
              <p className="text-white font-black italic text-2xl tracking-tight mb-5">Keď už niet čo zachraňovať</p>
              <ul className="space-y-3">
                {[
                  'Keramická vložka je roztavená alebo rozpadnutá',
                  'Teleso filtra je prasknuté',
                  'Filter ani po vyčistení nepustí dostatok vzduchu',
                  'Poškodenie vzniklo prehriatím pri opakovaných regeneráciách',
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 text-zinc-300 text-sm font-bold leading-relaxed">
                    <span className="text-red-500 shrink-0">✕</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-center text-zinc-400 text-sm font-bold mt-8 max-w-2xl mx-auto leading-relaxed">
            Do ktorej skupiny váš filter patrí, zistíme až po demontáži. Poviem vám to skôr,
            než začneme čistiť — aby ste neplatili za prácu, ktorá nemá zmysel.
          </p>
        </div>
      </section>

      {/* CENNÍK */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Koľko to stojí</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Cenník</h2>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden divide-y divide-zinc-900">
            {cennik.map((c, i) => (
              <div key={i} className="px-7 py-5 flex items-center justify-between gap-4 hover:bg-black/40 transition-colors">
                <div>
                  <p className="text-white text-sm font-bold">{c.name}</p>
                  <p className="text-zinc-400 text-[11px] font-bold mt-0.5">{c.note}</p>
                </div>
                <span className="text-red-500 font-black text-sm shrink-0 tabular-nums">{c.price}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-8">
            Ceny s DPH · Demontáž a montáž podľa skutočného času · Cenu schválite pred prácou
          </p>
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
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Nechajte to na nás</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Napíšte, čo auto robí</h2>
            <p className="text-zinc-300 font-bold text-sm mt-4">
              Ozveme sa a povieme, či to vyzerá na DPF — a čo to bude znamenať.
            </p>
          </div>
          <LeadForm
            sluzba="Čistenie DPF"
            placeholder="Napr. svieti kontrolka DPF, auto stratilo výkon a ventilátor beží aj po vypnutí..."
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

      <StickyCta source="dpf" />
    </div>
  );
}
