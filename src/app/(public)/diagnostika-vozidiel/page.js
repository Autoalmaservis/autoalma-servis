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

const riesime = [
  { icon: '🟠', t: 'Kontrolka motora', d: 'Chybové kódy motora, snímače, vstrekovanie, turbo, nedostatok výkonu.' },
  { icon: '🛑', t: 'ABS a podvozok', d: 'Chyby ABS, ESP, snímače otáčok kolies, riadiace jednotky.' },
  { icon: '💧', t: 'AdBlue a emisie', d: 'Hlásenia o AdBlue, blokovanie štartu, EGR, lambda sondy.' },
  { icon: '🌫️', t: 'DPF a regenerácie', d: 'Tlaky vo výfuku, nedokončené regenerácie, núdzový režim.' },
  { icon: '🔌', t: 'Elektrické závady', d: 'Hľadanie skratu, vybíjanie batérie, nefunkčná elektronika.' },
  { icon: '🔑', t: 'Kľúče a jednotky', d: 'Nahratie nových kľúčov, oprava budíkov, RJM, chiptuning.' },
];

const kroky = [
  { n: '1', t: 'Vypočujeme si vás', d: 'Kedy sa to deje, za studena či za tepla, pri akých otáčkach. Toto je polovica úspechu.' },
  { n: '2', t: 'Načítame jednotky', d: 'Nielen motor — všetky riadiace jednotky v aute a ich uložené aj aktuálne chyby.' },
  { n: '3', t: 'Overíme namerané dáta', d: 'Pozrieme sa na živé hodnoty snímačov. Chybový kód ukazuje na okruh, nie na pokazený diel.' },
  { n: '4', t: 'Nájdeme príčinu', d: 'Meraním overíme, či je chyba v snímači, v kabeláži, alebo v mechanike.' },
  { n: '5', t: 'Povieme, čo s tým', d: 'Zrozumiteľne a bez žargónu: čo je pokazené, čo to bude stáť a čo znesie odklad.' },
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
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: '30',
      description: 'Univerzálna diagnostika 30 €, originálna diagnostika 50 €',
    },
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
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/10 via-transparent to-transparent pointer-events-none" />
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 mb-4 italic">
          Bratislava – Podunajské Biskupice
        </p>
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.95] mb-6 max-w-4xl mx-auto">
          Svieti kontrolka? <span className="text-red-600">Zistíme presne prečo</span>
        </h1>
        <p className="text-zinc-200 text-base md:text-xl font-bold max-w-2xl mx-auto leading-relaxed mb-3">
          Chybový kód ukáže, kde hľadať — nie čo je pokazené. My to dohľadáme meraním
          a povieme vám to bez technického žargónu.
        </p>
        <p className="text-zinc-400 text-sm md:text-base font-bold max-w-2xl mx-auto leading-relaxed mb-9">
          Univerzálna diagnostika 30 €, originálna 50 €. Cenu prípadnej opravy schválite vopred.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full max-w-lg mx-auto">
          <Link href="/objednavka"
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl shadow-red-600/25 hover:scale-[1.03] text-center">
            📅 Objednať diagnostiku
          </Link>
          <a href="tel:0940449449"
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
            📞 0940 449 449
          </a>
        </div>

        <div className="w-full max-w-4xl mx-auto mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { v: '30 €', l: 'univerzálna diagnostika' },
            { v: '50 €', l: 'originálna, ako v značkovom servise' },
            { v: '4,6 ★', l: '148 hodnotení na Google' },
            { v: '12 mes.', l: 'záruka na vykonanú prácu' },
          ].map((p, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-6 text-left">
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
              <div key={i} className="bg-black border border-zinc-900 rounded-2xl p-7">
                <span className="text-3xl block mb-4">{p.icon}</span>
                <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{p.t}</p>
                <p className="text-zinc-400 text-sm font-bold leading-relaxed">{p.d}</p>
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
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Ako u nás prebieha diagnostika</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {kroky.map((s, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-7 flex gap-5">
                <span className="text-red-600 font-black italic text-3xl leading-none shrink-0">{s.n}</span>
                <div>
                  <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{s.t}</p>
                  <p className="text-zinc-400 text-sm font-bold leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ONLINE PREDDIAGNOSTIKA */}
      <section className="px-6 py-12">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-950/40 via-zinc-950 to-zinc-950 border border-blue-900/40 rounded-[2rem] p-8 md:p-10 text-center">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.4em] mb-4">Ešte než k nám prídete</p>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter mb-4">
            Skúste našu <span className="text-blue-400">online diagnostiku</span>
          </h2>
          <p className="text-zinc-300 font-bold text-sm max-w-xl mx-auto mb-7 leading-relaxed">
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
      <footer className="px-6 py-12 border-t border-zinc-900 text-center">
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
