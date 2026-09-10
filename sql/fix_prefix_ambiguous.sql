-- Oprava chyby: "column reference "prefix" is ambiguous" pri vystavení faktúry.
--
-- Príčina:
--   generate_invoice_number má parameter s názvom "prefix" a tabuľka
--   invoice_counters má rovnako pomenovaný stĺpec. V klauzule
--   ON CONFLICT (prefix) Postgres nevie, či myslíme parameter alebo stĺpec.
--   Túto klauzulu si totiž rozoberá ako výraz, kde platia aj premenné funkcie
--   (na rozdiel od zoznamu stĺpcov v INSERT ... (prefix, last_number), ktorý
--   je vždy len stĺpec — preto tam problém nie je).
--   Postgres si telo funkcie plánuje až pri prvom behu, takže vytvorenie
--   funkcie prešlo bez chyby a spadlo to až pri prvej vystavenej faktúre.
--
-- Riešenie:
--   Posun počítadla sme presunuli do pomocnej funkcie, ktorá premennú "prefix"
--   nemá — tam je ON CONFLICT (prefix) jednoznačne stĺpec. Podpis
--   generate_invoice_number(prefix, p_job_id) ostáva nezmenený, takže
--   frontend netreba upravovať ani znova nasadzovať.
--
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv).

-- ── posun počítadla pre daný prefix (atomicky, jedným príkazom) ────────
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

GRANT EXECUTE ON FUNCTION public.generate_invoice_number(text, uuid) TO authenticated;

-- Kontrola (malo by vrátiť ďalšie číslo a posunúť počítadlo o 1):
--   SELECT public.generate_invoice_number('F');
--   SELECT prefix, last_number FROM invoice_counters ORDER BY prefix;
