import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get('ecv');

  if (!ecv) return NextResponse.json({ error: 'Chýba EČV' }, { status: 400 });

  console.log(`--- SKÚŠAM DOTAZ PRE: ${ecv} ---`);

  try {
    const response = await fetch(`https://www.databazavozidiel.sk/api/vehicles?ecv=${ecv}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Version': '2',
        'Authorization': 'Bearer JeEwhfoFooklmPqc0brJY5cByzZy0gfEV22QFbCVThlrniGhgJMMIB1egtXh5Rud',
        'User-Agent': 'Mozilla/5.0'
      },
      cache: 'no-store'
    });

    // POZOR: Najprv načítame odpoveď ako text, aby sme videli, či to nie je náhodou chyba 403 alebo 404
    const rawText = await response.text();
    console.log("SUROVÁ ODPOVEĎ ZO SERVERA:", rawText);

    // Ak je to prázdne alebo to nie je JSON, tu to uvidíme
    try {
      const data = JSON.parse(rawText);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("CHYBA: Server neposlal JSON, ale niečo iné (napr. HTML chybu)");
      return NextResponse.json({ error: "Neplatný formát dát", raw: rawText }, { status: 500 });
    }

  } catch (error) {
    console.error("CHYBA SPOJENIA:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}