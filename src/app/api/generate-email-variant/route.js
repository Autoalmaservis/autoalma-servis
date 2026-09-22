import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/app/lib/apiAuth';

// Iba admin — volá Anthropic API (kredit), používa iba dashboard (audit 2026-09)
async function isAuthenticated(request) {
  return !!(await requireAdmin(request));
}

const TONE_DESCRIPTIONS = {
  formal:      'formálny, profesionálny, úctivý, bez humoru',
  friendly:    'priateľský, teplý, povzbudzujúci, ale stále slušný',
  witty_exit:  'vtipný — auto odišlo spokojné, s nadhľadom a miernou sebairóniou autoservisu',
  witty_tech:  'vtipný s odborným humorom o oprave a prevencii, akoby mechanik písal esej',
  witty_phil:  'filozofický a trochu absurdný, auto ako metafora života',
  witty_buddy: 'veľmi neformálny, kamarátsky, hovorový tón, akoby písal kamarát',
  witty_drama: 'dramatický, patetický, ale s úsmevom — záchrana vozidla ako hrdinský príbeh',
  witty_detective: 'detektívsky — mechanik ako vyšetrovateľ, oprava ako uzavretý prípad, suchý humor, formát policajnej správy',
};

export async function POST(request) {
  if (!await isAuthenticated(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tone, name, carStr, invoiceNum, total, companyName, previousText } = await request.json();

  const toneDesc = TONE_DESCRIPTIONS[tone] || 'priateľský';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Napíš krátky e-mail zákazníkovi autoservisu po dokončení opravy vozidla.

TON: ${toneDesc}
JAZYK: slovenčina

ÚDAJE O ZÁKAZKE:
- Zákazník: ${name}
- Vozidlo: ${carStr}
- Faktúra č.: ${invoiceNum}
- Suma: ${total} €
- Autoservis: ${companyName}

POŽIADAVKY:
- Spomeň faktúru č. ${invoiceNum} a sumu ${total} €
- Faktúra je priložená ako PDF
- Záver: "S pozdravom, ${companyName}"
- Maximálne 5–7 viet, len čistý text (žiadne nadpisy, žiadne odrážky)
- Každý e-mail musí znieť úplne inak ako predošlé — iné obraty, iný úvod, iná záverečná veta${previousText ? `\n\nPREDOŠLÁ VERZIA (túto NEOPAKUJ, vymysli niečo iné):\n${previousText.substring(0, 300)}` : ''}`,
    }],
  });

  return Response.json({ text: message.content[0].text });
}
