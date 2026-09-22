import { createClient } from '@supabase/supabase-js';
import { getClientIp, isRateLimited, rateLimitResponse } from '@/app/lib/rateLimit';
import { posliUvitaciEmail } from '@/app/lib/welcomeEmail';
import { createMailTransport } from '@/app/lib/mailer';
import { getCompanySettings } from '@/app/lib/companySettings';

// Dokončenie samoobslužnej registrácie (audit 2026-09).
//
// Prečo to musí byť na serveri: keď je zapnuté potvrdenie e-mailu, supabase.auth.signUp()
// vráti používateľa, ale ŽIADNU reláciu. Zápis profilu z prehliadača preto zlyhá na RLS
// (auth.uid() je prázdne) a v systéme ostane účet bez profilu — taký zákazník sa nevie
// prihlásiť a admin mu účet nevie ani vytvoriť nanovo, lebo e-mail je obsadený.
// Presne takto vzniklo 16 nepoužiteľných účtov.
//
// Bez prihlásenia, preto prísne obmedzené:
//  - profil sa založí IBA účtu, ktorý existuje a profil ešte NEMÁ
//  - údaje sa berú z metadát účtu (zapísal ich Supabase pri registrácii), nie z požiadavky
//  - rola je vždy 'zakaznik'
//  - strop 5 volaní / 10 min / IP

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function najdiPouzivatela(sb, email) {
  // listUsers nemá filter podľa e-mailu, preto prejdeme stránky (účtov sú stovky, nie milióny)
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users || [];
    const found = users.find(u => (u.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < 200) return null;
  }
  return null;
}

export async function POST(request) {
  if (isRateLimited('registracia-dokoncit', getClientIp(request), 5, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').toString().trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: 'Neplatný e-mail' }, { status: 400 });
  }

  const sb = adminClient();

  const { data: existujuciProfil } = await sb
    .from('user_profiles').select('id').ilike('email', email).maybeSingle();
  if (existujuciProfil) {
    // Profil už je (napr. opakované odoslanie formulára) — nič nerobíme, ale netreba to hlásiť ako chybu
    return Response.json({ ok: true, profilVytvoreny: false });
  }

  const user = await najdiPouzivatela(sb, email);
  if (!user) {
    return Response.json({ error: 'Účet sa nenašiel' }, { status: 404 });
  }

  const m = user.user_metadata || {};
  const { error: profErr } = await sb.from('user_profiles').insert([{
    id: user.id,
    email,
    full_name: m.full_name || null,
    phone: m.phone || null,
    role: 'zakaznik',
    company_name: m.company_name || null,
    ico: m.ico || null,
    dic: m.dic || null,
    ic_dph: m.ic_dph || null,
    address: m.address || null,
    city: m.city || null,
    zip: m.zip || null,
    country: m.country || null,
    referral_source: m.referral_source || null,
    gdpr_consent_at: m.gdpr_consent_at || new Date().toISOString(),
    gdpr_consent_version: m.gdpr_consent_version || null,
    gdpr_marketing: m.gdpr_marketing ?? false,
  }]);

  if (profErr) {
    console.error('registracia-dokoncit profil:', profErr.message);
    return Response.json({ error: 'Interná chyba servera' }, { status: 500 });
  }

  // Vozidlá a zákazky, ktoré už na tento e-mail v systéme sú, naviažeme na nový účet
  await sb.from('vehicles').update({ owner_id: user.id })
    .is('owner_id', null).ilike('owner_email', email);
  await sb.from('job_tickets').update({ customer_id: user.id })
    .is('customer_id', null).ilike('customer_email', email);

  // Uvítací e-mail zákazníkovi
  await posliUvitaciEmail({ email, name: m.full_name || null, createdByAdmin: false });

  // Upozornenie do servisu, že pribudol nový klient
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const company = await getCompanySettings();
      const klientiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.autoalma.sk'}/klienti`;
      const meno = m.company_name || m.full_name || email;
      const riadky = [
        ['Meno', meno],
        ['Typ', m.company_name ? 'Firma / Živnostník' : 'Súkromná osoba'],
        ['E-mail', email],
        m.phone ? ['Telefón', m.phone] : null,
      ].filter(Boolean).map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap">${k}</td>
          <td style="padding:8px 0;color:#222;font-weight:bold">${v}</td>
        </tr>`).join('');

      const transporter = createMailTransport();
      await transporter.sendMail({
        from: `"${company.name}" <${process.env.SMTP_USER}>`,
        to: company.email,
        subject: `Nový zákazník v Garáži: ${meno}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
            <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
              <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">${company.name} · Registrácia</p>
              <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">👤 Nový zákazník</h1>
            </div>
            <table style="width:100%;border-collapse:collapse">${riadky}</table>
            <div style="margin-top:28px;text-align:center">
              <a href="${klientiUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">Otvoriť klientov</a>
            </div>
          </div>`,
      });
    }
  } catch (e) {
    console.error('registracia-dokoncit notifikacia:', e.message);
  }

  return Response.json({ ok: true, profilVytvoreny: true });
}
