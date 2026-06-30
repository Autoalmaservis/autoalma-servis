import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

export async function GET(request) {
  if (!await isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get('ecv');

  if (!ecv) return NextResponse.json({ error: 'Chýba EČV' }, { status: 400 });

  const cleaned = ecv.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(cleaned)) {
    return NextResponse.json({ error: 'Neplatný formát EČV' }, { status: 400 });
  }

  if (!process.env.DATABAZA_VOZIDIEL_API_KEY) {
    return NextResponse.json({ error: 'Vyhľadávanie vozidiel nie je nakonfigurované' }, { status: 503 });
  }

  try {
    const response = await fetch(`https://www.databazavozidiel.sk/api/vehicles?ecv=${cleaned}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Version': '2',
        'Authorization': `Bearer ${process.env.DATABAZA_VOZIDIEL_API_KEY}`,
        'User-Agent': 'Mozilla/5.0'
      },
      cache: 'no-store'
    });

    const rawText = await response.text();

    try {
      const data = JSON.parse(rawText);
      // API vracia [false, "Error: Your IP is not authorized..."] pri blokovanej IP
      if (Array.isArray(data)) {
        const msg = String(data[1] || '');
        if (msg.includes('IP') || msg.includes('not authorized')) {
          console.error('vehicle-lookup: IP not whitelisted at databazavozidiel.sk');
          return NextResponse.json({ error: 'IP adresa servera nie je autorizovaná v databazavozidiel.sk — kontaktujte podporu' }, { status: 403 });
        }
        if (data[0] === false) {
          return NextResponse.json({ error: msg || 'Vozidlo sa nenašlo' }, { status: 404 });
        }
        // [true, {vehicle: ...}] alebo [true, {...}]
        const payload = data[1];
        return NextResponse.json(typeof payload === 'object' && payload !== null ? payload : { vehicle: payload });
      }
      return NextResponse.json(data);
    } catch {
      console.error('vehicle-lookup: unexpected response format for EČV', cleaned);
      return NextResponse.json({ error: 'Vozidlo sa nenašlo alebo externá služba nedostupná' }, { status: 502 });
    }

  } catch (error) {
    console.error('vehicle-lookup connection error:', error.message);
    return NextResponse.json({ error: 'Chyba spojenia s databázou vozidiel' }, { status: 500 });
  }
}
