-- Oprava párovania histórie vozidiel (2026-09-22)
--
-- Problém: /prijem ukladal meno zákazníka presne tak, ako prišlo z formulára,
-- takže 112 zákaziek má v customer_name medzeru navyše ("katarina gelo ").
-- Karta klienta hľadá históriu podľa presnej zhody mena → história "zmizla".
-- Od teraz sa mená orezávajú už pri ukladaní; toto vyčistí existujúce záznamy.

begin;

-- 1. Medzery navyše v zákazkách (aj dvojité medzery vnútri mena)
update public.job_tickets
   set customer_name = regexp_replace(btrim(customer_name), '\s+', ' ', 'g')
 where customer_name is not null
   and customer_name <> regexp_replace(btrim(customer_name), '\s+', ' ', 'g');

update public.job_tickets
   set customer_email = lower(btrim(customer_email))
 where customer_email is not null and customer_email <> lower(btrim(customer_email));

update public.job_tickets
   set plate_number = upper(btrim(plate_number))
 where plate_number is not null and plate_number <> upper(btrim(plate_number));

-- 2. To isté v ostatných tabuľkách, kde sa meno používa na párovanie
update public.customers
   set full_name = regexp_replace(btrim(full_name), '\s+', ' ', 'g')
 where full_name is not null
   and full_name <> regexp_replace(btrim(full_name), '\s+', ' ', 'g');

update public.vehicles
   set owner_name = regexp_replace(btrim(owner_name), '\s+', ' ', 'g')
 where owner_name is not null
   and owner_name <> regexp_replace(btrim(owner_name), '\s+', ' ', 'g');

update public.vehicles
   set license_plate = upper(btrim(license_plate))
 where license_plate is not null and license_plate <> upper(btrim(license_plate));

update public.calendar_events
   set customer_name = regexp_replace(btrim(customer_name), '\s+', ' ', 'g')
 where customer_name is not null
   and customer_name <> regexp_replace(btrim(customer_name), '\s+', ' ', 'g');

-- 3. Doplnenie väzby zákazky na účet zákazníka.
--    job_tickets.customer_id odkazuje na user_profiles.id (účet), nie na customers.id.
--    Vyplníme len tam, kde e-mail jednoznačne sedí na práve jeden účet — vďaka tomu
--    história prežije aj premenovanie klienta a zákazník ju uvidí v Garáži.
update public.job_tickets t
   set customer_id = u.id
  from public.user_profiles u
 where t.customer_id is null
   and t.customer_email is not null and t.customer_email <> ''
   and lower(u.email) = lower(t.customer_email)
   and (select count(*) from public.user_profiles u2 where lower(u2.email) = lower(t.customer_email)) = 1;

-- 4. To isté pre vozidlá bez majiteľa
update public.vehicles v
   set owner_id = u.id
  from public.user_profiles u
 where v.owner_id is null
   and v.owner_email is not null and v.owner_email <> ''
   and lower(u.email) = lower(v.owner_email)
   and (select count(*) from public.user_profiles u2 where lower(u2.email) = lower(v.owner_email)) = 1;

commit;

-- Kontrola po spustení
select
  (select count(*) from job_tickets where customer_name <> btrim(customer_name)) as zakazky_s_medzerou,
  (select count(*) from job_tickets where customer_id is null) as zakazky_bez_uctu,
  (select count(*) from vehicles where owner_id is null) as vozidla_bez_majitela;
