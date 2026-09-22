-- Galéria na hlavnej stránke — tabuľka, ktorá nikdy nebola vytvorená (audit 2026-09).
-- POZOR: zámerne NEPOUŽÍVA politiku `auth.role() = 'authenticated'`, ktorú ponúka
-- varovanie v /spravovat-web/galeria — tá by dovolila ktorémukoľvek registrovanému
-- zákazníkovi meniť fotky na verejnom webe. Zápis má iba admin.

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.gallery_photos enable row level security;

drop policy if exists "Public read" on public.gallery_photos;
drop policy if exists "Auth write" on public.gallery_photos;
drop policy if exists "select public" on public.gallery_photos;
drop policy if exists "admin write" on public.gallery_photos;

-- Galéria sa zobrazuje na verejnej stránke → čítanie pre všetkých
create policy "select public" on public.gallery_photos for select to anon, authenticated
  using (true);

-- Spravovať ju môže iba admin cez /spravovat-web/galeria
create policy "admin write" on public.gallery_photos for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());

create index if not exists gallery_photos_sort_idx on public.gallery_photos (sort_order);

select 'M OK' as result;
