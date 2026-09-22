import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Zákazník (bez prihlásenia, odkaz z SMS/e-mailu) môže iba označiť, ktoré položky
// prijíma. Názvy, množstvá a ceny sa berú výhradne z DB — klient ich nemôže prepísať.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Neplatné dáta' }, { status: 400 });
  }
  const { offerId, status, selections } = body;

  if (!offerId || !['Schválené', 'Zamietnuté'].includes(status) || !Array.isArray(selections)) {
    return Response.json({ error: 'Neplatné dáta' }, { status: 400 });
  }

  const sb = adminClient();

  const { data: offer, error: fetchErr } = await sb
    .from('price_offers')
    .select('id, job_id, status, items_json, job_tickets(customer_id, plate_number)')
    .eq('id', offerId)
    .single();

  if (fetchErr || !offer) {
    return Response.json({ error: 'Ponuka nenájdená' }, { status: 404 });
  }

  if (offer.status === 'Schválené' || offer.status === 'Zamietnuté') {
    return Response.json({ error: 'Ponuka už bola zodpovedaná' }, { status: 409 });
  }

  // items_json je buď pole položiek, alebo { items, discount }
  const raw = offer.items_json;
  const wrapped = raw && !Array.isArray(raw);
  const dbItems = wrapped ? (raw.items || []) : (raw || []);

  const byId = new Map();
  const byIndex = new Map();
  selections.forEach(s => {
    if (s?.id !== null && s?.id !== undefined) byId.set(String(s.id), !!s.is_selected);
    if (Number.isInteger(s?.index)) byIndex.set(s.index, !!s.is_selected);
  });

  const mergedItems = dbItems.map((item, idx) => {
    const key = item?.id !== null && item?.id !== undefined ? String(item.id) : null;
    const sel = key !== null && byId.has(key) ? byId.get(key)
      : byIndex.has(idx) ? byIndex.get(idx)
      : (item.is_selected !== undefined ? !!item.is_selected : true);
    return { ...item, is_selected: sel };
  });

  const newItemsJson = wrapped ? { ...raw, items: mergedItems } : mergedItems;

  const { error } = await sb
    .from('price_offers')
    .update({ status, items_json: newItemsJson })
    .eq('id', offerId);

  if (error) return Response.json({ error: 'Interná chyba servera' }, { status: 500 });

  if (offer.job_id) {
    await sb
      .from('job_tickets')
      .update({ status: status === 'Schválené' ? 'Prebieha' : 'Ponuka zamietnutá' })
      .eq('id', offer.job_id);
  }

  // Notifikácia do Garáže zákazníka (predtým ju vkladala stránka cez anon kľúč)
  const ticket = Array.isArray(offer.job_tickets) ? offer.job_tickets[0] : offer.job_tickets;
  const targetUserId = ticket?.customer_id;
  if (targetUserId) {
    const baseTotal = mergedItems
      .filter(i => i.is_selected)
      .reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0) * 1.23;
    // Rovnaký výpočet zľavy ako na stránke ponuky (getDiscountAmount)
    const disc = wrapped ? raw.discount : null;
    const discNum = parseFloat(disc?.value) || 0;
    const discountAmount = disc?.type === 'eur' ? discNum : baseTotal * discNum / 100;
    const selectedTotal = Math.max(0, baseTotal - discountAmount);
    await sb.from('notifications').insert([{
      user_id: targetUserId,
      customer_id: targetUserId,
      title: status === 'Schválené' ? '✅ Ponuka schválená' : '✕ Ponuka zamietnutá',
      content: status === 'Schválené'
        ? `Vozidlo ${ticket.plate_number}: Schválili ste opravy za ${selectedTotal.toFixed(2)}€.`
        : `Vozidlo ${ticket.plate_number}: Ponuka bola zamietnutá.`,
      type: status === 'Schválené' ? 'success' : 'error',
      is_read: false,
      link: '/garaz',
    }]);
  }

  return Response.json({ ok: true });
}
