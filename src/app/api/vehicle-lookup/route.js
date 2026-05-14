import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get('ecv');

  if (!ecv) return NextResponse.json({ error: 'Chýba EČV' }, { status: 400 });

  const cleaned = ecv.replace(/\s+/g, '').toUpperCase();
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
