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
      zip: s('company_zip'),
      ico: s('company_ico'),
      dic: s('company_dic'),
      phone: s('company_phone'),
      email: s('company_email'),
      web: s('company_web'),
      bank: s('company_bank'),
    };

    const docType = inv.is_official ? 'Faktúra' : 'Servisný záznam';
    const customerName = inv.company_details?.company_name || inv.customer_name || '—';
    const plate = inv.car_details?.plate || '—';
    const brand = inv.car_details?.brand || '—';
    const vin = inv.car_details?.vin || '—';
    const mileage = inv.car_details?.mileage != null ? Number(inv.car_details.mileage).toLocaleString('sk-SK') + ' km' : '—';
    const dateStr = new Date(inv.created_at).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const subtotal = Number(inv.subtotal_amount || 0).toFixed(2);
    const tax = Number(inv.tax_amount || 0).toFixed(2);
    const total = Number(inv.total_amount || 0).toFixed(2);

    const itemsRows = (inv.items_json || []).map(item => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#1f2937">${item.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">${item.quantity} ${item.unit}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right">${parseFloat(item.unit_price).toFixed(2)} €</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#111827;text-align:right">${(item.quantity * item.unit_price).toFixed(2)} €</td>
      </tr>
    `).join('');

    const customerBlock = inv.company_details?.company_name ? `
      <p style="margin:0;font-size:14px;font-weight:700;color:#111">${inv.company_details.company_name}</p>
      ${inv.company_details.address ? `<p style="margin:2px 0;font-size:12px;color:#555">${inv.company_details.address}, ${inv.company_details.zip || ''} ${inv.company_details.city || ''}</p>` : ''}
      ${inv.company_details.ico ? `<p style="margin:2px 0;font-size:11px;color:#777">IČO: ${inv.company_details.ico}${inv.company_details.dic ? ' | DIČ: ' + inv.company_details.dic : ''}</p>` : ''}
    ` : `<p style="margin:0;font-size:14px;font-weight:700;color:#111">${customerName}</p>`;

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
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.3em">AutoAlma Servis</p>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-style:italic;text-transform:uppercase">${docType}</h1>
          </td>
          <td align="right">
            <p style="margin:0;color:#ef4444;font-size:24px;font-weight:900;letter-spacing:-1px">${inv.invoice_number}</p>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:11px">${dateStr}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ODBERATEĽ + VOZIDLO -->
  <tr>
    <td style="padding:24px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" valign="top" style="padding-right:16px">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280">Odberateľ</p>
            ${customerBlock}
          </td>
          <td width="50%" valign="top" style="border-left:2px solid #f3f4f6;padding-left:16px">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280">Vozidlo</p>
            <p style="margin:0;font-size:13px;font-weight:700;color:#111;text-transform:uppercase">${plate}</p>
            <p style="margin:2px 0;font-size:12px;color:#374151">${brand}</p>
            <p style="margin:2px 0;font-size:11px;color:#9ca3af">VIN: ${vin}</p>
            <p style="margin:2px 0;font-size:11px;color:#9ca3af">Najazdené: ${mileage}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- POLOŽKY -->
  <tr>
    <td style="padding:24px 32px 0">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280">Vykonané práce a materiál</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px;font-size:10px;text-align:left;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Položka</th>
            <th style="padding:10px;font-size:10px;text-align:center;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Množstvo</th>
            <th style="padding:10px;font-size:10px;text-align:right;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Cena/J</th>
            <th style="padding:10px;font-size:10px;text-align:right;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Spolu</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </td>
  </tr>

  <!-- SÚČET -->
  <tr>
    <td style="padding:16px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td></td>
          <td width="240" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            ${Number(inv.tax_amount) > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:8px 14px;font-size:12px;color:#6b7280">Základ DPH</td><td style="padding:8px 14px;font-size:12px;color:#374151;text-align:right">${subtotal} €</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px 14px;font-size:12px;color:#6b7280">DPH (23 %)</td><td style="padding:8px 14px;font-size:12px;color:#374151;text-align:right">${tax} €</td></tr>
            </table>` : ''}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:0 0 7px 7px">
              <tr><td style="padding:12px 14px;font-size:13px;font-weight:900;color:#ffffff;text-transform:uppercase;letter-spacing:.05em">Celkom k úhrade</td><td style="padding:12px 14px;font-size:16px;font-weight:900;color:#ef4444;text-align:right">${total} €</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${company.bank ? `
  <!-- PLATOBNÉ ÚDAJE -->
  <tr>
    <td style="padding:20px 32px 0">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#3b82f6">Platobné údaje</p>
        <p style="margin:0;font-size:12px;color:#1e40af;font-family:monospace;font-weight:700">${company.bank}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Variabilný symbol: ${String(inv.invoice_number).replace(/\D/g, '')}</p>
      </div>
    </td>
  </tr>` : ''}

  <!-- DODÁVATEĽ FOOTER -->
  <tr>
    <td style="padding:20px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;padding-top:16px">
        <tr>
          <td>
            <p style="margin:0;font-size:11px;color:#6b7280">${company.name} · ${company.address}, ${company.zip} ${company.city}</p>
            <p style="margin:2px 0;font-size:11px;color:#6b7280">IČO: ${company.ico} | DIČ: ${company.dic}</p>
            <p style="margin:2px 0;font-size:11px;color:#6b7280">${company.phone} | ${company.email}</p>
          </td>
        </tr>
        <tr>
          <td style="padding-top:14px">
            <p style="margin:0;font-size:11px;color:#9ca3af;font-style:italic">
              Ďakujeme za dôveru. Vaše vozidlo opustilo naše garáže v lepšom stave, ako prišlo — čo je, úprimne, presne ten plán. 🔧
            </p>
          </td>
        </tr>
      </table>
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
      subject: `${docType} č. ${inv.invoice_number} — ${plate} — ${customerName}`,
      html,
      attachments,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('send-invoice-email error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
