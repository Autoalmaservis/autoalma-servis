-- Rezervácia čísel faktúr + manuálne číslo faktúry.
--
-- Načo to je:
--  1) Keď faktúru zrušíš (/faktury/[id] → "Zrušiť faktúru / Otvoriť zákazku"),
--     jej číslo sa odloží do zásobníka a zostane rezervované pre tú istú zákazku.
--     Po oprave údajov dostane nová faktúra to isté číslo — v číslovaní nevznikne diera.
--  2) Číslo faktúry sa dá zadať/zmeniť ručne (pri vystavení aj na hotovej faktúre).
--
-- Nahrádza pôvodné jednoargumentové generate_invoice_number / release_invoice_number
-- (sql/release_invoice_number.sql).
--
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv).

-- ── zásobník voľných / rezervovaných čísel ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_number_pool (
  invoice_number text PRIMARY KEY,
  prefix         text NOT NULL,
  job_id         uuid,
  is_official    boolean,
  released_at    timestamptz NOT NULL DEFAULT now(),
  used_at        timestamptz
);

CREATE INDEX IF NOT EXISTS invoice_number_pool_free_idx
  ON public.invoice_number_pool (job_id) WHERE used_at IS NULL;

ALTER TABLE public.invoice_number_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_number_pool_authenticated" ON public.invoice_number_pool;
CREATE POLICY "invoice_number_pool_authenticated"
  ON public.invoice_number_pool FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── pomocná: prefix (F26) z čísla faktúry (F26034) ─────────────────────
CREATE OR REPLACE FUNCTION public.invoice_prefix_of(p_number text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE pfx text;
BEGIN
  SELECT ic.prefix INTO pfx
    FROM invoice_counters ic
   WHERE p_number LIKE ic.prefix || '%'
     AND substring(p_number from length(ic.prefix) + 1) ~ '^[0-9]+$'
   ORDER BY length(ic.prefix) DESC
   LIMIT 1;
  -- fallback: posledné 3 číslice sú poradie, zvyšok je prefix
  IF pfx IS NULL THEN
    pfx := left(p_number, greatest(length(p_number) - 3, 1));
  END IF;
  RETURN pfx;
END;
$fn$;

-- Staré jednoargumentové verzie treba zahodiť — inak by volanie s jedným
-- argumentom bolo nejednoznačné oproti novým, ktoré majú druhý arg s DEFAULT.
DROP FUNCTION IF EXISTS public.generate_invoice_number(text);
DROP FUNCTION IF EXISTS public.release_invoice_number(text);

-- ── vrátenie čísla do zásobníka, viazané na zákazku ────────────────────
CREATE OR REPLACE FUNCTION public.release_invoice_number(inv_number text, p_job_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE pfx text;
BEGIN
  IF inv_number IS NULL OR btrim(inv_number) = '' THEN RETURN false; END IF;
  pfx := public.invoice_prefix_of(inv_number);
  INSERT INTO public.invoice_number_pool (invoice_number, prefix, job_id, released_at, used_at)
  VALUES (inv_number, pfx, p_job_id, now(), NULL)
  ON CONFLICT (invoice_number) DO UPDATE
    SET used_at     = NULL,
        released_at = now(),
        job_id      = COALESCE(excluded.job_id, invoice_number_pool.job_id);
  RETURN true;
END;
$fn$;

-- ── posun počítadla pre daný prefix ───────────────────────────────────
-- Zámerne vo vlastnej funkcii: generate_invoice_number má parameter "prefix"
-- a ON CONFLICT (prefix) by tam bolo nejednoznačné voči rovnomennému stĺpcu.
CREATE OR REPLACE FUNCTION public.bump_invoice_counter(p_prefix text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE n int;
BEGIN
  INSERT INTO invoice_counters AS ic (prefix, last_number) VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET last_number = ic.last_number + 1
  RETURNING ic.last_number INTO n;
  RETURN n;
END;
$fn$;

-- ── generovanie: najprv rezervované pre zákazku, inak počítadlo ────────
CREATE OR REPLACE FUNCTION public.generate_invoice_number(prefix text, p_job_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE pfx text; reserved text; n int;
BEGIN
  pfx := prefix || to_char(now() AT TIME ZONE 'Europe/Bratislava', 'YY');

  IF p_job_id IS NOT NULL THEN
    SELECT p.invoice_number INTO reserved
      FROM public.invoice_number_pool p
     WHERE p.job_id = p_job_id AND p.used_at IS NULL AND p.prefix = pfx
     ORDER BY p.released_at DESC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF reserved IS NOT NULL THEN
      UPDATE public.invoice_number_pool SET used_at = now() WHERE invoice_number = reserved;
      RETURN reserved;
    END IF;
  END IF;

  n := public.bump_invoice_counter(pfx);

  RETURN pfx || lpad(n::text, 3, '0');
END;
$fn$;

-- ── zabratie konkrétneho (ručne zadaného) čísla + posun počítadla ──────
CREATE OR REPLACE FUNCTION public.claim_invoice_number(p_number text, p_job_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE pfx text; suffix text; n int;
BEGIN
  IF p_number IS NULL OR btrim(p_number) = '' THEN RETURN false; END IF;

  UPDATE public.invoice_number_pool
     SET used_at = now(), job_id = COALESCE(p_job_id, job_id)
   WHERE invoice_number = p_number AND used_at IS NULL;

  pfx    := public.invoice_prefix_of(p_number);
  suffix := substring(p_number from length(pfx) + 1);
  IF suffix ~ '^[0-9]+$' THEN
    n := suffix::int;
    INSERT INTO invoice_counters AS ic (prefix, last_number) VALUES (pfx, n)
    ON CONFLICT (prefix) DO UPDATE SET last_number = greatest(ic.last_number, n);
  END IF;
  RETURN true;
END;
$fn$;

-- ── zmena čísla existujúcej faktúry ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_invoice_number(p_invoice_id uuid, p_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE old_num text; old_job uuid; new_num text;
BEGIN
  new_num := upper(btrim(p_number));
  IF new_num = '' THEN
    RAISE EXCEPTION 'Číslo faktúry nemôže byť prázdne';
  END IF;
  IF new_num !~ '^[A-Z0-9/-]{2,20}$' THEN
    RAISE EXCEPTION 'Neplatný formát čísla — povolené sú písmená, číslice, - a /';
  END IF;

  SELECT invoice_number, job_id INTO old_num, old_job FROM invoices WHERE id = p_invoice_id;
  IF old_num IS NULL THEN RAISE EXCEPTION 'Faktúra sa nenašla'; END IF;
  IF old_num = new_num THEN RETURN new_num; END IF;

  IF EXISTS (SELECT 1 FROM invoices WHERE invoice_number = new_num AND id <> p_invoice_id) THEN
    RAISE EXCEPTION 'Číslo % už používa iná faktúra', new_num;
  END IF;

  UPDATE invoices SET invoice_number = new_num WHERE id = p_invoice_id;
  PERFORM public.claim_invoice_number(new_num, old_job);
  PERFORM public.release_invoice_number(old_num, old_job);
  RETURN new_num;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.generate_invoice_number(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_invoice_number(text, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invoice_number(text, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_invoice_number(uuid, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_prefix_of(text)             TO authenticated;
