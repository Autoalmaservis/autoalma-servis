export const maxDuration = 30;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireUser } from '@/app/lib/apiAuth';
import { isRateLimited, rateLimitResponse } from '@/app/lib/rateLimit';

export async function POST(req) {
  // Používa aj zákazník v Garáži (sken TP pri pridaní auta) → stačí prihlásenie, ale volá
  // Google AI: bežný používateľ max 10 skenov / 10 min, admin bez stropu (audit 2026-09)
  const caller = await requireUser(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (caller.role !== 'admin' && isRateLimited('scan-tp', caller.user.id, 10, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Skenovanie TP nie je nakonfigurované' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Súbor nebol nájdený.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Obrázok je príliš veľký (max 10 MB)' }, { status: 413 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const buffer = await file.arrayBuffer();
    const base64String = Buffer.from(buffer).toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      "Analyze this car registration document. Return ONLY a JSON object with: brand, model, vin, engine_volume, engine_power, fuel_type, year.",
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('scan-tp: AI returned invalid JSON');
      return NextResponse.json({ error: 'AI nevrátila platné dáta. Skús odfotiť TP znova.' }, { status: 422 });
    }

    return NextResponse.json({ status: true, data });

  } catch (err) {
    console.error('scan-tp error:', err.message);
    return NextResponse.json({ error: 'Chyba pri skenovaní TP' }, { status: 500 });
  }
}
