'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { odkazNaSluzbu } from '@/app/lib/specialneStranky';
import BannerPopup from '@/app/components/BannerPopup';
import HladanieSluzieb from '@/app/components/HladanieSluzieb';
import {
  trackMojaGarazClick, trackPhoneClick, trackContactSubmit, trackBookingCta,
  trackFaqOpen, trackServiceClick, trackReviewsClick, trackMapClick, trackPriceListView,
} from '@/app/lib/analytics';

const services = [
  {
    icon: '🔧',
    name: 'Mechanické práce',
    slug: 'mechanicke-prace',
    items: ['Pravidelný servis', 'Výmena bŕzd', 'Oprava podvozku', 'Výmena rozvodov', 'Čistenie DPF/CAT', 'Spojka a prevodovka', 'Dekarbonizácia'],
  },
  {
    icon: '⚡',
    name: 'Elektro a diagnostika',
    slug: 'elektro-diagnostika',
    items: ['Diagnostika', 'Oprava / hľadanie elektrických závad', 'Chiptuning', 'Oprava ABS', 'Oprava AdBlue', 'Oprava budíkov', 'Nahratie nových kľúčov', 'RJM oprava'],
  },
  {
    icon: '❄️',
    name: 'Klimatizácia',
    slug: 'klimatizacia',
    items: ['Čistenie ozónom', 'Plnenie klimatizácie'],
  },
  {
    icon: '🛞',
    name: 'Pneuservis',
    slug: 'pneuservis',
    items: ['Kódovanie ventilov pneumatík', 'Prehodenie kolies', 'Prezúvanie pneumatiky', 'Vyvažovanie', 'Vyrovnávanie diskov'],
  },
];

// Dôkazy v hlavičke — jediné čísla, ktoré musí zákazník vidieť hneď
const proofs = [
  { value: '4,6 ★', label: '148 hodnotení na Google' },
  { value: '12 mes.', label: 'záruka na vykonanú prácu' },
  { value: 'od 35 €', label: 'normohodina, účtujeme skutočný čas' },
  { value: 'STK', label: 'odvezieme a vybavíme za vás' },
];

const steps = [
  { n: '1', title: 'Objednáte sa', desc: 'Online za dve minúty bez registrácie, alebo telefonicky.' },
  { n: '2', title: 'Prevezmeme auto', desc: 'Spíšeme, čo vás trápi, a spravíme diagnostiku.' },
  { n: '3', title: 'Pošleme cenu', desc: 'Cenová ponuka vám príde do mobilu ešte pred prácou.' },
  { n: '4', title: 'Vy ju schválite', desc: 'Bez vášho súhlasu nezačneme. Žiadne prekvapenie na faktúre.' },
  { n: '5', title: 'Opravíme a otestujeme', desc: 'Každú opravu overíme testovacou jazdou.' },
  { n: '6', title: 'Odovzdáme s faktúrou', desc: 'Doklad aj história vozidla vám zostanú v Mojej Garáži.' },
];

// Recenzie z profilu na Google. Ďalšie pridávaj sem.
const reviews = [
  {
    name: 'Dušan D.',
    text: 'Veľmi spokojný so službami — spoľahlivé, kvalitné a všetko vybavené rýchlo a bez zbytočných komplikácií. Určite odporúčam každému, kto hľadá profesionálny prístup.',
    when: 'pred 4 mesiacmi',
  },
  {
    name: 'Juraj K.',
    text: 'Už niekoľkokrát som využil tento autoservis. Zatiaľ som bol vždy spokojný.',
    when: 'pred 4 mesiacmi',
  },
];

