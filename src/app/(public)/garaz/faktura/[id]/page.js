'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

export default function DetailFakturyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [myCompany, setMyCompany] = useState({
    name: 'AutoAlma Servis',
    address: '',
    city: '',
    zip: '',
    ico: '',
    dic: '',
    ic_dph: '',
    bank: '',
    swift: ''
  });

  useEffect(() => {
    if (id) {
      fetchInvoice();
      fetchMyCompanySettings();
    }
  }, [id]);

  const fetchMyCompanySettings = async () => {
    const { data } = await supabase.from('business_settings').select('*');
    if (data) {
      setMyCompany({
        name: data.find(s => s.id === 'company_name')?.value || 'AutoAlma Servis',
        address: data.find(s => s.id === 'company_address')?.value || '',
        city: data.find(s => s.id === 'company_city')?.value || '',
        zip: data.find(s => s.id === 'company_zip')?.value || '',
        ico: data.find(s => s.id === 'company_ico')?.value || '',
        dic: data.find(s => s.id === 'company_dic')?.value || '',
        ic_dph: data.find(s => s.id === 'company_ic_dph')?.value || '',
        bank: data.find(s => s.id === 'company_bank')?.value || '',
        swift: data.find(s => s.id === 'company_swift')?.value || '',
      });
    }
  };

  const fetchInvoice = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (!error) setInv(data);
    setLoading(false);
  };

  // --- NOVÁ FUNKCIA: ZRUŠIŤ FAKTÚRU A OTVORIŤ ZÁKAZKU ---
  const handleReopenJob = async () => {
    if (!confirm("Pozor! Vymazaním faktúry sa pôvodná zákazka opäť otvorí v stave 'Dokončené'. Chcete pokračovať?")) return;

    try {
      setLoading(true);
      
      // 1. Ak máme prepojenú zákazku, vrátime jej status
      if (inv.job_id) {
        const { error: updateError } = await supabase
          .from('job_tickets')
          .update({ status: 'Dokončené' })
          .eq('id', inv.job_id);
        
        if (updateError) throw updateError;
      }

      // 2. Vymažeme faktúru
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      alert("Faktúra bola odstránená. Pôvodná zákazka je opäť dostupná v zozname zákaziek.");
      router.push('/zakazky');
    } catch (err) {
      alert("Chyba pri znovuotváraní: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateQRValue = () => {
    if (!inv || !myCompany.bank) return '';
    return `SPD*1.0*ACC:${myCompany.bank.replace(/\s/g, '')}*AM:${inv.total_amount}*CUR:EUR*VS:${inv.invoice_number.replace(/\D/g, '')}*MSG:Oprava vozidla ${inv.car_details?.plate_number}`;
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Spracovávam...</div>;
  if (!inv) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Doklad nenájdený</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-12 font-bold font-sans">
      
      {/* OVLÁDACIA LIŠTA */}
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center no-print">
        <div className="flex gap-4">
          <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest font-bold">
            ← Späť
          </button>
          
        </div>
        <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest flex items-center gap-2 font-bold">
          🖨️ Tlačiť dokument
        </button>
      </div>

      {/* SAMOTNÝ DOKLAD */}
      <div className="printable-area bg-zinc-900 border border-zinc-800 p-8 md:p-16 rounded-[3rem] shadow-2xl max-w-5xl mx-auto text-white relative overflow-hidden font-bold">
        
        <div className="absolute top-10 right-10 text-white/5 text-9xl font-black rotate-12 pointer-events-none no-print uppercase">
          {inv.is_official ? 'INVOICE' : 'ARCHIVE'}
        </div>

        {/* HLAVIČKA */}
        <div className="flex justify-between items-start border-b-4 border-red-600 pb-10 mb-10 relative z-10 font-bold section-header">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-4 font-bold title-main">
              AutoAlma <span className="text-red-600 text-5xl font-bold">Servis</span>
            </h1>
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed space-y-1 font-black company-info">
              <p className="text-white font-black italic label-supplier">Dodávateľ:</p>
              <p className="text-white company-name">{myCompany.name}</p>
              <p>{myCompany.address}, {myCompany.zip} {myCompany.city}</p>
              <p>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
              {myCompany.ic_dph && <p>IČ DPH: {myCompany.ic_dph}</p>}
            </div>
          </div>
          <div className="text-right font-bold invoice-meta">
            <h2 className="text-xl font-black uppercase text-red-600 mb-2 italic font-bold doc-type">
              {inv.is_official ? 'Faktúra' : 'Servisný záznam'}
            </h2>
            <p className="text-3xl font-black tracking-tighter mb-4 doc-number">{inv.invoice_number}</p>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black date-info">
              <p>Dátum vystavenia: <span className="text-white date-val">{new Date(inv.created_at).toLocaleDateString('sk-SK')}</span></p>
            </div>
          </div>
        </div>

        {/* ODBERATEĽ A VOZIDLO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 font-bold section-clients">
          <div className="bg-black/30 p-8 rounded-3xl border border-zinc-800 shadow-inner font-bold client-box">
            <p className="text-[9px] text-red-600 font-black uppercase tracking-[0.3em] mb-4 italic font-bold">Odberateľ:</p>
            <div className="space-y-1 font-bold">
              <p className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-2 font-bold client-name">{inv.customer_name}</p>
              <p className="text-xs text-zinc-400 font-bold">{inv.customer_email}</p>
              <p className="text-xs text-zinc-400 font-bold mb-4">{inv.customer_phone}</p>
              {inv.company_details?.ico && (
                <div className="pt-4 border-t border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-500 font-bold">
                   <p>IČO: {inv.company_details.ico} | DIČ: {inv.company_details.dic}</p>
                   {inv.company_details.ic_dph && <p>IČ DPH: {inv.company_details.ic_dph}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-800/20 p-8 rounded-3xl border border-zinc-800 shadow-inner font-bold car-box">
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-4 italic font-bold">Vozidlo:</p>
            <div className="space-y-3 font-bold">
              <span className="bg-white text-black px-4 py-1 rounded-lg font-black text-lg tracking-widest uppercase inline-block shadow-2xl font-bold plate-val">
                {inv.car_details?.plate_number}
              </span>
              <p className="text-xl font-black uppercase italic tracking-tighter font-bold car-model">{inv.car_details?.brand_model}</p>
              <div className="text-[10px] uppercase font-black space-y-1 text-zinc-400 car-meta">
                <p className="flex justify-between font-bold"><span>VIN:</span> <span className="text-zinc-300 font-mono tracking-widest font-bold">{inv.car_details?.vin || '---'}</span></p>
                <p className="flex justify-between font-bold"><span>Stav km:</span> <span className="text-zinc-300 font-bold">{inv.car_details?.mileage || '---'} KM</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* TABUĽKA POLOŽIEK */}
        <div className="mb-12 font-bold table-container">
          <table className="w-full text-left font-bold items-table">
            <thead>
              <tr className="bg-zinc-800/50 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 font-bold">
                <th className="p-4 rounded-l-xl font-bold">Položka / Úkon</th>
                <th className="p-4 text-center font-bold">Množstvo</th>
                <th className="p-4 text-right font-bold">Cena / J</th>
                <th className="p-4 text-right rounded-r-xl font-bold">Spolu bez DPH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-black uppercase italic text-xs font-bold">
              {inv.items_json?.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-all">
                  <td className="p-4 py-6 border-zinc-800 font-bold">
                    <p className="text-white font-bold item-name">{item.name}</p>
                    <span className="text-[8px] text-zinc-600 font-bold tracking-widest font-bold item-type">{item.type}</span>
                  </td>
                  <td className="p-4 text-center text-zinc-400 font-mono font-bold">{item.quantity} {item.unit}</td>
                  <td className="p-4 text-right text-zinc-400 font-mono font-bold">{parseFloat(item.unit_price).toFixed(2)} €</td>
                  <td className="p-4 text-right text-white font-black font-bold">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PLATOBNÉ INFO + QR KÓD */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-12 font-bold border-t border-zinc-800 pt-10 footer-section">
          
          <div className="flex gap-8 items-center payment-info-area">
             {myCompany.bank && inv.is_official && (
               <div className="bg-white p-3 rounded-2xl shadow-2xl no-print qr-code">
                  <QRCodeSVG value={generateQRValue()} size={120} level="H" />
                  <p className="text-[7px] text-black font-black uppercase text-center mt-2 tracking-tighter">Skenujte pre platbu</p>
               </div>
             )}
             {myCompany.bank && inv.is_official && (
               <div className="hidden print-block qr-print">
                  <QRCodeSVG value={generateQRValue()} size={100} level="H" />
               </div>
             )}

             <div className="text-[10px] text-zinc-600 uppercase tracking-widest max-w-xs italic font-bold bank-details">
                <p className="text-zinc-400">Platobné informácie:</p>
                <p className="text-white font-black mt-1 uppercase tracking-tight text-sm bank-iban">{myCompany.bank || 'Platba v hotovosti'}</p>
                {myCompany.swift && <p className="text-zinc-500 mt-1">SWIFT/BIC: {myCompany.swift}</p>}
                <p className="text-zinc-500 mt-1">Variabilný symbol: {inv.invoice_number.replace(/\D/g, '')}</p>
                <p className="mt-4">Vystavil: Maroš - AutoAlma</p>
             </div>
          </div>
          
          <div className="bg-black p-10 rounded-[2.5rem] border border-zinc-800 min-w-[340px] space-y-4 shadow-2xl font-bold totals-box">
            <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest font-bold">
              <span>Základ dane:</span>
              <span>{inv.subtotal_amount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-4 font-bold">
              <span>DPH (23%):</span>
              <span>{inv.tax_amount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-end pt-2 font-bold">
              <span className="text-red-600 font-black uppercase italic tracking-tighter text-2xl leading-none font-bold total-label">Celkom k úhrade:</span>
              <span className="text-5xl font-black italic tracking-tighter leading-none text-white font-bold total-val">{inv.total_amount.toFixed(2)} <span className="text-red-600 text-lg font-bold">€</span></span>
            </div>
          </div>
        </div>

        <div className="hidden print-block mt-16 grid grid-cols-2 gap-20 text-center text-black font-black uppercase italic text-[10px] tracking-widest font-bold signatures">
          <div className="border-t border-black pt-4 font-bold">Pečiatka a podpis servisu</div>
          <div className="border-t border-black pt-4 font-bold">Podpis prevzal (zákazník)</div>
        </div>
      </div>

      {/* --- BRUTÁLNE ČISTÁ TLAČ (BEZ ČIERNYCH BLOKOV) --- */}
      <style jsx global>{`
        .print-block { display: none; }
        @media print {
          @page { size: A4; margin: 1.5cm; }
          
          /* Úplné zrušenie webového prostredia */
          html, body { 
            background: #fff !important; 
            color: #000 !important; 
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Skrytie nepotrebných prvkov */
          .no-print, .absolute.top-10.right-10, ::-webkit-scrollbar { display: none !important; }
          .print-block { display: block !important; }
          .min-h-screen { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          
          /* Čistý papierový kontajner */
          .printable-area { 
            background: #fff !important; 
            color: #000 !important; 
            border: none !important; 
            box-shadow: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: 100% !important; 
            max-width: none !important; 
            border-radius: 0 !important;
            overflow: visible !important;
          }

          /* Resetovanie farieb všetkého textu */
          p, span, h1, h2, h3, h4, td, th, div { 
            color: #000 !important; 
            background: none !important; 
            text-shadow: none !important;
          }

          /* Úprava hlavičky */
          .section-header { 
            border-bottom: 3pt solid #000 !important; 
            padding-bottom: 20pt !important; 
            margin-bottom: 30pt !important; 
          }

          /* Odstránenie tmavých boxov - nahradenie tenkou čiarou */
          .client-box, .car-box, .totals-box, .items-table thead tr { 
            background: #fff !important; 
            border: 1pt solid #000 !important; 
            border-radius: 0 !important;
            padding: 10pt !important;
            box-shadow: none !important;
          }

          /* Tabuľka - čisté linky */
          table { width: 100% !important; border-collapse: collapse !important; }
          th { border-bottom: 2pt solid #000 !important; background: #f0f0f0 !important; color: #000 !important; }
          td { border-bottom: 0.5pt solid #eee !important; padding: 8pt !important; }
          
          /* ŠPZ bez čierneho pozadia */
          .plate-val { 
            background: #fff !important; 
            color: #000 !important; 
            border: 2pt solid #000 !important; 
            padding: 2pt 10pt !important;
            display: inline-block !important;
          }

          /* Sumár - bez čiernej, len s čiarou */
          .totals-box { 
            border: 2pt solid #000 !important; 
            background: #fff !important;
          }
          
          .border-zinc-800, .border-b, .border-t { border-color: #000 !important; }
        }
      `}</style>
    </div>
  );
}