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
    swift: '',
    phone: '',
    email: '',
    web: '',
    logo_url: ''
  });
  const [qrValue, setQrValue] = useState('');

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
        address: data.find(s => s.id === 'company_address')?.value || 'Tilgnerova 712/3',
        city: data.find(s => s.id === 'company_city')?.value || 'Bratislava',
        zip: data.find(s => s.id === 'company_zip')?.value || '841 04',
        ico: data.find(s => s.id === 'company_ico')?.value || '',
        dic: data.find(s => s.id === 'company_dic')?.value || '',
        ic_dph: data.find(s => s.id === 'company_ic_dph')?.value || '',
        bank: data.find(s => s.id === 'company_bank')?.value || '',
        swift: data.find(s => s.id === 'company_swift')?.value || '',
        phone: data.find(s => s.id === 'company_phone')?.value || '',
        email: data.find(s => s.id === 'company_email')?.value || '',
        web: data.find(s => s.id === 'company_web')?.value || '',
        logo_url: data.find(s => s.id === 'company_logo')?.value || '',
      });
    }
  };

  const fetchInvoice = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        job_tickets (
          complaints
        )
      `)
      .eq('id', id)
      .single();

    if (!error) setInv(data);
    setLoading(false);
  };

  const handleReopenJob = async () => {
    if (!confirm("Pozor! Vymazaním faktúry sa pôvodná zákazka opäť otvorí v stave 'Dokončené'. Chcete pokračovať?")) return;
    try {
      setLoading(true);
      if (inv.job_id) {
        await supabase.from('job_tickets').update({ status: 'Dokončené' }).eq('id', inv.job_id);
      }
      await supabase.from('invoices').delete().eq('id', id);
      alert("Faktúra bola odstránená. Pôvodná zákazka je opäť dostupná.");
      router.push('/zakazky');
    } catch (err) {
      alert("Chyba pri znovuotváraní: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!inv || !myCompany.bank || !inv.is_official) return;
    fetch('/api/generate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        iban: myCompany.bank,
        amount: inv.total_amount,
        variableSymbol: String(inv.invoice_number).replace(/\D/g, ''),
        beneficiaryName: myCompany.name,
        paymentNote: `Oprava vozidla ${inv.car_details?.plate || ''}`.trim(),
      }),
    })
      .then(r => r.json())
      .then(d => { if (d.qrValue) setQrValue(d.qrValue); })
      .catch(() => {});
  }, [inv, myCompany.bank]);

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
          <button onClick={handleReopenJob} className="bg-zinc-900 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
            🔓 Zrušiť faktúru / Otvoriť zákazku
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

        {/* --- TLAČOVÁ TABUĽKA HLAVIČKY --- */}
        <table className="print-only-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
          <tbody>
            <tr>
              <td width="50%" valign="top">
                <img src={myCompany.logo_url || "/autoalma logo.png"} alt="Logo" style={{ width: '100px', height: 'auto', marginBottom: '10pt' }} />
                <div style={{ fontSize: '8.5pt', color: '#000', lineHeight: '1.2' }}>
                  <p style={{ margin: '0', color: '#666', fontWeight: '900' }}>DODÁVATEĽ:</p>
                  <p style={{ margin: '0' }}><strong>{myCompany.name}</strong></p>
                  <p style={{ margin: '0' }}>{myCompany.address}</p>
                  <p style={{ margin: '0' }}>{myCompany.zip} {myCompany.city}</p>
                  <p style={{ margin: '3pt 0 0 0' }}>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
                  <p style={{ margin: '0' }}>{myCompany.phone} | {myCompany.email}</p>
                  {myCompany.web && <p style={{ margin: '0' }}>{myCompany.web}</p>}
                </div>
              </td>
              <td width="50%" valign="top" align="right">
                <h2 style={{ fontSize: '16pt', color: '#dc2626', margin: '0' }}>{inv.is_official ? 'Faktúra' : 'Servisný záznam'}</h2>
                <p style={{ fontSize: '24pt', color: '#000', fontWeight: '900', margin: '2pt 0' }}>{inv.invoice_number}</p>
                <p style={{ margin: '0', color: '#000', fontSize: '9pt' }}>Dátum: <strong>{new Date(inv.created_at).toLocaleDateString('sk-SK')}</strong></p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* --- TLAČOVÁ TABUĽKA ADRIES --- */}
        <table className="print-only-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
          <tbody>
            <tr>
              <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
                <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>ODBERATEĽ:</p>
                <p style={{ margin: '0', fontSize: '11pt', color: '#000', fontWeight: '900' }}>{inv.company_details?.company_name || inv.customer_name}</p>
                <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{inv.company_details?.address || '---'}</p>
                <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{inv.company_details?.zip} {inv.company_details?.city}</p>
                {(inv.company_details?.ico || inv.company_details?.dic) && (
                  <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>IČO: {inv.company_details?.ico || '---'} | DIČ: {inv.company_details?.dic || '---'}</p>
                )}
                {inv.company_details?.ic_dph && (
                  <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>IČ DPH: {inv.company_details.ic_dph}</p>
                )}
              </td>
              <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
                <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>VOZIDLO:</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ border: '1.5pt solid #000', padding: '1pt 4pt', fontWeight: '900', fontSize: '11pt', color: '#000' }}>{inv.car_details?.plate || '---'}</span>
                  <span style={{ fontSize: '10pt', fontWeight: '900', color: '#000' }}>{inv.car_details?.brand || 'Vozidlo'}</span>
                </div>
                <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>VIN: {inv.car_details?.vin || '---'}</p>
                <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>KM: {inv.car_details?.mileage != null && inv.car_details?.mileage !== '' ? Number(inv.car_details.mileage).toLocaleString('sk-SK') + ' km' : '---'}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* WEB HLAVIČKA */}
        <div className="flex justify-between items-start border-b-4 border-red-600 pb-10 mb-10 relative z-10 font-bold section-header no-print">
          <div className="flex gap-6 items-center">
            <img src={myCompany.logo_url || "/autoalma logo.png"} alt="Logo" className="w-24 h-auto brightness-0 invert" />
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed space-y-1 font-black company-info">
              <p className="text-white font-black italic label-supplier">Dodávateľ:</p>
              <p className="text-white company-name">{myCompany.name}</p>
              <p>{myCompany.address}, {myCompany.zip} {myCompany.city}</p>
              <p>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
              <p className="text-zinc-300">{myCompany.phone} | {myCompany.email}</p>
            </div>
          </div>
          <div className="text-right invoice-meta">
            <h2 className="text-xl font-black uppercase text-red-600 mb-2 italic doc-type">
              {inv.is_official ? 'Faktúra' : 'Servisný záznam'}
            </h2>
            <p className="text-3xl font-black tracking-tighter mb-4 doc-number">{inv.invoice_number}</p>
            <div className="mt-4 text-[10px] text-zinc-400 uppercase text-right">
                <p className="text-blue-500 font-black italic">Odberateľ:</p>
                <p className="text-white font-black">{inv.company_details?.company_name || inv.customer_name}</p>
                {(inv.company_details?.ico || inv.company_details?.dic) && (
                  <p className="text-zinc-400 mt-1">IČO: {inv.company_details?.ico || '---'} | DIČ: {inv.company_details?.dic || '---'}</p>
                )}
                {inv.company_details?.ic_dph && (
                  <p className="text-zinc-400">IČ DPH: {inv.company_details.ic_dph}</p>
                )}
            </div>
          </div>
        </div>

        {/* TABUĽKA POLOŽIEK */}
        <div className="mb-6 table-container">
          <table className="w-full text-left font-bold items-table" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-zinc-800/50 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 print-header-row">
                <th className="p-4 border-b border-black print-p1">Položka / Úkon</th>
                <th className="p-4 text-center border-b border-black print-p1">Množstvo</th>
                <th className="p-4 text-right border-b border-black print-p1">Cena / J</th>
                <th className="p-4 text-right border-b border-black print-p1">Spolu bez DPH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-black uppercase italic text-xs print-body-rows">
              {inv.items_json?.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-all">
                  <td className="p-4 py-6 border-zinc-800 font-bold print-py1">
                    <p className="text-white font-bold item-name print-text-black">{item.name}</p>
                    <span className="text-[8px] text-zinc-600 font-bold tracking-widest item-type no-print">{item.type}</span>
                  </td>
                  <td className="p-4 text-center text-zinc-400 font-mono print-py1 print-text-black">{item.quantity} {item.unit}</td>
                  <td className="p-4 text-right text-zinc-400 font-mono print-py1 print-text-black">{parseFloat(item.unit_price).toFixed(2)} €</td>
                  <td className="p-4 text-right text-white font-black print-py1 print-text-black">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TLAČOVÁ PÄTA — PLATOBNÉ ÚDAJE */}
        <div className="print-footer-area">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10pt' }}>
            <tbody>
              <tr>
                <td width="60%" valign="top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15pt' }}>
                    {myCompany.bank && inv.is_official && qrValue && <QRCodeSVG value={qrValue} size={110} level="M" />}
                    <div style={{ fontSize: '9pt', color: '#000', lineHeight: '1.2' }}>
                      <p style={{ color: '#dc2626', fontWeight: '900', margin: '0' }}>PLATOBNÉ ÚDAJE:</p>
                      <p style={{ margin: '0' }}>IBAN: <strong>{myCompany.bank}</strong></p>
                      <p style={{ margin: '0' }}>VS: <strong>{String(inv.invoice_number).replace(/\D/g, '')}</strong></p>
                      <p style={{ marginTop: '3pt', margin: '0' }}>Splatnosť: <strong>{inv.payment_info?.due_date ? new Date(inv.payment_info.due_date).toLocaleDateString('sk-SK') : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('sk-SK')}</strong></p>
                    </div>
                  </div>
                </td>
                <td width="40%" valign="top">
                  <div style={{ border: '1.5pt solid #000', padding: '8pt', background: '#f9f9f9' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr style={{ fontSize: '9pt', color: '#000' }}>
                          <td style={{ paddingBottom: '2pt' }}>Základ dane:</td>
                          <td align="right">{inv.subtotal_amount.toFixed(2)} €</td>
                        </tr>
                        <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #000' }}>
                          <td style={{ paddingBottom: '2pt' }}>DPH (23%):</td>
                          <td align="right">{inv.tax_amount.toFixed(2)} €</td>
                        </tr>
                        <tr style={{ color: '#000' }}>
                          <td style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '11pt', color: '#dc2626' }}>CELKOM:</td>
                          <td align="right" style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '18pt' }}>{inv.total_amount.toFixed(2)} €</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FLEXOVÝ SPACER — tlačí podpisy na spodok strany */}
        <div className="print-spacer" />

        {/* PODPISY — vždy na spodku poslednej strany */}
        <div className="print-signature-area">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>
                  PODPIS PREVZAL (ZÁKAZNÍK)
                </td>
                <td width="10%"></td>
                <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>
                  PEČIATKA A PODPIS SERVISU
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* WEB SUMÁR */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-12 border-t border-zinc-800 pt-10 no-print">
          <div className="flex gap-8 items-center">
             {myCompany.bank && inv.is_official && qrValue && <div className="bg-white p-3 rounded-2xl shadow-2xl"><QRCodeSVG value={qrValue} size={150} level="M" /></div>}
             <div className="text-[10px] text-zinc-600 uppercase tracking-widest max-w-xs italic font-bold">
                <p className="text-zinc-400">Platobné informácie:</p>
                <p className="text-white font-black mt-1 uppercase text-sm">{myCompany.bank || 'Platba v hotovosti'}</p>
                <p className="text-zinc-500 mt-1">Variabilný symbol: {String(inv.invoice_number).replace(/\D/g, '')}</p>
             </div>
          </div>
          <div className="bg-black p-10 rounded-[2.5rem] border border-zinc-800 min-w-[340px] shadow-2xl">
            <div className="flex justify-between items-end pt-2">
              <span className="text-red-600 font-black uppercase text-2xl">Celkom:</span>
              <span className="text-5xl font-black text-white">{inv.total_amount.toFixed(2)} <span className="text-red-600 text-lg">€</span></span>
            </div>
          </div>
        </div>

        {/* SEKCIJA ZÁVAD */}
        {inv.job_tickets?.complaints && (
          <div className="mt-6 p-6 bg-red-600/5 border border-red-900/20 rounded-[2rem] complaints-box print-complaints">
            <p className="text-[9px] text-red-600 font-black uppercase tracking-[0.3em] mb-3 italic">Upozornenie servisu:</p>
            <p className="text-[11px] text-zinc-400 font-bold whitespace-pre-wrap uppercase leading-relaxed print-text-black">
              {inv.job_tickets.complaints}
            </p>
          </div>
        )}
      </div>

      <p className="text-center mt-8 text-zinc-600 text-[9px] uppercase tracking-[0.4em] font-black italic no-print">
        {myCompany.name} • {myCompany.address}, {myCompany.city} • {myCompany.web}
      </p>

      <style jsx global>{`
        .print-only-table, .print-footer-area, .print-signature-area, .print-spacer { display: none; }

        @media print {
          @page { size: A4; margin: 0 !important; }

          html, body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Remove all non-print elements from flow so they don't push content down */
          .no-print { display: none !important; }
          .min-h-screen { min-height: 0 !important; padding: 0 !important; background: #fff !important; }

          /* Hide everything, then reveal only the printable area */
          body * { visibility: hidden !important; }
          .printable-area { visibility: visible !important; }
          .printable-area * { visibility: visible !important; }
          .printable-area .no-print,
          .printable-area .no-print * { visibility: hidden !important; display: none !important; }

          .print-only-table { display: table !important; visibility: visible !important; }
          .print-footer-area { display: block !important; visibility: visible !important; }
          .print-signature-area { display: block !important; visibility: visible !important; }
          .print-spacer { display: block !important; flex: 1 !important; }

          .printable-area {
            display: flex !important;
            flex-direction: column !important;
            min-height: 26.7cm !important;
            background: #fff !important;
            color: #000 !important;
            border: none !important;
            padding: 0.8cm 1.5cm 1.5cm 1.5cm !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }
          p, span, h1, h2, td, th, div { color: #000 !important; }
          .print-text-black { color: #000 !important; }
          .print-p1 { padding: 3pt !important; }
          .print-py1 { padding-top: 3pt !important; padding-bottom: 3pt !important; }
          .print-body-rows td { border-bottom: 0.5pt solid #eee !important; font-size: 8.5pt !important; }
          .print-header-row th { background: #f4f4f5 !important; border-bottom: 2pt solid #000 !important; font-size: 8pt !important; padding: 4pt !important; }
          .print-complaints { border: 1pt solid #000 !important; padding: 10pt !important; margin-top: 15pt !important; }
        }
      `}</style>
    </div>
  );
}