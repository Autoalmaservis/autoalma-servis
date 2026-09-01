'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

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
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Email modal
  const [emailModal, setEmailModal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [accountantEmail, setAccountantEmail] = useState('');
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [sendToAccountant, setSendToAccountant] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfReady, setPdfReady] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [emailTone, setEmailTone] = useState('friendly');
  const [emailBody, setEmailBody] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const [peppolDownloading, setPeppolDownloading] = useState(false);
  const [peppolMsg, setPeppolMsg] = useState('');

  // Zmena dátumu vystavenia / splatnosti
  const [dateModal, setDateModal] = useState(false);
  const [newIssueDate, setNewIssueDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [dateSaving, setDateSaving] = useState(false);

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
      const accEmail = data.find(s => s.id === 'accountant_email')?.value || '';
      setAccountantEmail(accEmail);
      if (accEmail) setSendToAccountant(true);
    }
  };

  const fetchInvoice = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        job_tickets (
          complaints,
          customer_email
        )
      `)
      .eq('id', id)
      .single();

    if (!error) {
      setInv(data);
      const email = data?.job_tickets?.customer_email || '';
      setCustomerEmail(email);
      setSendToCustomer(!!email);
    }
    setLoading(false);
  };

  const handleReopenJob = async () => {
    if (!confirm("Pozor! Vymazaním faktúry sa pôvodná zákazka opäť otvorí v stave 'Dokončené'. Chcete pokračovať?")) return;
    try {
      setLoading(true);
      if (inv.job_id) {
        const { error: jobErr } = await supabase.from('job_tickets').update({ status: 'Dokončené' }).eq('id', inv.job_id);
        if (jobErr) throw new Error('Nepodarilo sa otvoriť zákazku: ' + jobErr.message);
        await supabase.from('kasa_entries').delete().eq('job_id', inv.job_id);
      }
      await supabase.from('invoices').delete().eq('id', id);
      // Vrátiť poradové číslo späť do počítadla, ak išlo o posledné vydané číslo
      // (inak v číslovaní faktúr vznikne diera)
      try { await supabase.rpc('release_invoice_number', { inv_number: inv.invoice_number }); } catch (_) {}
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
    const fetchQr = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      fetch('/api/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          iban: myCompany.bank,
          amount: inv.total_amount,
          variableSymbol: String(inv.invoice_number).replace(/\D/g, ''),
          beneficiaryName: myCompany.name,
          paymentNote: `Oprava vozidla ${inv.car_details?.plate || ''}`.trim(),
        }),
      })
        .then(r => r.json())
        .then(d => { if (d.qrDataUrl) setQrDataUrl(d.qrDataUrl); else console.error('QR chyba:', d.error); })
        .catch(e => console.error('QR fetch chyba:', e));
    };
    fetchQr();
  }, [inv, myCompany.bank]);

  const EMAIL_TEMPLATES = [
    { key: 'formal',       emoji: '🤝', name: 'Formálny',      preview: 'V prílohe Vám zasielame faktúru za vykonaný servis vozidla…' },
    { key: 'friendly',     emoji: '😊', name: 'Priateľský',    preview: 'Ahoj! Posielame faktúru za servis. Ak máš otázky, ozvi sa…' },
    { key: 'witty_exit',   emoji: '🚗', name: 'Spokojné auto', preview: 'Vaše auto odišlo z dielne v lepšom stave, ako prišlo…' },
    { key: 'witty_tech',   emoji: '🔧', name: 'Odborný vtip',  preview: 'Absolvovalo preventívnu prevenciu pred tým, čo by sa stalo…' },
    { key: 'witty_phil',   emoji: '🧠', name: 'Filozofický',   preview: 'Auto je predĺžením osobnosti majiteľa. Vaše nám toho prezradilo…' },
    { key: 'witty_buddy',  emoji: '👊', name: 'Kamarátsky',    preview: 'Čau! Tvoje auto sme dali dokopy — trvalo to trochu, ale…' },
    { key: 'witty_drama',  emoji: '🎭', name: 'Dramatický',    preview: 'Bolo to tesné, ale vaše vozidlo to zvládlo. Naši mechanici…' },
    { key: 'witty_detective', emoji: '🕵️', name: 'Detektívsky', preview: 'Prípad č. ${invoiceNum} — uzavretý. Páchateľ: opotrebovaný…' },
  ];

  const buildEmailBody = (tone, invoiceData, company) => {
    const name = invoiceData?.company_details?.company_name || invoiceData?.customer_name || 'zákazník';
    const plate = invoiceData?.car_details?.plate || invoiceData?.car_details?.plate_number || '';
    const brand = invoiceData?.car_details?.brand || invoiceData?.car_details?.brand_model || '';
    const invoiceNum = invoiceData?.invoice_number || '';
    const total = Number(invoiceData?.total_amount || 0).toFixed(2);
    const phone = company?.phone || '';
    const email = company?.email || '';
    const companyName = company?.name || 'AutoAlma Servis';
    const carStr = [plate, brand].filter(Boolean).join(' — ');

    if (tone === 'formal') return `Dobrý deň, ${name},

