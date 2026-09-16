-- Číslovanie faktúr bez dier: uvoľnené číslo na vrchu radu dostane ďalšia faktúra.
--
-- Čo bolo zle:
--   Zrušená faktúra si číslo rezervovala pre svoju zákazku natrvalo. Keď sa
--   zákazka už znova nevystavila, číslo ostalo visieť v zásobníku a ďalšie
--   faktúry ho preskočili. Stav 16. 9. 2026: existuje F26044, v zásobníku visia
--   F26045–F26048, ďalšia faktúra by dostala F26049.
--
-- Nové pravidlo (frontend sa nemení, podpis funkcie ostáva):
--   1) Zákazka, ktorá si číslo uvoľnila, ho dostane späť — ak príde prvá.
--   2) Inak ďalšia faktúra (ktorejkoľvek zákazky) dostane najnižšie voľné číslo
--      na vrchu radu, t. j. hneď za poslednou skutočne existujúcou faktúrou.
--      Rad tak nikdy nepreskočí číslo. Dnes to znamená F26045, potom 46, 47, 48.
--   3) Diery vnútri radu (zrušená F26040, keď už existuje F26044) ostávajú len
--      pre pôvodnú zákazku alebo na ručné zadanie — dať ich cudzej faktúre
--      s neskorším dátumom by rozbilo chronológiu.
--
-- Navyše: generovanie zamyká riadok počítadla, takže dve faktúry vystavené
-- naraz nemôžu dostať to isté číslo.
--
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv).

-- ── počítadlo aspoň na danú hodnotu ───────────────────────────────────
-- Vo vlastnej funkcii zámerne: generate_invoice_number má parameter "prefix"
-- a ON CONFLICT (prefix) by tam bolo nejednoznačné voči rovnomennému stĺpcu.
CREATE OR REPLACE FUNCTION public.invoice_counter_at_least(p_prefix text, p_n int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  INSERT INTO invoice_counters AS ic (prefix, last_number) VALUES (p_prefix, p_n)
  ON CONFLICT (prefix) DO UPDATE SET last_number = greatest(ic.last_number, p_n);
END;
$fn$;

-- ── generovanie čísla ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_invoice_number(prefix text, p_job_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE pfx text; reserved text; n int; kandidat text;
BEGIN
  pfx := prefix || to_char(now() AT TIME ZONE 'Europe/Bratislava', 'YY');

  -- 1) vlastné rezervované číslo zákazky (najnižšie, ak ich má viac)
  IF p_job_id IS NOT NULL THEN
    SELECT p.invoice_number INTO reserved
      FROM public.invoice_number_pool p
     WHERE p.job_id = p_job_id AND p.used_at IS NULL AND p.prefix = pfx
     ORDER BY p.invoice_number
     LIMIT 1
     FOR UPDATE SKIP LOCKED;
    IF reserved IS NOT NULL THEN
      UPDATE public.invoice_number_pool SET used_at = now() WHERE invoice_number = reserved;
      RETURN reserved;
    END IF;
  END IF;

  -- 2) zamkneme počítadlo a zosunieme ho cez voľné čísla na vrchu radu
  SELECT ic.last_number INTO n FROM invoice_counters ic WHERE ic.prefix = pfx FOR UPDATE;
  n := COALESCE(n, 0);

  WHILE n > 0 AND EXISTS (
    SELECT 1 FROM public.invoice_number_pool p
     WHERE p.prefix = pfx AND p.used_at IS NULL
       AND p.invoice_number = pfx || lpad(n::text, 3, '0')
  ) LOOP
    n := n - 1;
  END LOOP;
  -- n = posledné číslo, ktoré naozaj sedí (existuje, alebo nebolo uvoľnené)

  n := n + 1;
  kandidat := pfx || lpad(n::text, 3, '0');

  -- ak to číslo visí v zásobníku (rezervované pre inú zákazku), berieme ho
  UPDATE public.invoice_number_pool
     SET used_at = now(), job_id = COALESCE(p_job_id, job_id)
   WHERE invoice_number = kandidat AND used_at IS NULL;

  PERFORM public.invoice_counter_at_least(pfx, n);
  RETURN kandidat;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.generate_invoice_number(text, uuid) TO authenticated;

-- Kontrola bez vedľajších účinkov (nič nevydá, len ukáže, čo by dostala ďalšia faktúra):
--   SELECT ic.prefix, ic.last_number,
--          (SELECT count(*) FROM invoice_number_pool p WHERE p.prefix = ic.prefix AND p.used_at IS NULL) AS volne_v_zasobniku
--     FROM invoice_counters ic WHERE ic.prefix IN ('F26', 'A26');
