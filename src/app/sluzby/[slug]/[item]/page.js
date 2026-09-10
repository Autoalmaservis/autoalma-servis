import Link from 'next/link';
import { supabaseServer } from '@/app/lib/supabaseServer';
import ImageGallery from './ImageGallery';
import SiteHeader from '@/app/components/SiteHeader';
import StickyCta from '@/app/components/StickyCta';

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
    .filter(p => p && !(p.startsWith('**') && p.endsWith('**')))
    .join(' ')
    .replace(/\s+/g, ' ');

  if (clean.length > 60) return clean.slice(0, 250);
  return `${title} v autoservise AutoAlma, Bratislava – Podunajské Biskupice. Cenu schválite vopred v mobile, na prácu dávame 12 mesiacov záruku. Objednajte sa online.`;
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
  const paragraphs = (itemData.desc || '').split('\n').filter(p => p.trim());

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

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader back={`/sluzby/${slug}`} backLabel="← Späť" />

      {/* HERO */}
      <section className="pt-32 pb-12 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/8 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          {section && (
            <Link href={`/sluzby/${slug}`} className="inline-block text-[10px] font-black uppercase tracking-[0.35em] text-blue-400 hover:text-blue-300 mb-3 italic transition-colors">
              {section.icon} {section.name}
            </Link>
          )}
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none mb-4">
            <span className="text-white">{itemData.title.split(' ')[0]}</span>
            {itemData.title.split(' ').length > 1 && (
              <> <span className="text-red-600">{itemData.title.split(' ').slice(1).join(' ')}</span></>
            )}
          </h1>
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">
            Bratislava – Podunajské Biskupice · Záruka 12 mesiacov na prácu
          </p>
          <div className="flex items-center gap-4 mt-8">
            <div className="h-[2px] w-12 bg-red-600" />
            <div className="h-[1px] flex-grow bg-gradient-to-r from-zinc-800 to-transparent" />
          </div>

          {/* DÔKAZY */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
            {[
              { v: '4,6 ★', l: '148 hodnotení na Google' },
              { v: '12 mes.', l: 'záruka na vykonanú prácu' },
              { v: 'od 35 €', l: 'normohodina, skutočný čas' },
              { v: 'Cenu vopred', l: 'schvaľujete v mobile' },
            ].map((p, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl px-5 py-5">
                <p className="text-white text-lg md:text-xl font-black italic tracking-tight leading-none mb-1.5">{p.v}</p>
                <p className="text-zinc-400 text-[11px] font-bold leading-snug">{p.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HLAVNÝ OBSAH */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 pb-20">
        <div className={`grid gap-12 ${images.length > 0 ? 'lg:grid-cols-[1fr_380px]' : 'grid-cols-1 max-w-3xl'}`}>

          {paragraphs.length > 0 && (
            <div className="space-y-0">
              {paragraphs.map((p, i) => {
                const isBold = p.startsWith('**') && p.endsWith('**');
                const text = isBold ? p.slice(2, -2) : p;
                if (isBold) return (
                  <div key={i} className={`${i > 0 ? 'mt-8' : ''}`}>
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-red-500 mb-3 flex items-center gap-3">
                      <span className="w-5 h-[2px] bg-red-600 shrink-0" />
                      {text}
                    </h2>
                  </div>
                );
                return (
                  <p key={i} className="text-zinc-300 text-[15px] md:text-base font-bold leading-[1.8] pl-8 mb-4 max-w-[65ch]">
                    {text}
                  </p>
                );
              })}
            </div>
          )}

          {!paragraphs.length && images.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10">
              <p className="text-white font-black uppercase italic tracking-tight text-lg mb-4">
                {itemData.title} v AutoAlma
              </p>
              <p className="text-zinc-300 text-[15px] font-bold leading-[1.8] max-w-[65ch]">
                Túto službu robíme bežne. Presný rozsah a cenu vieme povedať až po obhliadke
                a diagnostike vozidla — a dozviete sa ich skôr, než začneme pracovať. Cenová
                ponuka vám príde do mobilu a bez vášho súhlasu na aute nič nerobíme.
                Na vykonanú prácu dávame záruku 12 mesiacov.
              </p>
            </div>
          )}

          <ImageGallery images={images} />
        </div>

        {/* AKO TO PREBIEHA */}
        <div className="mt-16">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mb-6">Ako to u nás prebieha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: '1', t: 'Objednáte sa', d: 'Online za dve minúty alebo telefonicky.' },
              { n: '2', t: 'Pozrieme auto', d: 'Diagnostika a presný rozsah práce.' },
              { n: '3', t: 'Schválite cenu', d: 'Ponuka príde do mobilu. Bez súhlasu nezačíname.' },
              { n: '4', t: 'Opravíme', d: 'Test jazdou a záruka 12 mesiacov.' },
            ].map((k, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
                <span className="inline-flex w-8 h-8 rounded-full bg-red-600 text-white font-black italic text-sm items-center justify-center mb-4">{k.n}</span>
                <p className="text-white font-black uppercase italic tracking-tight text-sm mb-1.5">{k.t}</p>
                <p className="text-zinc-400 text-xs font-bold leading-relaxed">{k.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mb-2">Máte záujem o túto službu?</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                Objednajte sa <span className="text-red-600">online</span>
              </h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
                Bez registrácie · Cenu schválite vopred · Po–Pi 8:00–16:00
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
      </div>

      <StickyCta source="detail-sluzby" />
    </div>
  );
}
