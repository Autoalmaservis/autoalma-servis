export const maxDuration = 30;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

export async function POST(req) {
  if (!await isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
