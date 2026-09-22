import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/apiAuth';
import { isRateLimited, rateLimitResponse } from '@/app/lib/rateLimit';

export async function GET(request) {
  // Používa aj zákazník v Garáži pri pridaní auta → stačí prihlásenie, ale platená kvóta
  // databazavozidiel.sk: bežný používateľ max 20 dopytov / 10 min, admin bez stropu (audit 2026-09)
  const caller = await requireUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (caller.role !== 'admin' && isRateLimited('vehicle-lookup', caller.user.id, 20, 10 * 60 * 1000)) {
    return rateLimitResponse();
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
      if (data?.message?.toLowerCase().includes('quota')) {
        return NextResponse.json({ error: 'Kvóta API databazavozidiel.sk je vyčerpaná — dobite kredity na webe' }, { status: 402 });
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
