'use client';
import { useState, useEffect } from 'react';

/**
 * Lepkavý filter pre zoznamy.
 *
 * Hľadaný výraz drží v URL (?q=...) aj v sessionStorage, takže prežije
 * odchod na detail a návrat späť. Platí kým ho používateľ nezmaže.
 *
 * @param {string} klucStranky - unikátny kľúč stránky, napr. 'zakazky'
 * @param {string} nazovParametra - názov query parametra v URL (default 'q')
 * @returns {[string, Function]} [vyraz, nastavVyraz]
 */
export function useStickyFilter(klucStranky, nazovParametra = 'q') {
  const ulozKluc = `filter:${klucStranky}`;

  const [vyraz, setVyraz] = useState(() => {
    if (typeof window === 'undefined') return '';
    const zUrl = new URLSearchParams(window.location.search).get(nazovParametra);
    if (zUrl !== null) return zUrl;
    try {
      return sessionStorage.getItem(ulozKluc) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (vyraz) sessionStorage.setItem(ulozKluc, vyraz);
      else sessionStorage.removeItem(ulozKluc);
    } catch {
      // súkromný režim prehliadača – filter potom neprežije obnovenie stránky
    }

    const url = new URL(window.location.href);
    if (vyraz) url.searchParams.set(nazovParametra, vyraz);
    else url.searchParams.delete(nazovParametra);
    window.history.replaceState(null, '', url.toString());
  }, [vyraz, ulozKluc, nazovParametra]);

  return [vyraz, setVyraz];
}
