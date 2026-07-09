import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  const { offerId, status, items } = await request.json();

  if (!offerId || !['Schválené', 'Zamietnuté'].includes(status)) {
    return Response.json({ error: 'Neplatné dáta' }, { status: 400 });
  }

  const sb = adminClient();

  const { data: offer, error: fetchErr } = await sb
    .from('price_offers')
    .select('id, job_id, status')
    .eq('id', offerId)
    .single();

  if (fetchErr || !offer) {
    return Response.json({ error: 'Ponuka nenájdená' }, { status: 404 });
  }

  if (offer.status === 'Schválené' || offer.status === 'Zamietnuté') {
    return Response.json({ error: 'Ponuka už bola zodpovedaná' }, { status: 409 });
  }

  const { error } = await sb
    .from('price_offers')
    .update({ status, items_json: items })
    .eq('id', offerId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (offer.job_id) {
    await sb
      .from('job_tickets')
      .update({ status: status === 'Schválené' ? 'Prebieha' : 'Ponuka zamietnutá' })
      .eq('id', offer.job_id);
  }

  return Response.json({ ok: true });
}
