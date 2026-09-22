-- Bezpečnostný audit 2026-09-22 — 2. kolo (krok L): faktúry, kalendár, storage listing
-- Predpoklad: spustené security_2026_09_A_helpers.sql a security_2026_09_B_K_rls.sql
-- Celé v transakcii.

begin;

-- ---------------------------------------------------------------------
-- L1. user_profiles: zákazník si nesmie sám zmeniť e-mail (ani rolu).
-- Dôvod: politika faktúr páruje invoices.customer_email s user_profiles.email —
-- zmenou e-mailu na cudzí by zákazník videl cudzie faktúry. Admin e-mail meniť môže.
-- Garáž posiela e-mail v update nezmenený (pole je disabled) → prejde.
-- ---------------------------------------------------------------------
drop policy if exists "update own keep role" on public.user_profiles;
create policy "update own keep role and email" on public.user_profiles for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select up.role from public.user_profiles up where up.id = auth.uid())
    and (
      lower(email) is not distinct from (select lower(up.email) from public.user_profiles up where up.id = auth.uid())
      or lower(email) = lower(auth.email())
    )
  );

-- ---------------------------------------------------------------------
-- L2. invoices: admin cez is_admin_safe(); zákazník podľa profilového e-mailu
-- (ponechané kvôli účtom, kde sa prihlasovací e-mail líši od fakturačného — GEAREX).
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='invoices' loop
    execute format('drop policy if exists %I on public.invoices', r.policyname);
  end loop;
end $$;
create policy "admin all" on public.invoices for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "customer select own" on public.invoices for select to authenticated
  using (
    lower(customer_email) = lower(auth.email())
    or lower(customer_email) = (select lower(up.email) from public.user_profiles up where up.id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- L3. calendar_events: zákazník vkladá iba neschválenú, neblokujúcu rezerváciu
-- s reálnou ŠPZ (nie 'BLOK'). Garáž posiela is_confirmed=false a ŠPZ vozidla → prejde.
-- Staff bez obmedzenia.
-- ---------------------------------------------------------------------
drop policy if exists "insert staff or own" on public.calendar_events;
create policy "insert staff or own" on public.calendar_events for insert to authenticated
  with check (
    is_staff()
    or (
      user_id = auth.uid()
      and coalesce(is_confirmed, false) = false
      and coalesce(is_blocked, 'false') <> 'true'
      and upper(coalesce(plate_number, '')) <> 'BLOK'
    )
  );

-- ---------------------------------------------------------------------
-- L4. storage: bez anonymného listovania. Bucket-y sú public, takže priame URL
-- (getPublicUrl) fungujú bez SELECT politiky; listing potrebuje iba admin
-- (správa galérie/bannerov) a staff pri fotkách zákaziek.
-- ---------------------------------------------------------------------
drop policy if exists "public read" on storage.objects;
create policy "staff list service-images" on storage.objects for select to authenticated
  using (bucket_id = 'service-images' and is_staff());
create policy "admin list other buckets" on storage.objects for select to authenticated
  using (bucket_id in ('web-images','logos','form-templates','voice-notes') and is_admin_safe());

commit;

select 'L OK' as result;
