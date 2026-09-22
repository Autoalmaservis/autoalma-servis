-- Čas uzatvorenia zákazky (kliknutie na "Dokončené") — predvolený "dátum vyhotovenia"
-- na faktúre. Spustiť v Supabase SQL editore (projekt zffelujnebefjixejavv).
alter table public.job_tickets add column if not exists completed_at timestamptz;

-- Backfill pre už uzavreté zákazky
update public.job_tickets
   set completed_at = coalesce(updated_at, created_at)
 where completed_at is null
   and status in ('Dokončené', 'Archivované');
