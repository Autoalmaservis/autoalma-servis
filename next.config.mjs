/** @type {import('next').NextConfig} */

// Presmerovania zo starej štruktúry webu (pred prerobením) na nové adresy.
// Dôvod: staré URL adresy zostali v Google Ads reklamách, v organických
// výsledkoch vyhľadávania, v záložkách a v starých príspevkoch na Facebooku.
// Bez týchto presmerovaní končia všetky na 404 — Google Ads kvôli tomu
// zamietol reklamy s dôvodom "Nefungujúci cieľ".
const redirects = async () => [
  // --- Staré "doplnkové služby" -------------------------------------------
  { source: '/doplnkove-sluzby/cistenie-dpf-kat', destination: '/cistenie-dpf', permanent: true },
  { source: '/doplnkove-sluzby/dekarbonizacia', destination: '/sluzby/mechanicke-prace/dekarbonizacia', permanent: true },
  { source: '/doplnkove-sluzby/chiptuning', destination: '/sluzby/elektro-diagnostika/chiptuning', permanent: true },
  // Klimatizačné služby musia byť PRED zberným pravidlom nižšie, inak by
  // skončili na mechanických prácach — to je iná kategória.
  { source: '/doplnkove-sluzby/plnenie-klimatizacie', destination: '/sluzby/klimatizacia/plnenie-klimatizacie', permanent: true },
  { source: '/doplnkove-sluzby/dezinfekcia-ozonom', destination: '/sluzby/klimatizacia/cistenie-ozonom', permanent: true },
  { source: '/doplnkove-sluzby/:slug*', destination: '/sluzby/mechanicke-prace', permanent: false },

  // --- Staré stránky služieb ----------------------------------------------
  { source: '/autoservis', destination: '/sluzby/mechanicke-prace', permanent: true },

  // --- Staré podstránky /autoservis/... ------------------------------------
  // Zoznam adries pochádza z Google Ads → konverzná akcia clickKontakt →
  // karta Webové stránky (rozsah „Od začiatku"). Sú to stránky, na ktoré
  // reálne chodila platená návštevnosť starého webu. Bez presmerovania
  // vracali 404 — napr. /autoservis/vymena-oleja malo 243 konverzií.
  { source: '/autoservis/vymena-oleja', destination: '/sluzby/mechanicke-prace/pravidelny-servis', permanent: true },
  { source: '/autoservis/vymena-brzd', destination: '/sluzby/mechanicke-prace/vymena-brzd', permanent: true },
  { source: '/autoservis/vymena-rozvodov', destination: '/sluzby/mechanicke-prace/vymena-rozvodov', permanent: true },
  { source: '/autoservis/vymena-spojky-a-prevodovky', destination: '/sluzby/mechanicke-prace/spojka-a-prevodovka', permanent: true },
  { source: '/autoservis/oprava-podvozku', destination: '/sluzby/mechanicke-prace/oprava-podvozku', permanent: true },
  { source: '/autoservis/mechanicke-prace', destination: '/sluzby/mechanicke-prace', permanent: true },
  // Prezúvanie patrí do pneuservisu, nie medzi mechanické práce.
  { source: '/autoservis/prezuvanie', destination: '/sluzby/pneuservis/prezuvanie-pneumatiky', permanent: true },
  { source: '/autoservis/:slug*', destination: '/sluzby/mechanicke-prace', permanent: false },

  // --- Staré podstránky /elektro-servis/... --------------------------------
  // Diagnostika ide na cieľovú stránku kampane, nie na výpis služby.
  { source: '/elektro-servis/diagnostika', destination: '/diagnostika-vozidiel', permanent: true },
  { source: '/elektro-servis/chiptuning', destination: '/sluzby/elektro-diagnostika/chiptuning', permanent: true },
  { source: '/elektro-servis/oprava-abs', destination: '/sluzby/elektro-diagnostika/oprava-abs', permanent: true },
  { source: '/elektro-servis/oprava-adblue', destination: '/sluzby/elektro-diagnostika/oprava-adblue', permanent: true },
  { source: '/elektro-servis/oprava-budikov', destination: '/sluzby/elektro-diagnostika/oprava-budikov', permanent: true },
  { source: '/elektro-servis/oprava-rjm', destination: '/sluzby/elektro-diagnostika/rjm-oprava', permanent: true },
  { source: '/elektro-servis', destination: '/sluzby/elektro-diagnostika', permanent: true },
  { source: '/elektro-servis/:slug*', destination: '/sluzby/elektro-diagnostika', permanent: false },
  { source: '/mechanicke-prace', destination: '/sluzby/mechanicke-prace', permanent: true },
  { source: '/pneuservis', destination: '/sluzby/pneuservis', permanent: true },
  { source: '/klimatizacia', destination: '/sluzby/klimatizacia', permanent: true },
  { source: '/elektro-diagnostika', destination: '/sluzby/elektro-diagnostika', permanent: true },
  { source: '/chiptuning', destination: '/sluzby/elektro-diagnostika/chiptuning', permanent: true },

  // --- Čistenie DPF (hlavná reklamná stránka) ------------------------------
  { source: '/cistenie/dpf', destination: '/cistenie-dpf', permanent: true },
  { source: '/cistenie/filtra', destination: '/cistenie-dpf', permanent: true },
  { source: '/cistenie-dpf-filtra', destination: '/cistenie-dpf', permanent: true },
  { source: '/cistenie-dpf-filtrov', destination: '/cistenie-dpf', permanent: true },
  { source: '/dpf', destination: '/cistenie-dpf', permanent: true },

  // --- Výmeny --------------------------------------------------------------
  { source: '/vymena/oleja', destination: '/sluzby/mechanicke-prace/pravidelny-servis', permanent: true },
  { source: '/vymena-oleja', destination: '/sluzby/mechanicke-prace/pravidelny-servis', permanent: true },
  { source: '/servisna-prehliadka', destination: '/sluzby/mechanicke-prace/pravidelny-servis', permanent: true },
  { source: '/vymena/brzd', destination: '/sluzby/mechanicke-prace/vymena-brzd', permanent: true },
  { source: '/vymena-brzd', destination: '/sluzby/mechanicke-prace/vymena-brzd', permanent: true },
  { source: '/vymena/rozvodov', destination: '/sluzby/mechanicke-prace/vymena-rozvodov', permanent: true },
  { source: '/vymena-rozvodov', destination: '/sluzby/mechanicke-prace/vymena-rozvodov', permanent: true },
  { source: '/oprava-podvozku', destination: '/sluzby/mechanicke-prace/oprava-podvozku', permanent: true },

  // --- Sekcie, ktoré sú dnes kotvami na hlavnej stránke --------------------
  { source: '/kontakt', destination: '/#kontakt', permanent: true },
  // /kontakty tu ZAMERNE nie je — je to interna admin stranka (src/app/(dashboard)/kontakty),
  // presmerovanie by ju prekrylo, lebo sa vyhodnocuje skor nez routing aj middleware.
  { source: '/sluzby', destination: '/#sluzby', permanent: true },
  { source: '/cennik', destination: '/#cennik', permanent: true },
  { source: '/recenzie', destination: '/#recenzie', permanent: true },
  { source: '/faq', destination: '/#faq', permanent: true },

  // --- Objednanie ----------------------------------------------------------
  { source: '/rezervacia', destination: '/objednavka', permanent: true },
  { source: '/objednat', destination: '/objednavka', permanent: true },
  { source: '/objednat-sa', destination: '/objednavka', permanent: true },
  { source: '/online-rezervacia', destination: '/objednavka', permanent: true },
];

// Bezpečnostné hlavičky (audit 2026-09). Zámerne bez Content-Security-Policy —
// tá by mohla zablokovať Google Analytics / fonty a treba ju ladiť osobitne.
const securityHeaders = [
  // Vynúti HTTPS na 1 rok aj pre subdomény (prehliadač si to zapamätá)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Stránku nejde vložiť do <iframe> na cudzom webe (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prehliadač neháda typ súboru (MIME sniffing)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Pri odchode na cudzí web sa neposiela celá URL (napr. /ponuka/<id>)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Mikrofón (zápisník – hlasové poznámky) a kamera (fotky mechanika) iba pre vlastnú doménu;
  // poloha a platby sa nepoužívajú vôbec
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=()' },
];

const headers = async () => [
  { source: '/(.*)', headers: securityHeaders },
];

const nextConfig = {
  redirects,
  headers,
};

export default nextConfig;
