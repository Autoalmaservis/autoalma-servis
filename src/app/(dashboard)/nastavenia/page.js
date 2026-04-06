'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function NastaveniaPage() {
  // Stav pre prepínanie záložiek
  const [activeTab, setActiveTab] = useState('pracovna_doba');

  // Stavy pre zamestnancov
  const [employees, setEmployees] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('mechanik');
  const [newColor, setNewColor] = useState('#dc2626');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Stavy pre MODÁLNE OKNO (Editácia zamestnanca)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', role: '', color: '', email: '', password: '' });

  // Stavy pre pracovnú dobu
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // STAVY PRE FAKTURAČNÉ ÚDAJE FIRMY
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
    bank_account: ''
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

      // Firemné údaje
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
        bank_account: setData.find(s => s.id === 'company_bank')?.value || '',
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
    const { error } = await supabase.from('business_settings').upsert(payload);
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

        {/* --- SEKCIJA 3: FAKTURÁCIA --- */}
        {activeTab === 'fakturacia' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3rem] shadow-2xl space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest ml-1 italic">Názov firmy</label>
                  <input type="text" value={billingData.company_name} onChange={(e) => setBillingData({...billingData, company_name: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600" />
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

        {/* --- SEKCIJA 4: TÍM --- */}
        {activeTab === 'tim' && (
          <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Formulár pre nového zamestnanca */}
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

            {/* Zoznam zamestnancov */}
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