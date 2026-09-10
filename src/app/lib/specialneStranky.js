/*
  Služby, ktoré majú vlastnú podrobnú stránku.

  Prečo to existuje: na čistenie DPF a na diagnostiku sme postavili samostatné
  stránky s vlastnou grafikou a obsahom. Bez tohto zoznamu by na tú istú službu
  viedli dve rôzne adresy — jedna z reklamy a druhá z menu. Zákazník by zakaždým
  videl niečo iné a Google by nevedel, ktorú z nich ukázať vo výsledkoch.

  Kľúč je `<slug kategórie>/<slug služby>`, hodnota je adresa vlastnej stránky.
  Odkazy v menu aj v zozname služieb vedú rovno sem a starú adresu presmerujeme.
*/
export const SPECIALNE_STRANKY = {
  'mechanicke-prace/cistenie-dpf-cat': '/cistenie-dpf',
  'elektro-diagnostika/diagnostika': '/diagnostika-vozidiel',
};

// Vráti vlastnú stránku pre danú službu, alebo null.
export function vlastnaStranka(slugKategorie, slugSluzby) {
  return SPECIALNE_STRANKY[`${slugKategorie}/${slugSluzby}`] || null;
}

// Adresa, na ktorú má viesť odkaz na službu — buď vlastná stránka, alebo bežný detail.
export function odkazNaSluzbu(slugKategorie, slugSluzby) {
  return vlastnaStranka(slugKategorie, slugSluzby) || `/sluzby/${slugKategorie}/${slugSluzby}`;
}
