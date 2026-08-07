import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { buildUblXml } from '@/app/lib/peppol-builder';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

export async function POST(request) {
  if (!await isAuthenticated(request)) {
    return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });
  }

  try {
    const { invoiceId } = await request.json();
    if (!invoiceId) return NextResponse.json({ error: 'Chýba invoiceId' }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: invoice, error: invErr } = await sb
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) return NextResponse.json({ error: 'Faktúra nenájdená' }, { status: 404 });
    if (!invoice.is_official) return NextResponse.json({ error: 'Len vystavené faktúry je možné exportovať ako eFaktúru' }, { status: 400 });

    const { data: settings } = await sb.from('business_settings').select('*');
    const s = (key) => settings?.find(r => r.id === key)?.value || '';
    const supplierAddr = {
      address: s('company_address'),
      city:    s('company_city'),
      zip:     s('company_zip'),
    };

    const xml = buildUblXml(invoice, supplierAddr);
    const filename = `eFaktura_${invoice.invoice_number}.xml`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
