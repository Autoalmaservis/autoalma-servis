import { createClient } from '@supabase/supabase-js';

// Overenie volajúceho v API routes (audit 2026-09).
// Registrácia zákazníkov je otvorená, takže "prihlásený" = ktokoľvek —
// routes, ktoré posielajú SMS/e-maily alebo pália kredit, musia vyžadovať rolu.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Vráti { user, role } alebo null (bez tokenu / neplatný token). */
export async function getCaller(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await sb.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  return { user, role: profile?.role || null };
}

/** Ľubovoľný prihlásený používateľ (zákazník, mechanik, admin). */
export async function requireUser(request) {
  return getCaller(request);
}

/** Iba admin (dashboard). */
export async function requireAdmin(request) {
  const caller = await getCaller(request);
  return caller?.role === 'admin' ? caller : null;
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
