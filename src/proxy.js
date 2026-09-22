import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Serverová ochrana routes (Next.js 16: proxy.js = bývalý middleware.js).
// POZOR: musí byť v src/proxy.js — v src/app/ ho Next.js ignoruje.
// Relácia prichádza v cookies (src/app/lib/supabase.js používa createBrowserClient).

const ADMIN_ROUTES = [
  '/dashboard', '/klienti', '/kalendar', '/zakazky', '/CP',
  '/faktury', '/nastavenia', '/databaza', '/spravovat-web',
  '/statistiky', '/prijem', '/historia',
  '/kasa', '/sms-email', '/kontakty', '/todo', '/zapisnik',
];

export async function proxy(req) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const url = req.nextUrl.clone();
  const path = url.pathname;

  const isAdminRoute    = ADMIN_ROUTES.some(r => path === r || path.startsWith(r + '/'));
  const isMechanikLogin = path === '/mechanik/login';
  const isMechanikRoute = path.startsWith('/mechanik') && !isMechanikLogin;
  const isGarazRoute    = path.startsWith('/garaz');

  if (!isAdminRoute && !isMechanikRoute && !isGarazRoute) return res;

  // getUser() overuje JWT na serveri Supabase (na rozdiel od getSession, ktorý iba číta cookie)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    url.pathname = isMechanikRoute ? '/mechanik/login' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role;

  if (isAdminRoute) {
    if (role === 'admin') return res;
    url.pathname = role === 'zakaznik' ? '/garaz' : '/unauthorized';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (isMechanikRoute) {
    // Mechanik nemusí mať user_profiles (Michal, Vlado) — rozhoduje aktívny záznam v employees.
    // Admin má prístup tiež (kontrola zákaziek mechanikov).
    if (role === 'admin' || role === 'mechanik') return res;
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (isStaff === true) return res;
    url.pathname = role === 'zakaznik' ? '/garaz' : '/unauthorized';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // /garaz: stačí prihlásenie (zákazník; admin si ju môže pozrieť tiež)
  return res;
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