const faqs = [
  {
    q: 'Koľko ma oprava bude stáť?',
    a: 'Normohodina je od 35 € pri osobnom vozidle a od 45 € pri dodávke, účtujeme skutočne odpracovaný čas. Presnú cenu poznáme až po diagnostike — a dozviete sa ju vopred: cenovú ponuku vám pošleme do mobilu a začneme pracovať až vtedy, keď ju schválite.',
  },
  {
    q: 'Vybavíte mi STK a emisnú kontrolu?',
    a: 'Áno, celé to vybavíme za vás — auto pripravíme, odvezieme na stanicu a vrátime vám ho s platnou kontrolou. Cena 140 € zahŕňa aj kontrolu vozidla pred STK, aby ste sa nevrátili s chybou.',
  },
  {
    q: 'Ako dlho budem bez auta?',
    a: 'Výmenu oleja, bŕzd, prezutie či diagnostiku zvládneme na počkanie — môžete počkať priamo v servise. Pri väčších opravách vás v rámci Bratislavy odvezieme, kam potrebujete.',
  },
  {
    q: 'Akú dávate záruku?',
    a: 'Na vykonanú prácu dávame záruku 12 mesiacov. Na diely platí záruka výrobcu, ktorú vám uvedieme na faktúre.',
  },
  {
    q: 'Musím sa registrovať, aby som sa objednal?',
    a: 'Nie. Online objednávka funguje bez registrácie. Moja Garáž je dobrovoľná — dáva vám prístup k stavu opravy, cenovým ponukám, faktúram a histórii vozidla.',
  },
  {
    q: 'Svieti mi kontrolka motora. Viete zistiť prečo?',
    a: 'Áno, to je naša parketa. Univerzálna diagnostika stojí 30 €, originálna (výrobcom autorizovaná) 50 €. Riešime aj ABS, AdBlue, DPF, elektrické závady či nahratie nových kľúčov.',
  },
];

const slogans = [
  { main: 'Férovosť, ktorú cítite', sub: 'nie len čítate' },
  { main: 'Servis, ktorý komunikuje', sub: 'nie iba účtuje' },
  { main: 'Transparentná diagnostika', sub: 'bez technického žargónu' },
];

