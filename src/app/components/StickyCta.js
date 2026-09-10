'use client';
import { useRouter } from 'next/navigation';
import { trackPhoneClick, trackBookingCta } from '@/app/lib/analytics';

// Lepiaca lišta na mobile. Väčšina návštev z reklamy je z telefónu
// a hlavná konverzia v servise je hovor — preto musí byť stále na obrazovke.
export default function StickyCta({ source = 'podstranka' }) {
  const router = useRouter();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-3 py-3 flex gap-3">
      <a
        href="tel:0940449449"
        onClick={() => trackPhoneClick(`sticky-${source}`)}
        className="flex-1 bg-zinc-900 border border-zinc-700 text-white py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest text-center"
      >
        📞 Zavolať
      </a>
      <button
        onClick={() => { trackBookingCta(`sticky-${source}`); router.push('/objednavka'); }}
        className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-red-600/25"
      >
        📅 Objednať termín
      </button>
    </div>
  );
}
