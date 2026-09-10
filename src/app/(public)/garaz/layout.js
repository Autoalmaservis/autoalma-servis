import PwaGaraz from './PwaGaraz';

// Moja Garáž je samostatne inštalovateľná aplikácia pre zákazníka — má vlastný
// manifest a vlastnú ikonu, nezávisle od appky interného systému (/manifest.json).
export const metadata = {
  title: 'Moja Garáž',
  manifest: '/manifest-garaz.json',
  icons: {
    icon: '/icon-garaz-192.png',
    apple: '/icon-garaz-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Moja Garáž',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  themeColor: '#000000',
};

export default function GarazLayout({ children }) {
  return (
    <>
      {children}
      <PwaGaraz />
    </>
  );
}
