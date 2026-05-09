export async function POST(request) {
  try {
    const { name, email, plate, vehicle, message } = await request.json();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: 'RESEND_API_KEY not set' }, { status: 500 });

    const rows = [
      ['Meno', name || '—'],
      ['E-mail', email ? `<a href="mailto:${email}" style="color:#60a5fa">${email}</a>` : '—'],
      plate ? ['ŠPZ', `<span style="color:#ef4444;font-weight:900;font-size:18px">${plate.toUpperCase()}</span>`] : null,
      vehicle ? ['Vozidlo', vehicle] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#fff;font-weight:bold">${value}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#fff;padding:32px;border-radius:16px">
        <div style="border-bottom:2px solid #ef4444;padding-bottom:16px;margin-bottom:24px">
          <p style="color:#71717a;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis · Web formulár</p>
          <h1 style="color:#fff;font-size:22px;margin:0;font-style:italic;text-transform:uppercase">✉️ Nová správa</h1>
        </div>
        <table style="width:100%;border-collapse:collapse">${tableRows}</table>
        <div style="margin-top:20px;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px">
          <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Správa</p>
          <p style="color:#d4d4d8;font-size:14px;white-space:pre-line;margin:0">${message || '—'}</p>
        </div>
        <p style="color:#27272a;font-size:10px;text-align:center;margin-top:24px;text-transform:uppercase;letter-spacing:.1em">
          AutoAlma Servis · autoalma.sk
        </p>
      </div>`;

    const subject = plate
      ? `✉️ Správa od ${name || 'zákazníka'} · ${plate.toUpperCase()}`
      : `✉️ Správa od ${name || 'zákazníka'}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AutoAlma Servis <web@autoalma.sk>',
        to: ['autoalma@autoalma.sk'],
        reply_to: email || undefined,
        subject,
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
    console.error('contact error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
