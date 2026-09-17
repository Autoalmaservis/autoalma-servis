-- ============================================================
-- Doplnok k indexy_vykon.sql — 17. 9. 2026
--
-- Zistenie: tabuľka `invoices` NEMÁ stĺpec `plate_number`
-- (index idx_invoices_plate_number sa preto preskočil).
-- SPZ je uložená len v JSONB stĺpci car_details ->> 'plate'.
--
-- Bežný index sa na ILIKE použiť nedá, ale GIN index s rozšírením
-- pg_trgm áno — a presne to táto stránka (/garaz) potrebuje.
--
-- VRÁTENIE SPÄŤ: sql/indexy_vykon_rollback.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_invoices_plate_trgm
  ON public.invoices
  USING gin ((car_details ->> 'plate') gin_trgm_ops);

-- job_tickets už mal vlastný index idx_plate_number na to isté,
-- takže ten môj je duplicitný a len spomaľuje zápisy — mažem ho.
DROP INDEX IF EXISTS public.idx_job_tickets_plate;

ANALYZE public.invoices;
