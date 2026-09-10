import './globals.css';
import Script from 'next/script';
import CookieConsent from '@/app/components/CookieConsent';

// Hodnota NEXT_PUBLIC_GA_ID ma na zaciatku neviditelny BOM znak (ulozena ako UTF-8 with BOM),
// takze sa gtag nacitaval ako ?id=%EF%BB%BFG-250VH3NKCB — taky identifikator Google odmietne
// a GA4 nezbiera vobec ziadne udaje. Preto BOM a biele znaky odstranujeme.
const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || '').replace(/[\uFEFF\u200B\s]/g, '');

// Microsoft Clarity \u2014 nahr\u00E1vky n\u00E1v\u0161tev a teplotn\u00E9 mapy. Rovnak\u00E9 \u010Distenie
// hodnoty, aby sa nezopakoval ten ist\u00FD probl\u00E9m ako pri GA4.
const CLARITY_ID = (process.env.NEXT_PUBLIC_CLARITY_ID || '').replace(/[\uFEFF\u200B\s]/g, '');

export const metadata = {
  metadataBase: new URL('https://autoalma.sk'),
  icons: {
    icon: '/autoalma-icon.png',
    apple: '/autoalma-icon.png',
    shortcut: '/autoalma-icon.png',
  },
  manifest: '/manifest.json',
  title: {
    default: 'Autoservis Bratislava – Podunajské Biskupice | AutoAlma',
    template: '%s | AutoAlma Servis',
  },
  description: 'Autoservis v Bratislave – Podunajských Biskupiciach. Servis, diagnostika, klimatizácia, pneuservis, DPF aj STK. Cenu schválite vopred v mobile. Hodnotenie 4,6 zo 148 recenzií. Svornosti 119, Po–Pi 8:00–16:00.',
  keywords: [
    'autoservis Bratislava', 'autoservis Podunajské Biskupice', 'autoservis Vrakuňa',
    'oprava auta Bratislava', 'servis auta Bratislava', 'elektrodiagnostika Bratislava',
    'pneuservis Bratislava', 'chiptuning Bratislava', 'čistenie DPF Bratislava',
    'klimatizácia auto Bratislava', 'STK Bratislava', 'AutoAlma', 'autoservis Svornosti',
    'výmena oleja Bratislava', 'výmena bŕzd Bratislava', 'oprava podvozku Bratislava',
  ],
  authors: [{ name: 'AutoAlma Servis' }],
  creator: 'AutoAlma Servis',
  publisher: 'AutoAlma Servis',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: 'https://autoalma.sk',
    siteName: 'AutoAlma Servis',
    title: 'Autoservis Bratislava – Podunajské Biskupice | AutoAlma',
    description: 'Servis, diagnostika, klimatizácia, pneuservis aj DPF. Cenovú ponuku schválite vopred v mobile. Svornosti 119, Bratislava – Podunajské Biskupice.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://autoalma.sk',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body className="bg-black text-white antialiased" suppressHydrationWarning>
        {children}
        {GA_ID && (
          <>
            {/* Celé nastavenie merania beží v jednom skripte a MUSÍ byť
                beforeInteractive. Dôvody sú dva:

                1. Predvolený stav súhlasu musí byť zapísaný skôr, než sa načíta
                   gtag — inak by sa stihli uložiť cookies bez súhlasu.
                2. Príkaz `config` musí byť vo fronte skôr než akákoľvek udalosť.
                   gtag spracúva frontu v poradí; udalosť zapísaná pred `config`
                   nemá kam patriť a zahodí sa. Presne preto sa strácala udalosť
                   prvého kroku objednávky, ktorá vzniká hneď pri zobrazení. */}
            <Script id="gtag-init" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  analytics_storage: 'denied',
                  wait_for_update: 500
                });
                gtag('set', 'ads_data_redaction', true);
                gtag('set', 'url_passthrough', true);
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  cookie_flags: 'SameSite=None;Secure'
                });

                // Služobný prehliadač (prihlásil sa v ňom zamestnanec) sa nemeria.
                // Značku nastavuje MarkInternalTraffic v rozloženiach dashboardu a dielne.
                try {
                  if (localStorage.getItem('autoalma_internal') === '1') {
                    window['ga-disable-${GA_ID}'] = true;
                  }
                } catch (e) {}
              `}
            </Script>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
          </>
        )}
        {CLARITY_ID && (
          <Script id="clarity-init" strategy="afterInteractive">
            {`
              // V služobnom prehliadači sa Clarity vôbec nespustí — inak by boli
              // v nahrávkach z väčšej časti vaši vlastní ľudia.
              var jeInterny = false;
              try { jeInterny = localStorage.getItem('autoalma_internal') === '1'; } catch (e) {}
              if (!jeInterny) {
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${CLARITY_ID}");
              }
            `}
          </Script>
        )}
        <CookieConsent />
      </body>
    </html>
  );
}