v prílohe Vám zasielame faktúru č. ${invoiceNum} za vykonaný servis vozidla ${carStr}.

Celková suma: ${total} €

V prípade akýchkoľvek otázok nás neváhajte kontaktovať na ${phone}${email ? ' alebo ' + email : ''}.

S úctou,
tím ${companyName}`;

    if (tone === 'friendly') return `Ahoj ${name},

posielame ti faktúru č. ${invoiceNum} za servis ${carStr}. Celková suma je ${total} €.

Faktúra je priložená k tomuto e-mailu. Ak máš akékoľvek otázky, neváhaj nám zavolať alebo napísať — vždy radi pomôžeme.

Ďakujeme, že si nás navštívil, a tešíme sa na ďalšie stretnutie!

Tím ${companyName}`;

    if (tone === 'witty_exit') return `Dobrý deň, ${name},

vaše ${carStr} odišlo z našej dielne spokojné — a v lepšom stave, ako prišlo. Čo je presne ten výsledok, za ktorý platíte.

Faktúra č. ${invoiceNum} na sumu ${total} € je priložená. Áno, je to skutočná suma. Nie, nejde o preklep.

Dúfame, že ${brand || 'vaše auto'} bude odmietať kaziť sa aspoň do budúceho servisu — ale keď aj predsa, viete, kde nás nájdete.

S motoristickým pozdravom,
${companyName}`;

    if (tone === 'witty_tech') return `Dobrý deň, ${name},

vaše ${carStr} absolvovalo u nás preventívnu prevenciu pred tým, čo by sa mohlo stať, keby ste na servis nechali ísť dlhšie. Zjednodušene: prišlo, videlo, bolo opravené.

Faktúra č. ${invoiceNum} na sumu ${total} € je v prílohe. Áno, každé euro bolo vynaložené zmysluplne — máme na to doklady (práve čítate jeden z nich).

S odborným pozdravom,
${companyName}`;

    if (tone === 'witty_phil') return `Dobrý deň, ${name},

hovorí sa, že auto je predĺžením osobnosti svojho majiteľa. Vaše ${carStr} nám teda o Vás prezradilo dosť — ale nebojte, zachovávame profesionálnu diskrétnosť.

Faktúra č. ${invoiceNum} na sumu ${total} € je v prílohe. Berte ju ako investíciu do harmónie medzi Vami a Vašim vozidlom.

S filozofickým pozdravom,
${companyName}`;

    if (tone === 'witty_buddy') return `Čau ${name}!

tvoje ${carStr} sme dali dokopy — trvalo to trochu, ale výsledok stojí za to. Aspoň sa ti to nebude kaziť cestou na dovolenku (sľubujeme, robili sme, čo sme mohli).

Faktúrka č. ${invoiceNum} je v prílohe, ${total} €. Za tú cenu sme to naozaj poriadne skontrolovali. Naozaj.

Maj sa,
${companyName}`;

    if (tone === 'witty_drama') return `Vážený ${name},

bolo to tesné, ale vaše ${carStr} to zvládlo. Naši mechanici pracovali s chirurgickou presnosťou a zodpovedajúcou hudbou na pozadí. Výsledok: vozidlo žije a je pripravené na ďalšie kilometre.

Faktúra č. ${invoiceNum} na sumu ${total} € je priložená. Dramatický príbeh má — ako správne — šťastný koniec.

