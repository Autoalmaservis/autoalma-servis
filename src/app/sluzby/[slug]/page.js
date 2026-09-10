import Link from 'next/link';
import { supabaseServer } from '@/app/lib/supabaseServer';
import SiteHeader from '@/app/components/SiteHeader';
import StickyCta from '@/app/components/StickyCta';

// Stránka sa vygeneruje na serveri a raz za hodinu sa obnoví.
// Google tak dostane hotový text, nie prázdny obal, ktorý si musí sám doskladať.
export const revalidate = 3600;

const toSlug = (str) =>
  str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

async function getSection(slug) {
  const { data } = await supabaseServer
    .from('web_sections')
    .select('*')
    .eq('slug', slug)
    .single();
  return data || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const section = await getSection(slug);
  if (!section) return { title: 'Služba nenájdená' };

  const nazov = section.name;
  const popis = section.description
    || `${nazov} v autoservise AutoAlma, Bratislava – Podunajské Biskupice. Cenu schválite vopred, záruka 12 mesiacov na vykonanú prácu.`;

  return {
    title: `${nazov} Bratislava`,
    description: popis.slice(0, 300),
    alternates: { canonical: `https://autoalma.sk/sluzby/${slug}` },
    openGraph: {
      title: `${nazov} Bratislava | AutoAlma Servis`,
      description: popis.slice(0, 300),
      url: `https://autoalma.sk/sluzby/${slug}`,
      type: 'website',
      locale: 'sk_SK',
    },
  };
}

export default async function SluzbaPage({ params }) {
  const { slug } = await params;
  const section = await getSection(slug);

  if (!section) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <p className="text-6xl mb-6">🔧</p>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-4">Sekcia nenájdená</h1>
        <Link href="/#sluzby" className="text-red-600 font-black uppercase text-xs tracking-widest hover:underline">← Späť na služby</Link>
      </div>
    );
  }

  const items = Array.isArray(section.items) ? section.items : [];
  const images = Array.isArray(section.image_urls) ? section.image_urls.filter(Boolean) : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: section.name,
    description: section.description || `${section.name} v autoservise AutoAlma, Bratislava – Podunajské Biskupice.`,
    serviceType: section.name,
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
      <SiteHeader back="/#sluzby" backLabel="← Späť na služby" />

      {/* HERO */}
      <section className="pt-32 pb-14 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/8 via-transparent to-transparent pointer-events-none" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600 mb-4 italic">
          Autoservis Bratislava – Podunajské Biskupice
        </p>
        <div className="text-6xl mb-6">{section.icon}</div>
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-6">
          <span className="text-red-600">{section.name}</span>
        </h1>
        {section.description && (
          <p className="text-zinc-300 text-base md:text-lg font-bold max-w-2xl mx-auto leading-relaxed">
            {section.description}
          </p>
        )}
      </section>

      {/* OBRÁZKY */}
      {images.length > 0 && (
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((url, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden border border-zinc-900 ${i === 0 && images.length > 2 ? 'col-span-2 row-span-2' : ''}`}>
                <img src={url} alt={`${section.name} — AutoAlma Bratislava`} className="w-full h-full object-cover aspect-video" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* POLOŽKY */}
      {items.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-8 text-center">Čo zahŕňa táto služba</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item, i) => {
                const title = typeof item === 'string' ? item : item.title;
                const desc = typeof item === 'string' ? '' : item.desc;
                return (
                  <Link
                    key={i}
                    href={`/sluzby/${slug}/${toSlug(title)}`}
                    className="bg-zinc-950 border border-zinc-900 hover:border-red-600/40 p-7 rounded-[2rem] transition-all group block"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-2 h-2 bg-red-600 rounded-full shrink-0 mt-2" />
                      <h2 className="text-base font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors">
                        {title}
                      </h2>
                      <span className="ml-auto text-zinc-700 group-hover:text-red-500 text-sm transition-colors">→</span>
                    </div>
                    {desc && <p className="text-zinc-400 text-sm font-bold leading-relaxed pl-5 line-clamp-3">{desc}</p>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-6 border-t border-zinc-900 text-center">
        <p className="text-zinc-400 font-bold mb-2 text-sm">Potrebujete túto službu?</p>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-8">
          Objednajte sa <span className="text-red-600">online za dve minúty</span>
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
          <Link href="/objednavka"
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl shadow-red-600/20 hover:scale-105">
            📅 Objednať termín
          </Link>
          <a href="tel:0940449449"
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all">
            📞 0940 449 449
          </a>
        </div>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-6">
          Ulica Svornosti 119 · Bratislava – Podunajské Biskupice · Po–Pi 8:00–16:00
        </p>
      </section>

      <StickyCta source="sluzba" />
    </div>
  );
}
