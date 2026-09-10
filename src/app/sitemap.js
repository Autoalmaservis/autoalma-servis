import { createClient } from '@supabase/supabase-js';
import { vlastnaStranka } from '@/app/lib/specialneStranky';

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

const BASE = 'https://autoalma.sk';

export default async function sitemap() {
  const { data: sections } = await supabase
    .from('web_sections')
    .select('slug, items');

  const sectionUrls = (sections || []).map(s => ({
    url: `${BASE}/sluzby/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  // Služby, ktoré majú vlastnú stránku (napr. čistenie DPF), sem nedávame.
  // Ich pôvodná adresa už len presmerováva a Google nemá rád, keď mu
  // v mape stránok posielame adresy, ktoré vedú inam.
  const itemUrls = (sections || []).flatMap(s =>
    (s.items || []).flatMap(item => {
      const title = typeof item === 'string' ? item : item.title;
      const itemSlug = toSlug(title);
      if (vlastnaStranka(s.slug, itemSlug)) return [];
      return [{
        url: `${BASE}/sluzby/${s.slug}/${itemSlug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      }];
    })
  );

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    // Cieľové stránky pre reklamu — vyššia priorita ako bežné podstránky
    { url: `${BASE}/cistenie-dpf`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/diagnostika-vozidiel`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/objednavka`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/diagnostika`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...sectionUrls,
    ...itemUrls,
  ];
}
