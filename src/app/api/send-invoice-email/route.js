import { createMailTransport } from '@/app/lib/mailer';
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

export async function POST(request) {
  if (!await isAuthenticated(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { invoiceId, recipients, pdfBase64, pdfFilename } = await request.json();
    if (!invoiceId || !recipients?.length) {
      return Response.json({ error: 'Chýba invoiceId alebo príjemcovia' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return Response.json({ error: 'SMTP nie je nakonfigurované' }, { status: 500 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: inv, error: invErr } = await sb
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();
    if (invErr || !inv) return Response.json({ error: 'Faktúra nenájdená' }, { status: 404 });

    const { data: settings } = await sb.from('business_settings').select('*');
    const s = (key) => settings?.find(r => r.id === key)?.value || '';
    const company = {
      name: s('company_name') || 'AutoAlma Servis',
      address: s('company_address'),
      city: s('company_city'),
      phone: s('company_phone'),
      email: s('company_email'),
      web: s('company_web'),
    };
    const googleReviewUrl = s('google_review_url') || 'https://g.page/r/autoalma/review';

    const docType = inv.is_official ? 'Faktúra' : 'Servisný záznam';
    const customerName = inv.company_details?.company_name || inv.customer_name || '';
    const plate = inv.car_details?.plate || '—';
    const brand = inv.car_details?.brand || '';
    const dateStr = new Date(inv.created_at).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const total = Number(inv.total_amount || 0).toFixed(2);
    const greeting = customerName ? `Dobrý deň, <strong>${customerName}</strong>,` : 'Dobrý deň,';

    const html = `
<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px">

  <!-- HLAVIČKA -->
  <tr>
    <td style="background:#111827;padding:28px 32px">
      <p style="margin:0 0 4px;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.3em">${company.name}</p>
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-style:italic;text-transform:uppercase;letter-spacing:-0.5px">Ďakujeme za návštevu</h1>
    </td>
  </tr>

  <!-- TELO -->
  <tr>
    <td style="padding:32px">
      <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6">${greeting}</p>

      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
        ďakujeme, že ste nám zverili starostlivosť o Vaše vozidlo <strong>${plate}${brand ? ' — ' + brand : ''}</strong>.
        Tešíme sa, že odišlo z našej dielne spokojné — a v lepšom stave, ako prišlo.
      </p>

      <!-- Odkaz na faktúru -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 28px">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280">Doklad v prílohe</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:13px;font-weight:700;color:#111827">${docType} č. ${inv.invoice_number}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${dateStr}</p>
            </td>
            <td align="right">
              <p style="margin:0;font-size:18px;font-weight:900;color:#ef4444">${total} €</p>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.7">
        ${docType} nájdete v prílohe tohto e-mailu vo formáte <strong>PDF</strong>.
      </p>

      <!-- Google recenzia -->
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:28px 0;text-align:center">
        <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:700">Ako sme sa vám zapáčili?</p>
        <p style="margin:0 0 16px;font-size:13px;color:#78350f;line-height:1.6">
          Vaša recenzia nám veľmi pomáha. Zaberie to 30 sekúnd a pre nás to znamená veľa.
        </p>
        <a href="${googleReviewUrl}"
          style="display:inline-block;background:#111827;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.08em">
          ⭐ Zanechať recenziu na Google
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
        V prípade otázok nás kontaktujte na
        <a href="mailto:${company.email}" style="color:#ef4444;text-decoration:none">${company.email}</a>
        alebo telefonicky na <strong>${company.phone}</strong>.
      </p>
    </td>
  </tr>

  <!-- PÄTA -->
  <tr>
    <td style="background:#111827;padding:20px 32px">
      <p style="margin:0;font-size:11px;color:#6b7280;text-align:center">
        ${company.name} · ${company.address}, ${company.city}
        ${company.web ? ` · <a href="https://${company.web}" style="color:#9ca3af">${company.web}</a>` : ''}
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const attachments = [];
    if (pdfBase64) {
      const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
      attachments.push({
        filename: pdfFilename || `Faktura_${inv.invoice_number}.pdf`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: 'application/pdf',
      });
    }

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `${docType} č. ${inv.invoice_number} — ${plate} — ${company.name}`,
      html,
      attachments,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('send-invoice-email error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
