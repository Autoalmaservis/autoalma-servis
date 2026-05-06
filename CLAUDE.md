# AutoAlma Servis — ERP systém (CLAUDE.md)

Interný servisný systém pre autoservis AutoAlma s.r.o., Bratislava, Svornosti 119.

## Tech Stack
- **Frontend**: Next.js 14 App Router, Tailwind CSS, `'use client'` komponenty
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Hosting**: Vercel
- **Supabase URL**: `zffelujnebefjixejavv.supabase.co`
- **Supabase client**: `src/app/lib/supabase.js` — `createClient` s `persistSession: true`, `autoRefreshToken: true`

## Štýl kódu
- Čierne pozadie (`bg-black`, `bg-zinc-950`), červené akcenty (`red-600`)
- Font: `font-black uppercase italic tracking-tighter` pre nadpisy
- Zaoblené rohy: `rounded-[2rem]`, `rounded-[1.5rem]`
- Tailwind utility-first, žiadne externé UI knižnice

## Štruktúra routes

### Verejné (bez prihlásenia)
| URL | Súbor | Popis |
|-----|-------|-------|
| `/` | `src/app/page.js` | Hlavná stránka — hero, služby, galéria, kontakt |
| `/login` | `src/app/login/page.js` | Prihlásenie (email + heslo) |
| `/sluzby/[slug]/[item]` | `src/app/sluzby/[slug]/[item]/page.js` | Detail služby |
| `/garaz` | `src/app/(public)/garaz/page.js` | Zákaznícky portál — stav auta, objednanie |
| `/objednavka` | `src/app/(public)/objednavka/page.js` | Verejná objednávka |
| `/ponuka/[id]` | `src/app/(public)/ponuka/[id]/page.js` | Cenová ponuka pre zákazníka |

### Dashboard (len admin, `/login` → rola `admin`)
| URL | Súbor | Popis |
|-----|-------|-------|
| `/dashboard` | `(dashboard)/dashboard/page.js` | Prehľad |
| `/prijem` | `(dashboard)/prijem/page.js` | Príjem auta — vytvorenie zákazky |
| `/zakazky` | `(dashboard)/zakazky/page.js` | Zoznam zákaziek |
| `/zakazky/[id]` | `(dashboard)/zakazky/[id]/page.js` | Detail zákazky — položky, úkony, foto, fakturácia |
| `/klienti` | `(dashboard)/klienti/page.js` | Klienti a vozidlá |
| `/kalendar` | `(dashboard)/kalendar/page.js` | Plán servisu |
| `/CP` | `(dashboard)/CP/page.js` | Cenové ponuky |
| `/faktury` | `(dashboard)/faktury/page.js` | Faktúry a odložené doklady |
| `/databaza` | `(dashboard)/databaza/page.js` | Normy prác + materiál/diely |
| `/nastavenia` | `(dashboard)/nastavenia/page.js` | Zamestnanci, hodinové sadzby, firma |
| `/statistiky` | `(dashboard)/statistiky/page.js` | Štatistiky — tržby, hodiny mechanikov |
| `/spravovat-web` | `(dashboard)/spravovat-web/page.js` | Správa webu — sekcie, galéria |
| `/spravovat-web/[slug]` | `(dashboard)/spravovat-web/[slug]/page.js` | Detail sekcie webu |
| `/spravovat-web/galeria` | `(dashboard)/spravovat-web/galeria/page.js` | Správa galérie fotiek |

### Mechanik (rola `mechanik`)
| URL | Súbor | Popis |
|-----|-------|-------|
| `/mechanik` | `src/app/mechanik/page.js` | Zákazky mechanika, kalendár, voľno |
| `/mechanik/login` | `src/app/mechanik/login/page.js` | Login pre mechanika |

## Supabase tabuľky

### Zákazky
- **`job_tickets`**: Zákazky. Stĺpce: `id, customer_name, plate_number, status, assigned_worker_id, car_brand_model, vin_number, mileage, fuel_type, customer_phone, customer_email, customer_id, created_at`
  - `status`: `'Prebieha'`, `'Dokončené'`, `'Archivované'`, `'Čaká na schválenie'`
  - `assigned_worker_id` → FK na `employees.id` (**DÔLEŽITÉ**: nie `employee_id`!)
- **`job_items`**: Položky zákazky. Stĺpce: `id, job_id, name, quantity, unit, unit_price, type`
  - `type`: `'Práca'` (unit=hod, quantity=hodiny) alebo `'Materiál'`
- **`job_tasks`**: Úkony/tasky zákazky. Stĺpce: `id, job_id, description, is_completed`
- **`job_photos`**: Fotky zákazky. Stĺpce: `id, job_id, url, storage_path`

### Faktúry a doklady
- **`invoices`**: `id, invoice_number, customer_name, car_details(jsonb), total_amount, is_official(bool), created_at`
  - `is_official=true` → vystavená faktúra, `is_official=false` → odložená
- **`price_offers`**: Cenové ponuky. `id, job_id, offer_number, total_amount, items_json, status, created_at`

