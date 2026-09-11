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
  { source: '/doplnkove-sluzby/:slug*', destination: '/sluzby/mechanicke-prace', permanent: false },

  // --- Staré stránky služieb ----------------------------------------------
  { source: '/autoservis', destination: '/sluzby/mechanicke-prace', permanent: true },
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
  { source: '/vymena/rozvodov', destination: '/sluzby/mechanicke-prace', permanent: true },
  { source: '/vymena-rozvodov', destination: '/sluzby/mechanicke-prace', permanent: true },
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

const nextConfig = {
  redirects,
};

export default nextConfig;
