'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { buildInvoicePDF } from '@/app/lib/invoicePdf';


export default function FakturyDashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('official');
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [myCompany, setMyCompany] = useState({});

  useEffect(() => {
    fetchInvoices();
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    const { data } = await supabase.from('business_settings').select('*');
    if (data) {
      setMyCompany({
        name: data.find(s => s.id === 'company_name')?.value || 'AutoAlma Servis',
        address: data.find(s => s.id === 'company_address')?.value || '',
        city: data.find(s => s.id === 'company_city')?.value || '',
        zip: data.find(s => s.id === 'company_zip')?.value || '',
        ico: data.find(s => s.id === 'company_ico')?.value || '',
        dic: data.find(s => s.id === 'company_dic')?.value || '',
        bank: data.find(s => s.id === 'company_bank')?.value || '',
        phone: data.find(s => s.id === 'company_phone')?.value || '',
        email: data.find(s => s.id === 'company_email')?.value || '',
      });
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setInvoices(data || []);
    setLoading(false);
  };

  const togglePaid = async (invId, currentPaid) => {
    const newVal = !currentPaid;
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, is_paid: newVal } : i));
    await supabase.from('invoices').update({ is_paid: newVal }).eq('id', invId);
  };

  const filteredInvoices = invoices.filter(inv => {
    const isRightTab = activeTab === 'official' ? inv.is_official === true : inv.is_official === false;
    const s = searchTerm.toLowerCase();
    return isRightTab && (
      inv.invoice_number.toLowerCase().includes(s) ||
      inv.customer_name.toLowerCase().includes(s) ||
      (inv.car_details?.plate || inv.car_details?.plate_number || '').toLowerCase().includes(s)
    );
  });

  const totalOfficial = invoices.filter(i => i.is_official).reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalDrafts = invoices.filter(i => !i.is_official).reduce((acc, curr) => acc + curr.total_amount, 0);

  const exportPDFs = async () => {
    if (filteredInvoices.length === 0) return;
    setExporting(true);
    try {
      const [{ jsPDF }, { default: JSZip }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jszip'),
        import('jspdf-autotable'),
      ]);

      const zip = new JSZip();
      for (const inv of filteredInvoices) {
        const doc = buildInvoicePDF(jsPDF, autoTable, inv, myCompany);
        zip.file(`${inv.invoice_number}.pdf`, doc.output('arraybuffer'));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab === 'official' ? 'faktury' : 'odlozene'}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Chyba pri exporte PDF: ' + err.message);
    }
    setExporting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-black uppercase tracking-[0.3em] animate-pulse">
      Načítavam financie...
    </div>
  );

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white font-bold">

      {/* HEADER S INFO KARTAMI */}
      <header className="mb-8 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
            Finančný <span className="text-red-600 text-4xl">Prehľad</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Správa dokladov a servisných záznamov</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col items-end min-w-[160px] shadow-xl">
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Spolu Faktúry</span>
            <span className="text-2xl font-black text-green-500 tracking-tighter">{totalOfficial.toFixed(2)} €</span>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col items-end min-w-[160px] shadow-xl">
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Spolu Odložené</span>
            <span className="text-2xl font-black text-zinc-300 tracking-tighter">{totalDrafts.toFixed(2)} €</span>
          </div>
        </div>
      </header>

      {/* HORNÉ MENU (TABS), VYHĽADÁVANIE A EXPORT */}
      <div className="flex flex-col md:flex-row gap-6 mb-10 items-center justify-between bg-zinc-900/30 p-4 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
        <div className="flex bg-black p-1.5 rounded-[1.8rem] border border-zinc-800 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('official')}
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${activeTab === 'official' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white'}`}
          >
            📄 Faktúry
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${activeTab === 'draft' ? 'bg-zinc-800 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white'}`}
          >
            📂 Odložené
          </button>
        </div>

        <div className="relative w-full md:w-96 group">
          <input
            type="text"
            placeholder="Hľadať v dokladoch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-4 px-6 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner italic uppercase text-[10px] tracking-widest transition-all"
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
        </div>

        <button
          onClick={exportPDFs}
          disabled={exporting || filteredInvoices.length === 0}
          className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 hover:border-red-600 hover:bg-red-600/10 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap shadow-lg"
        >
          {exporting ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
              Generujem...
            </>
          ) : (
            <>
              ⬇ Export PDF ({filteredInvoices.length})
            </>
          )}
        </button>
      </div>

      {/* ZOZNAM NA CELÝ RIADOK */}
      <div className="space-y-4">
        {filteredInvoices.length > 0 ? (
          filteredInvoices.map((inv) => (
            <Link href={`/faktury/${inv.id}`} key={inv.id} className="group block">
              <div className={`bg-zinc-900/20 border-2 ${inv.is_paid ? 'border-green-500 hover:border-green-400' : 'border-red-600/40 hover:border-red-600'} p-6 md:px-10 rounded-[2.5rem] transition-all shadow-xl hover:shadow-red-900/5 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6`}>

                {/* IDENTIFIKÁCIA */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="flex flex-col min-w-[120px]">
                    <span className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1 italic">
                      {inv.is_official ? 'Doklad' : 'Servis'}
                    </span>
                    <span className="bg-white text-black px-3 py-1 rounded-lg font-black text-sm tracking-widest uppercase text-center">
                      {inv.invoice_number}
                    </span>
                  </div>
                  <div className="h-10 w-[1px] bg-zinc-800 hidden md:block"></div>
                  <div className="text-left">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-1">Dátum vystavenia</p>
                    <p className="text-sm font-black">{new Date(inv.created_at).toLocaleDateString('sk-SK')}</p>
                  </div>
                </div>

                {/* KLIENT A AUTO */}
                <div className="flex-grow text-center md:text-left">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter group-hover:text-red-500 transition-colors leading-none mb-2">
                    {inv.customer_name}
                  </h3>
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <span className="text-[10px] text-zinc-500 font-black uppercase italic">{inv.car_details?.brand || inv.car_details?.brand_model}</span>
                    <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                    <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-widest">{inv.car_details?.plate || inv.car_details?.plate_number}</span>
                  </div>
                </div>

                {/* SUMA A TLAČIDLO */}
                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mb-1">Suma s DPH</p>
                    <p className="text-3xl font-black italic tracking-tighter leading-none text-white">
                      {inv.total_amount.toFixed(2)} <span className="text-red-600 text-sm font-bold">€</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePaid(inv.id, inv.is_paid); }}
                    className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all ${inv.is_paid ? 'border-green-500 text-green-400 bg-green-500/10 hover:bg-green-500/20' : 'border-zinc-600 text-zinc-500 hover:border-green-500 hover:text-green-400'}`}
                  >
                    {inv.is_paid ? '✓ Uhradená' : 'Neuhradená'}
                  </button>
                  <div className="bg-zinc-800 p-4 rounded-2xl group-hover:bg-red-600 transition-all shadow-lg">
                    <span className="text-white text-sm">➔</span>
                  </div>
                </div>

                {/* DEKORÁCIA POZADIA */}
                <div className="absolute left-1/2 -translate-x-1/2 text-white/[0.01] text-[100px] font-black pointer-events-none uppercase hidden md:block">
                  {inv.is_official ? 'INVOICE' : 'ARCHIVE'}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="h-[40vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40 uppercase font-black tracking-[0.5em] text-sm text-center px-10 italic">
            Žiadne záznamy na zobrazenie
          </div>
        )}
      </div>
    </div>
  );
}
