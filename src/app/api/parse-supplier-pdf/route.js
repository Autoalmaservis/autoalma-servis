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
      max_tokens: 2048,
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
              text: `Toto je faktúra alebo dodací list od dodávateľa autodielu. Extrahuj z nej tieto údaje a vráť VÝHRADNE čistý JSON (žiadny markdown, žiadne vysvetlenia):

{
  "supplier": "názov dodávateľa",
  "doc_number": "číslo faktúry alebo dodacieho listu",
  "date": "dátum vo formáte YYYY-MM-DD",
  "items": [
    {
      "name": "názov dielu alebo položky",
      "part_number": "katalógové alebo OEM číslo dielu ak existuje, inak null",
      "quantity": číslo,
      "unit": "ks alebo l alebo kg alebo m alebo sada",
      "purchase_price": cena bez DPH za jednotku ako číslo
    }
  ]
}

Pravidlá:
- purchase_price musí byť cena BEZ DPH za 1 jednotku (nie celková cena riadku)
- Ak vidíš iba cenu s DPH, vydeľ ju 1.23 a zaokrúhli na 2 desatinné miesta
- Vynechaj položky ktoré nie sú fyzické diely (dopravné, poplatky, zľavy)
- name musí byť krátky výstižný názov dielu (max 60 znakov)
- Ak nejaká hodnota chýba, použi null`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0]?.text?.trim() || '';
    // Strip markdown code fences if Claude adds them
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);
  } catch (e) {
    console.error('parse-supplier-pdf error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
