import { createMailTransport } from '@/app/lib/mailer';
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await supabase.auth.getUser(token);
  return !!user;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, name, password, createdByAdmin } = body;

    // Admin-created accounts (with credentials) require authentication
    if (createdByAdmin && !await isAuthenticated(request)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!email) return Response.json({ error: 'Chýba e-mail' }, { status: 400 });

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured — welcome email not sent');
      return Response.json({ ok: true, emailSent: false });
    }

    const garageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/garaz`;
    const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/login`;

    const credentialsBlock = createdByAdmin && password
      ? `<div style="margin-top:20px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px">
          <p style="color:#856404;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px;font-weight:bold">Vaše prihlasovacie údaje</p>
          <p style="margin:4px 0;font-size:13px;color:#333"><strong>E-mail:</strong> ${email}</p>
          <p style="margin:4px 0;font-size:13px;color:#333"><strong>Heslo:</strong> <span style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:4px">${password}</span></p>
          <p style="margin:12px 0 0;font-size:11px;color:#856404;font-weight:bold">⚠️ Odporúčame zmeniť heslo po prvom prihlásení.</p>
        </div>`
      : '';

    const introText = createdByAdmin
      ? `Prijímací technik AutoAlma Servis vám vytvoril prístup do zákazníckej zóny — <strong>Vašej Garáže</strong>.`
      : `Váš účet bol úspešne vytvorený. Vitajte v zákazníckej zóne AutoAlma Servis.`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis · Zákaznícka zóna</p>
          <h1 style="color:#111;font-size:22px;margin:0;font-style:italic;text-transform:uppercase">🔑 Váš prístup do Garáže</h1>
        </div>

        <p style="color:#333;font-size:14px;margin:0 0 16px">Dobrý deň${name ? `, <strong>${name}</strong>` : ''},</p>
        <p style="color:#333;font-size:14px;margin:0 0 20px">${introText}</p>

        ${credentialsBlock}

        <div style="margin-top:24px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px">Čo nájdete vo Vašej Garáži</p>
          <ul style="color:#333;font-size:13px;margin:0;padding-left:20px;line-height:1.8">
            <li>Stav a história Vášho vozidla</li>
            <li>Schvaľovanie servisných úkonov</li>
            <li>Online objednávanie termínu</li>
            <li>Správy a notifikácie od servisu</li>
          </ul>
        </div>

        <div style="margin-top:28px;text-align:center">
          <a href="${garageUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">
            🚗 Otvoriť moju Garáž
          </a>
        </div>

        <p style="color:#999;font-size:12px;margin-top:20px;text-align:center">
          Ak tlačidlo nefunguje, kliknite na: <a href="${loginUrl}" style="color:#ef4444">${loginUrl}</a>
        </p>
        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:16px">AutoAlma Servis · Svornosti 119, 821 06 Bratislava · autoalma.sk</p>
      </div>`;

    const subject = createdByAdmin
      ? `AutoAlma Servis — prístup do Vašej Garáže`
      : `Vitajte v AutoAlma Servis — Vaša Garáž je pripravená`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"AutoAlma Servis" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    return Response.json({ ok: true, emailSent: true });
  } catch (e) {
    console.error('welcome email error:', e.message);
    return Response.json({ ok: true, emailSent: false });
  }
}
