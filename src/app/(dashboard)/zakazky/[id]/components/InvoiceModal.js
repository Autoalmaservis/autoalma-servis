'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function InvoiceModal({ zakazka, total, invoiceLoading, onFinalize, onClose }) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [noVat, setNoVat] = useState(false);

  // Číslo faktúry — automaticky, alebo ručne zadané
  const [manualOn, setManualOn] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [reserved, setReserved] = useState([]);

  // Čísla, ktoré sa uvoľnili zrušením faktúry tejto zákazky — použijú sa znova
  useEffect(() => {
    if (!zakazka?.id) return;
    supabase
      .from('invoice_number_pool')
      .select('invoice_number, prefix')
      .eq('job_id', zakazka.id)
      .is('used_at', null)
      .order('released_at', { ascending: false })
      .then(({ data }) => setReserved(data || []));
  }, [zakazka?.id]);

  const reservedFor = (isOfficial) => reserved.find(r => r.prefix?.startsWith(isOfficial ? 'F' : 'A'))?.invoice_number || null;
  const submit = (isOfficial) => onFinalize(isOfficial, paymentMethod, noVat, manualOn ? manualNumber : '');

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 no-print font-black">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl font-bold">
        <h3 className="text-4xl font-black uppercase italic mb-2 tracking-tighter text-white">Finalizácia zákazky</h3>
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-8">{zakazka.customer_name} — {zakazka.plate_number} — {total.toFixed(2)} €</p>

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Spôsob úhrady</p>
        <div className="grid grid-cols-3 gap-3 mb-8">
          <button onClick={() => setPaymentMethod('card')} className={`py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest transition-all border-2 ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>💳 Kartou</button>
          <button onClick={() => setPaymentMethod('cash')} className={`py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest transition-all border-2 ${paymentMethod === 'cash' ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>💵 Hotovosť</button>
          <button onClick={() => setPaymentMethod('transfer')} className={`py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest transition-all border-2 ${paymentMethod === 'transfer' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>🏦 Prevodom</button>
        </div>

        {paymentMethod === 'cash' && (
          <div className="bg-green-600/10 border border-green-600/30 rounded-2xl px-4 py-3 mb-6 text-[10px] font-black text-green-400 uppercase tracking-widest">
            Platba sa automaticky zapíše do kasy — {zakazka.plate_number} — {total.toFixed(2)} €
          </div>
        )}

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setNoVat(v => !v)}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${noVat ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}
          >
            {noVat ? '✓ Fakturácia bez DPH (CZ firma)' : 'Fakturácia bez DPH (CZ firma)'}
          </button>
          {noVat && (
            <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest text-center mt-2">
              DPH nebude účtovaná — platí pre zahraničné firmy s IČ DPH
            </p>
          )}
        </div>

        {/* ČÍSLO DOKLADU */}
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Číslo dokladu</p>

          {reserved.length > 0 && !manualOn && (
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl px-4 py-3 mb-3 text-[10px] font-black text-blue-300 uppercase tracking-widest">
              Rezervované zo zrušenej faktúry: {reserved.map(r => r.invoice_number).join(', ')} — použije sa znova
            </div>
          )}

          <button
            type="button"
            onClick={() => setManualOn(v => !v)}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${manualOn ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}
          >
            {manualOn ? '✓ Zadať číslo ručne' : 'Zadať číslo ručne'}
          </button>

          {manualOn && (
            <div className="mt-3">
              <input
                type="text"
                value={manualNumber}
                onChange={e => setManualNumber(e.target.value.toUpperCase())}
                placeholder="napr. F26012"
                className="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-red-600 rounded-2xl px-4 py-3 text-white font-black text-lg tracking-widest outline-none transition-all text-center uppercase"
              />
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest text-center mt-2">
                Musí byť jedinečné. Ak necháš prázdne, použije sa automatické číslo.
              </p>
            </div>
          )}
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Typ dokladu</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button disabled={invoiceLoading} onClick={() => submit(true)} className="bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all shadow-xl font-bold font-sans">
            📄 VYSTAVIŤ FAKTÚRU
            <span className="block text-[9px] tracking-widest opacity-60 mt-1 normal-case">
              {manualOn ? (manualNumber || 'zadaj číslo vyššie') : (reservedFor(true) || 'ďalšie v poradí')}
            </span>
          </button>
          <button disabled={invoiceLoading} onClick={() => submit(false)} className="bg-zinc-800 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all font-bold font-sans">
            📂 IBA ODLOŽIŤ
            <span className="block text-[9px] tracking-widest opacity-60 mt-1 normal-case">
              {manualOn ? (manualNumber || 'zadaj číslo vyššie') : (reservedFor(false) || 'ďalšie v poradí')}
            </span>
          </button>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all italic font-black">Späť k úpravám</button>
      </div>
    </div>
  );
}
