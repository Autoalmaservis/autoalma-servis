-- Bezpečnostný audit 2026-09-22 — Kroky B–K: RLS + storage
-- PREDPOKLAD: najprv spustený sql/security_2026_09_A_helpers.sql (is_staff, calendar_slots, get_price_offer)
-- Celé v transakcii: ak čokoľvek zlyhá, nič sa nezmení.

begin;

-- Pomocná procedúra: zmaže VŠETKY existujúce politiky na tabuľke (nahradíme ich nižšie)
create or replace function pg_temp.drop_policies(p_table text) returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', r.policyname, p_table);
  end loop;
end $$;

-- =====================================================================
-- Krok B — user_profiles (únik 218 profilov)
-- =====================================================================
select pg_temp.drop_policies('user_profiles');
create policy "select own or staff" on public.user_profiles for select to authenticated
  using (auth.uid() = id or is_staff());
-- registrácia: iba vlastný riadok a iba rola zakaznik (inak by si registrovaný mohol zapísať role='admin')
create policy "insert own zakaznik" on public.user_profiles for insert to authenticated
  with check (auth.uid() = id and role = 'zakaznik');
create policy "update own keep role" on public.user_profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select up.role from public.user_profiles up where up.id = auth.uid()));
create policy "admin all" on public.user_profiles for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());

-- =====================================================================
-- Krok C — calendar_events (únik 232 rezervácií s kontaktmi)
-- obsadenosť pre verejnosť ide cez view calendar_slots; verejná objednávka cez /api/public-booking (service role)
-- =====================================================================
select pg_temp.drop_policies('calendar_events');
create policy "select staff or own" on public.calendar_events for select to authenticated
  using (is_staff() or user_id = auth.uid());
create policy "insert staff or own" on public.calendar_events for insert to authenticated
  with check (is_staff() or user_id = auth.uid());
create policy "update staff" on public.calendar_events for update to authenticated
  using (is_staff()) with check (is_staff());
create policy "delete staff" on public.calendar_events for delete to authenticated
  using (is_staff());

-- =====================================================================
-- Krok D — job_tasks, job_photos (anonym mohol mazať)
-- =====================================================================
select pg_temp.drop_policies('job_tasks');
create policy "select staff or own job" on public.job_tasks for select to authenticated
  -- job_tasks.job_id je text (historicky), preto cast
  using (is_staff() or exists (select 1 from public.job_tickets t where t.id::text = job_tasks.job_id and t.customer_id = auth.uid()));
create policy "write staff" on public.job_tasks for all to authenticated
  using (is_staff()) with check (is_staff());

select pg_temp.drop_policies('job_photos');
create policy "select staff or own job" on public.job_photos for select to authenticated
  using (is_staff() or exists (select 1 from public.job_tickets t where t.id = job_photos.job_id and t.customer_id = auth.uid()));
create policy "write staff" on public.job_photos for all to authenticated
  using (is_staff()) with check (is_staff());

-- =====================================================================
-- Krok E — price_offers (verejný odkaz ide cez RPC get_price_offer)
-- =====================================================================
select pg_temp.drop_policies('price_offers');
create policy "admin all" on public.price_offers for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "select staff or own" on public.price_offers for select to authenticated
  using (is_staff() or customer_id = auth.uid()
         or exists (select 1 from public.job_tickets t where t.id = price_offers.job_id and t.customer_id = auth.uid()));

-- =====================================================================
-- Krok F — business_settings (IBAN, e-mail účtovníčky; zákazník mohol prepísať)
-- =====================================================================
delete from public.business_settings where id like 'probe_%';
select pg_temp.drop_policies('business_settings');
create policy "select public filtered" on public.business_settings for select to anon, authenticated
  using (
    is_staff()
    or (id <> 'accountant_email' and (auth.uid() is not null or id <> 'company_bank'))
  );
create policy "admin write" on public.business_settings for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());

-- =====================================================================
-- Krok G — katalógy a šablóny
-- =====================================================================
-- verejne čitateľné (web, objednávka), zápis iba admin
do $$
declare t text;
begin
  foreach t in array array['service_norms','service_categories','services_catalog','banners','web_sections'] loop
    perform pg_temp.drop_policies(t);
    execute format('create policy "select public" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (is_admin_safe()) with check (is_admin_safe())', t);
  end loop;
end $$;

