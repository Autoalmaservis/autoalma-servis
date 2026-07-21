export const metadata = {
  title: 'Zápisník',
  manifest: '/manifest-zapisnik.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zápisník',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function ZapisnikLayout({ children }) {
  return children;
}
