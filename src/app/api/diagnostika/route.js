import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Diagnostika nie je nakonfigurovaná' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neplatný formát požiadavky' }, { status: 400 });
  }

  const { brand, model, year, fuel, code, symptom } = body;
  if (!code && !symptom) {
    return NextResponse.json({ error: 'Zadajte kód závady alebo popis symptomu' }, { status: 400 });
  }

  const vehicleInfo = [brand, model, year, fuel].filter(Boolean).join(', ');
  const issue = code ? `Kód závady: ${code.toUpperCase()}` : '';
  const symptomText = symptom ? `Popis symptomu: ${symptom}` : '';

  const prompt = `Si skúsený automobilový diagnostik a technik v autoservise AutoAlma Servis v Bratislave. Zákazník má problém s vozidlom a potrebuje odbornú radu.

Vozidlo: ${vehicleInfo || 'nešpecifikované'}
${issue}
${symptomText}

Odpovedz v slovenčine, odborne ale zrozumiteľne pre bežného vodiča. Štruktúruj odpoveď takto:

1. **Čo tento kód/symptom znamená** — jednoduché vysvetlenie čo sa deje v aute
2. **Najčastejšie príčiny** — vypíš 3-5 konkrétnych príčin od najčastejšej po menej časté
3. **Čo sa môže stať ak to ignorujem** — riziko pokračovania jazdy
4. **Odporúčaný postup opravy** — konkrétne kroky čo treba skontrolovať/vymeniť
5. **Odhadovaná náročnosť** — jednoduché (do 1h), stredné (1-3h), alebo komplexné (3h+)

Na záver pripoj krátku vetu že pre presnú diagnostiku a opravu odporúčaš navštíviť autoservis — nezväzuj sa na konkrétny servis, len všeobecné odporúčanie.

Buď konkrétny a praktický. Ak je kód neznámy alebo symptom príliš vágny, povedz to a spýtaj sa na ďalšie informácie.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text?.trim() || '';
    return NextResponse.json({ result: text });
  } catch (e) {
    console.error('diagnostika error:', e.message);
    return NextResponse.json({ error: 'Chyba pri spracovaní diagnostiky' }, { status: 500 });
  }
}
