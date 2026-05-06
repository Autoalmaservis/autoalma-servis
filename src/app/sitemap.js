import { createClient } from '@supabase/supabase-js';

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

  const itemUrls = (sections || []).flatMap(s =>
    (s.items || []).map(item => {
      const title = typeof item === 'string' ? item : item.title;
      return {
        url: `${BASE}/sluzby/${s.slug}/${toSlug(title)}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      };
    })
  );

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/objednavka`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    ...sectionUrls,
    ...itemUrls,
  ];
}
