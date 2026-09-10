'use client';
import { useState, useEffect } from 'react';
import { setConsent } from '@/app/lib/analytics';

const KEY = 'autoalma_cookie_consent';

// Lišta so súhlasom s cookies.
// Bez súhlasu beží GA4 v režime Consent Mode v2 — neukladá cookies ani
// identifikátory, posiela len anonymné signály. Po súhlase sa meranie
// a remarketing v Google Ads zapnú naplno.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { }
    if (saved === 'granted') {
      setConsent(true);
    } else if (saved !== 'denied') {
      // Ešte sa nerozhodol — ukážeme lištu (s malým odkladom, nech neprekryje úvod hneď)
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const decide = (granted) => {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch { }
    setConsent(granted);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Súhlas s cookies"
      className="fixed inset-x-0 bottom-0 z-[400] md:bottom-4 md:left-4 md:right-auto md:max-w-md"
    >
      <div className="bg-zinc-950 border-t md:border border-zinc-800 md:rounded-2xl p-5 md:p-6 shadow-2xl mb-20 md:mb-0">
        <p className="text-white font-black uppercase italic tracking-tight text-sm mb-2">
          Používame cookies
        </p>
        <p className="text-zinc-400 text-xs font-bold leading-relaxed mb-4">
          Pomáhajú nám zistiť, ktoré služby ľudí zaujímajú a či sa im dá objednať bez problémov.
          Bez vášho súhlasu nič neukladáme.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => decide(true)}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 px-5 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all"
          >
            Súhlasím
          </button>
          <button
            onClick={() => decide(false)}
            className="flex-1 bg-transparent hover:bg-zinc-900 border border-zinc-700 text-zinc-300 py-3 px-5 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all"
          >
            Iba nevyhnutné
          </button>
        </div>
      </div>
    </div>
  );
}
