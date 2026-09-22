import { createMailTransport } from '@/app/lib/mailer';
import { getCompanySettings } from '@/app/lib/companySettings';

// Uvítací e-mail do Garáže. Používa ho /api/send-welcome-email (admin)
// aj /api/registracia-dokoncit (zákazník sa registruje sám) — preto je tu,
// nie v jednej z tých routes.
//
// booking: { date: 'YYYY-MM-DD', startTime: 'HH:MM', plateNumber, issueDescription }
// — vyplnené, keď účet vznikol automaticky pri zápise termínu do kalendára.
export async function posliUvitaciEmail({ email, name, createdByAdmin, setPasswordUrl, booking }) {
  if (!email) return { ok: false, error: 'Chýba e-mail' };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured — welcome email not sent');
    return { ok: true, emailSent: false };
  }

  try {
    const company = await getCompanySettings();
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.autoalma.sk';
    const garageUrl = `${base}/garaz`;
    const loginUrl = `${base}/login`;

    // Heslo sa e-mailom neposiela nikdy a servis ho ani nepozná.
    // Zákazník si ho nastaví sám cez odkaz nižšie.
    const credentialsBlock = createdByAdmin
      ? `<div style="margin-top:20px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px">
          <p style="color:#856404;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px;font-weight:bold">Vaše prihlasovacie meno</p>
          <p style="margin:4px 0;font-size:13px;color:#333"><strong>E-mail:</strong> ${email}</p>
          <p style="margin:10px 0 0;font-size:12px;color:#856404;">Heslo si nastavíte sami — nikto zo servisu ho nepozná a nikdy vám ho nebudeme posielať.</p>
        </div>`
      : '';

    const setPasswordBlock = setPasswordUrl
      ? `<div style="margin-top:24px;text-align:center">
          <a href="${setPasswordUrl}" style="background:#111;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:.1em;display:inline-block">
            🔐 Nastaviť si heslo
          </a>
          <p style="color:#999;font-size:11px;margin-top:10px">Odkaz je platný obmedzený čas. Ak vyprší, použite na prihlasovacej stránke možnosť „Zabudnuté heslo".</p>
        </div>`
      : `<div style="margin-top:24px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px;text-align:center">
          <p style="color:#333;font-size:13px;margin:0">Heslo si nastavíte na prihlasovacej stránke cez možnosť <strong>„Zabudnuté heslo"</strong> — zadajte tento e-mail a príde vám odkaz.</p>
        </div>`;

    let bookingBlock = '';
    if (booking?.date) {
      const dateFormatted = new Date(`${booking.date}T12:00:00`).toLocaleDateString('sk-SK', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const rows = [
        ['Dátum', `${dateFormatted}${booking.startTime ? ` o ${booking.startTime}` : ''}`],
        booking.plateNumber ? ['ŠPZ', booking.plateNumber] : null,
        booking.issueDescription ? ['Popis', String(booking.issueDescription).replace(/\n/g, '<br>')] : null,
      ].filter(Boolean).map(([label, value]) => `
        <tr>
          <td style="padding:8px 16px 8px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;vertical-align:top">${label}</td>
          <td style="padding:8px 0;color:#222;font-size:13px;font-weight:600">${value}</td>
        </tr>`).join('');
      bookingBlock = `
        <div style="margin-top:20px;background:#fff;border:1px solid #e5e5e5;border-left:4px solid #22c55e;border-radius:8px;padding:16px">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">✅ Váš servisný termín</p>
          <table style="width:100%;border-collapse:collapse">${rows}</table>
        </div>`;
    }

    const introText = createdByAdmin
      ? `Prijímací technik ${company.name} vám vytvoril prístup do zákazníckej zóny — <strong>Vašej Garáže</strong>.`
      : `Váš účet bol úspešne vytvorený. Vitajte v zákazníckej zóne ${company.name}.`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">${company.name} · Zákaznícka zóna</p>
          <h1 style="color:#111;font-size:22px;margin:0;font-style:italic;text-transform:uppercase">🔑 Váš prístup do Garáže</h1>
        </div>

        <p style="color:#333;font-size:14px;margin:0 0 16px">Dobrý deň${name ? `, <strong>${name}</strong>` : ''},</p>
        <p style="color:#333;font-size:14px;margin:0 0 20px">${introText}</p>

        ${bookingBlock}
        ${credentialsBlock}
        ${createdByAdmin ? setPasswordBlock : ''}

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
        <p style="color:#ccc;font-size:10px;text-align:center;margin-top:16px">${company.name} · ${company.web}</p>
      </div>`;

    const subject = booking?.date
      ? `${company.name} — potvrdenie termínu${booking.plateNumber ? ` ${booking.plateNumber}` : ''} a prístup do Vašej Garáže`
      : createdByAdmin
      ? `${company.name} — prístup do Vašej Garáže`
      : `Vitajte v ${company.name} — Vaša Garáž je pripravená`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    return { ok: true, emailSent: true };
  } catch (e) {
    console.error('welcome email error:', e.message);
    return { ok: true, emailSent: false };
  }
}
