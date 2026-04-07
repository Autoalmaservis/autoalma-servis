import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get('ecv');

  if (!ecv) return NextResponse.json({ error: 'Chýba EČV' }, { status: 400 });

  try {
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

    // AK API VRÁTI CHYBU (Limit, IP, čokoľvek), VRÁTIME TESTOVACIE AUTO
    // Takto môžeš aplikáciu používať a testovať aj bez funkčného API
    if (!response.ok || data.status === false) {
      console.log("Externé API má problém, vraciam testovacie dáta pre:", ecv);
      
      return NextResponse.json({
        status: true,
        car: {
          znacka: "VOLKSWAGEN (TEST REŽIM)",
          obch_nazov: "TOUAREG",
          vin: "WVGZZZCRZKD015273",
          objem: 2967,
          vykon: 210,
          druh_paliva: "Nafta",
          dat_prva_evid: "15.11.2018"
        }
      });
    }

    // Ak API funguje, vrátime reálne dáta
    return NextResponse.json(data);

  } catch (error) {
    console.error("Kritická chyba v API Route:", error);
    return NextResponse.json({ error: 'Interná chyba servera' }, { status: 500 });
  }
}