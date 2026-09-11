'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { odkazNaSluzbu } from '@/app/lib/specialneStranky';
import { trackServiceClick } from '@/app/lib/analytics';

/*
  Vyhľadávanie služieb na hlavnej stránke.

  Ľudia z reklamy prichádzajú s vlastným výrazom („čistenie filtra", „výmenu
  oleja") a nemusia vedieť, pod ktorou službou to u nás nájdu. Preto má každá
  služba okrem názvu aj ďalšie slová, pod ktorými ju ľudia hľadajú. Hľadá sa
  bez ohľadu na diakritiku a skloňovanie — „výmenu oleja" nájde
  „Pravidelný servis" rovnako ako „výmena oleja".
*/

const DALSIE_SLOVA = {
  'Pravidelný servis': 'výmena oleja olej olejový filter filtre servisná prehliadka kontrola pred STK kvapaliny',
  'Výmena bŕzd': 'brzdy brzdové platničky kotúče bubny brzdová kvapalina škrípanie pískanie',
  'Oprava podvozku': 'tlmiče ramená guľové čapy ložiská silentbloky stabilizátor klepanie hrkotanie geometria',
  'Výmena rozvodov': 'rozvody rozvodový remeň reťaz kladka vodná pumpa napinák',
  'Čistenie DPF/CAT': 'filter filtra filtrov pevných častíc katalyzátor dpf fap sadze zanesený kontrolka regenerácia',
  'Spojka a prevodovka': 'spojka prevodovka radenie preklzuje dvojhmotnostný zotrvačník',
  'Dekarbonizácia': 'karbón uhlík sadze vodík hho klopkanie',
  'Diagnostika': 'kontrolka chyba chybové hlásenie check engine motor načítanie chýb',
  'Oprava / hľadanie elektrických závad': 'elektrika elektrina skrat kabeláž nefunguje poistka',
  'Chiptuning': 'výkon tuning úprava riadiacej jednotky',
  'Oprava ABS': 'abs kontrolka esp',
  'Oprava AdBlue': 'adblue močovina scr',
  'Oprava budíkov': 'budíky prístrojová doska tachometer',
  'Nahratie nových kľúčov': 'kľúč kľúče diaľkové ovládanie imobilizér',
  'RJM oprava': 'riadiaca jednotka motora ecu',
  'Čistenie ozónom': 'ozón zápach dezinfekcia smrad klimatizácia',
  'Plnenie klimatizácie': 'klíma klimatizácia chladivo nechladí doplnenie',
  'Kódovanie ventilov pneumatík': 'tpms senzor tlaku ventil',
  'Prehodenie kolies': 'kolesá prehodiť striedanie',
  'Prezúvanie pneumatiky': 'pneumatiky gumy zimné letné prezutie prezuť prezúvanie',
  'Vyvažovanie': 'vibrácie volant vyváženie',
  'Vyrovnávanie diskov': 'disk krivý disk elektróny plechové',
};

const bezDiakritiky = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Slovenčina skloňuje — „výmenu oleja" musí nájsť „výmena" aj „olej".
// Dlhším slovám odsekneme koncovku, krátke berieme celé.
const kmen = (slovo) => {
  if (slovo.length >= 6) return slovo.slice(0, -2);
  if (slovo.length === 5) return slovo.slice(0, -1);
  return slovo;
};

const MAX_VYSLEDKOV = 8;

