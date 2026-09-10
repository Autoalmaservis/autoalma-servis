import Link from 'next/link';
import { supabaseServer } from '@/app/lib/supabaseServer';
import ImageGallery from './ImageGallery';
import SiteHeader from '@/app/components/SiteHeader';
import StickyCta from '@/app/components/StickyCta';
import FotoMiesto from '@/app/components/FotoMiesto';

// Detail konkrétnej služby. Toto sú stránky, na ktoré smeruje reklama,
// preto sa generujú na serveri a majú vlastný titulok aj popis.
export const revalidate = 3600;

const toSlug = (str) =>
  str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

async function getData(slug, itemSlug) {
  const { data: section } = await supabaseServer
    .from('web_sections')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!section) return { section: null, itemData: null };

  const found = (section.items || []).find(i => toSlug(i.title || i) === itemSlug);
  const itemData = found
    ? (typeof found === 'string' ? { title: found, desc: '', image_urls: [] } : found)
    : null;

  return { section, itemData };
}

// Z popisu služby vyrobí čistú vetu pre Google (bez značiek **nadpisov**).
function metaPopis(desc, title) {
  const clean = (desc || '')
    .split('\n')
    .map(p => p.trim())
    .filter(p => p && !(p.startsWith('**') && p.endsWith('**')) && !p.endsWith(':'))
    .join(' ')
    .replace(/\s+/g, ' ');

  if (clean.length > 60) return clean.slice(0, 250);
  return `${title} v autoservise AutoAlma, Bratislava – Podunajské Biskupice. Cenu schválite vopred v mobile, na prácu dávame 12 mesiacov záruku. Objednajte sa online.`;
}

/*
  Rozdelí popis na bloky. Nadpis je riadok označený **hviezdičkami**
  alebo krátky riadok ukončený dvojbodkou — tak sú popisy v databáze písané.
  Riadok, ktorý sa začína pomlčkou alebo bodkou, sa vykreslí ako položka zoznamu.
*/
function rozdelPopis(desc) {
  const riadky = (desc || '').split('\n').map(r => r.trim()).filter(Boolean);
  const bloky = [];

  for (const r of riadky) {
    const jeHviezdickovyNadpis = r.startsWith('**') && r.endsWith('**');
    const jeDvojbodkovyNadpis = !jeHviezdickovyNadpis && r.endsWith(':') && r.length < 70;
    const jeOdrazka = /^[-–•]\s+/.test(r);

    if (jeHviezdickovyNadpis) {
      bloky.push({ typ: 'nadpis', text: r.slice(2, -2).trim() });
    } else if (jeDvojbodkovyNadpis) {
      bloky.push({ typ: 'nadpis', text: r.replace(/:$/, '').trim() });
    } else if (jeOdrazka) {
      const text = r.replace(/^[-–•]\s+/, '');
      if (bloky.length && bloky[bloky.length - 1].typ === 'zoznam') {
        bloky[bloky.length - 1].polozky.push(text);
      } else {
        bloky.push({ typ: 'zoznam', polozky: [text] });
      }
    } else {
      bloky.push({ typ: 'odsek', text: r });
    }
  }
  return bloky;
}

export async function generateMetadata({ params }) {
  const { slug, item } = await params;
  const { itemData } = await getData(slug, item);
  if (!itemData) return { title: 'Služba nenájdená' };

  const popis = metaPopis(itemData.desc, itemData.title);

  return {
    title: `${itemData.title} Bratislava`,
    description: popis,
    alternates: { canonical: `https://autoalma.sk/sluzby/${slug}/${item}` },
    openGraph: {
      title: `${itemData.title} Bratislava | AutoAlma Servis`,
      description: popis,
      url: `https://autoalma.sk/sluzby/${slug}/${item}`,
      type: 'website',
      locale: 'sk_SK',
    },
  };
}

