import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/app/lib/apiAuth';

// Iba admin — volá Anthropic API (kredit), používa iba dashboard (audit 2026-09)
async function isAuthenticated(request) {
  return !!(await requireAdmin(request));
}

const TONE_DESCRIPTIONS = {
  formal:          'formálny, profesionálny, úctivý, bez humoru',
  friendly:        'priateľský, teplý, povzbudzujúci, ale stále slušný',
  witty_exit:      'vtipný — auto dorazilo do dobrých rúk, s nadhľadom a sebairóniou autoservisu',
  witty_tech:      'vtipný s odborným humorom o diagnostike a oprave, akoby mechanik písal technickú správu',
  witty_phil:      'filozofický a trochu absurdný, cesta auta do servisu ako metafora života',
  witty_buddy:     'veľmi neformálny, kamarátsky, hovorový tón, akoby písal kamarát čo opravuje auto',
  witty_drama:     'dramatický, patetický, ale s úsmevom — prijatie vozidla ako hrdinský moment',
  witty_detective: 'detektívsky — mechanik ako vyšetrovateľ, zákazka ako otvorený prípad, suchý humor, formát policajnej správy',
};

export async function POST(request) {
  if (!await isAuthenticated(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tone, name, carStr, jobNum, total, companyName, complaints, previousText } = await request.json();

  const toneDesc = TONE_DESCRIPTIONS[tone] || 'priateľský';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const complaintsLine = complaints ? `- Zákazník hlási závady: ${complaints}` : '';

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Napíš krátky e-mail zákazníkovi autoservisu. E-mail sa posiela pri PREVZATÍ vozidla do opravy (nie po dokončení). Zákazník dostane servisný protokol v prílohe.

TON: ${toneDesc}
JAZYK: slovenčina

OSLOVI zákazníka ako "pán [Priezvisko]" alebo "pani [Priezvisko]" podľa mena: ${name}
(slovenské ženské priezviská končia na -ová, inak pán)

ÚDAJE:
- Zákazník: ${name}
- Vozidlo: ${carStr}
- Zákazka č.: ${jobNum}
${complaintsLine}
- Autoservis: ${companyName}

OBSAH:
- Potvrď prevzatie vozidla do opravy
${complaints ? '- Krátko spomeň čo zákazník hlási / čo budeme riešiť' : ''}
- Spomeň zákazku č. ${jobNum}
- Servisný protokol je priložený ako PDF
- Záver s pozdravom od ${companyName}
- Maximálne 5–7 viet, len čistý text (žiadne nadpisy, žiadne odrážky)
- Každý e-mail musí znieť úplne inak ako predošlé${previousText ? `\n\nPREDOŠLÁ VERZIA (NEOPAKUJ):\n${previousText.substring(0, 300)}` : ''}`,
    }],
  });

  return Response.json({ text: message.content[0].text });
}
