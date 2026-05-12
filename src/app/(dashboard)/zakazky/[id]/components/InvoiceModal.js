'use client';
import { useState } from 'react';

export default function InvoiceModal({ zakazka, total, invoiceLoading, onFinalize, onClose }) {
  const [paymentMethod, setPaymentMethod] = useState('card');

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 no-print font-black">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl font-bold">
        <h3 className="text-4xl font-black uppercase italic mb-2 tracking-tighter text-white">Finalizácia zákazky</h3>
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-8">{zakazka.customer_name} — {zakazka.plate_number} — {total.toFixed(2)} €</p>

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Spôsob úhrady</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button onClick={() => setPaymentMethod('card')} className={`py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest transition-all border-2 ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>💳 Kartou</button>
          <button onClick={() => setPaymentMethod('cash')} className={`py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest transition-all border-2 ${paymentMethod === 'cash' ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>💵 Hotovosť</button>
        </div>

        {paymentMethod === 'cash' && (
          <div className="bg-green-600/10 border border-green-600/30 rounded-2xl px-4 py-3 mb-6 text-[10px] font-black text-green-400 uppercase tracking-widest">
            Platba sa automaticky zapíše do kasy — {zakazka.plate_number} — {total.toFixed(2)} €
          </div>
        )}

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Typ dokladu</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button disabled={invoiceLoading} onClick={() => onFinalize(true, paymentMethod)} className="bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all shadow-xl font-bold font-sans">📄 VYSTAVIŤ FAKTÚRU</button>
          <button disabled={invoiceLoading} onClick={() => onFinalize(false, paymentMethod)} className="bg-zinc-800 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all font-bold font-sans">📂 IBA ODLOŽIŤ</button>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all italic font-black">Späť k úpravám</button>
      </div>
    </div>
  );
}
