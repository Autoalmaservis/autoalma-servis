import './globals.css';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata = {
  metadataBase: new URL('https://autoalma.sk'),
  title: {
    default: 'AutoAlma Servis | Autoservis Bratislava – Petržalka',
    template: '%s | AutoAlma Servis',
  },
  description: 'Autoservis v Bratislave, Petržalka. Mechanické práce, elektrodiagnostika, klimatizácia, pneuservis. Férovosť, transparentnosť a odbornosť. Svornosti 119, 821 06 Bratislava.',
  keywords: [
    'autoservis Bratislava', 'servis auta Petržalka', 'oprava auta Bratislava',
    'elektrodiagnostika Bratislava', 'pneuservis Bratislava', 'chiptuning Bratislava',
    'klimatizacia auto Bratislava', 'AutoAlma', 'autoservis Svornosti',
    'výmena oleja Bratislava', 'oprava podvozku Bratislava',
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
    title: 'AutoAlma Servis | Autoservis Bratislava – Petržalka',
    description: 'Autoservis v Bratislave, Petržalka. Mechanické práce, elektrodiagnostika, klimatizácia, pneuservis. Svornosti 119.',
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