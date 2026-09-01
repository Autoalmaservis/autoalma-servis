-- Vráti poradové číslo faktúry späť do počítadla, ak ide o POSLEDNÉ vydané číslo.
-- Volá sa pri zrušení faktúry (/faktury/[id] → "Zrušiť faktúru / Otvoriť zákazku"),
-- aby v číslovaní nevznikali diery.
--
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv).

CREATE OR REPLACE FUNCTION public.release_invoice_number(inv_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  updated int;
BEGIN
  UPDATE invoice_counters ic
     SET last_number = ic.last_number - 1
   WHERE inv_number LIKE ic.prefix || '%'
     AND substring(inv_number from length(ic.prefix) + 1) ~ '^[0-9]+$'
     AND ic.last_number = substring(inv_number from length(ic.prefix) + 1)::int
     AND ic.last_number > 0;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.release_invoice_number(text) TO authenticated;
