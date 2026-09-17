-- ============================================================
-- AutoAlma / servis.autoalma — indexy na zníženie Disk IO
-- Vytvorené: 2026-09-17
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv)
--
-- Bezpečné: každý index sa vytvára samostatne a ak stĺpec alebo
-- tabuľka neexistuje, riadok sa len preskočí (NOTICE), nespadne to.
-- Opakované spustenie nič nepokazí (IF NOT EXISTS).
--
-- VRÁTENIE SPÄŤ: spusti sql/indexy_vykon_rollback.sql
-- ============================================================

DO $$
DECLARE
  stmts text[] := ARRAY[
    -- zákazky a ich podriadené tabuľky (FK nemá v Postgrese index automaticky!)
    'CREATE INDEX IF NOT EXISTS idx_job_items_job_id        ON public.job_items (job_id)',
    'CREATE INDEX IF NOT EXISTS idx_job_tasks_job_id        ON public.job_tasks (job_id)',
    'CREATE INDEX IF NOT EXISTS idx_job_photos_job_id       ON public.job_photos (job_id)',
    'CREATE INDEX IF NOT EXISTS idx_job_forms_job_id        ON public.job_forms (job_id)',
    'CREATE INDEX IF NOT EXISTS idx_price_offers_job_id     ON public.price_offers (job_id)',

    -- zoznam zákaziek, filtre a štatistiky
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_created_at  ON public.job_tickets (created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_status      ON public.job_tickets (status)',
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_status_crat ON public.job_tickets (status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_plate       ON public.job_tickets (plate_number)',
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_worker      ON public.job_tickets (assigned_worker_id)',
    'CREATE INDEX IF NOT EXISTS idx_job_tickets_customer    ON public.job_tickets (customer_id)',

    -- kalendár a badge neschválených objednávok
    'CREATE INDEX IF NOT EXISTS idx_cal_events_start        ON public.calendar_events (start_datetime)',
    'CREATE INDEX IF NOT EXISTS idx_cal_events_conf_start   ON public.calendar_events (is_confirmed, start_datetime)',
    'CREATE INDEX IF NOT EXISTS idx_cal_events_employee     ON public.calendar_events (employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_cal_events_plate        ON public.calendar_events (plate_number)',

    -- vozidlá a klienti
    'CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id       ON public.vehicles (owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_vehicles_plate          ON public.vehicles (license_plate)',
    'CREATE INDEX IF NOT EXISTS idx_vehicles_owner_email    ON public.vehicles (owner_email)',
    'CREATE INDEX IF NOT EXISTS idx_user_profiles_role      ON public.user_profiles (role)',

    -- faktúry
    'CREATE INDEX IF NOT EXISTS idx_invoices_created_at     ON public.invoices (created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_official_crat  ON public.invoices (is_official, created_at DESC)',
    -- pozn.: invoices nemá stĺpec plate_number, SPZ je v JSONB — rieši to indexy_vykon_2.sql

    -- notifikácie, todo, kasa
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read)',
    'CREATE INDEX IF NOT EXISTS idx_todos_done              ON public.todos (done)',
    'CREATE INDEX IF NOT EXISTS idx_kasa_entries_type_date  ON public.kasa_entries (type, date DESC)',

    -- normy prác
    'CREATE INDEX IF NOT EXISTS idx_service_norms_category  ON public.service_norms (category_id)'
  ];
  s text;
  ok int := 0;
  skipped int := 0;
BEGIN
  FOREACH s IN ARRAY stmts LOOP
    BEGIN
      EXECUTE s;
      ok := ok + 1;
    EXCEPTION WHEN others THEN
      skipped := skipped + 1;
      RAISE NOTICE 'PRESKOCENE: % -> %', s, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Hotovo. Vytvorene/existujuce: %, preskocene: %', ok, skipped;
END $$;

-- Po vytvorení indexov zaktualizuj štatistiky plánovača
ANALYZE;
