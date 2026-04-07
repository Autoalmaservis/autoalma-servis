import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get('ecv');

  // Ak niekto zabudne zadať ŠPZ
  if (!ecv) {
    return NextResponse.json({ error: 'Chýba EČV' }, { status: 400 });
  }

  try {
    // REÁLNA POŽIADAVKA NA API (bez simulovaných dát)
    const response = await fetch(`https://www.databazavozidiel.sk/api/vehicles?ecv=${ecv}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Version': '2',
        'Authorization': 'Bearer JeEwhfoFooklmPqc0brJY5cByzZy0gfEV22QFbCVThlrniGhgJMMIB1egtXh5Rud',
        'User-Agent': 'AutoAlma-App/1.0'
      },
      cache: 'no-store'
    });

    const data = await response.json();

    // Ak API vráti chybu (napr. neexistujúca ŠPZ)
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Vozidlo sa nenašlo alebo API odmietlo prístup', 
        details: data 
      }, { status: response.status });
    }

    // VRÁTIME REÁLNE DÁTA, KTORÉ PRIŠLI Z API
    return NextResponse.json(data);

  } catch (error) {
    console.error("Kritická chyba:", error);
    return NextResponse.json({ error: 'Interná chyba servera' }, { status: 500 });
  }
}