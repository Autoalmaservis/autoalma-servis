import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // 1. Overíme, či je používateľ vôbec prihlásený (má session)
  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const path = url.pathname;

  const ADMIN_ROUTES = [
    '/dashboard', '/klienti', '/kalendar', '/zakazky', '/CP',
    '/faktury', '/nastavenia', '/databaza', '/spravovat-web',
    '/statistiky', '/prijem', '/historia',
  ];
  const isAdminRoute   = ADMIN_ROUTES.some(r => path === r || path.startsWith(r + '/'));
  const isMechanikRoute = path.startsWith('/mechanik');
  const isGarazRoute   = path.startsWith('/garaz');

  // Ak nie je prihlásený — presmeruj na login
  if (!session) {
    if (isAdminRoute || isMechanikRoute || isGarazRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return res;
  }

  // 2. Ak je prihlásený, vytiahneme jeho rolu z tabuľky user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role;

  // 3. LOGIKA BLOKOVANIA (Smerovanie podľa oprávnenia)

  // Mechanik nemôže do admin sekcie
  if (isAdminRoute && role !== 'admin') {
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Admin nemôže do sekcie mechanika
  if (isMechanikRoute && role !== 'mechanik') {
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Zákazník patrí do garáže
  if ((isAdminRoute || isMechanikRoute) && role === 'zakaznik') {
    url.pathname = '/garaz';
    return NextResponse.redirect(url);
  }

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
    '/mechanik/:path*',
    '/garaz/:path*',
  ],
};