import { createMailTransport } from '@/app/lib/mailer';
import { getCompanySettings } from '@/app/lib/companySettings';

export async function POST(request) {
  try {
    // type: 'confirmed' (technik vytvoril termín) | 'received' (zákazník odoslal žiadosť z webu/garáže)
    const { email, customerName, plateNumber, date, startTime, issueDescription, type = 'confirmed' } = await request.json();

    if (!email || !plateNumber || !date) {
      return Response.json({ error: 'Chýbajú povinné polia' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Neplatný e-mail' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured — reservation email not sent');
      return Response.json({ ok: true, emailSent: false });
    }

    const company = await getCompanySettings();
    const garageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma-servis.vercel.app'}/garaz`;

    const dateFormatted = new Date(`${date}T12:00:00`).toLocaleDateString('sk-SK', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const isConfirmed = type === 'confirmed';

    const heading = isConfirmed ? '✅ Termín bol potvrdený' : '📋 Žiadosť o termín bola prijatá';
    const subtext = isConfirmed
      ? 'Váš servisný termín bol potvrdený. Tešíme sa na Vás!'
      : 'Prijali sme Vašu žiadosť o servisný termín. Čoskoro Vás budeme kontaktovať pre záväzné potvrdenie.';
    const subject = isConfirmed
      ? `${company.name} — potvrdenie termínu ${plateNumber}`
      : `${company.name} — žiadosť o termín prijatá (${plateNumber})`;
    const accentColor = isConfirmed ? '#22c55e' : '#f59e0b';

    const rows = [
      ['Dátum', `${dateFormatted}${startTime ? ` o ${startTime}` : ''}`],
      ['ŠPZ', plateNumber],
      issueDescription ? ['Popis', issueDescription] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([label, value]) => `
      <tr>
        <td style="padding:9px 16px 9px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:9px 0;color:#222;font-size:13px;font-weight:600">${value}</td>
      </tr>`).join('');

    const pendingNote = isConfirmed ? '' : `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin-bottom:24px">
        <p style="color:#92400e;font-size:12px;margin:0">
          ⏳ Váš termín <strong>čaká na záväzné potvrdenie</strong> zo strany servisu.<br>
          Kontaktujeme Vás telefonicky alebo e-mailom.
        </p>
      </div>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">

        <div style="border-bottom:3px solid ${accentColor};padding-bottom:14px;margin-bottom:24px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">${company.name} · Servisný termín</p>
          <h1 style="color:#111;font-size:22px;margin:0;font-style:italic;text-transform:uppercase">${heading}</h1>
        </div>

        <p style="color:#333;font-size:14px;margin:0 0 12px">
          Dobrý deň${customerName ? `, <strong>${customerName}</strong>` : ''},
        </p>
        <p style="color:#333;font-size:14px;margin:0 0 24px">${subtext}</p>

        ${pendingNote}

        <div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 12px">Detail termínu</p>
          <table style="width:100%;border-collapse:collapse">${tableRows}</table>
        </div>

        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:14px 16px;margin-bottom:24px">
          <p style="color:#856404;font-size:12px;margin:0">
            📍 <strong>${company.name}</strong> · Svornosti 119, 821 06 Bratislava<br>
            📞 <strong>${company.phone}</strong>
          </p>
          <p style="color:#856404;font-size:11px;margin:8px 0 0">
            V prípade zmeny alebo zrušenia termínu nás prosím kontaktujte čo najskôr.
          </p>
        </div>

        <div style="text-align:center;margin-bottom:8px">
          <a href="${garageUrl}" style="background:#ef4444;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">
            🚗 Zobraziť moju Garáž
          </a>
        </div>

        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:20px">${company.name} · ${company.web}</p>
      </div>`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    return Response.json({ ok: true, emailSent: true });
  } catch (e) {
    console.error('reservation email error:', e.message);
    return Response.json({ ok: true, emailSent: false });
  }
}
