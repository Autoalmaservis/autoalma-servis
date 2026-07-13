'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import BannerPopup from '@/app/components/BannerPopup';
import { trackMojaGarazClick, trackPhoneClick, trackContactSubmit } from '@/app/lib/analytics';

const services = [
  {
    icon: '🔧',
    name: 'Mechanické práce',
    slug: 'mechanicke-prace',
    items: ['Pravidelný servis', 'Výmena bŕzd', 'Oprava podvozku', 'Čistenie DPF/CAT', 'Spojka a prevodovka', 'Dekarbonizácia'],
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

const slogans = [
  { main: 'Férovosť, ktorú cítite', sub: 'nie len čítate' },
  { main: 'Servis, ktorý komunikuje', sub: 'nie iba účtuje' },
  { main: 'Transparentná diagnostika', sub: 'bez technického žargónu' },
];

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [cennik, setCennik] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', plate: '', vehicle: '', year: '', message: '' });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', email: '', plate: '', date: '', time: '08:00', description: '' });
  const [bookingSending, setBookingSending] = useState(false);
  const [bookingSent, setBookingSent] = useState(false);
  const [bookingError, setBookingError] = useState('');
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

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingSending(true);
    setBookingError('');
    try {
      const startDt = `${bookingForm.date}T${bookingForm.time}:00`;
      // predpokladáme 1 hod termin
      const endDt = `${bookingForm.date}T${String(parseInt(bookingForm.time.split(':')[0]) + 1).padStart(2, '0')}:${bookingForm.time.split(':')[1]}:00`;
      const contactInfo = `${bookingForm.name}${bookingForm.phone ? ' · ' + bookingForm.phone : ''}${bookingForm.email ? ' · ' + bookingForm.email : ''}`;
      const { error } = await supabase.from('calendar_events').insert({
        title: bookingForm.name || 'Online objednávka',
        plate_number: bookingForm.plate.toUpperCase() || 'NEZNÁMA',
        start_datetime: startDt,
        end_datetime: endDt,
        status: 'Čaká na schválenie',
        is_confirmed: false,
        issue_description: (bookingForm.description ? bookingForm.description + '\n' : '') + contactInfo,
      });
      if (error) throw error;
      setBookingSent(true);
      setBookingForm({ name: '', phone: '', email: '', plate: '', date: '', time: '08:00', description: '' });
    } catch (err) {
      setBookingError('Objednávku sa nepodarilo uložiť. Zavolajte nám: 0940 449 449');
    }
    setBookingSending(false);
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
    trackContactSubmit();
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
    description: 'Autoservis v Bratislave, Petržalka. Mechanické práce, elektrodiagnostika, klimatizácia, pneuservis.',
    url: 'https://autoalma.sk',
    telephone: '+421940449449',
    email: 'autoalma@autoalma.sk',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Svornosti 119',
      addressLocality: 'Bratislava',
      postalCode: '821 06',
      addressCountry: 'SK',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 48.1221,
      longitude: 17.1077,
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '08:00', closes: '17:00' },
    ],
    priceRange: '€€',
    servesCuisine: undefined,
    hasMap: 'https://maps.google.com/?q=Svornosti+119+Bratislava',
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <BannerPopup />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAVIGÁCIA */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25 transition-all duration-300 ${scrolled ? 'shadow-lg shadow-blue-500/5' : ''}`}>
        <div className={`flex items-center justify-between px-6 md:px-12 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>

          {/* LOGO + NAV LINKY */}
          <div className="flex items-center gap-8 md:gap-12">
            <a href="#" className={`font-black uppercase italic tracking-tighter transition-all duration-300 hover:opacity-80 ${scrolled ? 'text-lg' : 'text-2xl'}`}>
              Auto<span className="text-red-600">Alma</span>
            </a>

            <div className="hidden md:flex items-center gap-1">
              {[
                { href: '#sluzby', label: 'Naše služby' },
                { href: '#cennik', label: 'Cenník' },
                { href: '#galeria', label: 'Galéria' },
                { href: '#napiste-nam', label: 'Napíšte nám' },
              ].map(link => (
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
                AI Diagnostika
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-red-500 group-hover:w-4/5 transition-all duration-300" />
              </Link>
            </div>
          </div>

          {/* PRAVÁ STRANA */}
          <div className="flex items-center gap-3 md:gap-5">
            <a
              href="tel:0940449449"
              onClick={() => trackPhoneClick('nav')}
              className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
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
              🏎️ Moja Garáž
            </Link>

            <Link
              href="/system"
              className="text-zinc-800 hover:text-zinc-500 transition-all text-base"
              title="Pre zamestnancov"
            >
              ⚙
            </Link>
          </div>
        </div>
        {/* MODRÁ LINKA DOLE */}
        <div className="nav-stripe" />
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-transparent to-transparent pointer-events-none" />

        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600 mb-5 italic">
          Bratislava · Svornosti 119
        </p>

        <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-none mb-4">
          Auto<span className="text-red-600">Alma</span>
        </h1>

        <p className="text-white text-sm md:text-base font-bold max-w-lg mb-2 leading-relaxed">
          Máme možno prvý autoservis,
        </p>
        <p className="text-white text-base md:text-lg font-black italic max-w-lg mb-10">
          ktorému budete veriť.
        </p>

        {/* VÝHODY GARÁŽE — viditeľné hneď */}
        <div className="w-full max-w-6xl mb-10">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-600 mb-6 italic">
            🏎️ Moja Garáž — váš online servisný účet
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '📡', title: 'Stav opravy naživo', desc: 'Vidíte čo sa s autom deje — bez volania' },
              { icon: '📋', title: 'Schvaľujete práce online', desc: 'Cenová ponuka priamo na telefón' },
              { icon: '🧾', title: 'Faktúry vždy po ruke', desc: 'Všetky doklady na jednom mieste' },
              { icon: '🚗', title: 'História každého auta', desc: 'Kompletná servisná karta vozidla' },
              { icon: '📱', title: 'Funguje na mobile', desc: 'Bez aplikácie, stačí prehliadač' },
              { icon: '🔒', title: 'Len váš účet', desc: 'Súkromný prístup, vaše dáta' },
            ].map((b, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 hover:border-red-600/30 p-8 md:p-10 rounded-[2rem] text-left transition-all group flex items-start gap-6">
                <span className="text-4xl md:text-5xl shrink-0 mt-0.5">{b.icon}</span>
                <div>
                  <p className="text-white text-sm md:text-base font-black uppercase italic tracking-tight leading-tight mb-2 group-hover:text-red-500 transition-colors">{b.title}</p>
                  <p className="text-zinc-300 text-xs md:text-sm font-bold leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => { setShowBookingModal(true); setBookingSent(false); setBookingError(''); }}
            className="bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl shadow-red-600/20 hover:shadow-red-600/40 hover:scale-105"
          >
            📅 Objednať sa online
          </button>
          <Link
            href="/login"
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all"
          >
            🏎️ Aktivovať Moju Garáž
          </Link>
        </div>
        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mt-4">
          Objednajte sa bez registrácie · Garáž dáva prístup k stavu opravy
        </p>
      </section>

      {/* SLOGANY */}
      <section className="py-14 px-6 border-y border-zinc-900 bg-zinc-950">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        onClick={() => router.push(`/sluzby/${s.slug}/${toSlug(item)}`)}
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

      {/* GALÉRIA */}
      <section id="galeria" className="py-24 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Naša práca</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Galéria</h2>
          </div>

          {galleryPhotos.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-800 rounded-[2rem] py-24 text-center text-zinc-700 text-xs font-black uppercase tracking-widest italic">
              Fotky z dielne — pripravujeme
            </div>
          ) : (
            <>
              <div className="columns-2 md:columns-3 gap-4">
                {galleryPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="break-inside-avoid mb-4 rounded-2xl overflow-hidden cursor-pointer group relative"
                    onClick={() => setLightbox(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'AutoAlma servis'}
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
            </>
          )}
        </div>
      </section>

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
              <p className="text-zinc-300 text-sm font-bold mt-4 max-w-lg mx-auto">Ceny sú orientačné a závisia od konkrétneho vozidla. Presná cena vždy po diagnostike.</p>
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

      {/* KONTAKTNÝ FORMULÁR */}
      <section id="napiste-nam" className="py-24 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Rýchly kontakt</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Napíšte nám</h2>
            <p className="text-zinc-300 font-bold text-sm mt-4">Odpovieme do 24 hodín v pracovné dni.</p>
          </div>

          {contactSent ? (
            <div className="bg-zinc-950 border border-green-900/50 rounded-[2rem] p-12 text-center">
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
            <form onSubmit={handleContactSubmit} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 space-y-5">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Meno *</label>
                  <input
                    required
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ján Novák"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="jan@email.sk"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Telefón *</label>
                  <input
                    required
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+421 900 000 000"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Vozidlo</label>
                  <input
                    value={contactForm.vehicle}
                    onChange={e => setContactForm(p => ({ ...p, vehicle: e.target.value }))}
                    placeholder="napr. Škoda Octavia 2.0 TDI"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">ŠPZ</label>
                  <input
                    value={contactForm.plate}
                    onChange={e => setContactForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))}
                    placeholder="BA123AB"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Rok výroby</label>
                  <input
                    type="number"
                    min="1980"
                    max="2026"
                    value={contactForm.year}
                    onChange={e => setContactForm(p => ({ ...p, year: e.target.value }))}
                    placeholder="napr. 2018"
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Správa *</label>
                <textarea
                  required
                  rows={5}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Opíšte problém s vozidlom alebo čo potrebujete..."
                  className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">* povinné polia</p>
                <button
                  type="submit"
                  disabled={contactSending}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105 hover:shadow-red-600/30"
                >
                  {contactSending ? 'Odosielam...' : 'Odoslať správu'}
                </button>
              </div>

            </form>
          )}
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" className="py-24 px-6 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Kde nás nájdete</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Kontakt</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* TELEFÓNY */}
            <div className="bg-black border border-zinc-900 p-8 rounded-[2rem] flex flex-col gap-5">
              <div>
                <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-4">📞 Telefón</p>
                <a href="tel:0940449449" onClick={() => trackPhoneClick('kontakt')} className="flex flex-col group mb-4">
                  <span className="text-white font-black text-lg tracking-widest group-hover:text-red-500 transition-colors">0940 449 449</span>
                  <span className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-1">Christian Flickinger</span>
                  <span className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">Prijímací technik</span>
                </a>
                <div className="h-px bg-zinc-900 mb-4" />
                <a href="tel:0908647227" onClick={() => trackPhoneClick('kontakt')} className="flex flex-col group">
                  <span className="text-white font-black text-lg tracking-widest group-hover:text-red-500 transition-colors">0908 647 227</span>
                  <span className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-1">Maroš Jurkovič</span>
                  <span className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">Diagnostik</span>
                </a>
              </div>
            </div>

            {/* ADRESA */}
            <a
              href="https://maps.google.com/?q=Svornosti+119,+Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black border border-zinc-900 hover:border-red-600/30 p-8 rounded-[2rem] text-center transition-all group cursor-pointer"
            >
              <span className="text-4xl mb-4 block">📍</span>
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-3">Kde nás nájdete</p>
              <p className="text-white font-black text-xl group-hover:text-red-500 transition-colors">Svornosti 119</p>
              <p className="text-zinc-300 font-bold text-sm mt-2">821 06 Bratislava</p>
              <p className="text-zinc-300 font-bold text-[10px] uppercase tracking-widest mt-3">Po–Pi 8:00–16:00</p>
            </a>

            {/* E-MAILY */}
            <div className="bg-black border border-zinc-900 p-8 rounded-[2rem] flex flex-col gap-4">
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

            {/* FAKTURAČNÉ ÚDAJE */}
            <div className="bg-black border border-zinc-900 p-8 rounded-[2rem] text-center">
              <span className="text-4xl mb-4 block">🧾</span>
              <p className="text-[9px] text-red-600 font-black uppercase tracking-widest mb-3">Fakturačné údaje</p>
              <p className="text-white font-black text-base">Autoalma s.r.o.</p>
              <div className="mt-2 mb-4">
                <p className="text-zinc-300 font-bold text-sm">Tilgnerova 712/3</p>
                <p className="text-zinc-300 font-bold text-sm">841 04 Bratislava</p>
              </div>
              <div className="space-y-1 border-t border-zinc-900 pt-4">
                <p className="text-zinc-300 font-bold text-sm">IČO: 46044876</p>
                <p className="text-zinc-300 font-bold text-sm">DIČ: 2023194316</p>
                <p className="text-zinc-300 font-bold text-sm">IČ DPH: SK2023194316</p>
              </div>
            </div>
          </div>

          {/* MAPA */}
          <div className="mt-10 rounded-[2rem] overflow-hidden border border-zinc-900 relative">
            <iframe
              src="https://maps.google.com/maps?q=Svornosti+119,+Bratislava&t=&z=16&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="400"
              style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="AutoAlma Servis – Svornosti 119, Bratislava"
            />
            <a
              href="https://maps.google.com/?q=Svornosti+119,+Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 bg-black/90 border border-zinc-800 hover:border-red-600/50 text-white font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl transition-all"
            >
              Otvoriť v Maps →
            </a>
          </div>
        </div>
      </section>

      {/* BOOKING MODAL */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowBookingModal(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-zinc-900">
              <div>
                <h2 className="font-black uppercase italic tracking-tighter text-xl text-white">Objednať sa</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Bez registrácie · Potvrdíme telefonicky</p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center justify-center font-black">✕</button>
            </div>

            {bookingSent ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="font-black uppercase italic tracking-tighter text-xl text-white mb-2">Objednávka odoslaná!</h3>
                <p className="text-zinc-400 text-sm font-bold mb-6">Potvrdíme vám termín telefonicky alebo e-mailom.</p>
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-6">
                  Chcete vidieť stav opravy naživo? Aktivujte si Moju Garáž.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => setShowBookingModal(false)} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all">Zavrieť</button>
                  <Link href="/login" onClick={() => setShowBookingModal(false)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all text-center">🏎️ Aktivovať Moju Garáž</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">Meno a priezvisko *</label>
                    <input required type="text" value={bookingForm.name} onChange={e => setBookingForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ján Novák"
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">Telefón *</label>
                    <input required type="tel" value={bookingForm.phone} onChange={e => setBookingForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="09XX XXX XXX"
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">E-mail</label>
                    <input type="email" value={bookingForm.email} onChange={e => setBookingForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="vas@email.sk"
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">ŠPZ vozidla</label>
                    <input type="text" value={bookingForm.plate} onChange={e => setBookingForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                      placeholder="BA 123 AB"
                      className="w-full bg-white text-black border-none p-3 rounded-xl font-black text-sm tracking-widest outline-none uppercase" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-red-500 mb-1.5 ml-1 tracking-widest uppercase">Požadovaný dátum *</label>
                    <input required type="date" value={bookingForm.date} min={new Date().toISOString().split('T')[0]}
                      onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm transition-all cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">Čas</label>
                    <input type="time" value={bookingForm.time} min="07:00" max="17:00"
                      onChange={e => setBookingForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-zinc-500 mb-1.5 ml-1 tracking-widest uppercase">Popis závady / čo potrebujete</label>
                  <textarea value={bookingForm.description} onChange={e => setBookingForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Napr. Výmena oleja, škrípe predná brzdička..."
                    rows={3}
                    className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-bold outline-none text-sm resize-none transition-all" />
                </div>

                {bookingError && <p className="text-red-500 text-xs font-black text-center">{bookingError}</p>}

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                    💡 Chcete vidieť stav opravy naživo, schvaľovať práce online a mať faktúry po ruke?{' '}
                    <Link href="/login" onClick={() => setShowBookingModal(false)} className="text-red-500 hover:text-red-400 transition-colors">Aktivujte si Moju Garáž</Link>
                    {' '}— vytvorí vám ju servis po prvej návšteve.
                  </p>
                </div>

                <button type="submit" disabled={bookingSending}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-600/20">
                  {bookingSending ? 'Odosielam...' : '📅 Odoslať objednávku'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