export default async function ItemDetailPage({ params }) {
  const { slug, item } = await params;
  const { section, itemData } = await getData(slug, item);

  if (!itemData) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <p className="text-5xl mb-6">🔧</p>
        <h1 className="text-2xl font-black uppercase italic text-white mb-4">Služba nenájdená</h1>
        <Link href="/#sluzby" className="text-red-600 font-black uppercase text-xs tracking-widest hover:underline">← Späť</Link>
      </div>
    );
  }

  const images = itemData.image_urls?.filter(Boolean) || [];
  const bloky = rozdelPopis(itemData.desc);

  // Ostatné služby z tej istej kategórie — vnútorné prelinkovanie
  const dalsie = (section?.items || [])
    .map(i => (typeof i === 'string' ? { title: i } : i))
    .filter(i => i.title && toSlug(i.title) !== item)
    .slice(0, 6);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: itemData.title,
    description: metaPopis(itemData.desc, itemData.title),
    serviceType: itemData.title,
    areaServed: { '@type': 'City', name: 'Bratislava' },
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

  const dokazy = [
    { v: '4,6 ★', l: '148 hodnotení na Google' },
    { v: '12 mes.', l: 'záruka na vykonanú prácu' },
    { v: 'od 35 €', l: 'normohodina, skutočný čas' },
    { v: 'Cenu vopred', l: 'schvaľujete v mobile' },
  ];

  const postup = [
    { n: '1', t: 'Objednáte sa', d: 'Online za dve minúty alebo telefonicky.' },
    { n: '2', t: 'Pozrieme auto', d: 'Diagnostika a presný rozsah práce.' },
    { n: '3', t: 'Schválite cenu', d: 'Ponuka príde do mobilu. Bez súhlasu nezačíname.' },
    { n: '4', t: 'Opravíme', d: 'Test jazdou a záruka 12 mesiacov.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader back={`/sluzby/${slug}`} backLabel="← Späť" />

      {/* HERO */}
      <section className="pt-32 pb-12 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(220,38,38,0.12),transparent_62%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <nav aria-label="Drobčeková navigácia" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-5">
            <Link href="/" className="hover:text-white transition-colors">AutoAlma</Link>
            <span className="text-zinc-700">/</span>
            {section && (
              <>
                <Link href={`/sluzby/${slug}`} className="hover:text-white transition-colors">{section.name}</Link>
                <span className="text-zinc-700">/</span>
              </>
            )}
            <span className="text-zinc-300">{itemData.title}</span>
          </nav>

          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.95] mb-4 max-w-4xl">
            <span className="text-white">{itemData.title.split(' ')[0]}</span>
            {itemData.title.split(' ').length > 1 && (
              <> <span className="text-red-600">{itemData.title.split(' ').slice(1).join(' ')}</span></>
            )}
          </h1>
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">
            Bratislava – Podunajské Biskupice · Záruka 12 mesiacov na prácu
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
            {dokazy.map((p, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-5">
                <p className="text-white text-lg md:text-xl font-black italic tracking-tight leading-none mb-1.5">{p.v}</p>
                <p className="text-zinc-400 text-[11px] font-bold leading-snug">{p.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OBSAH + BOČNÝ STĹPEC */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 pb-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-14 items-start">

          <div className="min-w-0">
            {bloky.length > 0 ? (
              <div className="max-w-[68ch]">
                {bloky.map((b, i) => {
                  if (b.typ === 'nadpis') return (
                    <h2 key={i} className={`text-lg md:text-xl font-black uppercase italic tracking-tight text-white flex items-center gap-3 ${i > 0 ? 'mt-10' : ''} mb-4`}>
                      <span className="w-6 h-[3px] bg-red-600 shrink-0" />
                      {b.text}
                    </h2>
                  );
                  if (b.typ === 'zoznam') return (
                    <ul key={i} className="space-y-2.5 mb-5">
                      {b.polozky.map((p, j) => (
                        <li key={j} className="flex gap-3 text-zinc-300 text-[15px] md:text-base font-medium leading-[1.75]">
                          <span className="text-red-600 shrink-0 mt-1.5">▪</span>{p}
                        </li>
                      ))}
                    </ul>
                  );
                  return (
                    <p key={i} className="text-zinc-300 text-[15px] md:text-base font-medium leading-[1.85] mb-5">
                      {b.text}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 max-w-[68ch]">
                <h2 className="text-white font-black uppercase italic tracking-tight text-lg mb-4">
                  {itemData.title} v AutoAlma
                </h2>
                <p className="text-zinc-300 text-[15px] font-medium leading-[1.85]">
                  Túto službu robíme bežne. Presný rozsah a cenu vieme povedať až po obhliadke
                  a diagnostike vozidla — a dozviete sa ich skôr, než začneme pracovať. Cenová
                  ponuka vám príde do mobilu a bez vášho súhlasu na aute nič nerobíme.
                  Na vykonanú prácu dávame záruku 12 mesiacov.
                </p>
              </div>
            )}

            {/* FOTKY — z databázy alebo zo súborov, ak sú */}
            {images.length > 0 ? (
              <div className="mt-10">
                <ImageGallery images={images} />
              </div>
            ) : (
              <div className="mt-10 grid sm:grid-cols-2 gap-5">
                <FotoMiesto nazov={`sluzba-${item}`} bezRamika
                  popis={`${itemData.title} — záber z dielne`} alt={`${itemData.title} — AutoAlma Bratislava`} />
                <FotoMiesto nazov={`sluzba-${item}-2`} bezRamika
                  popis={`${itemData.title} — druhý záber`} alt={`${itemData.title} — AutoAlma Bratislava`} />
              </div>
            )}

            {/* AKO TO PREBIEHA */}
            <div className="mt-14">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mb-6">Ako to u nás prebieha</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {postup.map((k, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex gap-4">
                    <span className="shrink-0 w-9 h-9 rounded-full bg-red-600 text-white font-black italic text-sm flex items-center justify-center">{k.n}</span>
                    <div>
                      <p className="text-white font-black uppercase italic tracking-tight text-sm mb-1.5">{k.t}</p>
                      <p className="text-zinc-400 text-xs font-bold leading-relaxed">{k.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOČNÝ STĹPEC */}
          <aside className="lg:sticky lg:top-28 space-y-5">
            <div className="bg-gradient-to-b from-red-950/40 to-zinc-950 border border-red-900/40 rounded-[2rem] p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 mb-3">Potrebujete to riešiť?</p>
              <p className="text-white font-black uppercase italic tracking-tight text-xl leading-tight mb-5">
                Objednajte sa online
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/objednavka"
                  className="bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all text-center shadow-xl shadow-red-600/20">
                  📅 Objednať termín
                </Link>
                <a href="tel:0940449449"
                  className="bg-black hover:bg-zinc-900 border border-zinc-800 text-white px-6 py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all text-center">
                  📞 0940 449 449
                </a>
              </div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-4 text-center">
                Bez registrácie · Po–Pi 8:00–16:00
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">Prečo u nás</p>
              <ul className="space-y-3">
                {[
                  'Cenovú ponuku schválite vopred v mobile',
                  'Účtujeme skutočne odpracovaný čas',
                  'Záruka 12 mesiacov na vykonanú prácu',
                  'Stav opravy vidíte v Mojej Garáži',
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 text-zinc-300 text-[13px] font-bold leading-relaxed">
                    <span className="text-red-600 shrink-0">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            {dalsie.length > 0 && section && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">
                  Ďalšie z kategórie {section.name}
                </p>
                <ul className="space-y-1">
                  {dalsie.map((d, i) => (
                    <li key={i}>
                      <Link href={`/sluzby/${slug}/${toSlug(d.title)}`}
                        className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-xl hover:bg-red-600 transition-colors group">
                        <span className="w-1.5 h-1.5 bg-zinc-600 group-hover:bg-white rounded-full shrink-0 transition-colors" />
                        <span className="text-zinc-300 group-hover:text-white text-[13px] font-bold transition-colors">{d.title}</span>
                        <span className="ml-auto text-zinc-700 group-hover:text-white text-xs transition-colors">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ZÁVEREČNÁ VÝZVA */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mb-2">Máte záujem o túto službu?</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                Objednajte sa <span className="text-red-600">online</span>
              </h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
                Ulica Svornosti 119 · Bratislava – Podunajské Biskupice · Po–Pi 8:00–16:00
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
              <Link href="/objednavka"
                className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105 text-center">
                📅 Objednať termín
              </Link>
              <a href="tel:0940449449"
                className="bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-red-500/30 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
                📞 0940 449 449
              </a>
            </div>
          </div>
        </div>
      </section>

      <StickyCta source="detail-sluzby" />
    </div>
  );
}
