export async function POST(request) {
  try {
    const { phone, message } = await request.json();
    if (!phone || !message) return Response.json({ error: 'Chýba číslo alebo správa' }, { status: 400 });

    if (!process.env.BULKGATE_APP_ID || !process.env.BULKGATE_APP_TOKEN) {
      console.warn('BulkGate not configured');
      return Response.json({ error: 'SMS brána nie je nakonfigurovaná' }, { status: 503 });
    }

    // Convert Slovak number to international format: 0908647227 → 421908647227
    const number = phone.replace(/\s/g, '').replace(/^\+/, '').replace(/^0/, '421');

    const res = await fetch('https://portal.bulkgate.com/api/1.0/simple/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: process.env.BULKGATE_APP_ID,
        application_token: process.env.BULKGATE_APP_TOKEN,
        number,
        text: message,
        sender_id: 'gText',
        sender_id_value: 'AutoAlma',
      }),
    });

    const data = await res.json();

    if (!res.ok || data?.data?.status === 'error') {
      console.error('BulkGate error:', JSON.stringify(data));
      return Response.json({ error: data?.data?.error || 'Chyba SMS brány' }, { status: 502 });
    }

    return Response.json({ ok: true, sms_id: data?.data?.sms_id });
  } catch (e) {
    console.error('send-sms error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