export default function HladanieSluzieb({ services, cennik, toSlug }) {
  const [dopyt, setDopyt] = useState('');
  const [otvorene, setOtvorene] = useState(false);
  const [aktivny, setAktivny] = useState(0);
  const obal = useRef(null);
  const router = useRouter();

  // Index sa postaví raz — služby sú statické, cenník príde z DB o chvíľu neskôr.
  const polozky = useMemo(() => {
    const zoznam = [];
    for (const kat of services) {
      for (const nazov of kat.items) {
        zoznam.push({
          typ: 'sluzba',
          nazov,
          kategoria: kat.name,
          ikona: kat.icon,
          href: odkazNaSluzbu(kat.slug, toSlug(nazov)),
          vNazve: bezDiakritiky(nazov),
          vsetko: bezDiakritiky(`${nazov} ${kat.name} ${DALSIE_SLOVA[nazov] || ''}`),
        });
      }
    }
    for (const kat of cennik || []) {
      for (const p of kat.items || []) {
        zoznam.push({
          typ: 'cena',
          nazov: p.name,
          poznamka: p.note,
          cena: p.price,
          kategoria: kat.name,
          ikona: kat.icon || '💶',
          href: '#cennik',
          vNazve: bezDiakritiky(p.name),
          vsetko: bezDiakritiky(`${p.name} ${p.note || ''} ${kat.name}`),
        });
      }
    }
    return zoznam;
  }, [services, cennik, toSlug]);

  const vysledky = useMemo(() => {
    const slova = bezDiakritiky(dopyt).split(/\s+/).filter(s => s.length >= 2).map(kmen);
    if (!slova.length) return [];
    return polozky
      .map((p, poradie) => {
        if (!slova.every(s => p.vsetko.includes(s))) return null;
        // Zhoda priamo v názve je cennejšia než zhoda v pomocných slovách;
        // služby idú pred cenníkom, lebo majú vlastnú stránku s vysvetlením.
        const skore = (slova.every(s => p.vNazve.includes(s)) ? 2 : 0) + (p.typ === 'sluzba' ? 1 : 0);
        return { p, skore, poradie };
      })
      .filter(Boolean)
      .sort((a, b) => b.skore - a.skore || a.poradie - b.poradie)
      .slice(0, MAX_VYSLEDKOV)
      .map(v => v.p);
  }, [dopyt, polozky]);

  useEffect(() => { setAktivny(0); }, [dopyt]);

  // Klik mimo zavrie zoznam.
  useEffect(() => {
    const mimo = (e) => { if (obal.current && !obal.current.contains(e.target)) setOtvorene(false); };
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, []);

  const otvorit = (p) => {
    setOtvorene(false);
    if (p.typ === 'sluzba') trackServiceClick(p.nazov, 'Hľadanie');
    if (p.href.startsWith('#')) {
      document.getElementById(p.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(p.href);
    }
  };

  const klavesa = (e) => {
    if (!vysledky.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAktivny(a => (a + 1) % vysledky.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktivny(a => (a - 1 + vysledky.length) % vysledky.length); }
    else if (e.key === 'Enter') { e.preventDefault(); otvorit(vysledky[aktivny]); }
    else if (e.key === 'Escape') { setOtvorene(false); }
  };

  const zobrazitZoznam = otvorene && dopyt.trim().length >= 2;

  return (
    <div ref={obal} className="relative w-full max-w-lg mb-6 text-left">
      <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 focus-within:border-red-600/60 rounded-2xl px-5 py-4 transition-colors">
        <span className="text-zinc-500 text-base">🔍</span>
        <input
          type="search"
          value={dopyt}
          onChange={(e) => { setDopyt(e.target.value); setOtvorene(true); }}
          onFocus={() => setOtvorene(true)}
          onKeyDown={klavesa}
          placeholder="Čo potrebujete? Napr. výmena oleja, čistenie DPF…"
          aria-label="Hľadať službu"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-white placeholder:text-zinc-600 [&::-webkit-search-cancel-button]:hidden"
        />
        {dopyt && (
          <button
            onClick={() => { setDopyt(''); setOtvorene(false); }}
            aria-label="Vymazať"
            className="text-zinc-600 hover:text-zinc-300 text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {zobrazitZoznam && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black z-40">
          {vysledky.length === 0 ? (
            <div className="px-5 py-5">
              <p className="text-white text-sm font-bold">Toto sme v zozname nenašli.</p>
              <p className="text-zinc-400 text-[12px] font-bold mt-1 leading-relaxed">
                Neznamená to, že to nerobíme — zavolajte{' '}
                <a href="tel:0940449449" className="text-red-500">0940 449 449</a>, poradíme hneď.
              </p>
            </div>
          ) : (
            <ul role="listbox">
              {vysledky.map((p, i) => (
                <li key={`${p.typ}-${p.nazov}-${p.kategoria}`} role="option" aria-selected={i === aktivny}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => otvorit(p)}
                    onMouseEnter={() => setAktivny(i)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left border-b border-zinc-900 last:border-0 transition-colors ${i === aktivny ? 'bg-zinc-900' : 'hover:bg-zinc-900/60'}`}
                  >
                    <span className="text-xl shrink-0">{p.ikona}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-white text-sm font-bold truncate">{p.nazov}</span>
                      <span className="block text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-0.5 truncate">
                        {p.typ === 'cena' ? `Cenník · ${p.kategoria}` : p.kategoria}
                      </span>
                    </span>
                    {p.typ === 'cena'
                      ? <span className="text-red-500 font-black text-sm shrink-0">{p.cena}</span>
                      : <span className="text-zinc-600 text-sm shrink-0">→</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
