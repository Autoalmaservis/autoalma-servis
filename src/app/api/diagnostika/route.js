import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM = `Si skúsený automobilový diagnostik v autoservise. Zákazník ti opísal problém so svojím vozidlom. Tvojou úlohou je klásť mu upresňujúce otázky — VŽDY len jednu naraz — a po získaní dostatočných informácií dať záverečnú diagnózu.

Pravidlá:
- Pýtaj sa JEDNU konkrétnu a relevantnú otázku naraz
- Otázky musia pomôcť zúžiť možné príčiny (napr. kedy nastáva problém, za akých podmienok, či svieti kontrolka, aký zvuk...)
- Odpovedaj vždy v slovenčine

Odpovedaj VÝHRADNE vo formáte JSON — žiadny iný text pred ani po:
- Ak kladieš prvú otázku A zákazník zadal OBD kód závady (napr. P0300, B0001, U0100, C0035...): {"type":"question","explanation":"<1-2 vety: čo presne ten kód znamená, aký systém/komponent sa tým myslí>","text":"<prvá upresňujúca otázka>"}
- Ak kladieš ďalšiu otázku (bez kódu alebo druhá+ otázka): {"type":"question","text":"<otázka>"}
- Ak dávaš záverečnú diagnózu: {"type":"diagnosis","text":"<diagnóza vo formáte markdown>"}

Záverečná diagnóza musí obsahovať tieto časti (použij markdown bold pre nadpisy):
**Čo to pravdepodobne je** — 2–4 možnosti od najčastejšej po menej časté
**Závažnosť** — môžem jazdiť normálne / jazdiť opatrne / auto nejazdite
**Odporúčaný postup** — konkrétne kroky čo treba skontrolovať alebo vymeniť
**Odhadovaná náročnosť opravy** — jednoduchá (do 1h) / stredná (1–3h) / komplexná (3h+)`;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Diagnostika nie je nakonfigurovaná' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Neplatný formát' }, { status: 400 });
  }

  const { vehicle } = body;
  // Podpora oboch formátov: nový {messages:[...]} aj starý {code, symptom}
  let messages = body.messages;
  if (!messages?.length) {
    const { code, symptom } = body;
    if (!code?.trim() && !symptom?.trim()) {
      return NextResponse.json({ error: 'Zadajte kód závady alebo popis problému' }, { status: 400 });
    }
    const content = [
      code?.trim() ? `Kód závady: ${code.trim().toUpperCase()}` : '',
      symptom?.trim() ? `Popis problému: ${symptom.trim()}` : '',
    ].filter(Boolean).join('\n');
    messages = [{ role: 'user', content }];
  }

  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  const vehicleStr = [vehicle?.brand, vehicle?.model, vehicle?.year, vehicle?.fuel].filter(Boolean).join(', ');

  let systemFull = SYSTEM;
  if (vehicleStr) systemFull += `\n\nVozidlo zákazníka: ${vehicleStr}`;
  if (assistantCount >= 4) {
    systemFull += '\n\nMÁŠ UŽ DOSTATOK INFORMÁCIÍ. Teraz daj záverečnú diagnózu (type: "diagnosis").';
  } else if (assistantCount === 3) {
    systemFull += '\n\nToto je tvoja posledná otázka pred záverečnou diagnózou — polož ju tak, aby si získal kľúčovú chýbajúcu informáciu.';
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemFull,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const raw = response.content[0]?.text?.trim() || '';
    let parsed;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      parsed = { type: 'question', text: raw };
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('diagnostika error:', e.message);
    return NextResponse.json({ error: 'Chyba pri spracovaní' }, { status: 500 });
  }
}
