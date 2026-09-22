import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import GaleriaMriezka from './GaleriaMriezka';

export const metadata = {
  title: 'Galéria — fotky z našej dielne | AutoAlma Servis Bratislava',
  description: 'Pozrite si, ako u nás vyzerá práca na aute. Opravy motorov, rozvodov, bŕzd, spojky a prevodoviek v autoservise AutoAlma, Bratislava – Podunajské Biskupice.',
  alternates: { canonical: 'https://www.autoalma.sk/galeria' },
  openGraph: {
    title: 'Galéria z dielne | AutoAlma Servis Bratislava',
    description: 'Skutočné fotky z opráv — motory, rozvody, brzdy, spojky a prevodovky.',
    url: 'https://www.autoalma.sk/galeria',
    type: 'website',
    locale: 'sk_SK',
  },
};

export default function GaleriaPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.5em] mb-4">Naša práca</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-6">Galéria</h1>
            <p className="text-zinc-400 font-bold text-sm max-w-2xl mx-auto leading-relaxed">
              Fotky priamo z dielne — opravy motorov, rozvodov, bŕzd, spojky a prevodoviek.
              Takto vyzerá práca, ktorú za vás robíme.
            </p>
          </div>

          <GaleriaMriezka />

          <div className="text-center mt-20 pt-14 border-t border-zinc-900">
            <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter mb-4">
              Potrebujete opraviť auto?
            </h2>
            <p className="text-zinc-400 font-bold text-sm mb-8">
              Objednajte sa online za dve minúty — bez registrácie.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/objednavka"
                className="bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-tighter px-10 py-4 rounded-2xl text-sm transition-all shadow-xl"
              >
                📅 Objednať termín
              </Link>
              <a
                href="tel:0940449449"
                className="border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-black uppercase tracking-widest px-10 py-4 rounded-2xl text-[11px] transition-all"
              >
                📞 0940 449 449
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
