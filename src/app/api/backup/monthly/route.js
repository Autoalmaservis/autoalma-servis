import { createClient } from '@supabase/supabase-js';
import { createMailTransport } from '@/app/lib/mailer';
import * as XLSX from 'xlsx';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [custR, vehR, tickR, itemR, taskR, invR, poR, empR, normR, catR, invCatR, whR, whmR, kasaR] = await Promise.all([
      sb.from('customers').select('*').order('created_at'),
      sb.from('vehicles').select('*'),
      sb.from('job_tickets').select('*').order('created_at'),
      sb.from('job_items').select('*'),
      sb.from('job_tasks').select('*'),
      sb.from('invoices').select('*').order('created_at'),
      sb.from('price_offers').select('*').order('created_at'),
      sb.from('employees').select('id, name, email, color, role, active'),
      sb.from('service_norms').select('*'),
      sb.from('service_categories').select('*'),
      sb.from('inventory_catalog').select('*'),
      sb.from('warehouse_items').select('*'),
      sb.from('warehouse_movements').select('*').order('created_at'),
      sb.from('kasa_entries').select('*').order('date'),
    ]);

    const wb = XLSX.utils.book_new();
    const add = (name, data) => {
      if (data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
    };
    add('Klienti', custR.data);
    add('Vozidla', vehR.data);
    add('Zakazky', tickR.data);
    add('Polozky zakaziek', itemR.data);
    add('Ukony zakaziek', taskR.data);
    add('Faktury', invR.data);
    add('Cenove ponuky', poR.data);
    add('Zamestnanci', empR.data);
    add('Normy prac', normR.data);
    add('Kategorie noriem', catR.data);
    add('Katalog material', invCatR.data);
    add('Sklad', whR.data);
    add('Sklad pohyby', whmR.data);
    add('Kasa', kasaR.data);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toLocaleDateString('sk-SK').replace(/\s/g, '');
    const filename = `AutoAlma_zaloha_${dateStr}.xlsx`;

    const { data: settings } = await sb.from('business_settings').select('id, value').in('id', ['company_email', 'company_name']);
    const adminEmail = settings?.find(s => s.id === 'company_email')?.value || process.env.SMTP_USER;
    const companyName = settings?.find(s => s.id === 'company_name')?.value || 'AutoAlma Servis';

    const counts = {
      klienti: custR.data?.length || 0,
      vozidla: vehR.data?.length || 0,
      zakazky: tickR.data?.length || 0,
      faktury: invR.data?.length || 0,
      sklad: whR.data?.length || 0,
    };

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `📦 Mesačná záloha systému — ${new Date().toLocaleDateString('sk-SK')}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;border:1px solid #e5e5e5">
        <div style="border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:22px">
          <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">${companyName} · Systémová záloha</p>
          <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">📦 Mesačná záloha dát</h1>
        </div>
        <p style="color:#333;font-size:14px;">Vážený administrátor,</p>
        <p style="color:#333;font-size:14px;">V prílohe nájdete mesačnú zálohu všetkých dát systému <strong>${companyName}</strong>.</p>
        <div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:20px 0">
          <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px">Obsah zálohy</p>
          ${Object.entries(counts).map(([k, v]) => `<p style="margin:4px 0;font-size:13px;color:#333">● <strong>${v}</strong> ${k}</p>`).join('')}
          <p style="margin:8px 0 0;font-size:12px;color:#999">Súbor obsahuje ${wb.SheetNames.length} listov s kompletnými dátami.</p>
        </div>
        <p style="color:#999;font-size:12px;margin-top:20px">Táto záloha bola odoslaná automaticky 1. dňa v mesiaci. Uložte súbor na bezpečné miesto.</p>
        <p style="color:#ccc;font-size:10px;margin-top:8px">${companyName}</p>
      </div>`,
      attachments: [{
        filename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    return Response.json({ ok: true, sent: adminEmail, filename, counts });
  } catch (err) {
    console.error('backup error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
