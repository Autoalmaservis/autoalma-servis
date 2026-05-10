import nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.websupport.sk',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function POST(request) {
  try {
    const { name, email, phone, plate, vehicle, year, message } = await request.json();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured');
      return Response.json({ ok: true, emailSent: false });
    }

    const rows = [
      ['Meno', name || '—'],
      ['Telefón', phone || '—'],
      ['E-mail', email || '—'],
      plate ? ['ŠPZ', plate.toUpperCase()] : null,
      vehicle ? ['Vozidlo', vehicle] : null,
      year ? ['Rok výroby', year] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 0;color:#222;font-weight:bold">${value}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis · Web formulár</p>
          <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">✉️ Nová správa z webu</h1>
        </div>
        <table style="width:100%;border-collapse:collapse">${tableRows}</table>
        <div style="margin-top:20px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Správa</p>
          <p style="color:#333;font-size:14px;white-space:pre-line;margin:0">${message || '—'}</p>
        </div>
        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:24px">AutoAlma Servis · autoalma.sk</p>
      </div>`;

    const subject = plate
      ? `Správa z webu: ${name || 'zákazník'} · ${plate.toUpperCase()}`
      : `Správa z webu: ${name || 'zákazník'}`;

    const transporter = createTransport();
    await transporter.sendMail({
      from: `"AutoAlma Servis" <${process.env.SMTP_USER}>`,
      to: 'autoalma@autoalma.sk',
      replyTo: email || undefined,
      subject,
      html,
    });

    return Response.json({ ok: true, emailSent: true });
  } catch (e) {
    console.error('contact email error:', e.message);
    return Response.json({ ok: true, emailSent: false });
  }
}
