import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
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

  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const path = url.pathname;

  const ADMIN_ROUTES = [
    '/dashboard', '/klienti', '/kalendar', '/zakazky', '/CP',
    '/faktury', '/nastavenia', '/databaza', '/spravovat-web',
    '/statistiky', '/prijem', '/historia',
  ];
  const isAdminRoute    = ADMIN_ROUTES.some(r => path === r || path.startsWith(r + '/'));
  const isMechanikRoute = path.startsWith('/mechanik');
  const isGarazRoute    = path.startsWith('/garaz');

  if (!session) {
    if (isAdminRoute || isMechanikRoute || isGarazRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return res;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role;

  if (isAdminRoute && role !== 'admin') {
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  if (isMechanikRoute && role !== 'mechanik') {
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

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
