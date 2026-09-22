import { NextResponse } from 'next/server';

// Serverová ochrana routes (Next.js 16: proxy.js = bývalý middleware.js).
// POZOR: musí byť v src/proxy.js — v src/app/ ho Next.js ignoruje.
//
// Zámerne NEVOLÁ supabase.auth.getUser() ani dopyt do DB:
// proxy beží pri každej požiadavke vrátane prefetchov, ktoré Next.js posiela
// pre odkazy v sidebare (/zakazky, /klienti...). Súbežné getUser() volania si
// navzájom rotovali refresh token a pri presmerovaní sa novo nastavené cookies
// zahodili — používateľa to odhlásilo. Preto tu iba overíme, či relácia
// vôbec existuje (bez siete). O rolu sa stará klientsky guard v layoute
// a hlavne RLS v databáze, ktorá bez správnej roly nevydá žiadne dáta.

const ADMIN_ROUTES = [
  '/dashboard', '/klienti', '/kalendar', '/zakazky', '/CP',
  '/faktury', '/nastavenia', '/databaza', '/spravovat-web',
  '/statistiky', '/prijem', '/historia',
  '/kasa', '/sms-email', '/kontakty', '/todo', '/zapisnik',
];

// Relácia je v cookies sb-<ref>-auth-token (pri dlhom tokene rozdelená na .0, .1 ...)
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function proxy(req) {
  const path = req.nextUrl.pathname;

  const isAdminRoute    = ADMIN_ROUTES.some(r => path === r || path.startsWith(r + '/'));
  const isMechanikLogin = path === '/mechanik/login';
  const isMechanikRoute = path.startsWith('/mechanik') && !isMechanikLogin;
  const isGarazRoute    = path.startsWith('/garaz');

  if (!isAdminRoute && !isMechanikRoute && !isGarazRoute) {
    return NextResponse.next();
  }

  const maRelaciu = req.cookies.getAll().some(c => AUTH_COOKIE.test(c.name) && c.value);
  if (maRelaciu) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = isMechanikRoute ? '/mechanik/login' : '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/klienti/:path*',
    '/kalendar/:path*',
    '/zakazky/:path*',
    '/CP/:path*',
    '/faktury/:path*',
    '/nastavenia/:path*',
    '/databaza/:path*',
    '/spravovat-web/:path*',
    '/statistiky/:path*',
    '/prijem/:path*',
    '/historia/:path*',
    '/kasa/:path*',
    '/sms-email/:path*',
    '/kontakty/:path*',
    '/todo/:path*',
    '/zapisnik/:path*',
    '/mechanik/:path*',
    '/garaz/:path*',
  ],
};
