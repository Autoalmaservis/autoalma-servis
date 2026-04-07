'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams } from 'next/navigation';

export default function FakturaOnlinePage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (data) setInvoice(data);
    setLoading(false);
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-zinc-400 animate-pulse font-bold uppercase tracking-widest">Generujem doklad...</div>;
  if (!invoice) return <div className="min-h-screen bg-white flex items-center justify-center text-red-600 font-bold uppercase">Doklad nebol nájdený</div>;

  const subtotal = invoice.subtotal_amount || 0;
  const tax = invoice.tax_amount || 0;
  const total = invoice.total_amount || 0;

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-12 font-sans text-black">
      {/* Tlačidlo tlače - skryté pri tlači */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-end no-print">
        <button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg transition-all"
        >
          🖨️ Tlačiť / Uložiť PDF
        </button>
      </div>

      {/* Samotná faktúra */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl p-8 md:p-16 rounded-sm border border-zinc-200 printable-invoice">
        
        {/* Hlavička */}
        <div className="flex justify-between items-start border-b-2 border-zinc-100 pb-10 mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">AutoAlma <span className="text-blue-600">Servis</span></h1>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest leading-relaxed">
              Slovenská ulica 12, Košice<br/>
              IČO: 12345678 | DIČ: 2021222324<br/>
              www.autoalma.sk
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase mb-1">Faktúra / Doklad</h2>
            <p className="text-3xl font-light text-blue-600">{invoice.invoice_number}</p>
            <p className="text-[9px] text-zinc-400 uppercase font-bold mt-2">Dátum vystavenia: {new Date(invoice.created_at).toLocaleDateString('sk-SK')}</p>
          </div>
        </div>

        {/* Odberateľ a Vozidlo */}
        <div className="grid grid-cols-2 gap-10 mb-12">
          <div>
            <h3 className="text-[10px] font-black uppercase text-zinc-400 mb-4 tracking-[0.2em]">Odberateľ</h3>
            <p className="text-lg font-bold uppercase">{invoice.customer_name}</p>
            {invoice.customer_phone && <p className="text-xs text-zinc-600">{invoice.customer_phone}</p>}
          </div>
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100">
            <h3 className="text-[10px] font-black uppercase text-zinc-400 mb-2 tracking-[0.2em]">Vozidlo</h3>
            <p className="text-sm font-bold uppercase italic">{invoice.car_details?.brand || 'Nezadané'}</p>
            <p className="text-lg font-black text-blue-600 tracking-wider">{invoice.car_details?.plate || '---'}</p>
            <p className="text-[9px] font-mono text-zinc-500 mt-1 uppercase">VIN: {invoice.car_details?.vin || '---'}</p>
          </div>
        </div>

        {/* Tabuľka položiek */}
        <div className="mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-black text-[10px] uppercase font-black tracking-widest text-zinc-400">
                <th className="py-4">Popis položky alebo služby</th>
                <th className="py-4 text-center w-24">Množstvo</th>
                <th className="py-4 text-right w-32">Cena / J</th>
                <th className="py-4 text-right w-32">Spolu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {invoice.items_json?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-5">
                    <p className="font-bold uppercase italic text-xs">{item.name}</p>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-widest">{item.type}</p>
                  </td>
                  <td className="py-5 text-center font-medium">{item.quantity} {item.unit}</td>
                  <td className="py-5 text-right font-medium">{item.unit_price.toFixed(2)} €</td>
                  <td className="py-5 text-right font-bold">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rekapitulácia sumy */}
        <div className="flex justify-end">
          <div className="w-full md:w-80">
            <div className="flex justify-between py-2 text-xs font-medium text-zinc-500 uppercase italic">
              <span>Základ dane:</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-2 text-xs font-medium text-zinc-500 uppercase italic border-b border-zinc-100 pb-4">
              <span>DPH (23%):</span>
              <span>{tax.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-6">
              <span className="text-xl font-black uppercase italic italic">Celkom k úhrade:</span>
              <span className="text-3xl font-black text-blue-600">{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Päta */}
        <div className="mt-20 border-t border-zinc-100 pt-10 flex justify-between items-center text-[9px] text-zinc-400 uppercase font-bold tracking-widest">
          <p>Doklad vygenerovaný systémom AutoAlma Service OS</p>
          <div className="text-right">
            <p className="text-zinc-800">Ďakujeme za prejavenú dôveru!</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; p: 0 !important; }
          .min-h-screen { min-height: 0 !important; background: white !important; padding: 0 !important; }
          .printable-invoice { 
            box-shadow: none !important; 
            border: none !important; 
            max-width: 100% !important; 
            width: 100% !important;
            padding: 0 !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}