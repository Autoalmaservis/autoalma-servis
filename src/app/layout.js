import './globals.css';

export const metadata = {
  title: 'AutoAlma ERP',
  description: 'Systém správy autoservisu',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body className="bg-black text-white antialiased">
        {/* Tu sa bude vykresľovať buď (dashboard) so sidebarom, alebo (public) bez neho */}
        {children}
      </body>
    </html>
  );
}