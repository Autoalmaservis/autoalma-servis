import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/lib/apiAuth';
import { capitalizeName, normalizeEmail, normalizePhone } from '@/app/lib/textNormalize';

// Prístup do Garáže pre existujúceho klienta (audit 2026-09).
// - účet neexistuje  → vytvorí ho a vráti odkaz na nastavenie hesla
// - účet existuje    → vráti odkaz na nastavenie nového hesla
// Odkaz sa posiela naším SMTP v uvítacom e-maile, nie cez Supabase —
// Supabase má strop 2 e-maily za hodinu na celý projekt.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  if (!await requireAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const full_name = capitalizeName(body.full_name) || null;
  const phone = normalizePhone(body.phone) || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: 'Klient nemá platný e-mail' }, { status: 400 });
  }

  const sb = adminClient();

  // Existuje už účet s týmto e-mailom?
  const { data: profil } = await sb
    .from('user_profiles').select('id, role').ilike('email', email).maybeSingle();

  let userId = profil?.id || null;
  let vytvoreny = false;

  if (!userId) {
    const docasneHeslo = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email,
      password: docasneHeslo,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });
    if (authError) return Response.json({ error: authError.message }, { status: 400 });
    userId = authData?.user?.id;
    if (!userId) return Response.json({ error: 'Nepodarilo sa vytvoriť účet' }, { status: 500 });

    const { error: profileError } = await sb.from('user_profiles').insert([{
      id: userId, full_name, email, phone, role: 'zakaznik',
    }]);
    if (profileError) {
      await sb.auth.admin.deleteUser(userId).catch(() => {});
      return Response.json({ error: `Profil: ${profileError.message}` }, { status: 400 });
    }
    vytvoreny = true;

    // Vozidlá, ktoré klient dovtedy mal bez účtu, sa naviažu na nový účet,
    // aby ich v Garáži hneď videl.
    await sb.from('vehicles')
      .update({ owner_id: userId })
      .is('owner_id', null)
      .ilike('owner_email', email);

    // To isté pre zákazky — vďaka tomu mu v Garáži pribudne aj história.
    await sb.from('job_tickets')
      .update({ customer_id: userId })
      .is('customer_id', null)
      .ilike('customer_email', email);
  }

  // Odkaz na nastavenie hesla (platí obmedzený čas)
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.autoalma.sk';
  let setPasswordUrl = null;
  try {
    const { data: linkData } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${base}/login/update-password` },
    });
    setPasswordUrl = linkData?.properties?.action_link || null;
  } catch {
    setPasswordUrl = null;
  }

  return Response.json({ ok: true, userId, email, vytvoreny, setPasswordUrl });
}
