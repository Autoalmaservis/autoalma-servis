import fs from 'node:fs';
import path from 'node:path';

/*
  Miesto pre fotku.

  Ako to funguje: fotku stačí uložiť do priečinka  public/fotky/  pod menom,
  ktoré je uvedené v atribúte `nazov`. Stránka si ju sama nájde a zobrazí —
  v kóde netreba meniť nič. Kým tam fotka nie je, na jej mieste zostane rámik
  s popisom, aký záber tam patrí.

  Podporované prípony: .webp, .jpg, .jpeg, .png (v tomto poradí).
*/

const PRIPONY = ['.webp', '.jpg', '.jpeg', '.png'];

function najdiFotku(nazov) {
  for (const pripona of PRIPONY) {
    const subor = path.join(process.cwd(), 'public', 'fotky', nazov + pripona);
    try {
      if (fs.existsSync(subor)) return `/fotky/${nazov}${pripona}`;
    } catch { }
  }
  return null;
}

export default function FotoMiesto({
  nazov,
  popis,          // čo má byť na fotke — zobrazí sa v prázdnom rámiku
  alt,            // alternatívny text pre hotovú fotku
  pomer = 'aspect-[4/3]',
  className = '',
}) {
  const cesta = najdiFotku(nazov);

  if (cesta) {
    return (
      <figure className={`relative overflow-hidden rounded-2xl border border-zinc-800 bg-black ${pomer} ${className}`}>
        <img
          src={cesta}
          alt={alt || popis}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </figure>
    );
  }

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 ${pomer} ${className} flex flex-col items-center justify-center text-center px-5 py-6 gap-3`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-zinc-700 shrink-0" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 16l-5-5-6 6-2-2-5 4" />
      </svg>
      <p className="text-zinc-500 text-xs font-bold leading-relaxed max-w-[26ch]">{popis}</p>
      <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest font-mono">
        fotky/{nazov}.jpg
      </p>
    </div>
  );
}
