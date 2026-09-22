-- Kontrola kampane „prihlásenie je opravené" (e-maily odoslané 2026-09-22 14:17 UTC)
--
-- Komu e-mail odišiel: 10 zákazníkov, ktorých účet ostal bez profilu a preto sa
-- nevedeli prihlásiť. Zoznam je pevný, aby sa výsledok dal porovnať kedykoľvek.
--
-- „Prihlásil sa po e-maile" = auth.users.last_sign_in_at je novší ako čas odoslania.

with kampan(email) as (values
  ('impad1113@gmail.com'), ('baranpalo@gmail.com'), ('borecky@atlas.sk'),
  ('milos.mitrovic7@gmail.com'), ('mjuhliarik@gmail.com'), ('ne2la.ilavska@gmail.com'),
  ('alica.sctukova@gmail.com'), ('obchodnik8@gmail.com'), ('juba00731@gmail.com'),
  ('korossy.peter3@gmail.com')
),
-- Pri impad1113 je hranica posunutá: testovacia kópia e-mailu (s jeho skutočným
-- odkazom) prišla do firemnej schránky a odkaz tam bol otvorený 22.9. o 14:19:50 UTC.
-- Bez posunu by sa to počítalo ako jeho prihlásenie.
odoslane as (select timestamptz '2026-09-22 14:17:00+00' as cas)
select
  k.email,
  coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), p.full_name, '—') as meno,
  case when u.last_sign_in_at > (case when k.email = 'impad1113@gmail.com'
                                      then timestamptz '2026-09-22 14:21:00+00'
                                      else o.cas end)
       then 'ÁNO' else 'nie' end as prihlasil_sa_po_emaile,
  u.last_sign_in_at                                   as posledne_prihlasenie,
  (u.email_confirmed_at is not null)                  as email_potvrdeny,
  (select count(*) from vehicles v  where v.owner_id  = u.id) as vozidiel,
  (select count(*) from job_tickets t where t.customer_id = u.id) as zakaziek
from kampan k
join auth.users u on lower(u.email) = k.email
left join user_profiles p on p.id = u.id
cross join odoslane o
order by (u.last_sign_in_at > o.cas) desc, u.last_sign_in_at desc nulls last;
