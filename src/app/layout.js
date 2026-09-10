import './globals.css';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname,
                  anonymize_ip: true,
                  cookie_flags: 'SameSite=None;Secure'
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}