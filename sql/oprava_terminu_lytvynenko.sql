-- Oprava objednávky, ktorá sa v kalendári nezobrazovala (2026-09-22)
--
-- Objednávka Ivana Lytvynenka (BL676XC) mala koniec PRED začiatkom:
--   začiatok 2026-09-30 16:00, koniec 2026-09-30 00:00
-- Vzniklo to zle vypočítaným dátumom konca (čas prešiel cez polnoc, ale dátum
-- ostal pôvodný). Udalosť so záporným trvaním kalendár nevykreslí, hoci
-- upozornenie na neschválenú žiadosť ju započítalo — odtiaľ ten rozpor.
--
-- Nové pravidlo (rovnaké ako v kóde, src/app/lib/terminy.js): zákazník privezie
-- auto 30. 9. o 16:00, ale pracovný čas je 8:00–16:00, takže práca (480 min)
-- sa začne ráno najbližšieho pracovného dňa — štvrtok 1. 10., 8:00–16:00.

begin;

update public.calendar_events
   set start_datetime = '2026-10-01T08:00:00',
       end_datetime   = '2026-10-01T16:00:00',
       customer_note  = 'Odhadované trvanie: 480 min. | 🚗 Auto privezie 30. 9. 2026 o 16:00 — práca naplánovaná na najbližší pracovný deň od rána. | Poznámka zákazníka: Čistenie DPF filtra a EGR ventila, z nasledujúcej STK/EK'
 where id = '65b20902-82c8-4e3a-888a-0282f94e4c13'
   and end_datetime <= start_datetime;   -- poistka: neprepíše už opravený záznam

commit;

-- Kontrola: nemá zostať žiadna udalosť so záporným trvaním
select count(*) as pokazenych_terminov
  from public.calendar_events
 where end_datetime <= start_datetime;
