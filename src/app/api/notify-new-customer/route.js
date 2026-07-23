import { createMailTransport } from '@/app/lib/mailer';
import { getCompanySettings } from '@/app/lib/companySettings';

export async function POST(request) {
  try {
    const { name, email, phone, clientType, companyName } = await request.json();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured — new customer notification not sent');
      return Response.json({ ok: true, emailSent: false });
    }

    const company = await getCompanySettings();
    const klientiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/klienti`;

    const displayName = clientType === 'Firma' ? (companyName || name) : name;

    const rows = [
      ['Meno', displayName || '—'],
      clientType === 'Firma' ? ['Typ', 'Firma / Živnostník'] : ['Typ', 'Súkromná osoba'],
      email ? ['E-mail', email] : null,
      phone ? ['Telefón', phone] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#222;font-weight:bold">${value}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">${company.name} · Webová registrácia</p>
          <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">👤 Nový zákazník</h1>
        </div>
        <p style="color:#333;font-size:14px;margin:0 0 20px">Zákazník sa zaregistroval cez web.</p>
        <table style="width:100%;border-collapse:collapse">${tableRows}</table>
        <div style="margin-top:28px;text-align:center">
          <a href="${klientiUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">
            👥 Otvoriť Klientov
          </a>
        </div>
        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:24px">${company.name} · ${company.web}</p>
      </div>`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.SMTP_USER}>`,
      to: company.email,
      subject: `Nový zákazník: ${displayName || email}`,
      html,
    });

    return Response.json({ ok: true, emailSent: true });
  } catch (e) {
    console.error('notify-new-customer error:', e.message);
    return Response.json({ ok: true, emailSent: false });
  }
}
