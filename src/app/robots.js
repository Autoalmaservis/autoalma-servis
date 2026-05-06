export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/', '/zakazky/', '/klienti/', '/kalendar/', '/CP/',
          '/faktury/', '/nastavenia/', '/databaza/', '/spravovat-web/',
          '/statistiky/', '/prijem/', '/historia/', '/mechanik/', '/garaz/',
          '/login',
        ],
      },
    ],
    sitemap: 'https://autoalma.sk/sitemap.xml',
  };
}
