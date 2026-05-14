export const maxDuration = 30; // Sekundy na spracovanie (Vercel)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) throw new Error("API kľúč chýba!");

    const formData = await req.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: "Súbor nebol nájdený." }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Čítanie dát bezpečným spôsobom
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
    
    return NextResponse.json({ status: true, data: JSON.parse(text) });

  } catch (err) {
    console.error("DETEKCIA CHYBY:", err); // Sleduj toto v TERMINÁLI
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}