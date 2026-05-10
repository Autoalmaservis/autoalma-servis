import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf');
    if (!file) return Response.json({ error: 'Žiadny súbor' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Toto je faktúra od dodávateľa autodielov (typicky DD AUTO alebo podobný veľkoobchod).

Faktúra má tieto stĺpce:
- "Číslo tovaru" = katalógové / OEM číslo dielu (napr. TRW DF4253, MAN HU5003Z)
- "Názov" = názov položky
- "Množstvo" = počet kusov
- "Mj" = jednotka (ks, l, kg, sada...)
- "MO bez dph" = maloobchodná cena bez DPH (IGNORUJ)
- "w bonus % zľava" = zľava v percentách (IGNORUJ)
- "bez dph po zľave" = NÁKUPNÁ CENA BEZ DPH po uplatnení zľavy — TOTO je purchase_price
- "s dph" = nákupná cena s DPH (purchase_price × 1.23) — TOTO je purchase_price_with_vat
- "dodací list" = číslo dodacieho listu (6-cyferné číslo napr. 6112621924)

Vráť VÝHRADNE čistý JSON bez markdown blokov:

{
  "supplier": "názov dodávateľa",
  "doc_number": "číslo faktúry",
  "date": "dátum vo formáte YYYY-MM-DD",
  "items": [
    {
      "part_number": "číslo tovaru presne ako v faktúre napr. TRW DF4253",
      "name": "názov dielu (max 60 znakov, výstižný)",
      "quantity": číslo,
      "unit": "ks",
      "purchase_price": číslo bez DPH po zľave (stĺpec bez dph po zľave),
      "purchase_price_with_vat": číslo s DPH (stĺpec s dph),
      "dodaci_list": "číslo dodacieho listu ako string"
    }
  ]
}

Dôležité pravidlá:
- purchase_price = stĺpec "bez dph po zľave" (nie MO cena!)
- Zahrň VŠETKY riadky s fyzickými dielmi vrátane tých s nízkou cenou
- Vynechaj len riadky súčtov (začínajú "súčet za dodací list")
- Číslo dielu zahrň presne aj s prefixom výrobcu (TRW, MAN, MAH, FIL...)
- Ak je faktúra na viacerých stranách, spracuj všetky strany`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);
  } catch (e) {
    console.error('parse-supplier-pdf error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
