'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function NastaveniaPage() {
  const router = useRouter();

  // Stav pre prepínanie záložiek
  const [activeTab, setActiveTab] = useState('pracovna_doba');

  // Stavy pre zamestnancov
  const [employees, setEmployees] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('mechanik');
  const [newColor, setNewColor] = useState('#dc2626');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // --- NOVÉ STAVY PRE SMS ŠABLÓNY ---
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [newSmsLabel, setNewSmsLabel] = useState('');
  const [newSmsContent, setNewSmsContent] = useState('');

  // --- STAVY PRE ČASOVÉ NORMY ---
  const [serviceCategories, setServiceCategories] = useState([]);
  const [serviceNorms, setServiceNorms] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newNorm, setNewNorm] = useState({ category_id: '', service_name: '', duration_minutes: 30 });
  const [normFilter, setNormFilter] = useState('all'); // Filter pre zoznam noriem

  // Stavy pre MODÁLNE OKNO (Editácia zamestnanca)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', role: '', color: '', email: '', password: '' });

  // Stavy pre pracovnú dobu
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // STAVY PRE FAKTURAČNÉ ÚDAJE FIRMY (DOPLNENÉ)
  const [billingData, setBillingData] = useState({
    company_name: '',
    address: '',
    city: '',
    zip: '',
    ico: '',
    dic: '',
    ic_dph: '',
    email: '',
    phone: '',
    web_address: '', // DOPLNENÉ
    bank_account: '',
    logo_url: '' // DOPLNENÉ
  });

  // Stavy pre hodinové sadzby
  const [rates, setRates] = useState({
    m1: '0',
    m2: '0',
    e1: '0',
    e2: '0'
  });
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [billingSaveStatus, setBillingSaveStatus] = useState('');
  const [ratesSaveStatus, setRatesSaveStatus] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false); // DOPLNENÉ

  // 1. Načítanie všetkých dát
  const fetchData = async () => {
    setLoading(true);
    // Načítanie zamestnancov
    const { data: empData, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (empData) setEmployees(empData);
    if (error) console.error("Chyba načítania zamestnancov:", error);

    // --- NAČÍTANIE SMS ŠABLÓN ---
    const { data: smsData } = await supabase
      .from('sms_templates')
      .select('*')
      .order('label', { ascending: true });
    if (smsData) setSmsTemplates(smsData);

    // --- NAČÍTANIE NORIEM A KATEGÓRIÍ ---
    const { data: catData } = await supabase.from('service_categories').select('*').order('name', { ascending: true });
    if (catData) setServiceCategories(catData);

    const { data: normData } = await supabase.from('service_norms').select('*, service_categories(name)').order('service_name', { ascending: true });
    if (normData) setServiceNorms(normData);

    // Načítanie nastavení z business_settings
    const { data: setData } = await supabase.from('business_settings').select('*');
    if (setData) {
      // Pracovná doba
      const start = setData.find(s => s.id === 'work_start')?.value;
      const end = setData.find(s => s.id === 'work_end')?.value;
      if (start) setWorkStart(start);
      if (end) setWorkEnd(end);

      // Firemné údaje (DOPLNENÉ)
      setBillingData({
        company_name: setData.find(s => s.id === 'company_name')?.value || '',
        address: setData.find(s => s.id === 'company_address')?.value || '',
        city: setData.find(s => s.id === 'company_city')?.value || '',
        zip: setData.find(s => s.id === 'company_zip')?.value || '',
        ico: setData.find(s => s.id === 'company_ico')?.value || '',
        dic: setData.find(s => s.id === 'company_dic')?.value || '',
        ic_dph: setData.find(s => s.id === 'company_ic_dph')?.value || '',
        email: setData.find(s => s.id === 'company_email')?.value || '',
        phone: setData.find(s => s.id === 'company_phone')?.value || '',
        web_address: setData.find(s => s.id === 'company_web')?.value || '',
        bank_account: setData.find(s => s.id === 'company_bank')?.value || '',
        logo_url: setData.find(s => s.id === 'company_logo')?.value || '',
      });

      // Hodinové sadzby
      setRates({
        m1: setData.find(s => s.id === 'rate_m1')?.value || '0',
        m2: setData.find(s => s.id === 'rate_m2')?.value || '0',
        e1: setData.find(s => s.id === 'rate_e1')?.value || '0',
        e2: setData.find(s => s.id === 'rate_e2')?.value || '0',
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- LOGIKA PRE LOGO UPLOAD (DOPLNENÉ - OPRAVENÁ FUNKCIA NA getPublicUrl) ---
  const handleLogoUpload = async (e) => {
    try {
      setUploadingLogo(true);
      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // 1. Nahrať do Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Získať verejnú URL (Opravené na getPublicUrl)
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // 3. Uložiť URL do business_settings
      const { error: dbError } = await supabase
        .from('business_settings')
        .upsert({ id: 'company_logo', value: publicUrl });

      if (dbError) throw dbError;

      setBillingData(prev => ({ ...prev, logo_url: publicUrl }));
      alert("Logo bolo nahraté!");
    } catch (err) {
      alert("Chyba nahrávania: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // --- LOGIKA PRE ČASOVÉ NORMY ---
  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('service_categories').insert([{ name: newCatName.toUpperCase() }]);
    if (!error) { setNewCatName(''); fetchData(); }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Zmazaním kategórie zmažete aj všetky priradené normy. Pokračovať?')) return;
    await supabase.from('service_categories').delete().eq('id', id);
    fetchData();
  };

  const addServiceNorm = async (e) => {
    e.preventDefault();
    if (!newNorm.service_name || !newNorm.category_id) return;
    const { error } = await supabase.from('service_norms').insert([newNorm]);
    if (!error) { setNewNorm({ ...newNorm, service_name: '' }); fetchData(); }
  };

  const updateServiceNorm = async (id, field, value) => {
    await supabase.from('service_norms').update({ [field]: value }).eq('id', id);
  };

  const deleteNorm = async (id) => {
    if (!confirm('Naozaj vymazať túto normu?')) return;
    await supabase.from('service_norms').delete().eq('id', id);
    fetchData();
  };

  // --- LOGIKA PRE SMS ŠABLÓNY ---
  const addSmsTemplate = async (e) => {
    e.preventDefault();
    if (!newSmsLabel.trim() || !newSmsContent.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('sms_templates').insert([
      { label: newSmsLabel, content: newSmsContent }
    ]);
    if (!error) {
      setNewSmsLabel('');
      setNewSmsContent('');
      fetchData();
    }
    setLoading(false);
  };

  const updateSmsTemplate = async (id, field, value) => {
    await supabase.from('sms_templates').update({ [field]: value }).eq('id', id);
  };

  const deleteSmsTemplate = async (id) => {
    if (confirm('Naozaj vymazať túto šablónu?')) {
      await supabase.from('sms_templates').delete().eq('id', id);
      fetchData();
    }
  };

  // 2. Logika pre pridanie nového zamestnanca
  const addEmployee = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      alert("Meno, Email a Heslo sú povinné!");
      return;
    }
    setLoading(true);
    const emailToSave = newEmail.toLowerCase().trim();

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToSave,
        password: newPassword,
      });
      if (authError) throw new Error("Chyba Auth: " + authError.message);

      const { error: dbError } = await supabase.from('employees').insert([
        { 
          id: authData.user.id, 
          name: newName, 
          role: newRole, 
          color: newColor, 
          email: emailToSave, 
          password: newPassword,
          active: true 
        }
      ]);
      if (dbError) throw dbError;

      setNewName(''); setNewEmail(''); setNewPassword(''); setNewColor('#dc2626');
      alert("Mechanik vytvorený!");
      fetchData();
    } catch (err) {
      alert("Chyba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (emp) => {
    setEditForm({ 
        id: emp.id, 
        name: emp.name, 
        role: emp.role, 
        color: emp.color, 
        email: emp.email || '', 
        password: emp.password || '' 
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('employees')
      .update({ 
        name: editForm.name, 
        role: editForm.role, 
        color: editForm.color,
        email: editForm.email.toLowerCase().trim(),
        password: editForm.password
      })
      .eq('id', editForm.id);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchData();
    } else {
      alert("Chyba pri aktualizácii: " + error.message);
    }
  };

  const updateEmployeeColor = async (id, color) => {
    await supabase.from('employees').update({ color }).eq('id', id);
    fetchData();
  };

  const deleteEmployee = async (id) => {
    if (confirm('Naozaj vymazať tohto člena tímu?')) {
      await supabase.from('employees').delete().eq('id', id);
      fetchData();
    }
  };

  const toggleActive = async (id, currentStatus) => {
    await supabase.from('employees').update({ active: !currentStatus }).eq('id', id);
    fetchData();
  };

  const saveWorkTime = async () => {
    setSaveStatus('Ukladám...');
    const { error } = await supabase.from('business_settings').upsert([
      { id: 'work_start', value: workStart },
      { id: 'work_end', value: workEnd }
    ]);
    if (!error) {
      setSaveStatus('Uložené!');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const saveBillingData = async () => {
    setBillingSaveStatus('Ukladám...');
    const payload = [
      { id: 'company_name', value: billingData.company_name },
      { id: 'company_address', value: billingData.address },
      { id: 'company_city', value: billingData.city },
      { id: 'company_zip', value: billingData.zip },
      { id: 'company_ico', value: billingData.ico },
      { id: 'company_dic', value: billingData.dic },
      { id: 'company_ic_dph', value: billingData.ic_dph },
      { id: 'company_email', value: billingData.email },
      { id: 'company_phone', value: billingData.phone },
      { id: 'company_web', value: billingData.web_address }, 
      { id: 'company_bank', value: billingData.bank_account },
    ];
    const { error } = await supabase.from('business_settings').upsert(payload);
    if (!error) {
      setBillingSaveStatus('Uložené!');
      setTimeout(() => setBillingSaveStatus(''), 3000);
    }
  };

  const saveRates = async () => {
    setRatesSaveStatus('Ukladám...');
    const payload = [
      { id: 'rate_m1', value: rates.m1 },
      { id: 'rate_m2', value: rates.m2 },
      { id: 'rate_e1', value: rates.e1 },
      { id: 'rate_e2', value: rates.e2 },
    ];
    const { error = null } = await supabase.from('business_settings').upsert(payload);
    if (!error) {
      setRatesSaveStatus('Uložené!');
      setTimeout(() => setRatesSaveStatus(''), 3000);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-black min-h-screen text-white relative font-sans select-none font-bold">
      <header className="mb-10 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">Nastavenia <span className="text-red-600">Systému</span></h1>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-2 italic">Konfigurácia dielne a firemných parametrov</p>
        </div>
      </header>

      {/* --- HORNE MENU (ZÁLOŽKY) --- */}
      <div className="flex flex-wrap gap-2 mb-10 bg-zinc-900/30 p-2 rounded-[2rem] border border-zinc-800">
        <button 
          onClick={() => setActiveTab('pracovna_doba')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'pracovna_doba' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          🕒 Pracovná doba
        </button>
        <button 
          onClick={() => setActiveTab('tim')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'tim' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          🔧 Tím a mechanici
        </button>
        <button 
          onClick={() => setActiveTab('sadzby')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'sadzby' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          💰 Hodinové sadzby
        </button>
        <button 
          onClick={() => setActiveTab('normy')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'normy' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          ⏱️ Normy prác
        </button>
        <button 
          onClick={() => setActiveTab('sms_templates')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'sms_templates' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          📱 SMS Šablóny
        </button>
        
        <button 
          onClick={() => router.push('/nastavenia/import-export')}
          className="px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 text-zinc-500 hover:text-white hover:bg-zinc-800"
        >
          Sync & Backup 🔄
        </button>

        <button 
          onClick={() => setActiveTab('fakturacia')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'fakturacia' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          🏢 Fakturačné údaje
        </button>
      </div>

      <div className="max-w-4xl">
        
        {/* --- SEKCIJA 1: PRACOVNÁ DOBA --- */}
        {activeTab === 'pracovna_doba' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div>
                  <label className="block text-[11px] font-black text-zinc-500 uppercase mb-3 tracking-widest ml-1">Otvárame o</label>
                  <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-2xl font-black text-white focus:border-red-600 outline-none transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-500 uppercase mb-3 tracking-widest ml-1">Zatvárame o</label>
                  <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-2xl font-black text-white focus:border-red-600 outline-none transition-all shadow-inner" />
                </div>
              </div>
              <button onClick={saveWorkTime} className="w-full md:w-auto px-12 bg-white text-black hover:bg-red-600 hover:text-white font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-xl">
                {saveStatus || 'Uložiť nastavenia času'}
              </button>
            </div>
          </section>
        )}

        {/* --- SEKCIJA 2: SADZBY --- */}
        {activeTab === 'sadzby' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="bg-black/40 p-6 rounded-2xl border border-zinc-800/50">
                  <label className="block text-[10px] font-black text-red-600 uppercase mb-3 tracking-widest italic font-bold">M1 (Základná mechanická)</label>
                  <input type="number" value={rates.m1} onChange={(e) => setRates({...rates, m1: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xl font-black text-white outline-none focus:border-red-600 transition-all" placeholder="0.00" />
                </div>
                <div className="bg-black/40 p-6 rounded-2xl border border-zinc-800/50">
                  <label className="block text-[10px] font-black text-red-600 uppercase mb-3 tracking-widest italic font-bold">M2 (Prémiová mechanická)</label>
                  <input type="number" value={rates.m2} onChange={(e) => setRates({...rates, m2: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xl font-black text-white outline-none focus:border-red-600 transition-all" placeholder="0.00" />
                </div>
                <div className="bg-black/40 p-6 rounded-2xl border border-zinc-800/50">
                  <label className="block text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest italic font-bold">E1 (Elektrodiagnostika)</label>
                  <input type="number" value={rates.e1} onChange={(e) => setRates({...rates, e1: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xl font-black text-white outline-none focus:border-red-600 transition-all" placeholder="0.00" />
                </div>
                <div className="bg-black/40 p-6 rounded-2xl border border-zinc-800/50">
                  <label className="block text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest italic font-bold">E2 (Špeciálne elektro)</label>
                  <input type="number" value={rates.e2} onChange={(e) => setRates({...rates, e2: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xl font-black text-white outline-none focus:border-red-600 transition-all" placeholder="0.00" />
                </div>
              </div>
              <button onClick={saveRates} className="w-full md:w-auto px-12 bg-red-600 text-white hover:bg-red-700 font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-xl">
                {ratesSaveStatus || 'Uložiť cenník prác'}
              </button>
            </div>
          </section>
        )}

        {/* --- SEKCIJA 3: ČASOVÉ NORMY --- */}
        {activeTab === 'normy' && (
          <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl">
              <h3 className="text-sm font-black uppercase text-red-600 tracking-widest italic mb-6">Správa kategórií prác</h3>
              <form onSubmit={addCategory} className="flex gap-4 mb-8">
                <input required type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Názov (napr. MOTOR)" className="flex-grow bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 uppercase" />
                <button type="submit" className="bg-white text-black font-black px-8 py-4 rounded-xl uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">Pridať +</button>
              </form>
              <div className="flex flex-wrap gap-3">
                {serviceCategories.map(cat => (
                  <div key={cat.id} className="bg-zinc-800 px-4 py-2 rounded-full border border-zinc-700 flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase">{cat.name}</span>
                    <button onClick={() => deleteCategory(cat.id)} className="text-red-500 hover:text-white font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-sm font-black uppercase text-blue-500 tracking-widest italic">Zoznam úkonov</h3>
                <select 
                  value={normFilter} 
                  onChange={(e) => setNormFilter(e.target.value)}
                  className="bg-black border border-zinc-800 p-3 rounded-xl text-zinc-500 text-[10px] font-black uppercase outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">Všetky kategórie</option>
                  {serviceCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              <form onSubmit={addServiceNorm} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 border-b border-zinc-800 pb-10">
                <select required value={newNorm.category_id} onChange={(e) => setNewNorm({ ...newNorm, category_id: e.target.value })} className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none">
                  <option value="">-- Vyberte kategóriu --</option>
                  {serviceCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <input required type="text" value={newNorm.service_name} onChange={(e) => setNewNorm({ ...newNorm, service_name: e.target.value })} placeholder="Názov úkonu..." className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                <div className="flex gap-2">
                  <input required type="number" value={newNorm.duration_minutes} onChange={(e) => setNewNorm({ ...newNorm, duration_minutes: parseInt(e.target.value) })} className="w-24 bg-black border border-zinc-800 p-4 rounded-xl text-center" />
                  <button type="submit" className="flex-grow bg-red-600 text-white font-black py-4 rounded-xl uppercase text-[10px]">Uložiť normu</button>
                </div>
              </form>

              <div className="space-y-4">
                {serviceNorms
                  .filter(n => normFilter === 'all' || n.category_id === normFilter)
                  .map(norm => (
                  <div key={norm.id} className="bg-black/40 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center group hover:border-red-600/30 transition-all">
                    <div className="flex-grow mr-6">
                      <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">{norm.service_categories?.name}</span>
                      <input 
                        className="bg-transparent border-none text-sm font-black uppercase italic text-zinc-200 w-full focus:ring-0 p-0"
                        defaultValue={norm.service_name}
                        onBlur={(e) => updateServiceNorm(norm.id, 'service_name', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-[8px] text-zinc-600 block uppercase mb-1 font-black">Minúty</span>
                        <input 
                          type="number"
                          className="bg-zinc-900 border border-zinc-800 rounded-xl text-lg font-black w-24 text-center focus:border-red-600 outline-none p-1"
                          defaultValue={norm.duration_minutes}
                          onBlur={(e) => updateServiceNorm(norm.id, 'duration_minutes', parseInt(e.target.value))}
                        />
                      </div>
                      <button onClick={() => deleteNorm(norm.id)} className="p-3 bg-zinc-800 rounded-xl hover:bg-red-600 transition-all">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- SEKCIJA 4: SMS ŠABLÓNY --- */}
        {activeTab === 'sms_templates' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl">
              <h3 className="text-sm font-black uppercase text-red-600 tracking-widest italic mb-6 ml-1">Vytvoriť novú SMS šablónu</h3>
              <form onSubmit={addSmsTemplate} className="space-y-4 mb-10">
                <input required type="text" value={newSmsLabel} onChange={(e) => setNewSmsLabel(e.target.value)} placeholder="Názov (napr. Vozidlo hotové)" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600" />
                <textarea required value={newSmsContent} onChange={(e) => setNewSmsContent(e.target.value)} placeholder="Samotný text správy..." className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 h-24 resize-none" />
                <button type="submit" disabled={loading} className="w-full md:w-auto px-10 bg-white text-black font-black py-4 rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all">Pridať šablónu +</button>
              </form>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] ml-1">Existujúce šablóny</h3>
                {smsTemplates.map((sms) => (
                  <div key={sms.id} className="bg-black/40 border border-zinc-800 p-6 rounded-3xl group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-grow mr-4">
                        <input 
                          className="bg-transparent border-none text-red-600 font-black uppercase text-xs w-full focus:ring-0 mb-1"
                          defaultValue={sms.label}
                          onBlur={(e) => updateSmsTemplate(sms.id, 'label', e.target.value)}
                        />
                        <textarea 
                          className="bg-transparent border-none text-zinc-400 text-sm w-full focus:ring-0 resize-none h-16"
                          defaultValue={sms.content}
                          onBlur={(e) => updateSmsTemplate(sms.id, 'content', e.target.value)}
                        />
                      </div>
                      <button onClick={() => deleteSmsTemplate(sms.id)} className="p-3 bg-zinc-800 rounded-xl hover:text-red-500 transition-colors">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- SEKCIJA 5: FAKTURÁCIA --- */}
        {activeTab === 'fakturacia' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl space-y-8">
              
              {/* NAHRÁVANIE LOGA */}
              <div className="bg-black/40 p-6 rounded-2xl border border-zinc-800/50 flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                   {billingData.logo_url ? (
                     <img src={billingData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                   ) : (
                     <span className="text-[9px] text-zinc-600 uppercase text-center p-2">Logo chýba</span>
                   )}
                </div>
                <div className="flex-grow text-center md:text-left">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 italic">Logo firmy</p>
                  <label className="cursor-pointer inline-block bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded-xl text-[10px] transition-all">
                    {uploadingLogo ? 'Nahrávam...' : 'Vybrať a nahrať logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Názov firmy</label>
                  <input type="text" value={billingData.company_name} onChange={(e) => setBillingData({...billingData, company_name: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Firemný telefón</label>
                    <input type="text" value={billingData.phone} onChange={(e) => setBillingData({...billingData, phone: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" placeholder="+421..." />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Firemný e-mail</label>
                    <input type="email" value={billingData.email} onChange={(e) => setBillingData({...billingData, email: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" placeholder="servis@..." />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Webová adresa</label>
                    <input type="text" value={billingData.web_address} onChange={(e) => setBillingData({...billingData, web_address: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" placeholder="www.firma.sk" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">IČO</label>
                    <input type="text" value={billingData.ico} onChange={(e) => setBillingData({...billingData, ico: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">DIČ / IČ DPH</label>
                    <input type="text" value={billingData.dic} onChange={(e) => setBillingData({...billingData, dic: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Sídlo / Adresa</label>
                  <input type="text" value={billingData.address} onChange={(e) => setBillingData({...billingData, address: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={billingData.zip} onChange={(e) => setBillingData({...billingData, zip: e.target.value})} placeholder="PSČ" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                  <input type="text" value={billingData.city} onChange={(e) => setBillingData({...billingData, city: e.target.value})} placeholder="Mesto" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Bankový IBAN (Pre QR platby)</label>
                  <input type="text" value={billingData.bank_account} onChange={(e) => setBillingData({...billingData, bank_account: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-mono" />
                </div>
              </div>
              <button onClick={saveBillingData} className="w-full md:w-auto px-12 bg-red-600 text-white font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-xl mt-4">
                {billingSaveStatus || 'Uložiť firemné údaje'}
              </button>
            </div>
          </section>
        )}

        {/* --- SEKCIJA 6: TÍM --- */}
        {activeTab === 'tim' && (
          <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={addEmployee} className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[3rem] shadow-xl space-y-6">
              <h3 className="text-sm font-black uppercase text-red-600 tracking-widest italic ml-2">Vytvoriť nový prístup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Meno mechanika" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none">
                  <option value="mechanik">Mechanik</option>
                  <option value="diagnostik">Diagnostik</option>
                  <option value="prijem">Prijímací technik</option>
                </select>
                <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="E-mail (prihlasovací)" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Heslo" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
              </div>
              <div className="flex items-center gap-4">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-16 h-16 bg-black border border-zinc-800 p-1 rounded-xl cursor-pointer shadow-lg" />
                <button type="submit" disabled={loading} className="flex-grow bg-red-600 py-5 rounded-2xl font-black hover:bg-red-700 transition-colors shadow-lg uppercase text-[10px] tracking-widest">
                  {loading ? 'Pracujem...' : 'Vytvoriť zamestnanca +'}
                </button>
              </div>
            </form>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-[0.3em] ml-2 italic">Aktuálny zoznam tímu</h3>
              <div className="grid gap-3">
                {employees.map((emp) => (
                  <div key={emp.id} className={`flex justify-between items-center bg-zinc-900/80 border border-zinc-800 p-5 rounded-[2rem] transition-all hover:border-red-600/50 ${!emp.active ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-5">
                      <input type="color" value={emp.color || '#dc2626'} onChange={(e) => updateEmployeeColor(emp.id, e.target.value)} className="w-12 h-12 bg-transparent border-none cursor-pointer rounded-full overflow-hidden border-2 border-zinc-800" />
                      <div>
                        <p className="font-black uppercase text-sm tracking-tight text-white italic">{emp.name}</p>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{emp.role} • {emp.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(emp)} className="p-3 bg-zinc-800 rounded-xl hover:text-red-500 transition-colors">✏️</button>
                      <button 
                        onClick={() => toggleActive(emp.id, emp.active)} 
                        className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl border transition-all ${emp.active ? 'border-green-600/30 text-green-500 bg-green-600/5' : 'border-zinc-700 text-zinc-500'}`}
                      >
                        {emp.active ? 'AKTÍVNY' : 'NEAKTÍVNY'}
                      </button>
                      <button onClick={() => deleteEmployee(emp.id)} className="p-3 bg-zinc-800 rounded-xl hover:text-red-600 transition-colors">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* --- MODÁLNE OKNO PRE EDITÁCIU --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic mb-8 text-center tracking-tighter">Upraviť <span className="text-red-600 text-3xl">údaje</span></h2>
            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <input required type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} placeholder="Meno" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none" />
              <input required type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} placeholder="Email" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none font-bold">
                  <option value="mechanik">Mechanik</option>
                  <option value="diagnostik">Diagnostik</option>
                  <option value="prijem">Prijímací technik</option>
                </select>
                <input type="color" value={editForm.color} onChange={(e) => setEditForm({...editForm, color: e.target.value})} className="w-full h-[60px] bg-zinc-900 border border-zinc-800 p-2 rounded-2xl cursor-pointer" />
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}