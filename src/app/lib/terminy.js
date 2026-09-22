// Výpočet termínu práce pre objednávku zo zákazníckej zóny a z verejného formulára.
//
// Zákazník si vyberá, kedy auto PRIVEZIE. Čas samotnej práce sa ale musí zmestiť
// do pracovného času (8:00–16:00, Po–Pi). Keď zákazník privezie auto o 16:00,
// nemá zmysel zapísať prácu na 16:00–00:00 — auto len prenocuje a robí sa naň
// od rána nasledujúceho pracovného dňa.
//
// Bez tohto výpočtu vznikali udalosti s koncom PRED začiatkom (dátum sa bral
// z pôvodného dňa, hoci čas prešiel cez polnoc) a kalendár ich vôbec nevykreslil.

const MIN_TRVANIE = 30;      // kratší termín ako polhodina nemá v kalendári zmysel
const ZVYSOK_DNA_MIN = 30;   // ak do konca dňa ostáva menej, prácu presunieme na ďalší deň

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DDTHH:MM:00' z Date objektu, v lokálnom čase (nie UTC). */
export function naLokalnyText(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** 'HH:MM' → počet minút od polnoci. */
function naMinuty(hhmm, zaloha) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return zaloha;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Najbližší pracovný deň (Po–Pi) od zadaného dátumu vrátane. */
function najblizsiPracovnyDen(d) {
  const v = new Date(d);
  while (v.getDay() === 0 || v.getDay() === 6) v.setDate(v.getDate() + 1);
  return v;
}

/**
 * @param {string} datum   'YYYY-MM-DD' — deň, keď zákazník privezie auto
 * @param {string} cas     'HH:MM' — čas príchodu
 * @param {number} minuty  odhadované trvanie práce
 * @param {string} workStart  'HH:MM' (default 08:00)
 * @param {string} workEnd    'HH:MM' (default 16:00)
 * @returns {{startText, endText, presunute, prekracuje, prichodText, trvanieMin}}
 *   startText/endText — čo sa zapíše do calendar_events
 *   presunute  — práca sa presunula na iný deň, než kedy auto prichádza
 *   prekracuje — práca sa do jedného dňa nezmestila a pokračuje ďalší deň
 */
export function vypocitajTermin({ datum, cas, minuty, workStart = '08:00', workEnd = '16:00' }) {
  const trvanie = Math.max(MIN_TRVANIE, Number(minuty) || MIN_TRVANIE);
  const zaciatokDna = naMinuty(workStart, 8 * 60);
  const koniecDna = naMinuty(workEnd, 16 * 60);

  const prichod = new Date(`${datum}T${cas || workStart}:00`);
  const prichodMin = prichod.getHours() * 60 + prichod.getMinutes();

  const jePracovnyDen = prichod.getDay() !== 0 && prichod.getDay() !== 6;
  const zostava = koniecDna - Math.max(prichodMin, zaciatokDna);

  let start;
  let presunute = false;

  if (jePracovnyDen && zostava >= ZVYSOK_DNA_MIN) {
    // Stihne sa aspoň kúsok ešte dnes — práca začína príchodom
    start = new Date(prichod);
    if (prichodMin < zaciatokDna) start.setHours(Math.floor(zaciatokDna / 60), zaciatokDna % 60, 0, 0);
  } else {
    // Auto prenocuje — robí sa naň od rána najbližšieho pracovného dňa
    const dalsi = najblizsiPracovnyDen(new Date(prichod.getFullYear(), prichod.getMonth(), prichod.getDate() + 1));
    dalsi.setHours(Math.floor(zaciatokDna / 60), zaciatokDna % 60, 0, 0);
    start = dalsi;
    presunute = true;
  }

  const startMin = start.getHours() * 60 + start.getMinutes();
  const doKoncaDna = Math.max(MIN_TRVANIE, koniecDna - startMin);
  const trvanieDnes = Math.min(trvanie, doKoncaDna);

  const end = new Date(start.getTime() + trvanieDnes * 60000);

  return {
    startText: naLokalnyText(start),
    endText: naLokalnyText(end),
    presunute,
    prekracuje: trvanie > trvanieDnes,
    prichodText: naLokalnyText(prichod),
    trvanieMin: trvanie,
  };
}

/** Veta do poznámky pre technika — nech vidí, kedy auto naozaj príde. */
export function poznamkaKTerminu(t) {
  const [den, cas] = t.prichodText.split('T');
  const denSk = new Date(`${den}T12:00:00`).toLocaleDateString('sk-SK');
  const casSk = cas.slice(0, 5);
  const casti = [`Odhadované trvanie: ${t.trvanieMin} min.`];
  if (t.presunute) {
    casti.push(`🚗 Auto privezie ${denSk} o ${casSk} — práca naplánovaná na najbližší pracovný deň od rána.`);
  }
  if (t.prekracuje) {
    casti.push('⏳ Práca sa do jedného dňa nezmestí, pokračuje ďalší pracovný deň.');
  }
  return casti;
}
