'use client';
import { useState, useEffect } from 'react';

// Registrácia service workera + ponuka na inštaláciu Mojej Garáže na plochu.
//
// Prečo vlastná ponuka: Chrome svoju vlastnú výzvu ukáže len občas a keď ju
// človek raz zavrie, ďalšie ~3 mesiace mlčí. Safari na iPhone neponúkne nič
// nikdy — tam sa to musí spraviť ručne cez Zdieľať, preto je pre iOS iný text.

const SKRYTE = 'garaz_pwa_skryte';

export default function PwaGaraz() {
  const [vyzva, setVyzva] = useState(null);   // beforeinstallprompt z Chrome
  const [iosNavod, setIosNavod] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registrácia zlyháva napr. v anonymnom okne. Appka funguje aj bez nej,
        // len sa nedá nainštalovať — nemá zmysel tým otravovať používateľa.
      });
    }

    // Už nainštalovaná (beží v samostatnom okne) → neponúkame nič.
    const uzNainstalovana =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (uzNainstalovana) return;

    let skryte = false;
    try { skryte = localStorage.getItem(SKRYTE) === '1'; } catch (e) {}
    if (skryte) return;

    const handler = (e) => {
      e.preventDefault();        // zabráni Chromu ukázať vlastnú lištu
      setVyzva(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const jeIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (jeIos) setIosNavod(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const zavriet = () => {
    try { localStorage.setItem(SKRYTE, '1'); } catch (e) {}
    setVyzva(null);
    setIosNavod(false);
  };

  const nainstalovat = async () => {
    if (!vyzva) return;
    vyzva.prompt();
    await vyzva.userChoice;
    // Výzvu sa dá použiť len raz; ďalšiu pošle prehliadač sám, keď uzná za vhodné.
    setVyzva(null);
  };

  if (!vyzva && !iosNavod) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-zinc-950 border border-zinc-800 rounded-[1.5rem] p-5 shadow-2xl shadow-black">
      <div className="flex items-start gap-4">
        <img src="/icon-garaz-192.png" alt="" className="w-12 h-12 rounded-xl bg-white shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black uppercase italic tracking-tighter text-base leading-tight">
            Moja Garáž ako aplikácia
          </p>
          <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
            {iosNavod
              ? 'Ťuknite dole na Zdieľať a potom na Pridať na plochu.'
              : 'Pridajte si ju na plochu telefónu — otvoríte ju jedným ťuknutím.'}
          </p>
        </div>
        <button
          onClick={zavriet}
          aria-label="Zavrieť"
          className="text-zinc-600 hover:text-zinc-300 text-xl leading-none shrink-0"
        >
          ×
        </button>
      </div>

      {!iosNavod && (
        <button
          onClick={nainstalovat}
          className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all"
        >
          Nainštalovať
        </button>
      )}
    </div>
  );
}
