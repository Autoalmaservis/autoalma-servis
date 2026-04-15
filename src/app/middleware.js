import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // 1. Overíme, či je používateľ vôbec prihlásený (má session)
  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Ak nie je prihlásený a skúša ísť do chránenej zóny, pošli ho na login
  if (!session) {
    if (path.startsWith('/dashboard') || path.startsWith('/mechanik') || path.startsWith('/garaz')) {
      url.pathname = '/login'; // Tu uprav na tvoju reálnu login cestu ak je iná
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
  
  // Ak mechanik lezie do dashboardu technika
  if (path.startsWith('/dashboard') && role !== 'admin') {
    url.pathname = '/unauthorized'; // Stránka "Nemáte prístup"
    return NextResponse.redirect(url);
  }

  // Ak admin (prijímací technik) lezie do rozhrania mechanika (voliteľné, ak mu to chceš zakázať)
  if (path.startsWith('/mechanik') && role !== 'mechanik') {
    // Ak chceš, aby admin mohol všetko, túto podmienku vymaž
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Ak zákazník lezie k mechanikom alebo do dashboardu
  if ((path.startsWith('/dashboard') || path.startsWith('/mechanik')) && role === 'zakaznik') {
    url.pathname = '/garaz'; // Zákazníka vždy vrátime do jeho garáže
    return NextResponse.redirect(url);
  }

  return res;
}

// Tento riadok hovorí Next.js, na ktoré adresy má Middleware dávať pozor
export const config = {
  matcher: ['/dashboard/:path*', '/mechanik/:path*', '/garaz/:path*'],
};