-- interné: čítanie staff, zápis admin
do $$
declare t text;
begin
  foreach t in array array['inventory_catalog','sms_templates','ticket_items'] loop
    perform pg_temp.drop_policies(t);
    execute format('create policy "select staff" on public.%I for select to authenticated using (is_staff())', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (is_admin_safe()) with check (is_admin_safe())', t);
  end loop;
end $$;

-- =====================================================================
-- Krok H — tabuľky s ALL authenticated USING (true) → iba admin
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['todos','notes_categories','notes_entries','contacts_categories','contacts_entries',
                           'warehouse_items','warehouse_movements','form_templates','import_batches',
                           'invoice_number_pool','scheduled_sms','service_actions','kasa_entries'] loop
    perform pg_temp.drop_policies(t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (is_admin_safe()) with check (is_admin_safe())', t);
  end loop;
end $$;

-- job_forms: admin všetko, zákazník číta formuláre vlastnej zákazky (garáž)
select pg_temp.drop_policies('job_forms');
create policy "admin all" on public.job_forms for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "select own job" on public.job_forms for select to authenticated
  using (exists (select 1 from public.job_tickets t where t.id = job_forms.job_id and t.customer_id = auth.uid()));

-- =====================================================================
-- Krok I — politiky mechanika cez is_staff() (funguje aj bez user_profiles)
-- =====================================================================
select pg_temp.drop_policies('job_tickets');
create policy "admin all" on public.job_tickets for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "staff select" on public.job_tickets for select to authenticated
  using (is_staff());
create policy "staff update" on public.job_tickets for update to authenticated
  using (is_staff()) with check (is_staff());
create policy "customer select own" on public.job_tickets for select to authenticated
  using (auth.uid() = customer_id);

select pg_temp.drop_policies('job_items');
create policy "admin all" on public.job_items for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "staff select" on public.job_items for select to authenticated
  using (is_staff());
create policy "staff insert" on public.job_items for insert to authenticated
  with check (is_staff());
create policy "customer select own" on public.job_items for select to authenticated
  using (exists (select 1 from public.job_tickets t where t.id = job_items.job_id and t.customer_id = auth.uid()));

select pg_temp.drop_policies('customers');
create policy "admin all" on public.customers for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "staff select" on public.customers for select to authenticated
  using (is_staff());
create policy "customer select own" on public.customers for select to authenticated
  using (id = auth.uid() or lower(email) = lower(auth.email()));

select pg_temp.drop_policies('vehicles');
create policy "admin all" on public.vehicles for all to authenticated
  using (is_admin_safe()) with check (is_admin_safe());
create policy "staff select" on public.vehicles for select to authenticated
  using (is_staff());
create policy "owner all" on public.vehicles for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- garáž hľadá vozidlá aj podľa owner_email (starší import bez owner_id)
create policy "owner select by email" on public.vehicles for select to authenticated
  using (lower(owner_email) = lower(auth.email()));

select pg_temp.drop_policies('findings');
create policy "staff all" on public.findings for all to authenticated
  using (is_staff()) with check (is_staff());

-- =====================================================================
-- Krok J — notifications (anonym mohol vkladať komukoľvek)
-- =====================================================================
select pg_temp.drop_policies('notifications');
create policy "select own or admin" on public.notifications for select to authenticated
  using (user_id = auth.uid() or is_admin_safe());
create policy "insert own or staff" on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or is_staff());
create policy "update own or admin" on public.notifications for update to authenticated
  using (user_id = auth.uid() or is_admin_safe()) with check (user_id = auth.uid() or is_admin_safe());
create policy "delete admin" on public.notifications for delete to authenticated
  using (is_admin_safe());

-- =====================================================================
-- Krok K — storage (service-images: anonym mohol nahrávať a mazať)
-- =====================================================================
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;
-- verejné čítanie (bucket-y sú public, používajú sa getPublicUrl)
create policy "public read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('service-images','web-images','logos','form-templates','voice-notes'));
-- fotky zákaziek: nahráva a maže staff (admin + mechanik)
create policy "staff write service-images" on storage.objects for insert to authenticated
  with check (bucket_id = 'service-images' and is_staff());
create policy "staff update service-images" on storage.objects for update to authenticated
  using (bucket_id = 'service-images' and is_staff()) with check (bucket_id = 'service-images' and is_staff());
create policy "staff delete service-images" on storage.objects for delete to authenticated
  using (bucket_id = 'service-images' and is_staff());
-- web, logá, šablóny formulárov: iba admin
create policy "admin write other buckets" on storage.objects for insert to authenticated
  with check (bucket_id in ('web-images','logos','form-templates','voice-notes') and is_admin_safe());
create policy "admin update other buckets" on storage.objects for update to authenticated
  using (bucket_id in ('web-images','logos','form-templates','voice-notes') and is_admin_safe())
  with check (bucket_id in ('web-images','logos','form-templates','voice-notes') and is_admin_safe());
create policy "admin delete other buckets" on storage.objects for delete to authenticated
  using (bucket_id in ('web-images','logos','form-templates','voice-notes') and is_admin_safe());

commit;

select 'B-K OK' as result;
