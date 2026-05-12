'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ffffff', '#a1a1aa', '#dc2626',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-10 gap-1.5 p-3 bg-black rounded-2xl border border-zinc-800">
      {PRESET_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
          style={{
            backgroundColor: color,
            borderColor: value === color ? '#ffffff' : 'transparent',
            boxShadow: value === color ? `0 0 0 2px ${color}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

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
  const [newHourlyRate, setNewHourlyRate] = useState('');
  
  // Stavy pre MODÁLNE OKNO (Editácia zamestnanca)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', role: '', color: '', email: '', password: '', hourly_rate: '' });

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
  const [rateCategories, setRateCategories] = useState([
    { key: 'M1', label: 'Základná mechanická', value: '0' },
    { key: 'M2', label: 'Prémiová mechanická', value: '0' },
    { key: 'E1', label: 'Elektrodiagnostika', value: '0' },
    { key: 'E2', label: 'Špeciálne elektro', value: '0' },
  ]);
  const [newRate, setNewRate] = useState({ key: '', label: '', value: '' });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [billingSaveStatus, setBillingSaveStatus] = useState('');
  const [ratesSaveStatus, setRatesSaveStatus] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Formuláre
  const [formTemplates, setFormTemplates] = useState([]);
  const [newFormName, setNewFormName] = useState('');
  const [uploadingForm, setUploadingForm] = useState(false);

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
      const rateCategoriesRaw = setData.find(s => s.id === 'rate_categories')?.value;
      if (rateCategoriesRaw) {
        try { setRateCategories(JSON.parse(rateCategoriesRaw)); } catch {}
      } else {
        setRateCategories([
          { key: 'M1', label: 'Základná mechanická', value: setData.find(s => s.id === 'rate_m1')?.value || '0' },
          { key: 'M2', label: 'Prémiová mechanická', value: setData.find(s => s.id === 'rate_m2')?.value || '0' },
          { key: 'E1', label: 'Elektrodiagnostika', value: setData.find(s => s.id === 'rate_e1')?.value || '0' },
          { key: 'E2', label: 'Špeciálne elektro', value: setData.find(s => s.id === 'rate_e2')?.value || '0' },
        ]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); fetchFormTemplates(); }, []);

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

  // --- LOGIKA PRE FORMULÁRE ---
  const fetchFormTemplates = async () => {
    const { data } = await supabase.from('form_templates').select('*').order('created_at', { ascending: false });
    if (data) setFormTemplates(data);
  };

  const handleFormUpload = async (e) => {
    e.preventDefault();
    const file = e.target.querySelector('input[type="file"]').files[0];
    if (!file || !newFormName.trim()) { alert('Zadajte názov a vyberte PDF súbor.'); return; }
    setUploadingForm(true);
    try {
      const fileName = `form-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('form-templates').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('form-templates').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('form_templates').insert([{ name: newFormName.trim(), pdf_url: publicUrl, storage_path: fileName }]);
      if (dbError) throw dbError;
      setNewFormName('');
      e.target.reset();
      fetchFormTemplates();
    } catch (err) { alert('Chyba: ' + err.message); }
    finally { setUploadingForm(false); }
  };

  const handleDeleteFormTemplate = async (id, storagePath) => {
    if (!confirm('Naozaj zmazať tento formulár?')) return;
    if (storagePath) await supabase.storage.from('form-templates').remove([storagePath]);
    await supabase.from('form_templates').delete().eq('id', id);
    fetchFormTemplates();
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
          active: true,
          hourly_rate: parseFloat(newHourlyRate) || 0,
        }
      ]);
      if (dbError) throw dbError;

      setNewName(''); setNewEmail(''); setNewPassword(''); setNewColor('#dc2626'); setNewHourlyRate('');
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
        password: emp.password || '',
        hourly_rate: emp.hourly_rate != null ? String(emp.hourly_rate) : '',
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
        password: editForm.password,
        hourly_rate: parseFloat(editForm.hourly_rate) || 0,
      })
      .eq('id', editForm.id);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchData();
    } else {
      alert("Chyba pri aktualizácii: " + error.message);
    }
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

  const saveRateCategories = async () => {
    setRatesSaveStatus('Ukladám...');
    const { error } = await supabase.from('business_settings').upsert({
      id: 'rate_categories',
      value: JSON.stringify(rateCategories)
    });
    if (!error) {
      setRatesSaveStatus('Uložené!');
      setTimeout(() => setRatesSaveStatus(''), 3000);
    }
  };

  const addRateCategory = () => {
    if (!newRate.key.trim() || !newRate.label.trim()) return;
    const key = newRate.key.trim().toUpperCase();
    if (rateCategories.find(c => c.key === key)) {
      alert('Kategória s týmto kódom už existuje!');
      return;
    }
    setRateCategories([...rateCategories, { key, label: newRate.label.trim(), value: newRate.value || '0' }]);
    setNewRate({ key: '', label: '', value: '' });
  };

  const deleteRateCategory = (key) => {
    setRateCategories(rateCategories.filter(c => c.key !== key));
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

        <button
          onClick={() => setActiveTab('formulare')}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'formulare' ? 'bg-red-600 text-white shadow-lg italic' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          📋 Formuláre
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
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl space-y-4">

              {/* Existujúce kategórie */}
              <div className="space-y-3">
                {rateCategories.map((cat, idx) => (
                  <div key={cat.key} className="bg-black/40 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4 group">
                    <div className="w-14 shrink-0 text-center bg-zinc-900 border border-zinc-700 rounded-xl py-2">
                      <span className="text-red-600 font-black uppercase text-sm italic">{cat.key}</span>
                    </div>
                    <input
                      type="text"
                      value={cat.label}
                      onChange={(e) => {
                        const updated = [...rateCategories];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setRateCategories(updated);
                      }}
                      className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black outline-none focus:border-red-600 transition-all"
                      placeholder="Popis kategórie"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        value={cat.value}
                        onChange={(e) => {
                          const updated = [...rateCategories];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setRateCategories(updated);
                        }}
                        className="w-24 bg-black border border-zinc-800 p-3 rounded-xl text-white text-right font-mono font-black text-sm outline-none focus:border-red-600 transition-all"
                        placeholder="0"
                      />
                      <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">€/hod</span>
                    </div>
                    <button
                      onClick={() => deleteRateCategory(cat.key)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-700 hover:text-red-600 hover:border-red-600/50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              {/* Pridať novú kategóriu */}
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-4 italic">Pridať novú kategóriu práce</p>
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="text-[8px] uppercase text-zinc-600 mb-1 block tracking-widest font-black">Kód</label>
                    <input
                      type="text"
                      value={newRate.key}
                      onChange={(e) => setNewRate({ ...newRate, key: e.target.value.toUpperCase() })}
                      className="w-20 bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm font-black uppercase outline-none focus:border-red-600 transition-all"
                      placeholder="K1"
                      maxLength={4}
                    />
                  </div>
                  <div className="flex-grow min-w-[160px]">
                    <label className="text-[8px] uppercase text-zinc-600 mb-1 block tracking-widest font-black">Popis</label>
                    <input
                      type="text"
                      value={newRate.label}
                      onChange={(e) => setNewRate({ ...newRate, label: e.target.value })}
                      className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black outline-none focus:border-red-600 transition-all"
                      placeholder="Napr. Karosárske práce"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase text-zinc-600 mb-1 block tracking-widest font-black">€/hod</label>
                    <input
                      type="number"
                      value={newRate.value}
                      onChange={(e) => setNewRate({ ...newRate, value: e.target.value })}
                      className="w-24 bg-black border border-zinc-800 p-3 rounded-xl text-white text-right font-mono font-black outline-none focus:border-red-600 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <button
                    onClick={addRateCategory}
                    className="bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-600 text-zinc-400 hover:text-white font-black px-5 py-3 rounded-xl transition-all text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-6">
                <button onClick={saveRateCategories} className="w-full md:w-auto px-12 bg-red-600 text-white hover:bg-red-700 font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-xl">
                  {ratesSaveStatus || 'Uložiť cenník prác'}
                </button>
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

        {/* --- SEKCIJA: FORMULÁRE --- */}
        {activeTab === 'formulare' && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl space-y-8">
              <h3 className="text-sm font-black uppercase text-red-600 tracking-widest italic">Nahrať nový formulár</h3>
              <form onSubmit={handleFormUpload} className="space-y-4">
                <input
                  required type="text" placeholder="Názov formulára (napr. Preberací protokol DPF)"
                  value={newFormName} onChange={e => setNewFormName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"
                />
                <div className="flex gap-4 items-center">
                  <label className="flex-grow cursor-pointer bg-black border border-dashed border-zinc-700 hover:border-red-600 p-5 rounded-2xl text-center transition-all">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">📄 Vybrať PDF súbor</span>
                    <input required type="file" accept="application/pdf" className="hidden" />
                  </label>
                  <button type="submit" disabled={uploadingForm} className="px-8 py-5 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 whitespace-nowrap">
                    {uploadingForm ? 'Nahrávam...' : '+ Pridať formulár'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-2">Uložené formuláre ({formTemplates.length})</h3>
              {formTemplates.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-800 rounded-[2rem] p-12 text-center text-zinc-700 font-black uppercase text-xs tracking-widest">Žiadne formuláre</div>
              ) : (
                <div className="space-y-3">
                  {formTemplates.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800 px-6 py-4 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">📋</span>
                        <div>
                          <p className="font-black uppercase text-sm">{t.name}</p>
                          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString('sk-SK')}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <a href={t.pdf_url} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all px-4 py-2 rounded-xl border border-blue-600/30 hover:border-blue-500">Zobraziť</a>
                        <button onClick={() => handleDeleteFormTemplate(t.id, t.storage_path)} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-600 transition-all px-4 py-2 rounded-xl border border-red-600/30">Zmazať</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  <option value="diagnostik">Diagnostik / Elektrikár</option>
                  <option value="klampiar">Klampiar</option>
                  <option value="lakernik">Lakerník</option>
                </select>
                <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="E-mail (prihlasovací)" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Heslo" className="bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none" />
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 ml-1">Hodinová sadzba mechanika</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min="0" step="any"
                      value={newHourlyRate}
                      onChange={(e) => setNewHourlyRate(e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-36 bg-black border border-amber-600/30 focus:border-amber-500 p-4 rounded-xl text-white text-right font-black outline-none transition-all"
                    />
                    <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">€ / hodina</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Farba v kalendári</label>
                <ColorPicker value={newColor} onChange={setNewColor} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-red-600 py-5 rounded-2xl font-black hover:bg-red-700 transition-colors shadow-lg uppercase text-[10px] tracking-widest">
                {loading ? 'Pracujem...' : 'Vytvoriť zamestnanca +'}
              </button>
            </form>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-[0.3em] ml-2 italic">Aktuálny zoznam tímu</h3>
              <div className="grid gap-3">
                {employees.map((emp) => (
                  <div key={emp.id} className={`flex justify-between items-center bg-zinc-900/80 border border-zinc-800 p-5 rounded-[2rem] transition-all hover:border-red-600/50 ${!emp.active ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-5">
                      <div
                        className="w-12 h-12 rounded-full border-2 border-zinc-700 shrink-0 cursor-pointer"
                        style={{ backgroundColor: emp.color || '#dc2626' }}
                        title="Klikni pre zmenu farby"
                        onClick={() => openEditModal(emp)}
                      />
                      <div>
                        <p className="font-black uppercase text-sm tracking-tight text-white italic">{emp.name}</p>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{emp.role} • {emp.email}</p>
                        <p className="text-[9px] font-mono text-zinc-600 mt-0.5 tracking-widest">🔑 {emp.password || '—'}</p>
                        {emp.hourly_rate > 0 && <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5">💰 {emp.hourly_rate} €/hod</p>}
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
              <input type="text" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} placeholder="Heslo (nechajte prázdne ak nemeníte)" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none font-mono tracking-widest" />
              <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none font-bold">
                <option value="mechanik">Mechanik</option>
                <option value="diagnostik">Diagnostik / Elektrikár</option>
                <option value="klampiar">Klampiar</option>
                <option value="lakernik">Lakerník</option>
              </select>
              <div className="flex items-center gap-3">
                <div className="flex-grow">
                  <label className="block text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 ml-1">Hodinová sadzba (€/hod)</label>
                  <input
                    type="number" min="0" step="any"
                    value={editForm.hourly_rate}
                    onChange={(e) => setEditForm({...editForm, hourly_rate: e.target.value})}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    className="w-full bg-zinc-900 border border-amber-600/30 focus:border-amber-500 p-4 rounded-2xl text-white font-black outline-none text-right"
                  />
                </div>
                <span className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6">€/hod</span>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Farba v kalendári</label>
                <ColorPicker value={editForm.color} onChange={(color) => setEditForm({...editForm, color})} />
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