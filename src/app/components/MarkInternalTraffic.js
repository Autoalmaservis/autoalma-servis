'use client';
import { useEffect } from 'react';

export const INTERNAL_KEY = 'autoalma_internal';

// Označí prehliadač ako služobný.
//
// Vykresľuje sa v rozloženiach, ku ktorým sa dostane iba prihlásený zamestnanec
// (dashboard a dielňa). Od tej chvíle sa v tomto prehliadači nespúšťa Analytics
// ani Clarity — ani na verejnom webe. Vaše vlastné návštevy tak neskresľujú
// štatistiky, ktoré majú merať zákazníkov.
//
// Značka je uložená v localStorage, takže platí aj po odhlásení. Zruší sa
// vymazaním údajov stránky v prehliadači.
export default function MarkInternalTraffic() {
  useEffect(() => {
    try {
      if (localStorage.getItem(INTERNAL_KEY) !== '1') {
        localStorage.setItem(INTERNAL_KEY, '1');
      }
    } catch { }
  }, []);

  return null;
}
