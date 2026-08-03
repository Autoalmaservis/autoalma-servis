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
    const { jobId, recipients, pdfBase64, pdfFilename, emailBody } = await request.json();
    if (!jobId || !recipients?.length) {
      return Response.json({ error: 'Chýba jobId alebo príjemcovia' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return Response.json({ error: 'SMTP nie je nakonfigurované' }, { status: 500 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: job, error: jobErr } = await sb
      .from('job_tickets')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobErr || !job) return Response.json({ error: 'Zákazka nenájdená' }, { status: 404 });

    const { data: jobItems } = await sb
      .from('job_items')
      .select('quantity, unit_price')
      .eq('job_id', jobId);

    const total = (jobItems || []).reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unit_price)), 0);

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

    const plate = job.plate_number || '—';
    const brand = job.car_brand_model || '';
    const dateStr = new Date(job.created_at).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const bodyHtml = emailBody
      ? emailBody.split('\n').map(line =>
          line.trim() === ''
            ? ''
            : `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.7">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
        ).join('\n')
      : `<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">Dobrý deň,</p>
         <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
           v prílohe zasielame servisný protokol k vozidlu <strong>${plate}${brand ? ' — ' + brand : ''}</strong>.
         </p>`;

    const html = `
<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px">

  <tr>
    <td style="background:#111827;padding:28px 32px">
      <p style="margin:0 0 4px;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.3em">${company.name}</p>
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-style:italic;text-transform:uppercase;letter-spacing:-0.5px">Servisný protokol</h1>
    </td>
  </tr>

  <tr>
    <td style="padding:32px">
      ${bodyHtml}

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 28px">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280">Zákazka v prílohe</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:13px;font-weight:700;color:#111827">Zákazka č. ${job.job_number} — ${plate}${brand ? ' (' + brand + ')' : ''}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${dateStr}</p>
            </td>
            <td align="right">
              <p style="margin:0;font-size:18px;font-weight:900;color:#ef4444">${total.toFixed(2)} €</p>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.7">
        Servisný protokol nájdete v prílohe tohto e-mailu vo formáte <strong>PDF</strong>.
      </p>

      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
        V prípade otázok nás kontaktujte na
        <a href="mailto:${company.email}" style="color:#ef4444;text-decoration:none">${company.email}</a>
        alebo telefonicky na <strong>${company.phone}</strong>.
      </p>
    </td>
  </tr>

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
        filename: pdfFilename || `Protokol_${job.job_number}_${plate}.pdf`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: 'application/pdf',
      });
    }

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `Servisný protokol č. ${job.job_number} — ${plate} — ${company.name}`,
      html,
      attachments,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('send-job-email error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
