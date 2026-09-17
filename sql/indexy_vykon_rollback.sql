-- ============================================================
-- VRÁTENIE SPÄŤ: zmaže všetky indexy vytvorené skriptom
-- indexy_vykon.sql (2026-09-17).
-- Zmazanie indexu NIKDY nezmaže dáta — len zrýchľovač.
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv)
-- ============================================================

DROP INDEX IF EXISTS public.idx_job_items_job_id;
DROP INDEX IF EXISTS public.idx_job_tasks_job_id;
DROP INDEX IF EXISTS public.idx_job_photos_job_id;
DROP INDEX IF EXISTS public.idx_job_forms_job_id;
DROP INDEX IF EXISTS public.idx_price_offers_job_id;

DROP INDEX IF EXISTS public.idx_job_tickets_created_at;
DROP INDEX IF EXISTS public.idx_job_tickets_status;
DROP INDEX IF EXISTS public.idx_job_tickets_status_crat;
DROP INDEX IF EXISTS public.idx_job_tickets_plate;
DROP INDEX IF EXISTS public.idx_job_tickets_worker;
DROP INDEX IF EXISTS public.idx_job_tickets_customer;

DROP INDEX IF EXISTS public.idx_cal_events_start;
DROP INDEX IF EXISTS public.idx_cal_events_conf_start;
DROP INDEX IF EXISTS public.idx_cal_events_employee;
DROP INDEX IF EXISTS public.idx_cal_events_plate;

DROP INDEX IF EXISTS public.idx_vehicles_owner_id;
DROP INDEX IF EXISTS public.idx_vehicles_plate;
DROP INDEX IF EXISTS public.idx_vehicles_owner_email;
DROP INDEX IF EXISTS public.idx_user_profiles_role;

DROP INDEX IF EXISTS public.idx_invoices_created_at;
DROP INDEX IF EXISTS public.idx_invoices_official_crat;
DROP INDEX IF EXISTS public.idx_invoices_plate_trgm;
-- pozn.: rozsirenie pg_trgm zamerne nechavame, nic nestoji a mozu ho pouzivat ine veci

DROP INDEX IF EXISTS public.idx_notifications_user_read;
DROP INDEX IF EXISTS public.idx_todos_done;
DROP INDEX IF EXISTS public.idx_kasa_entries_type_date;

DROP INDEX IF EXISTS public.idx_service_norms_category;
