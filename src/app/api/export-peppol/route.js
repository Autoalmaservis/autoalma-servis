import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildUblXml } from '@/app/lib/peppol-builder';

export async function POST(request) {
  try {
    const { invoiceId } = await request.json();
    if (!invoiceId) return NextResponse.json({ error: 'Chýba invoiceId' }, { status: 400 });

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) return NextResponse.json({ error: 'Faktúra nenájdená' }, { status: 404 });
    if (!invoice.is_official) return NextResponse.json({ error: 'Len vystavené faktúry je možné exportovať ako eFaktúru' }, { status: 400 });

    const { data: settings } = await supabase.from('business_settings').select('*');
    const supplierAddr = settings ? {
      address: settings.find(s => s.id === 'company_address')?.value || '',
      city:    settings.find(s => s.id === 'company_city')?.value    || '',
      zip:     settings.find(s => s.id === 'company_zip')?.value     || '',
    } : null;

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
