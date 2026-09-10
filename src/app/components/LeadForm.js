'use client';
import { useState } from 'react';
import { trackContactSubmit, trackPhoneClick } from '@/app/lib/analytics';

// Krátky formulár pre cieľové stránky reklamy.
// Povinné len meno, telefón a popis problému — každé pole navyše znižuje počet odoslaní.
export default function LeadForm({ sluzba = '', placeholder = 'Opíšte, čo auto robí...' }) {
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          message: sluzba ? `[${sluzba}] ${form.message}` : form.message,
        }),
      });
      if (!res.ok) throw new Error('send failed');
      trackContactSubmit();
      setSent(true);
      setForm({ name: '', phone: '', vehicle: '', message: '' });
    } catch {
      setError('Správu sa nepodarilo odoslať. Zavolajte nám prosím na 0940 449 449.');
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="bg-zinc-950 border border-green-900/50 rounded-[2rem] p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Máme to</h3>
        <p className="text-zinc-300 font-bold text-sm">
          Ozveme sa vám čo najskôr. Ak to súri, zavolajte na{' '}
          <a href="tel:0940449449" onClick={() => trackPhoneClick('po-odoslani')} className="text-red-500 hover:underline">0940 449 449</a>.
        </p>
      </div>
    );
  }

  const input = 'w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-red-600/60 rounded-xl px-4 py-3.5 text-white text-sm font-bold placeholder-zinc-500 focus:outline-none transition-colors';
  const label = 'text-[10px] font-black uppercase tracking-widest text-zinc-300';

  return (
    <form onSubmit={submit} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7 md:p-9 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label htmlFor="lf-meno" className={label}>Meno *</label>
          <input id="lf-meno" required value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Ján Novák" className={input} />
        </div>
        <div className="space-y-2">
          <label htmlFor="lf-tel" className={label}>Telefón *</label>
          <input id="lf-tel" required type="tel" value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="+421 900 000 000" className={input} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="lf-vozidlo" className={label}>Vozidlo</label>
        <input id="lf-vozidlo" value={form.vehicle}
          onChange={e => setForm(p => ({ ...p, vehicle: e.target.value }))}
          placeholder="napr. Škoda Octavia 2.0 TDI, 2016" className={input} />
      </div>

      <div className="space-y-2">
        <label htmlFor="lf-sprava" className={label}>Čo sa deje? *</label>
        <textarea id="lf-sprava" required rows={4} value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder={placeholder} className={`${input} resize-none`} />
      </div>

      {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Ozveme sa do 24 hodín</p>
        <button type="submit" disabled={sending}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-9 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all shadow-xl shadow-red-600/20 hover:scale-105">
          {sending ? 'Odosielam...' : 'Poslať a nechať sa ozvať'}
        </button>
      </div>
    </form>
  );
}