### Zákazníci a vozidlá
- **`customers`**: `id, name, phone, email, address, city, zip, client_type, company_name, ico, dic, ic_dph`
- **`vehicles`**: `id, owner_id, license_plate, brand_model, vin, year`
- **`user_profiles`**: `id, role` — rola: `'admin'`, `'mechanik'`, `'zakaznik'`

### Zamestnanci
- **`employees`**: `id, name, email, color, role, active`
  - `color`: hex farba pre kalendár/štatistiky
  - `active`: boolean — aktívni zamestnanci

### Kalendár
- **`calendar_events`**: `id, title, plate_number, employee_id, start_datetime, end_datetime, issue_description, status, is_confirmed`
  - `plate_number = 'BLOK'` → blokovaný čas (dovolenka/voľno)
  - `employee_id = null` na BLOK → blokovaní všetci mechanici
  - `is_confirmed = false` → neschválená objednávka (bliká v sidebari)

### Normy a katalóg
- **`service_norms`**: `id, service_name, duration_minutes, category_id`
- **`service_categories`**: `id, name`
- **`inventory_catalog`**: Katalóg materiálov/dielov

### Web a galéria
- **`web_sections`**: `id, slug, icon, name, description, items(jsonb), image_urls(jsonb), sort_order`
- **`gallery_photos`**: `id, url, caption, sort_order, created_at` — fotky pre galériu na hlavnej stránke
- **`business_settings`**: `id(text), value` — nastavenia firmy (company_name, company_ico, rate_categories...)

## Supabase Storage buckets
- **`web-images`**: Obrázky pre sekcie webu (`web-images/[slug]/items/...`) a galériu (`gallery/...`)
- **`service-images`**: Fotky zákaziek

## Auth a RLS
- Session: localStorage cez `supabase.auth.signInWithPassword()`
- Middleware (`src/app/middleware.js`): `@supabase/auth-helpers-nextjs`, chráni všetky dashboard/mechanik/garaz routes
- **POZOR**: Všetky write operácie (INSERT/UPDATE/DELETE) vyžadujú platný JWT. Pred write-mi volať `ensureAuth()` (pridané do zakazky/[id]/page.js)
- RLS polícia na `job_items` INSERT vyžaduje `TO authenticated`

## Hodinové sadzby
Uložené v `business_settings` pod kľúčom `rate_categories` ako JSON:
```json
[{"key": "M1", "label": "Základná mechanická", "value": "35"},
 {"key": "M2", "label": "Prémiová mechanická", "value": "45"},
 {"key": "E1", "label": "Elektrodiagnostika", "value": "55"},
 {"key": "E2", "label": "Špeciálne elektro", "value": "65"}]
```

## Štatistiky — ako sa počítajú hodiny mechanikov
Hodiny sa berú z `job_items` kde `type = 'Práca'`, `quantity` = počet hodín.
Mechanik sa identifikuje cez `job_tickets.assigned_worker_id` (nie `employee_id`!).
Query: `job_tickets` → `job_items(type='Práca')` → group by `assigned_worker_id`.

## Dostupnosť pre zákazníkov (garaz/objednávka)
- `fetchAvailability` v `/garaz/page.js` počíta počet obsadených mechanikov per deň
- BLOK eventy sa počítajú zvlášť: `null employee_id` = blokovaní všetci
- Farby dní: zelená < 40%, oranžová 40–80%, červená ≥ 80%, šedá = plné

## Dôležité vzory

### Diakritikou-nezávislé vyhľadávanie
```js
const nd = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
```

### Slug generovanie (s diakritikou)
```js
slug.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
```

### Kontaktné a fakturačné údaje
- Tel: 0940 449 449, 0908 647 227
- Adresa: Svornosti 119, 821 06 Bratislava
- Email: autoalma@autoalma.sk
- IČO: 46044876 | DIČ: 2023194316 | IČ DPH: SK2023194316

## Čo bolo postavené/upravené (chronológia)
1. Zákaznícky portál `/garaz` — stav auta, história, objednávanie, schvaľovanie prác
2. Databáza noriem prác — `/databaza` s kategóriami a ~173 normami
3. Vyhľadávanie noriem s diakritikou v `/databaza` a v objednávacom modali `/garaz`
4. Dostupnostný kalendár v `/garaz` — 3-úrovňové farby dní vrátane BLOK eventov
5. Mechanický portál `/mechanik` — zákazky, kalendár, správa voľna/dovolenky
6. Správa galérie `/spravovat-web/galeria` — upload, order, lightbox
7. Dynamická galéria na hlavnej stránke (`page.js`) — masonry grid, lightbox
8. Fakturačné údaje v kontaktnej sekcii hlavnej stránky
9. Pneuservis sekcia v Naše Služby na hlavnej stránke
10. Štatistiky `/statistiky` — KPI karty, trend, hodiny mechanikov per zákazka
11. Fix middleware — chráni všetky dashboard routes (predtým len `/dashboard/*`)
12. Fix 401 chyby — `ensureAuth()` pred write operáciami v zákazke
