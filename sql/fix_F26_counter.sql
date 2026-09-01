-- Jednorazová oprava: počítadlo F26 zostalo na 34, hoci posledná existujúca
-- faktúra je F26030 (čísla F26031–F26034 sa spálili pri opakovanom
-- vystavení/zrušení, žiadna faktúra s nimi neexistuje).
-- Po spustení dostane ďalšia faktúra číslo F26031.
--
-- Spustiť v Supabase → SQL Editor (projekt zffelujnebefjixejavv).

UPDATE invoice_counters
   SET last_number = 30
 WHERE prefix = 'F26'
   AND last_number = 34;

-- Kontrola:
SELECT prefix, last_number FROM invoice_counters WHERE prefix = 'F26';
