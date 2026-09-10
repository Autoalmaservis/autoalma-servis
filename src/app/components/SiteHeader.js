'use client';
import Link from 'next/link';
import { trackPhoneClick } from '@/app/lib/analytics';

// Jednoduchá hlavička pre podstránky a cieľové stránky.
// Telefón je viditeľný aj na mobile — na servisných stránkach je hovor hlavná konverzia.
export default function SiteHeader({ back = '/', backLabel = '← Späť' }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-blue-500/25">
      <div className="nav-stripe" />
      <div className="flex items-center justify-between px-5 md:px-12 py-4 gap-4">
        <Link href="/" className="text-xl font-black uppercase italic tracking-tighter hover:opacity-80 transition-all shrink-0">
          Auto<span className="text-red-600">Alma</span>
        </Link>
        <div className="flex items-center gap-3 md:gap-5">
          <a
            href="tel:0940449449"
            onClick={() => trackPhoneClick('header')}
            className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-all"
          >
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            0940 449 449
          </a>
          <Link
            href={back}
            className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl"
          >
            {backLabel}
          </Link>
        </div>
      </div>
      <div className="nav-stripe" />
    </nav>
  );
}
