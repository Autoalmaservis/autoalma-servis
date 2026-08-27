import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verejná žiadosť o termín z /objednavka.
 *
 * Beží na serveri so service_role kľúčom, pretože anonymný návštevník nemá
 * (a nemá mať) právo zapisovať do `customers` a `vehicles` — RLS mu to zamietne.
 * Preto si route musí všetko validovať sama.
 *
 * Pozor na dve väzby v schéme:
 *   vehicles.owner_id       → auth.users(id)
 *   calendar_events.user_id → auth.users(id)
 * Do oboch smie ísť LEN id prihlasovacieho účtu, nikdy `customers.id`.
 * Zákazník bez účtu v Garáži sa k vozidlu viaže cez owner_name / owner_phone /
 * owner_email — presne ako 37 vozidiel, ktoré tak v databáze už sú.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AHEAD_DAYS = 365;

// Jednoduchý strop na IP. Na serverless beží per inštancia, takže to nie je
// plnohodnotná ochrana — captcha zostáva na zozname úloh.
const RATE = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  RATE.set(ip, hits);
  if (RATE.size > 5000) RATE.clear();
  return hits.length > RATE_MAX;
}

const trim = (v, max) => String(v ?? '').trim().slice(0, max);

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Príliš veľa žiadostí. Skúste to prosím o chvíľu.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neplatné dáta' }, { status: 400 });
  }

  const {
    plate, date, start, end,
    customerName, phone, email,
    issueDescription, customerNote, title,
  } = body || {};

  // --- validácia ---
  if (!customerName || !date || !start || !end) {
    return NextResponse.json({ error: 'Chýbajú povinné polia' }, { status: 400 });
  }
  if (!DATE_RE.test(date) || !TIME_RE.test(start) || !TIME_RE.test(end)) {
    return NextResponse.json({ error: 'Neplatný dátum alebo čas' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'Koniec musí byť neskôr ako začiatok' }, { status: 400 });
  }

  const startAt = new Date(`${date}T${start}:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(startAt.getTime()) || startAt < today) {
    return NextResponse.json({ error: 'Termín nemôže byť v minulosti' }, { status: 400 });
  }
  if (startAt.getTime() - Date.now() > MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Termín je príliš ďaleko v budúcnosti' }, { status: 400 });
  }

  const nameFinal = trim(customerName, 120);
  const phoneFinal = trim(phone, 30);
  const emailFinal = trim(email, 160).toLowerCase();
  const plateFinal = trim(plate, 15).toUpperCase().replace(/\s+/g, '');

  if (emailFinal && !EMAIL_RE.test(emailFinal)) {
    return NextResponse.json({ error: 'Neplatná e-mailová adresa' }, { status: 400 });
  }

  try {
    // --- 1. Má zákazník účet v Garáži? Len taký smie ísť do FK stĺpcov. ---
    let authUserId = null;
    if (emailFinal) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .ilike('email', emailFinal)
        .limit(1);
      if (profiles?.length) authUserId = profiles[0].id;
    }

    // --- 2. Klient v tabuľke customers (zákazník bez prihlásenia) ---
    let customerId = null;
    if (!authUserId) {
      if (emailFinal) {
        const { data } = await supabaseAdmin
          .from('customers').select('id').ilike('email', emailFinal).limit(1);
        if (data?.length) customerId = data[0].id;
      }
      if (!customerId && phoneFinal) {
        const { data } = await supabaseAdmin
          .from('customers').select('id').eq('phone', phoneFinal).limit(1);
        if (data?.length) customerId = data[0].id;
      }
      if (!customerId) {
        const { data, error } = await supabaseAdmin.from('customers').insert([{
          full_name: nameFinal,
          phone: phoneFinal || null,
          email: emailFinal || null,
          client_type: 'Osoba',
        }]).select('id').single();
        if (error) console.error('public-booking → customers insert:', error.message);
        customerId = data?.id || null;
      }
    }

    // --- 3. Vozidlo ---
    let vehicleId = null;
    if (plateFinal) {
      const { data: existing } = await supabaseAdmin
        .from('vehicles').select('id, owner_id, owner_name').eq('license_plate', plateFinal).limit(1);

      if (existing?.length) {
        vehicleId = existing[0].id;
        // Vozidlo poznáme, ale nemá kontakt — doplníme ho z objednávky.
        if (!existing[0].owner_name) {
          await supabaseAdmin.from('vehicles').update({
            owner_id: existing[0].owner_id || authUserId,
            owner_name: nameFinal,
            owner_phone: phoneFinal || null,
            owner_email: emailFinal || null,
          }).eq('id', existing[0].id);
        }
      } else {
        const { data, error } = await supabaseAdmin.from('vehicles').insert([{
          owner_id: authUserId,            // null, ak zákazník nemá účet — FK to vyžaduje
          owner_name: nameFinal,
          owner_phone: phoneFinal || null,
          owner_email: emailFinal || null,
          license_plate: plateFinal,
          brand_model: 'Neznáme',
        }]).select('id').single();
        if (error) console.error('public-booking → vehicles insert:', error.message);
        vehicleId = data?.id || null;
      }
    }

    // --- 4. Žiadosť do kalendára ---
    const { error: eventError } = await supabaseAdmin.from('calendar_events').insert([{
      title: trim(title, 120) || `ONLINE: ${plateFinal || nameFinal}`,
      start_datetime: `${date}T${start}:00`,
      end_datetime: `${date}T${end}:00`,
      customer_note: trim(customerNote, 1000) || null,
      plate_number: plateFinal || null,
      issue_description: trim(issueDescription, 4000) || null,
      customer_name: nameFinal,
      customer_phone: phoneFinal || null,
      customer_email: emailFinal || null,
      is_confirmed: false,
      status: 'Čaká na schválenie',
      user_id: authUserId,                 // len prihlasovací účet, inak null
      vehicle_id: vehicleId,
    }]);

    if (eventError) {
      console.error('public-booking → calendar_events insert:', eventError.message);
      return NextResponse.json(
        { error: 'Žiadosť sa nepodarilo uložiť. Zavolajte nám prosím na 0940 449 449.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customerId,
      vehicleId,
      registered: Boolean(authUserId || customerId),
    });
  } catch (err) {
    console.error('public-booking:', err);
    return NextResponse.json(
      { error: 'Žiadosť sa nepodarilo uložiť. Zavolajte nám prosím na 0940 449 449.' },
      { status: 500 }
    );
  }
}