S úctou a adrenalínom,
${companyName}`;

    if (tone === 'witty_detective') return `Správa z vyšetrovania — prípad č. ${invoiceNum}

Vážený ${name},

po dôkladnom preskúmaní vozidla ${carStr} môžem s istotou vyhlásiť: prípad je uzavretý. Páchateľ bol identifikovaný, neutralizovaný a vozidlo je opäť v prevádzkyschopnom stave.

Dôkazový materiál — faktúra na sumu ${total} € — je priložený k tomuto hláseniu. Odporúčam uchovať pre prípad ďalšieho vyšetrovania.

Inspektor ${companyName}
(Oddelenie automobilovej kriminalistiky)`;

    return buildEmailBody('friendly', invoiceData, company);
  };

  const handleGenerateVariant = async () => {
    setAiGenerating(true);
    try {
      const name = inv?.company_details?.company_name || inv?.customer_name || '';
      const plate = inv?.car_details?.plate || inv?.car_details?.plate_number || '';
      const brand = inv?.car_details?.brand || inv?.car_details?.brand_model || '';
      const carStr = [plate, brand].filter(Boolean).join(' — ');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-email-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          tone: emailTone,
          name, carStr,
          invoiceNum: inv?.invoice_number,
          total: Number(inv?.total_amount || 0).toFixed(2),
          companyName: myCompany.name,
          previousText: emailBody,
        }),
      });
      const data = await res.json();
      if (data.text) setEmailBody(data.text);
      else setEmailStatus('Chyba pri generovaní: ' + (data.error || ''));
    } catch (e) {
      setEmailStatus('Chyba: ' + e.message);
    }
    setAiGenerating(false);
  };

  const handleDownloadPeppol = async () => {
    if (!inv.company_details?.dic) {
      alert('Zákazník nemá zadané DIČ.\n\neFaktúra (Peppol) sa zasiela len firmám s DIČ. Pre fyzické osoby nie je povinná.');
      return;
    }
    setPeppolDownloading(true);
    setPeppolMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/export-peppol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ invoiceId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPeppolMsg('Chyba: ' + (err.error || 'neznáma chyba'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eFaktura_${inv.invoice_number}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      setPeppolMsg('✓ XML stiahnuté — nahraj ho na portál Finančnej správy');
    } catch (e) {
      setPeppolMsg('Chyba: ' + e.message);
    }
    setPeppolDownloading(false);
  };

  const handlePrint = () => {
    const safeName = (inv?.customer_name || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const origTitle = document.title;
    document.title = `Faktura_${safeName}_${inv?.invoice_number || ''}`;
    window.onafterprint = () => { document.title = origTitle; window.onafterprint = null; };
    window.print();
  };

  const handleOpenEmailModal = () => {
    setEmailStatus('');
    setPdfFile(null);
    setPdfReady(null);
    setEmailTone('friendly');
    setEmailBody(buildEmailBody('friendly', inv, myCompany));
    setEmailModal(true);
  };

  const handleModalDownloadPdf = () => {
    handlePrint(); // rovnaká kvalita ako hlavné tlačidlo, modal je no-print → skrytý
  };

  const handleSendEmail = async () => {
    const recipients = [];
    if (sendToCustomer && customerEmail) recipients.push(customerEmail);
    if (sendToAccountant && accountantEmail) recipients.push(accountantEmail);
    if (customEmailInput.trim()) recipients.push(customEmailInput.trim());
    if (!recipients.length) { setEmailStatus('Zadaj aspoň jeden e-mail príjemcu.'); return; }
    if (!pdfFile) { setEmailStatus('Nahraj PDF súbor faktúry.'); return; }

    setEmailSending(true);
    setEmailStatus('Načítavam PDF...');
    try {
      const pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });
      const safeName = (inv?.customer_name || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const pdfFilename = `Faktura_${safeName}_${inv?.invoice_number || ''}.pdf`;

      setEmailStatus('Odosielam...');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ invoiceId: id, recipients, pdfBase64, pdfFilename, emailBody }),
      });
      const result = await res.json();
      if (result.ok) {
        setEmailStatus('✓ E-mail bol odoslaný');
        setTimeout(() => setEmailModal(false), 1500);
      } else {
        setEmailStatus('Chyba: ' + (result.error || 'neznáma chyba'));
      }
    } catch (e) {
      setEmailStatus('Chyba: ' + e.message);
    }
    setEmailSending(false);
  };

  // --- ZMENA DÁTUMU VYSTAVENIA / SPLATNOSTI ---
  const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleOpenDateModal = () => {
    setNewIssueDate(toDateInput(inv.payment_info?.issue_date || inv.created_at));
    setNewDueDate(toDateInput(inv.payment_info?.due_date));
    setDateModal(true);
  };

  const handleSaveDates = async () => {
    if (!newIssueDate) { alert('Zadajte dátum vystavenia.'); return; }
    setDateSaving(true);
    try {
      // zachovať pôvodný čas dňa, meniť len dátum
      const mkIso = (dateStr, ref) => {
        const base = ref ? new Date(ref) : null;
        const valid = base && !isNaN(base.getTime());
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, valid ? base.getHours() : 12, valid ? base.getMinutes() : 0, 0, 0).toISOString();
      };
      const issueIso = mkIso(newIssueDate, inv.payment_info?.issue_date || inv.created_at);
      const dueIso = newDueDate ? mkIso(newDueDate, inv.payment_info?.due_date) : null;

      const payload = {
        created_at: issueIso,
        payment_info: {
          ...(inv.payment_info || {}),
          issue_date: issueIso,
          due_date: dueIso,
        },
      };

      const { data, error } = await supabase.from('invoices').update(payload).eq('id', id).select().single();
      if (error) throw error;
      setInv(prev => ({ ...prev, ...data }));
      setDateModal(false);
    } catch (e) {
      alert('Nepodarilo sa uložiť dátum: ' + e.message);
    }
    setDateSaving(false);
  };

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
          <button onClick={handleOpenDateModal} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-white hover:text-black px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
            📅 Zmeniť dátum
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
            <button onClick={handleOpenEmailModal} className="bg-zinc-800 border border-zinc-700 text-zinc-200 px-6 py-3 rounded-2xl font-black uppercase text-xs hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all shadow-xl tracking-widest flex items-center gap-2">
              📧 Poslať mailom
            </button>
            {inv.is_official && (
              <button onClick={handleDownloadPeppol} disabled={peppolDownloading} title={!inv.company_details?.dic ? 'Dostupné len pre firmy s DIČ' : 'Stiahnuť eFaktúru vo formáte Peppol BIS 3.0 (XML)'}
                className={`px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl flex items-center gap-2 ${
                  !inv.company_details?.dic
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-800 border border-purple-800/60 text-purple-300 hover:bg-purple-700 hover:border-purple-500 hover:text-white'
                }`}>
                {peppolDownloading ? '⏳ Generujem...' : '📡 eFaktúra XML'}
              </button>
            )}
            <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest flex items-center gap-2 font-bold">
              🖨️ Tlačiť / Stiahnuť PDF
            </button>
          </div>
          {peppolMsg && (
            <p className={`text-[9px] font-black uppercase tracking-widest ${peppolMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {peppolMsg}
            </p>
          )}
        </div>
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
                <p style={{ margin: '0', color: '#000', fontSize: '9pt' }}>Dátum vystavenia: <strong>{new Date(inv.payment_info?.issue_date || inv.created_at).toLocaleDateString('sk-SK')}</strong></p>
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
            <div className="text-[10px] text-zinc-400 uppercase text-right space-y-0.5">
              <p>Vystavené: <span className="text-white font-black">{new Date(inv.payment_info?.issue_date || inv.created_at).toLocaleDateString('sk-SK')}</span></p>
              {inv.payment_info?.due_date && (
                <p>Splatnosť: <span className="text-white font-black">{new Date(inv.payment_info.due_date).toLocaleDateString('sk-SK')}</span></p>
              )}
            </div>
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
                    {myCompany.bank && inv.is_official && qrDataUrl && <img src={qrDataUrl} alt="QR platba" style={{ width: '110pt', height: '110pt' }} />}
                    <div style={{ fontSize: '9pt', color: '#000', lineHeight: '1.2' }}>
                      <p style={{ color: '#dc2626', fontWeight: '900', margin: '0' }}>PLATOBNÉ ÚDAJE:</p>
                      <p style={{ margin: '0' }}>IBAN: <strong>{myCompany.bank}</strong></p>
                      <p style={{ margin: '0' }}>VS: <strong>{String(inv.invoice_number).replace(/\D/g, '')}</strong></p>
                      <p style={{ marginTop: '3pt', margin: '0' }}>Splatnosť: <strong>{inv.payment_info?.due_date ? new Date(inv.payment_info.due_date).toLocaleDateString('sk-SK') : new Date(new Date(inv.payment_info?.issue_date || inv.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('sk-SK')}</strong></p>
                    </div>
                  </div>
                </td>
                <td width="40%" valign="top">
                  <div style={{ border: '1.5pt solid #000', padding: '8pt', background: '#f9f9f9' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        {inv.payment_info?.discount_amount > 0 ? (() => {
                          const discTotal = Number(inv.payment_info.discount_amount);
                          const discBase = discTotal / 1.23;
                          const discVat  = discTotal - discBase;
                          const origBase = Number(inv.payment_info.items_subtotal || 0);
                          const origVat  = origBase * 0.23;
                          const origTotal = origBase + origVat;
                          const discLabel = inv.payment_info.discount_type === 'pct'
                            ? `${inv.payment_info.discount_value}%`
                            : `${discTotal.toFixed(2)} €`;
                          return (
                            <>
                              <tr style={{ fontSize: '9pt', color: '#000' }}>
                                <td style={{ paddingBottom: '2pt' }}>Medzisúčet (základ):</td>
                                <td align="right">{origBase.toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '9pt', color: '#000' }}>
                                <td style={{ paddingBottom: '2pt' }}>DPH 23%:</td>
                                <td align="right">{origVat.toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #ccc', borderTop: '1pt solid #ccc' }}>
                                <td style={{ padding: '3pt 0' }}>Celkom pred zľavou:</td>
                                <td align="right" style={{ padding: '3pt 0' }}>{origTotal.toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '8.5pt', color: '#dc2626' }}>
                                <td style={{ paddingTop: '3pt', paddingBottom: '1pt' }}>Zľava {discLabel} — základ:</td>
                                <td align="right" style={{ paddingTop: '3pt' }}>-{discBase.toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '8.5pt', color: '#dc2626', borderBottom: '1pt solid #ccc' }}>
                                <td style={{ paddingBottom: '3pt' }}>Zľava {discLabel} — DPH 23%:</td>
                                <td align="right" style={{ paddingBottom: '3pt' }}>-{discVat.toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '9pt', color: '#000' }}>
                                <td style={{ paddingTop: '4pt', paddingBottom: '2pt' }}>Základ dane:</td>
                                <td align="right" style={{ paddingTop: '4pt' }}>{Number(inv.subtotal_amount || 0).toFixed(2)} €</td>
                              </tr>
                              <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #000' }}>
                                <td style={{ paddingBottom: '2pt' }}>DPH (23%):</td>
                                <td align="right">{Number(inv.tax_amount || 0).toFixed(2)} €</td>
                              </tr>
                            </>
                          );
                        })() : (
                          <>
                            <tr style={{ fontSize: '9pt', color: '#000' }}>
                              <td style={{ paddingBottom: '2pt' }}>Základ dane:</td>
                              <td align="right">{Number(inv.subtotal_amount || 0).toFixed(2)} €</td>
                            </tr>
                            <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #000' }}>
                              <td style={{ paddingBottom: '2pt' }}>DPH ({inv.payment_info?.no_vat ? '0' : '23'}%):</td>
                              <td align="right">{Number(inv.tax_amount || 0).toFixed(2)} €</td>
                            </tr>
                          </>
                        )}
                        <tr style={{ color: '#000' }}>
                          <td style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '11pt', color: '#dc2626' }}>CELKOM:</td>
                          <td align="right" style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '18pt' }}>{Number(inv.total_amount || 0).toFixed(2)} €</td>
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
             {myCompany.bank && inv.is_official && (
               <div className="flex flex-col items-center gap-2">
                 {qrDataUrl
                   ? <div className="bg-white p-4 rounded-2xl shadow-2xl"><img src={qrDataUrl} alt="QR platba" width={200} height={200} /></div>
                   : <div className="bg-zinc-900 border border-red-600 rounded-2xl p-4 text-red-500 text-[10px] font-black uppercase">QR sa negeneruje</div>
                 }
               </div>
             )}
             <div className="text-[10px] text-zinc-600 uppercase tracking-widest max-w-xs italic font-bold">
                <p className="text-zinc-400">Platobné informácie:</p>
                <p className="text-white font-black mt-1 uppercase text-sm">{myCompany.bank || 'Platba v hotovosti'}</p>
                <p className="text-zinc-500 mt-1">Variabilný symbol: {String(inv.invoice_number).replace(/\D/g, '')}</p>
             </div>
          </div>
          <div className="bg-black p-10 rounded-[2.5rem] border border-zinc-800 min-w-[340px] shadow-2xl">
            {inv.payment_info?.discount_amount > 0 ? (() => {
              const discTotal = Number(inv.payment_info.discount_amount);
              const discBase  = discTotal / 1.23;
              const discVat   = discTotal - discBase;
              const origBase  = Number(inv.payment_info.items_subtotal || 0);
              const origVat   = origBase * 0.23;
              const discLabel = inv.payment_info.discount_type === 'pct'
                ? `${inv.payment_info.discount_value}%`
                : `${discTotal.toFixed(2)} €`;
              return (
                <div className="mb-4 space-y-1 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-4">
                  <div className="flex justify-between text-zinc-500">
                    <span>Medzisúčet (základ)</span>
                    <span>{origBase.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>DPH 23%</span>
                    <span>{origVat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 border-t border-zinc-800 pt-1">
                    <span>Celkom pred zľavou</span>
                    <span>{(origBase + origVat).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-red-500 border-t border-zinc-800 pt-1">
                    <span>Zľava {discLabel} — základ</span>
                    <span>-{discBase.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Zľava {discLabel} — DPH 23%</span>
                    <span>-{discVat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 border-t border-zinc-800 pt-1">
                    <span>Základ dane</span>
                    <span>{Number(inv.subtotal_amount || 0).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>DPH 23%</span>
                    <span>{Number(inv.tax_amount || 0).toFixed(2)} €</span>
                  </div>
                </div>
              );
            })() : null}
            <div className="flex justify-between items-end pt-2">
              <span className="text-red-600 font-black uppercase text-2xl">Celkom:</span>
              <span className="text-5xl font-black text-white">{Number(inv.total_amount || 0).toFixed(2)} <span className="text-red-600 text-lg">€</span></span>
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

      {/* ===== EMAIL MODAL ===== */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4 no-print"
          onClick={() => setEmailModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 max-w-xl w-full shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* HLAVIČKA */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500 mb-0.5">Odoslať faktúru</p>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">{inv.invoice_number} <span className="text-zinc-500 text-sm font-bold normal-case not-italic">— {inv.customer_name}</span></h2>
              </div>
              <button onClick={() => setEmailModal(false)} className="text-zinc-600 hover:text-white text-lg font-black transition-colors ml-4 shrink-0">✕</button>
            </div>

            {/* PRÍJEMCOVIA */}
            <div className="mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Komu</p>
              <div className="space-y-1.5">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${sendToCustomer && customerEmail ? 'border-blue-500/60 bg-blue-600/8' : 'border-zinc-800 bg-zinc-950'} ${!customerEmail ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={sendToCustomer} disabled={!customerEmail} onChange={e => setSendToCustomer(e.target.checked)} className="w-4 h-4 accent-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Zákazník</span>
                    {customerEmail ? <span className="text-white text-[11px] font-bold truncate">{customerEmail}</span> : <span className="text-zinc-600 text-[10px] italic">nezadaný v zákazke</span>}
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${sendToAccountant && accountantEmail ? 'border-amber-500/60 bg-amber-600/8' : 'border-zinc-800 bg-zinc-950'} ${!accountantEmail ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={sendToAccountant} disabled={!accountantEmail} onChange={e => setSendToAccountant(e.target.checked)} className="w-4 h-4 accent-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Účtovníčka</span>
                    {accountantEmail ? <span className="text-white text-[11px] font-bold truncate">{accountantEmail}</span> : <span className="text-zinc-600 text-[10px] italic">nastaviť v Nastaveniach</span>}
                  </div>
                </label>
                <input type="email" value={customEmailInput} onChange={e => setCustomEmailInput(e.target.value)}
                  placeholder="+ iná adresa (voliteľné)"
                  className="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-zinc-600 p-3 rounded-xl text-white font-bold outline-none text-[11px] transition-all placeholder:text-zinc-600" />
              </div>
            </div>

            {/* PDF PRÍLOHA */}
            <div className="mb-4 p-3 bg-zinc-950 border-2 border-zinc-800 rounded-xl flex items-center gap-3 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Príloha</span>
              <button onClick={handleModalDownloadPdf}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 transition-all">
                ⬇ Stiahnuť PDF
              </button>
              <span className="text-zinc-700 text-[10px]">→</span>
              <label className="cursor-pointer flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${pdfFile ? 'bg-green-600/20 border-green-600 text-green-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {pdfFile ? '✓ ' + pdfFile.name.substring(0, 20) : '📎 Nahrať PDF'}
                </span>
                <input type="file" accept="application/pdf,.pdf" onChange={e => { setPdfFile(e.target.files[0] || null); setPdfReady(null); }} className="hidden" />
              </label>
              {!pdfFile && <span className="text-[9px] text-zinc-600 italic">najprv stiahnuť → uložiť → nahrať</span>}
            </div>

            {/* ŠTÝL MAILU */}
            <div className="mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Štýl</p>
              <div className="flex flex-wrap gap-1.5">
                {EMAIL_TEMPLATES.map(t => (
                  <button key={t.key}
                    onClick={() => { setEmailTone(t.key); setEmailBody(buildEmailBody(t.key, inv, myCompany)); }}
                    title={t.preview}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all ${emailTone === t.key ? 'border-blue-500 bg-blue-600/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600'}`}>
                    {t.emoji} {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* TEXT MAILU + VYMYSLI NOVE */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Text e-mailu <span className="text-zinc-600 normal-case font-bold tracking-normal">(môžeš upraviť)</span></p>
                <button onClick={handleGenerateVariant} disabled={aiGenerating}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-purple-700 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5">
                  {aiGenerating ? '⏳' : '🎲'} {aiGenerating ? 'Generujem...' : 'Vymyslieť nové'}
                </button>
              </div>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={8}
                className="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-blue-500 p-3 rounded-2xl text-zinc-300 font-mono text-xs outline-none resize-none leading-relaxed transition-all"
              />
            </div>

            {/* PÄTA */}
            {emailStatus && (
              <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${emailStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {emailStatus}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={handleSendEmail}
                disabled={emailSending || (!sendToCustomer && !sendToAccountant && !customEmailInput.trim())}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                {emailSending ? '📤 Odosielam...' : '📧 Odoslať faktúru'}
              </button>
              <button onClick={() => setEmailModal(false)}
                className="px-5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                Zrušiť
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===== MODAL: ZMENA DÁTUMU VYSTAVENIA ===== */}
      {dateModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4 no-print"
          onClick={() => setDateModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-600 mb-0.5">Zmeniť dátum</p>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">{inv.invoice_number}</h2>
              </div>
              <button onClick={() => setDateModal(false)} className="text-zinc-600 hover:text-white text-lg font-black transition-colors ml-4 shrink-0">✕</button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Dátum vystavenia</p>
                <input type="date" value={newIssueDate} onChange={e => setNewIssueDate(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-red-600 rounded-2xl px-4 py-3 text-white font-black outline-none transition-all" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Dátum splatnosti</p>
                <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-red-600 rounded-2xl px-4 py-3 text-white font-black outline-none transition-all" />
                <div className="flex gap-2 mt-2">
                  {[14, 30].map(dni => (
                    <button key={dni} type="button"
                      onClick={() => {
                        if (!newIssueDate) return;
                        const [y, m, d] = newIssueDate.split('-').map(Number);
                        const dt = new Date(y, m - 1, d + dni);
                        setNewDueDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                      +{dni} dní
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-4 leading-relaxed">
              Dátum sa prejaví na doklade, v zozname faktúr, v štatistikách aj v eFaktúre (XML).
            </p>

            <div className="flex gap-3">
              <button onClick={handleSaveDates} disabled={dateSaving || !newIssueDate}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                {dateSaving ? '⏳ Ukladám...' : '✓ Uložiť dátum'}
              </button>
              <button onClick={() => setDateModal(false)}
                className="px-5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                Zrušiť
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}