export async function POST(request) {
  try {
    const { customerName, plateNumber, carModel, date, time, services, source, phone, email } = await request.json();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: 'RESEND_API_KEY not set' }, { status: 500 });

    const dateFormatted = date
      ? new Date(`${date}T12:00:00`).toLocaleDateString('sk-SK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    const calendarUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/kalendar`;

    const rows = [
      ['Zákazník', customerName || '—'],
      ['ŠPZ', `<span style="color:#ef4444;font-size:20px;font-weight:900">${plateNumber}</span>`],
      carModel ? ['Vozidlo', carModel] : null,
      ['Dátum', dateFormatted],
      time ? ['Čas', time] : null,
      phone ? ['Telefón', `<a href="tel:${phone}" style="color:#60a5fa">${phone}</a>`] : null,
      email ? ['E-mail', `<a href="mailto:${email}" style="color:#60a5fa">${email}</a>`] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#fff;font-weight:bold">${value}</td>
      </tr>
    `).join('');

    const servicesHtml = services
      ? `<div style="margin-top:20px;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px">
          <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Požadované úkony</p>
          <p style="color:#d4d4d8;font-size:13px;white-space:pre-line;margin:0">${services}</p>
        </div>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#fff;padding:32px;border-radius:16px">
        <div style="border-bottom:2px solid #ef4444;padding-bottom:16px;margin-bottom:24px">
          <p style="color:#71717a;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis · ${source || 'Online'}</p>
          <h1 style="color:#fff;font-size:22px;margin:0;font-style:italic;text-transform:uppercase">🔧 Nová objednávka</h1>
        </div>

        <table style="width:100%;border-collapse:collapse">${tableRows}</table>

        ${servicesHtml}

        <div style="margin-top:28px;text-align:center">
          <a href="${calendarUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.15em;display:inline-block">
            📅 Otvoriť kalendár
          </a>
        </div>

        <p style="color:#27272a;font-size:10px;text-align:center;margin-top:24px;text-transform:uppercase;letter-spacing:.1em">
          AutoAlma Servis · Tilgnerova 712/3, Bratislava · autoalma.sk
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AutoAlma Servis <objednavky@autoalma.sk>',
        to: ['autoalma@autoalma.sk'],
        subject: `🔧 Nová objednávka: ${plateNumber} — ${dateFormatted}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return Response.json({ ok: false, error: err }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('notify-booking error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
