'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

const FUEL_OPTIONS = ['Benzín', 'Diesel', 'Hybrid', 'Elektrický', 'CNG', 'LPG'];

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<h3 class="text-red-500 font-black uppercase italic tracking-tight text-sm mt-4 mb-1">$1</h3>')
    .replace(/^(\d+)\.\s+\*\*(.+?)\*\*(.*)$/gm, '<div class="mt-3"><p class="font-bold text-white">$1. $2</p><p class="text-zinc-300 mt-0.5">$3</p></div>')
    .replace(/^- (.+)$/gm, '<li class="text-zinc-300 ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>');
}

export default function DiagnostikaPage() {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuel, setFuel] = useState('');
  const [code, setCode] = useState('');
  const [symptom, setSymptom] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const resultRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() && !symptom.trim()) {
      setError('Zadajte kód závady alebo popis symptomu.');
      return;
    }
    setError('');
    setResult('');
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostika', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, model, year, fuel, code: code.trim(), symptom: symptom.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Nastala chyba. Skúste neskôr.');
      } else {
        setResult(data.result);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch {
      setError('Nepodarilo sa spojiť so serverom.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-black uppercase italic tracking-tighter text-white text-lg hover:text-red-500 transition-colors">
          AutoAlma Servis
        </Link>
        <Link href="/#kontakt" className="text-sm text-zinc-400 hover:text-white transition-colors">
          Kontakt
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-red-600 text-xs font-black uppercase italic tracking-widest mb-3">AI Diagnostika</p>
          <h1 className="font-black uppercase italic tracking-tighter text-4xl sm:text-5xl leading-none mb-4">
            Kód závady<br />
            <span className="text-red-600">vysvetlený za sekundy</span>
          </h1>
          <p className="text-zinc-400 max-w-lg leading-relaxed">
            Zadajte chybový kód z diagnostiky alebo popíšte problém svojho vozidla. Náš AI asistent vám vysvetlí čo sa deje, aké sú možné príčiny a čo treba opraviť.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle info */}
          <div className="bg-zinc-950 rounded-[2rem] p-6 border border-zinc-900">
            <h2 className="font-black uppercase italic tracking-tighter text-sm text-zinc-400 mb-4">Vozidlo (voliteľné)</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Značka</label>
                <input
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="napr. Škoda"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Model</label>
                <input
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="napr. Octavia"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none transition-colors"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Rok</label>
                <input
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="2019"
                  maxLength={4}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none transition-colors"
                />
              </div>
              <div className="col-span-1 sm:col-span-3">
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Palivo</label>
                <select
                  value={fuel}
                  onChange={e => setFuel(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none transition-colors"
                >
                  <option value="">— neviem / neuviesť —</option>
                  {FUEL_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Problem */}
          <div className="bg-zinc-950 rounded-[2rem] p-6 border border-zinc-900">
            <h2 className="font-black uppercase italic tracking-tighter text-sm text-zinc-400 mb-4">Problém <span className="text-red-600">*</span></h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Kód závady (OBD kód)</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="napr. P0300, P0171, B0001..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none transition-colors font-mono"
                />
              </div>
              <div className="flex items-center gap-3 text-zinc-600 text-xs uppercase tracking-wider">
                <div className="flex-1 h-px bg-zinc-900" />
                alebo
                <div className="flex-1 h-px bg-zinc-900" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Popis symptomu</label>
                <textarea
                  value={symptom}
                  onChange={e => setSymptom(e.target.value)}
                  placeholder="napr. Auto ťažko štartuje, svieti kontrolka motora, cítiť spálené oleje, auto ťahá doľava..."
                  rows={3}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>
            {error && (
              <p className="mt-3 text-red-500 text-sm">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-tighter text-lg py-4 rounded-[1.5rem] transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzujem závadu...
              </span>
            ) : 'Analyzovať závadu'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div ref={resultRef} className="mt-10 bg-zinc-950 rounded-[2rem] border border-zinc-900 overflow-hidden">
            <div className="bg-red-600 px-6 py-4">
              <p className="font-black uppercase italic tracking-tighter text-white text-sm">Výsledok diagnostiky</p>
              {(brand || model) && (
                <p className="text-red-200 text-xs mt-0.5">{[brand, model, year, fuel].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div
              className="px-6 py-6 text-sm leading-relaxed prose-sm"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(result) }}
            />

            {/* CTA */}
            <div className="mx-6 mb-6 bg-black rounded-[1.5rem] p-5 border border-zinc-800">
              <p className="font-black uppercase italic tracking-tighter text-white mb-1">Potrebujete opravu?</p>
              <p className="text-zinc-400 text-sm mb-4">
                Navštívte nás v AutoAlma Servis Bratislava — profesionálna diagnostika a oprava osobných aj dodávkových vozidiel.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/#kontakt"
                  className="flex-1 text-center bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-tighter text-sm py-3 rounded-xl transition-colors"
                >
                  Objednať sa
                </Link>
                <a
                  href="tel:+421940449449"
                  className="flex-1 text-center border border-zinc-700 hover:border-zinc-500 text-white font-black uppercase italic tracking-tighter text-sm py-3 rounded-xl transition-colors"
                >
                  0940 449 449
                </a>
              </div>
              <p className="text-zinc-600 text-xs mt-3 text-center">Svornosti 119, 821 06 Bratislava · Po–Pi 7:30–17:00</p>
            </div>
          </div>
        )}

        {/* Info cards */}
        {!result && (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '🔍', title: 'OBD kódy', text: 'P, C, B, U série kódov z diagnostiky vozidla' },
              { icon: '🚗', title: 'Symptómy', text: 'Popíšte čo auto robí a my to analyzujeme' },
              { icon: '🛠️', title: 'Postup opravy', text: 'Dostanete konkrétny postup čo treba skontrolovať' },
            ].map(card => (
              <div key={card.title} className="bg-zinc-950 rounded-[1.5rem] p-5 border border-zinc-900 text-center">
                <div className="text-3xl mb-3">{card.icon}</div>
                <p className="font-black uppercase italic tracking-tighter text-white text-sm mb-1">{card.title}</p>
                <p className="text-zinc-500 text-xs leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 mt-20 px-6 py-8 text-center">
        <p className="text-zinc-600 text-xs">
          AutoAlma s.r.o. · Svornosti 119, 821 06 Bratislava · IČO: 46044876
        </p>
        <p className="text-zinc-700 text-xs mt-1">
          AI odpovede sú informatívne. Pre presnú diagnostiku navštívte autoservis.
        </p>
      </footer>
    </div>
  );
}
