import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ImageGallery from './ImageGallery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const toSlug = (str) =>
  str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

export async function generateMetadata({ params }) {
  const { data } = await supabase
    .from('web_sections')
    .select('name, items')
    .eq('slug', params.slug)
    .single();
  if (!data) return { title: 'Služba nenájdená' };
  const found = (data.items || []).find(i => toSlug(i.title || i) === params.item);
  if (!found) return { title: data.name };
  const title = typeof found === 'string' ? found : found.title;
  const desc = typeof found === 'string' ? '' : (found.desc || '');
  return {
    title: `${title} – ${data.name}`,
    description: desc.replace(/\*\*/g, '').slice(0, 160),
    alternates: { canonical: `https://autoalma.sk/sluzby/${params.slug}/${params.item}` },
    openGraph: {
      title: `${title} | AutoAlma Servis`,
      description: desc.replace(/\*\*/g, '').slice(0, 160),
      url: `https://autoalma.sk/sluzby/${params.slug}/${params.item}`,
    },
  };
}

export default async function ItemDetailPage({ params }) {
  const { data } = await supabase
    .from('web_sections')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!data) notFound();

  const found = (data.items || []).find(i => toSlug(i.title || i) === params.item);
  if (!found) notFound();

  const section = data;
  const itemData = typeof found === 'string' ? { title: found, desc: '', image_urls: [] } : found;

  const images = itemData.image_urls?.filter(Boolean) || [];
  const paragraphs = (itemData.desc || '').split('\n').filter(p => p.trim());

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
        <div className="flex items-center justify-between px-6 md:px-12 py-4">
          <Link href="/" className="text-xl font-black uppercase italic tracking-tighter hover:opacity-80 transition-all">
            Auto<span className="text-red-600">Alma</span>
          </Link>
          <div className="flex items-center gap-4">
            {section && (
              <Link href={`/#sluzby`} className="hidden md:block text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">
                {section.icon} {section.name}
              </Link>
            )}
            <Link href="/#sluzby" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl">
              ← Späť
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-12 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/8 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          {section && (
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-3 italic">
              {section.icon} {section.name}
            </p>
          )}
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none mb-6">
            <span className="text-white">{itemData.title.split(' ')[0]}</span>
            {itemData.title.split(' ').length > 1 && (
              <> <span className="text-red-600">{itemData.title.split(' ').slice(1).join(' ')}</span></>
            )}
          </h1>
          {/* DEKORATÍVNA ČIARA */}
          <div className="flex items-center gap-4 mt-8">
            <div className="h-[2px] w-12 bg-red-600" />
            <div className="h-[1px] flex-grow bg-gradient-to-r from-zinc-800 to-transparent" />
          </div>
        </div>
      </section>

      {/* HLAVNÝ OBSAH */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 pb-24">

        <div className={`grid gap-12 ${images.length > 0 ? 'lg:grid-cols-[1fr_380px]' : 'grid-cols-1 max-w-3xl'}`}>

          {/* TEXT */}
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
                  <p key={i} className="text-zinc-400 text-base font-bold leading-relaxed pl-8">
                    {text}
                  </p>
                );
              })}
            </div>
          )}

          {!paragraphs.length && images.length === 0 && (
            <div className="py-16 border-2 border-dashed border-zinc-900 rounded-[2rem] text-center text-zinc-700 font-black uppercase text-xs tracking-widest italic">
              Popis tejto služby čoskoro doplníme
            </div>
          )}

          {/* FOTKY — bočný stĺpec alebo plná šírka */}
          {images.length > 0 && <ImageGallery images={images} />}
        </div>


        {/* CTA */}
        <div className="mt-16 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-2">Máte záujem o túto službu?</p>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                Príďte alebo <span className="text-red-600">zavolajte</span>
              </h3>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-1">Bratislava · Svornosti 119 · Po–Pi 8:00–17:00</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href="tel:0940449449"
                className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105 text-center">
                📞 0940 449 449
              </a>
              <Link href="/login"
                className="bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-blue-500/30 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all text-center">
                🏎️ Moja Garáž
              </Link>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
