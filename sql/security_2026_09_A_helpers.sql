-- Bezpečnostný audit 2026-09-22 — Krok A: pomocné objekty (žiadna zmena správania)

-- is_staff(): admin alebo aktívny zamestnanec (mechanici bez user_profiles sa overia cez employees)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role in ('admin','mechanik'))
      or exists (select 1 from employees where id = auth.uid() and coalesce(active, true));
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- is_admin_safe(): iba hardening search_path, logika rovnaká
create or replace function public.is_admin_safe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role = 'admin');
$$;

-- View pre obsadenosť kalendára: beží ako vlastník (obchádza RLS), ale vystavuje iba 3 stĺpce
create or replace view public.calendar_slots with (security_invoker = false) as
  select start_datetime, end_datetime, employee_id from public.calendar_events;
grant select on public.calendar_slots to anon, authenticated;

-- RPC: jedna ponuka podľa ID + údaje zákazky (verejný odkaz z SMS/e-mailu, bez možnosti listovať)
create or replace function public.get_price_offer(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', o.id, 'job_id', o.job_id, 'status', o.status, 'items_json', o.items_json,
    'total_amount', o.total_amount, 'customer_note', o.customer_note, 'created_at', o.created_at,
    'customer_id', o.customer_id, 'offer_number', o.offer_number,
    'job_tickets', case when j.id is null then null else json_build_object(
      'id', j.id, 'customer_id', j.customer_id, 'customer_name', j.customer_name,
      'customer_phone', j.customer_phone, 'customer_email', j.customer_email,
      'address', j.address, 'city', j.city, 'car_brand_model', j.car_brand_model,
      'plate_number', j.plate_number, 'vin_number', j.vin_number, 'mileage', j.mileage) end)
  from price_offers o left join job_tickets j on j.id = o.job_id
  where o.id = p_id;
$$;
revoke all on function public.get_price_offer(uuid) from public;
grant execute on function public.get_price_offer(uuid) to anon, authenticated;

select 'A OK' as result;
