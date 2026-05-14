import { createMailTransport } from '@/app/lib/mailer';

export async function POST(request) {
  try {
    const { customerName, plateNumber, carModel, date, time, services, source, phone, email } = await request.json();

    if (!customerName?.trim() || !plateNumber?.trim()) {
      return Response.json({ error: 'Chýba meno zákazníka alebo ŠPZ' }, { status: 400 });
    }
    if (plateNumber.length > 20) {
      return Response.json({ error: 'Neplatné ŠPZ' }, { status: 400 });
    }
    if (services && services.length > 2000) {
      return Response.json({ error: 'Popis úkonov je príliš dlhý' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured — booking email not sent');
      return Response.json({ ok: true, emailSent: false });
    }

    const dateFormatted = date
      ? new Date(`${date}T12:00:00`).toLocaleDateString('sk-SK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    const calendarUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/kalendar`;

    const rows = [
      ['Zákazník', customerName || '—'],
      ['ŠPZ', plateNumber],
      carModel ? ['Vozidlo', carModel] : null,
      ['Dátum', dateFormatted],
      time ? ['Čas', time] : null,
      phone ? ['Telefón', phone] : null,
      email ? ['E-mail', email] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#222;font-weight:bold">${value}</td>
      </tr>`).join('');

    const servicesHtml = services
      ? `<div style="margin-top:20px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Požadované úkony</p>
          <p style="color:#333;font-size:13px;white-space:pre-line;margin:0">${services}</p>
        </div>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis · ${source || 'Online objednávka'}</p>
          <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">🔧 Nová objednávka</h1>
        </div>
        <table style="width:100%;border-collapse:collapse">${tableRows}</table>
        ${servicesHtml}
        <div style="margin-top:28px;text-align:center">
          <a href="${calendarUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">
            📅 Otvoriť kalendár
          </a>
        </div>
        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:24px">AutoAlma Servis · autoalma.sk</p>
      </div>`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"AutoAlma Servis" <${process.env.SMTP_USER}>`,
      to: 'autoalma@autoalma.sk',
      subject: `Nová objednávka: ${plateNumber} — ${dateFormatted}`,
      html,
    });

    return Response.json({ ok: true, emailSent: true });
  } catch (e) {
    console.error('booking email error:', e.message);
    return Response.json({ ok: false, error: 'Notifikácia sa neodoslala' }, { status: 500 });
  }
}
