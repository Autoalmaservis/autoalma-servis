import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

const TONE_DESCRIPTIONS = {
  formal:      'formálny, profesionálny, úctivý, bez humoru',
  friendly:    'priateľský, teplý, povzbudzujúci, ale stále slušný',
  witty_exit:  'vtipný — auto odišlo spokojné, s nadhľadom a miernou sebairóniou autoservisu',
  witty_tech:  'vtipný s odborným humorom o oprave a prevencii, akoby mechanik písal esej',
  witty_phil:  'filozofický a trochu absurdný, auto ako metafora života',
  witty_buddy: 'veľmi neformálny, kamarátsky, hovorový tón, akoby písal kamarát',
  witty_drama: 'dramatický, patetický, ale s úsmevom — záchrana vozidla ako hrdinský príbeh',
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
