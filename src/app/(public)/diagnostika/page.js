'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const FUEL_OPTIONS = ['Benzín', 'Diesel', 'Hybrid', 'Elektrický', 'CNG', 'LPG'];

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-zinc-300">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-3">');
}

export default function DiagnostikaPage() {
  const [phase, setPhase] = useState('form'); // 'form' | 'chat' | 'done'

  // Formulár
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuel, setFuel] = useState('');
  const [code, setCode] = useState('');
  const [symptom, setSymptom] = useState('');

  // Chat
  const [messages, setMessages] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [questionNum, setQuestionNum] = useState(0);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  useEffect(() => {
    if (phase === 'chat' && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase, loading, questionNum]);

  const vehicle = { brand, model, year, fuel };
  const vehicleLabel = [brand, model, year, fuel].filter(Boolean).join(' · ');

  async function callApi(msgs) {
    const res = await fetch('/api/diagnostika', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle, messages: msgs }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba servera');
    return data;
  }

  async function startDiagnosis(e) {
    e.preventDefault();
    if (!code.trim() && !symptom.trim()) {
      setError('Zadajte kód závady alebo popis problému.');
      return;
    }
    setError('');
    setLoading(true);

    const initialContent = [
      code.trim() ? `Kód závady: ${code.trim().toUpperCase()}` : '',
      symptom.trim() ? `Popis problému: ${symptom.trim()}` : '',
    ].filter(Boolean).join('\n');

    const initMsgs = [{ role: 'user', content: initialContent }];

    try {
      const reply = await callApi(initMsgs);
      const full = [...initMsgs, { role: 'assistant', content: reply.text, type: reply.type }];
      setMessages(full);
      if (reply.type === 'diagnosis') {
        setDiagnosis(reply.text);
        setPhase('done');
      } else {
        setQuestionNum(1);
        setPhase('chat');
      }
    } catch (err) {
      setError(err.message || 'Nepodarilo sa spojiť so serverom. Skúste znova.');
    } finally {
      setLoading(false);
    }
  }

  async function sendAnswer(e) {
    e?.preventDefault();
    if (!currentAnswer.trim() || loading) return;
    setLoading(true);
    setError('');

    const withAnswer = [...messages, { role: 'user', content: currentAnswer.trim() }];
    setMessages(withAnswer);
    setCurrentAnswer('');

    try {
      const reply = await callApi(withAnswer.map(m => ({ role: m.role, content: m.content })));
      const full = [...withAnswer, { role: 'assistant', content: reply.text, type: reply.type }];
      setMessages(full);
      if (reply.type === 'diagnosis') {
        setDiagnosis(reply.text);
        setPhase('done');
      } else {
        setQuestionNum(n => n + 1);
      }
    } catch {
      setError('Chyba pri odosielaní. Skúste znova.');
      setMessages(withAnswer.slice(0, -1));
      setCurrentAnswer(withAnswer[withAnswer.length - 1].content);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPhase('form');
    setMessages([]);
    setCurrentAnswer('');
    setDiagnosis('');
    setQuestionNum(0);
    setError('');
    setCode('');
    setSymptom('');
  }

  // Chat messages — skip first user message (initial complaint), show only Q&A
  const chatMessages = messages.slice(1);
  const currentQuestion = messages.filter(m => m.role === 'assistant' && m.type === 'question').slice(-1)[0];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black uppercase italic tracking-tighter text-white text-lg hover:text-red-500 transition-colors">
          AutoAlma Servis
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
            ← Hlavná stránka
          </Link>
          <Link href="/#kontakt" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Kontakt
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">

        {/* ── FÁZA 1: Formulár ── */}
        {phase === 'form' && (
          <>
            <div className="mb-10">
              <p className="text-red-600 text-xs font-black uppercase italic tracking-widest mb-3">Diagnostika vozidla</p>
              <h1 className="font-black uppercase italic tracking-tighter text-4xl sm:text-5xl leading-none mb-4">
                Opíšte<br />
                <span className="text-red-600">váš problém</span>
              </h1>
              <p className="text-zinc-400 leading-relaxed">
                Zadajte základné údaje o vozidle a popíšte závadu. Náš systém vám položí niekoľko upresňujúcich otázok a potom vám dá konkrétnu diagnózu.
              </p>
            </div>

            <form onSubmit={startDiagnosis} className="space-y-5">
              {/* Vozidlo */}
              <div className="bg-zinc-950 rounded-[1.5rem] p-5 border border-zinc-900">
                <p className="text-xs font-black uppercase italic tracking-widest text-zinc-500 mb-4">Vozidlo (voliteľné)</p>
                <div className="grid grid-cols-2 gap-3">
                  <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Značka" className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none" />
                  <input value={model} onChange={e => setModel(e.target.value)} placeholder="Model" className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none" />
                  <input value={year} onChange={e => setYear(e.target.value)} placeholder="Rok výroby" maxLength={4} className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none" />
                  <select value={fuel} onChange={e => setFuel(e.target.value)} className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none">
                    <option value="">Palivo</option>
                    {FUEL_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {/* Problém */}
              <div className="bg-zinc-950 rounded-[1.5rem] p-5 border border-zinc-900">
                <p className="text-xs font-black uppercase italic tracking-widest text-zinc-500 mb-4">Problém <span className="text-red-600">*</span></p>
                <div className="space-y-3">
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="OBD kód závady  (napr. P0300, P0171…)"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none font-mono"
                  />
                  <div className="flex items-center gap-3 text-zinc-700 text-xs uppercase tracking-wider">
                    <div className="flex-1 h-px bg-zinc-900" />alebo<div className="flex-1 h-px bg-zinc-900" />
                  </div>
                  <textarea
                    value={symptom}
                    onChange={e => setSymptom(e.target.value)}
                    placeholder="Opíšte problém vlastnými slovami…  napr. auto ťažko štartuje, svieti kontrolka motora, počuť klepanie…"
                    rows={3}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-red-600 focus:outline-none resize-none"
                  />
                </div>
                {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black uppercase italic tracking-tighter text-lg py-4 rounded-[1.5rem] transition-colors flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Spracovávam...
                  </>
                ) : 'Začať diagnostiku →'}
              </button>
            </form>

            {/* Info */}
            <div className="mt-10 grid grid-cols-3 gap-3">
              {[
                { icon: '💬', label: 'Max 5 otázok', text: 'Systém vám položí len najpotrebnejšie otázky' },
                { icon: '🔍', label: 'Presná analýza', text: 'Na základe odpovedí zúži možné príčiny' },
                { icon: '🛠️', label: 'Konkrétny plán', text: 'Dostanete odporúčanie čo opraviť a ako' },
              ].map(c => (
                <div key={c.label} className="bg-zinc-950 rounded-[1.5rem] p-4 border border-zinc-900 text-center">
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <p className="font-black uppercase italic tracking-tight text-white text-xs mb-1">{c.label}</p>
                  <p className="text-zinc-600 text-xs leading-tight">{c.text}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FÁZA 2: Chat ── */}
        {phase === 'chat' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-red-600 text-xs font-black uppercase italic tracking-widest mb-0.5">Diagnostika prebieha</p>
                {vehicleLabel && <p className="text-zinc-500 text-xs">{vehicleLabel}</p>}
              </div>
              <div className="text-right">
                <p className="text-zinc-400 text-xs font-black uppercase tracking-wider">Otázka {questionNum} / 5</p>
                <div className="flex gap-1 mt-1.5 justify-end">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i <= questionNum ? 'bg-red-600' : 'bg-zinc-800'}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Pôvodný popis */}
            {messages[0] && (
              <div className="mb-4 bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3">
                <p className="text-zinc-600 text-xs uppercase tracking-wider mb-1">Váš popis</p>
                <p className="text-zinc-300 text-sm whitespace-pre-line">{messages[0].content}</p>
              </div>
            )}

            {/* Konverzácia (Q&A) */}
            <div className="space-y-3 mb-6">
              {chatMessages.map((msg, i) => (
                msg.role === 'assistant' && msg.type === 'question' ? (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl rounded-tl-sm px-5 py-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1.5">Otázka</p>
                    <p className="text-white text-sm leading-relaxed">{msg.content}</p>
                  </div>
                ) : msg.role === 'user' && i > 0 ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-zinc-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                      <p className="text-zinc-300 text-sm">{msg.content}</p>
                    </div>
                  </div>
                ) : null
              ))}

              {loading && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl rounded-tl-sm px-5 py-4">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            <div ref={bottomRef} />

            {/* Input */}
            {!loading && currentQuestion && (
              <form onSubmit={sendAnswer} className="sticky bottom-4">
                <div className="bg-zinc-950 border border-zinc-800 rounded-[1.5rem] overflow-hidden shadow-2xl shadow-black">
                  <textarea
                    ref={inputRef}
                    value={currentAnswer}
                    onChange={e => setCurrentAnswer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); }
                    }}
                    placeholder="Napíšte vašu odpoveď…"
                    rows={2}
                    className="w-full bg-transparent px-5 pt-4 pb-2 text-sm text-white placeholder-zinc-600 focus:outline-none resize-none"
                  />
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <p className="text-zinc-700 text-xs">Enter = odoslať · Shift+Enter = nový riadok</p>
                    <button
                      type="submit"
                      disabled={!currentAnswer.trim()}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black uppercase italic tracking-tighter text-xs px-5 py-2 rounded-xl transition-colors"
                    >
                      Odoslať →
                    </button>
                  </div>
                </div>
                {error && <p className="mt-2 text-red-500 text-xs text-center">{error}</p>}
              </form>
            )}
          </>
        )}

        {/* ── FÁZA 3: Diagnóza ── */}
        {phase === 'done' && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-red-600 text-xs font-black uppercase italic tracking-widest mb-0.5">Výsledok diagnostiky</p>
                {vehicleLabel && <p className="text-zinc-500 text-xs">{vehicleLabel}</p>}
              </div>
              <button onClick={reset} className="text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2 transition-colors">
                Nová diagnostika
              </button>
            </div>

            {/* Súhrn konverzácie */}
            {chatMessages.length > 0 && (
              <div className="mb-5 bg-zinc-950 border border-zinc-900 rounded-[1.5rem] overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-900">
                  <p className="text-zinc-600 text-xs uppercase tracking-wider">Priebeh diagnostiky</p>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {messages[0] && (
                    <div>
                      <p className="text-zinc-600 text-xs mb-0.5">Váš popis</p>
                      <p className="text-zinc-400 text-xs whitespace-pre-line">{messages[0].content}</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    msg.type === 'question' ? (
                      <div key={i}>
                        <p className="text-zinc-600 text-xs mb-0.5">Otázka {Math.ceil((i) / 2) + 1}</p>
                        <p className="text-zinc-400 text-xs">{msg.content}</p>
                      </div>
                    ) : msg.role === 'user' ? (
                      <div key={i}>
                        <p className="text-zinc-700 text-xs mb-0.5">Vaša odpoveď</p>
                        <p className="text-zinc-500 text-xs">{msg.content}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            )}

            {/* Diagnóza */}
            <div className="bg-zinc-950 rounded-[2rem] border border-zinc-900 overflow-hidden mb-6">
              <div className="bg-red-600 px-6 py-4">
                <p className="font-black uppercase italic tracking-tighter text-white">Diagnóza a odporúčanie</p>
              </div>
              <div
                className="px-6 py-6 text-sm leading-relaxed text-zinc-300"
                dangerouslySetInnerHTML={{ __html: '<p>' + parseMarkdown(diagnosis) + '</p>' }}
              />
            </div>

            {/* CTA */}
            <div className="bg-zinc-950 rounded-[1.5rem] p-5 border border-zinc-800">
              <p className="font-black uppercase italic tracking-tighter text-white mb-1">Chcete to opraviť u nás?</p>
              <p className="text-zinc-400 text-sm mb-4">AutoAlma Servis Bratislava — profesionálna diagnostika a oprava. Objednajte sa a my sa o to postaráme.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/#kontakt" className="flex-1 text-center bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-tighter text-sm py-3 rounded-xl transition-colors">
                  Objednať sa online
                </Link>
                <a href="tel:+421940449449" className="flex-1 text-center border border-zinc-700 hover:border-zinc-500 text-white font-black uppercase italic tracking-tighter text-sm py-3 rounded-xl transition-colors">
                  Zavolať: 0940 449 449
                </a>
              </div>
              <p className="text-zinc-600 text-xs mt-3 text-center">Svornosti 119, 821 06 Bratislava · Po–Pi 7:30–17:00</p>
            </div>

            <div ref={bottomRef} />
          </>
        )}
      </main>

      <footer className="border-t border-zinc-900 mt-16 px-6 py-8 text-center">
        <p className="text-zinc-700 text-xs">AutoAlma s.r.o. · IČO: 46044876 · Svornosti 119, Bratislava</p>
        <p className="text-zinc-800 text-xs mt-1">Výsledky diagnostiky sú informatívne a nenahradzujú fyzickú prehliadku vozidla.</p>
      </footer>
    </div>
  );
}