// Odkazy v hlavičke — rovnaké pre desktop aj pre mobilné menu
const navLinks = [
  { href: '#sluzby', label: 'Naše služby' },
  { href: '#cennik', label: 'Cenník' },
  { href: '#recenzie', label: 'Recenzie' },
  { href: '#faq', label: 'Časté otázky' },
  { href: '#kontakt', label: 'Kontakt' },
];

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [cennik, setCennik] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', plate: '', vehicle: '', year: '', message: '' });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    supabase
      .from('gallery_photos')
      .select('id, url, caption')
      .order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setGalleryPhotos(data); });
    supabase
      .from('business_settings')
      .select('value')
      .eq('id', 'cennik')
      .single()
      .then(({ data }) => { if (data?.value) setCennik(JSON.parse(data.value)); });
  }, []);

  // Dopozeranie k cenníku je najsilnejší signál nákupného zámeru pred konverziou.
  // Pošleme ho raz za návštevu, keď sa sekcia naozaj dostane na obrazovku.
  useEffect(() => {
    if (cennik.length === 0) return;
    const el = document.getElementById('cennik');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let sent = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !sent) {
          sent = true;
          trackPriceListView();
          io.disconnect();
        }
      });
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [cennik]);

  const goToBooking = (source) => {
    trackBookingCta(source);
    router.push('/objednavka');
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSending(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
    } catch {}
    // E-mail a telefón idú do Ads pre rozšírené konverzie — hashujú sa
    // v prehliadači, samotné kontakty Googlu neodchádzajú.
    trackContactSubmit({ email: contactForm.email, phone: contactForm.phone });
    setContactSent(true);
    setContactForm({ name: '', email: '', phone: '', plate: '', vehicle: '', year: '', message: '' });
    setContactSending(false);
  };

  const toSlug = (str) =>
    str.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\//g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    name: 'AutoAlma Servis',
    description: 'Autoservis v Bratislave – Podunajských Biskupiciach. Mechanické práce, elektrodiagnostika, klimatizácia, pneuservis, čistenie DPF a STK.',
    url: 'https://autoalma.sk',
    telephone: '+421940449449',
    email: 'autoalma@autoalma.sk',
    image: 'https://autoalma.sk/autoalma-icon.png',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Ulica Svornosti 119',
      addressLocality: 'Bratislava',
      addressRegion: 'Podunajské Biskupice',
      postalCode: '821 06',
      addressCountry: 'SK',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 48.1257437,
      longitude: 17.1973119,
    },
    areaServed: [
      'Bratislava', 'Podunajské Biskupice', 'Vrakuňa', 'Ružinov',
      'Rovinka', 'Most pri Bratislave', 'Dunajská Lužná',
    ],
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '08:00', closes: '16:00' },
    ],
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    hasMap: 'https://maps.google.com/?q=Ulica+Svornosti+119,+821+06+Bratislava',
    sameAs: ['https://www.google.com/maps/place/Autoalma'],
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
      <BannerPopup />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* NAVIGÁCIA */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25 transition-all duration-300 ${scrolled ? 'shadow-lg shadow-blue-500/5' : ''}`}>
        <div className={`flex items-center justify-between px-6 md:px-12 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>

          {/* LOGO + NAV LINKY */}
          <div className="flex items-center gap-8 md:gap-12">
            <a href="#" className={`font-black uppercase italic tracking-tighter transition-all duration-300 hover:opacity-80 ${scrolled ? 'text-lg' : 'text-2xl'}`}>
              Auto<span className="text-red-600">Alma</span>
            </a>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all rounded-lg hover:bg-white/5 group"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-blue-500 group-hover:w-4/5 transition-all duration-300" />
                </a>
              ))}
              <Link
                href="/diagnostika"
                className="relative px-4 py-2 text-[11px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/5 group"
              >
                Diagnostika
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-red-500 group-hover:w-4/5 transition-all duration-300" />
              </Link>
            </div>
          </div>

          {/* PRAVÁ STRANA */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Telefón je na mobile v lepiacej lište dole, tu by len bral miesto */}
            <a
              href="tel:0940449449"
              onClick={() => trackPhoneClick('nav')}
              className="hidden sm:flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-all"
            >
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              0940 449 449
            </a>

            <div className="hidden md:block w-px h-4 bg-zinc-800" />

            <Link
              href="/login"
              onClick={() => trackMojaGarazClick('nav')}
              className={`bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest transition-all rounded-xl shadow-lg shadow-red-600/20 hover:shadow-red-600/30 ${scrolled ? 'text-[9px] px-4 py-2' : 'text-[10px] px-5 py-2.5'}`}
            >
              <span className="sm:hidden">🏎️ Garáž</span>
              <span className="hidden sm:inline">🏎️ Moja Garáž</span>
            </Link>

            <Link
              href="/system"
              className="hidden md:block text-zinc-800 hover:text-zinc-500 transition-all text-base"
              title="Pre zamestnancov"
            >
              ⚙
            </Link>

            {/* HAMBURGER — na mobile jediná cesta k sekciám stránky */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Zavrieť menu' : 'Otvoriť menu'}
              aria-expanded={menuOpen}
              className="md:hidden flex flex-col justify-center items-center gap-[5px] w-9 h-9 -mr-2 text-white"
            >
              <span className={`block h-[2px] w-5 bg-current transition-all duration-300 ${menuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
              <span className={`block h-[2px] w-5 bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-[2px] w-5 bg-current transition-all duration-300 ${menuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
            </button>
          </div>
        </div>

        {/* ROZBALENÉ MENU NA MOBILE */}
        {menuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-black/95 px-6 py-4 flex flex-col max-h-[70vh] overflow-y-auto">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="py-3 text-[12px] font-black uppercase tracking-widest text-zinc-300 hover:text-white border-b border-zinc-900"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/diagnostika"
              onClick={() => setMenuOpen(false)}
              className="py-3 text-[12px] font-black uppercase tracking-widest text-red-500 border-b border-zinc-900"
            >
              Diagnostika
            </Link>
            <Link
              href="/login"
              onClick={() => { setMenuOpen(false); trackMojaGarazClick('mobilne-menu'); }}
              className="mt-4 bg-red-600 text-white text-center py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-red-600/25"
            >
              🏎️ Moja Garáž — prihlásenie
            </Link>
            <Link
              href="/system"
              onClick={() => setMenuOpen(false)}
              className="mt-3 text-center py-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
            >
              ⚙ Pre zamestnancov
            </Link>
          </div>
        )}

        {/* MODRÁ LINKA DOLE */}
        <div className="nav-stripe" />
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-28 md:pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/10 via-transparent to-transparent pointer-events-none" />

        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 mb-4 italic">
          Bratislava – Podunajské Biskupice · Svornosti 119
        </p>

        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.95] mb-6 max-w-4xl">
          Autoservis, ktorý vám <span className="text-red-600">povie, čo sa deje</span> s vaším autom
        </h1>

        <p className="text-zinc-200 text-base md:text-xl font-bold max-w-2xl leading-relaxed mb-3">
          Servis, diagnostika, klimatizácia, pneuservis aj STK — auto odovzdáte raz
          a vyzdvihnete hotové.
        </p>
        <p className="text-zinc-400 text-sm md:text-base font-bold max-w-2xl leading-relaxed mb-9">
          Počas opravy vidíte v mobile, čo sa s autom robí a čo to bude stáť.
          Cenu schvaľujete vy — nie faktúra na konci.
        </p>

        {/* HĽADANIE SLUŽBY */}
        <HladanieSluzieb services={services} cennik={cennik} toSlug={toSlug} />

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-lg">
          <button
            onClick={() => goToBooking('hero')}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl shadow-red-600/25 hover:shadow-red-600/40 hover:scale-[1.03]"
          >
            📅 Objednať termín
          </button>
          <a
            href="tel:0940449449"
            onClick={() => trackPhoneClick('hero')}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center"
          >
            📞 0940 449 449
          </a>
        </div>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-4">
          Objednanie bez registrácie · Po–Pi 8:00–16:00
        </p>

        {/* DÔKAZY */}
        <div className="w-full max-w-5xl mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {proofs.map((p, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-6 text-left">
              <p className="text-white text-xl md:text-2xl font-black italic tracking-tight leading-none mb-2">{p.value}</p>
              <p className="text-zinc-400 text-[11px] md:text-xs font-bold leading-snug">{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SLOGANY */}
      <section className="py-12 px-6 border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {slogans.map((s, i) => (
            <div key={i}>
              <p className="text-white font-black uppercase italic text-lg tracking-tight">{s.main}</p>
              <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SLUŽBY */}
      <section id="sluzby" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Čo robíme</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Naše Služby</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={i}
                className="bg-zinc-950 border border-zinc-800 p-8 rounded-[2rem] flex flex-col relative overflow-hidden"
              >
                <div className="h-[2px] absolute top-0 left-0 right-0 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                <span className="text-5xl mb-6 block">{s.icon}</span>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-5 text-white">
                  {s.name}
                </h3>
                <ul className="space-y-2 flex-grow">
                  {s.items.map((item, j) => (
                    <li key={j}>
                      <button
                        onClick={() => { trackServiceClick(item, s.name); router.push(odkazNaSluzbu(s.slug, toSlug(item))); }}
                        className="w-full text-left flex items-center gap-3 group/item py-2 px-3 -mx-3 rounded-xl hover:bg-red-600 transition-all duration-200 cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 bg-zinc-600 group-hover/item:bg-white rounded-full shrink-0 transition-colors" />
                        <span className="text-zinc-300 group-hover/item:text-white text-sm font-bold transition-colors">
                          {item}
                        </span>
                        <span className="ml-auto text-zinc-600 group-hover/item:text-white text-xs transition-all">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STK — samostatný ťahák */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto bg-gradient-to-br from-red-950/40 via-zinc-950 to-zinc-950 border border-red-900/40 rounded-[2rem] p-8 md:p-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-4">Nemusíte nikam chodiť</p>
              <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter mb-4">
                STK a emisnú kontrolu <span className="text-red-600">vybavíme za vás</span>
              </h2>
              <p className="text-zinc-300 font-bold text-sm md:text-base leading-relaxed">
                Auto u nás necháte, my ho pripravíme, odvezieme na stanicu a vrátime vám ho
                s platnou kontrolou. V cene 140 € je aj kontrola vozidla pred STK — aby ste
                sa nevrátili s chybou a neplatili dvakrát.
              </p>
            </div>
            <button
              onClick={() => goToBooking('stk')}
              className="bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/25 hover:scale-105 shrink-0 w-full lg:w-auto"
            >
              Objednať STK
            </button>
          </div>
        </div>
      </section>

      {/* AKO TO PREBIEHA */}
      <section id="ako-to-prebieha" className="py-24 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Od objednania po odovzdanie</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Ako to u nás prebieha</h2>
            <p className="text-zinc-300 text-sm font-bold mt-4 max-w-xl mx-auto">
              Nič sa nedeje bez toho, aby ste o tom vedeli.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <div key={i} className="bg-black border border-zinc-900 hover:border-red-600/40 rounded-2xl p-7 flex gap-5 transition-colors">
                <span className="shrink-0 w-10 h-10 rounded-full bg-red-600 text-white font-black italic text-base flex items-center justify-center shadow-lg shadow-red-600/25">{s.n}</span>
                <div>
                  <p className="text-white font-black uppercase italic tracking-tight text-base mb-2">{s.title}</p>
                  <p className="text-zinc-400 text-sm font-bold leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECENZIE */}
      <section id="recenzie" className="py-24 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Čo hovoria zákazníci</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
              4,6 ★ zo 148 hodnotení
            </h2>
            <p className="text-zinc-300 text-sm font-bold mt-4">Hodnotenia na Google, ktoré si viete overiť.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {reviews.map((r, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-7 flex flex-col gap-4">
                <p className="text-yellow-500 text-sm tracking-widest">★★★★★</p>
                <p className="text-zinc-200 text-sm font-bold leading-relaxed flex-grow">„{r.text}“</p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{r.name} · {r.when}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://www.google.com/maps/place/Autoalma"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackReviewsClick()}
              className="inline-block text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-6 py-3 rounded-xl transition-all"
            >
              Pozrieť všetkých 148 recenzií na Google →
            </a>
          </div>
        </div>
      </section>

      {/* MOJA GARÁŽ */}
      <section className="py-24 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">🏎️ Váš online servisný účet</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Moja Garáž</h2>
            <p className="text-zinc-300 text-sm font-bold mt-4 max-w-xl mx-auto">
              Väčšina servisov vám povie cenu až pri preberaní auta. U nás ju schvaľujete vopred — v mobile, bez aplikácie.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: '📡', title: 'Stav opravy naživo', desc: 'Vidíte, čo sa s autom práve deje — bez volania do servisu.' },
              { icon: '📋', title: 'Cenu schvaľujete vy', desc: 'Ponuka príde do mobilu. Kým ju nepotvrdíte, nepracujeme.' },
              { icon: '🚗', title: 'História a faktúry', desc: 'Všetky doklady a servisná karta vozidla na jednom mieste.' },
            ].map((b, i) => (
              <div key={i} className="bg-black border border-zinc-900 hover:border-red-600/30 p-8 rounded-2xl transition-all group">
                <span className="text-4xl block mb-5">{b.icon}</span>
                <p className="text-white text-base font-black uppercase italic tracking-tight mb-2 group-hover:text-red-500 transition-colors">{b.title}</p>
                <p className="text-zinc-400 text-sm font-bold leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/login"
              onClick={() => trackMojaGarazClick('sekcia')}
              className="inline-block bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all"
            >
              🏎️ Aktivovať Moju Garáž
            </Link>
          </div>
        </div>
      </section>

      {/* GALÉRIA — zobrazí sa až keď sú v nej fotky */}
      {galleryPhotos.length > 0 && (
      <section id="galeria" className="py-24 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Naša práca</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Galéria</h2>
          </div>

          {(
            <div className="columns-2 md:columns-3 gap-4">
              {galleryPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="break-inside-avoid mb-4 rounded-2xl overflow-hidden cursor-pointer group relative"
                  onClick={() => setLightbox(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'AutoAlma servis Bratislava'}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-all">
                      <p className="text-white text-xs font-bold">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-w-4xl w-full relative" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption} className="w-full rounded-2xl object-contain max-h-[85vh]" />
            {lightbox.caption && (
              <p className="text-center text-zinc-400 font-bold text-sm mt-4">{lightbox.caption}</p>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-zinc-500 hover:text-white text-2xl font-black transition-colors"
            >✕</button>
          </div>
        </div>
      )}

      {/* CENNÍK */}
      {cennik.length > 0 && (
        <section id="cennik" className="py-24 px-6 border-t border-zinc-900 bg-zinc-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Orientačné ceny</p>
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Cenník</h2>
              <p className="text-zinc-300 text-sm font-bold mt-4 max-w-lg mx-auto">Ceny sú orientačné a závisia od konkrétneho vozidla. Presná cena vždy po diagnostike — a vždy skôr, než začneme.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {cennik.map((cat, ci) => (
                <div key={ci} className="bg-black border border-zinc-900 rounded-[2rem] overflow-hidden">
                  <div className="px-8 py-5 border-b border-zinc-900 flex items-center gap-3">
                    {cat.icon && <span className="text-2xl">{cat.icon}</span>}
                    <h3 className="text-sm font-black uppercase italic tracking-tight text-white">{cat.name}</h3>
                  </div>
                  <div className="divide-y divide-zinc-900">
                    {(cat.items || []).map((item, ii) => (
                      <div key={ii} className="px-8 py-4 flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors">
                        <div>
                          <p className="text-white text-sm font-bold">{item.name}</p>
                          {item.note && <p className="text-zinc-400 text-[11px] font-bold mt-0.5">{item.note}</p>}
                        </div>
                        <span className="text-red-500 font-black text-sm shrink-0">{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-10">
              Hodinová sadzba · Práce účtované podľa skutočného času · Bez skrytých poplatkov
            </p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Než zavoláte</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Časté otázky</h2>
          </div>
          <div className="divide-y divide-zinc-900 border-y border-zinc-900">
            {faqs.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => { if (openFaq !== i) trackFaqOpen(f.q); setOpenFaq(openFaq === i ? -1 : i); }}
                  className="w-full text-left py-6 flex items-start justify-between gap-6 group"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-white font-black text-base md:text-lg group-hover:text-red-500 transition-colors">{f.q}</span>
                  <span className={`text-red-600 text-xl font-black shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <p className="text-zinc-300 text-sm md:text-base font-bold leading-relaxed pb-7 pr-10">{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAKTNÝ FORMULÁR */}
      <section id="napiste-nam" className="py-24 px-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Neviete, čo autu je?</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Napíšte nám</h2>
            <p className="text-zinc-300 font-bold text-sm mt-4">Opíšte problém vlastnými slovami — ozveme sa a povieme, čo s tým.</p>
          </div>

          {contactSent ? (
            <div className="bg-black border border-green-900/50 rounded-[2rem] p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Správa odoslaná</h3>
              <p className="text-zinc-300 font-bold text-sm mb-6">Ozveme sa vám čo najskôr.</p>
              <button
                onClick={() => setContactSent(false)}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all border border-zinc-800 hover:border-zinc-600 px-5 py-2 rounded-xl"
              >
                Odoslať ďalšiu správu
              </button>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="bg-black border border-zinc-900 rounded-[2rem] p-8 md:p-10 space-y-5">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="kf-meno" className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Meno *</label>
                  <input
                    id="kf-meno"
                    required
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ján Novák"
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="kf-tel" className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Telefón *</label>
                  <input
                    id="kf-tel"
                    required
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+421 900 000 000"
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="kf-sprava" className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Čo potrebujete? *</label>
                <textarea
                  id="kf-sprava"
                  required
                  rows={4}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Napr. pri brzdení počuť škrípanie, alebo potrebujem STK a nemám čas to riešiť..."
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <details className="group">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors list-none">
                  + Doplniť údaje o vozidle (nepovinné)
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                  <div className="space-y-2">
                    <label htmlFor="kf-email" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">E-mail</label>
                    <input
                      id="kf-email"
                      type="email"
                      value={contactForm.email}
                      onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="jan@email.sk"
                      className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kf-vozidlo" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vozidlo</label>
                    <input
                      id="kf-vozidlo"
                      value={contactForm.vehicle}
                      onChange={e => setContactForm(p => ({ ...p, vehicle: e.target.value }))}
                      placeholder="napr. Škoda Octavia 2.0 TDI"
                      className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kf-spz" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ŠPZ</label>
                    <input
                      id="kf-spz"
                      value={contactForm.plate}
                      onChange={e => setContactForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))}
                      placeholder="BA123AB"
                      className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors tracking-widest"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kf-rok" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rok výroby</label>
                    <input
                      id="kf-rok"
                      type="number"
                      min="1980"
                      max="2030"
                      value={contactForm.year}
                      onChange={e => setContactForm(p => ({ ...p, year: e.target.value }))}
                      placeholder="napr. 2018"
                      className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </details>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Odpovieme do 24 hodín v pracovné dni</p>
                <button
                  type="submit"
                  disabled={contactSending}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105 hover:shadow-red-600/30"
                >
                  {contactSending ? 'Odosielam...' : 'Odoslať správu'}
                </button>
              </div>

            </form>
          )}
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" className="py-24 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Kde nás nájdete</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Kontakt</h2>
            <p className="text-zinc-300 text-sm font-bold mt-4">
              Bratislava – Podunajské Biskupice. Sme kúsok od Vrakune, Ružinova aj Rovinky.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* TELEFÓNY */}
            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-[2rem]">
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-5">📞 Telefón</p>
              <a href="tel:0940449449" onClick={() => trackPhoneClick('kontakt')} className="flex flex-col group mb-5">
                <span className="text-white font-black text-lg tracking-widest group-hover:text-red-500 transition-colors">0940 449 449</span>
                <span className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-1">Christian Flickinger</span>
                <span className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">Prijímací technik</span>
              </a>
              <div className="h-px bg-zinc-900 mb-5" />
              <a href="tel:0908647227" onClick={() => trackPhoneClick('kontakt')} className="flex flex-col group">
                <span className="text-white font-black text-lg tracking-widest group-hover:text-red-500 transition-colors">0908 647 227</span>
                <span className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-1">Maroš Jurkovič</span>
                <span className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">Diagnostik</span>
              </a>
            </div>

            {/* ADRESA */}
            <a
              href="https://maps.google.com/?q=Ulica+Svornosti+119,+821+06+Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackMapClick('adresa')}
              className="bg-zinc-950 border border-zinc-900 hover:border-red-600/30 p-8 rounded-[2rem] text-center transition-all group cursor-pointer flex flex-col justify-center"
            >
              <span className="text-4xl mb-4 block">📍</span>
              <p className="text-white font-black text-xl group-hover:text-red-500 transition-colors">Ulica Svornosti 119</p>
              <p className="text-zinc-300 font-bold text-sm mt-2">821 06 Bratislava<br />Podunajské Biskupice</p>
              <p className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-4">Po–Pi 8:00–16:00</p>
              <p className="text-red-500 font-black text-[10px] uppercase tracking-widest mt-4">Otvoriť navigáciu →</p>
            </a>

            {/* E-MAILY */}
            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-[2rem] flex flex-col gap-4">
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest">✉️ E-mail</p>
              <a href="mailto:autoalma@autoalma.sk" className="group">
                <p className="text-white font-black text-sm break-all group-hover:text-red-500 transition-colors">autoalma@autoalma.sk</p>
                <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest mt-1">Servis / Všeobecné</p>
              </a>
              <div className="h-px bg-zinc-900" />
              <a href="mailto:maros.jurkovic@autoalma.sk" className="group">
                <p className="text-white font-black text-sm break-all group-hover:text-red-500 transition-colors">maros.jurkovic@autoalma.sk</p>
                <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest mt-1">Maroš Jurkovič · Diagnostik</p>
              </a>
              <div className="h-px bg-zinc-900" />
              <a href="mailto:christian.flickinger@autoalma.sk" className="group">
                <p className="text-white font-black text-sm break-all group-hover:text-red-500 transition-colors">christian.flickinger@autoalma.sk</p>
                <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest mt-1">Christian Flickinger · Príjem</p>
              </a>
            </div>
          </div>

          {/* MAPA */}
          <div className="mt-10 rounded-[2rem] overflow-hidden border border-zinc-900 relative">
            <iframe
              src="https://maps.google.com/maps?q=Ulica+Svornosti+119,+821+06+Bratislava&t=&z=16&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="400"
              style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="AutoAlma Servis – Ulica Svornosti 119, Bratislava"
            />
            <a
              href="https://maps.google.com/?q=Ulica+Svornosti+119,+821+06+Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackMapClick('mapa')}
              className="absolute bottom-4 right-4 bg-black/90 border border-zinc-800 hover:border-red-600/50 text-white font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl transition-all"
            >
              Otvoriť v Maps →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-12 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <p className="font-black uppercase italic tracking-tighter text-lg mb-3">
              Auto<span className="text-red-600">Alma</span>
            </p>
            <p className="text-zinc-500 text-xs font-bold leading-relaxed">
              Autoalma s.r.o. · Tilgnerova 712/3, 841 04 Bratislava<br />
              IČO: 46044876 · DIČ: 2023194316 · IČ DPH: SK2023194316
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
              © {new Date().getFullYear()} Autoalma s.r.o.
            </p>
            <Link
              href="/system"
              className="text-zinc-700 hover:text-zinc-500 text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Pre zamestnancov →
            </Link>
          </div>
        </div>
      </footer>

      {/* LEPIACA LIŠTA NA MOBILE */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-3 py-3 flex gap-3">
        <a
          href="tel:0940449449"
          onClick={() => trackPhoneClick('sticky')}
          className="flex-1 bg-zinc-900 border border-zinc-700 text-white py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest text-center"
        >
          📞 Zavolať
        </a>
        <button
          onClick={() => goToBooking('sticky')}
          className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-red-600/25"
        >
          📅 Objednať termín
        </button>
      </div>

    </div>
  );
}
