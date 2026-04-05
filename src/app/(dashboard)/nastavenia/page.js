'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function NastaveniaPage() {
  // Stavy pre zamestnancov
  const [employees, setEmployees] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('mechanik');
  const [newColor, setNewColor] = useState('#dc2626');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Stavy pre MODÁLNE OKNO (Editácia)
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
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [billingSaveStatus, setBillingSaveStatus] = useState('');

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

    // Načítanie nastavení (Pracovná doba aj Firemné údaje)
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
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Logika pre pridanie nového zamestnanca s AUTOMATICKÝM AUTH
  const addEmployee = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      alert("Meno, Email a Heslo sú povinné!");
      return;
    }

    setLoading(true);
    const emailToSave = newEmail.toLowerCase().trim();

    try {
      // KROK A: Vytvorenie prihlasovacieho účtu v Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToSave,
        password: newPassword,
      });

      if (authError) throw new Error("Chyba Auth: " + authError.message);

      // KROK B: Zápis do tabuľky employees s ID z Auth systému
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
      alert("Mechanik vytvorený a prístup aktivovaný!");
      fetchData();

    } catch (err) {
      alert("Chyba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Logika pre OTVORENIE modálneho okna
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

  // 4. Logika pre ULOŽENIE zmien zamestnanca
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
      setSaveStatus('Nastavenia uložené!');
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      setSaveStatus('Chyba pri ukladaní.');
    }
  };

  // LOGIKA PRE ULOŽENIE FIREMNÝCH ÚDAJOV
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
      setBillingSaveStatus('Firemné údaje uložené!');
      setTimeout(() => setBillingSaveStatus(''), 3000);
    } else {
      alert("Chyba pri ukladaní firemných údajov: " + error.message);
      setBillingSaveStatus('Chyba.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-black min-h-screen text-white relative font-sans select-none font-bold">
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">Nastavenia <span className="text-red-600">Systému</span></h1>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-2">Konfigurácia dielne, firemných údajov a tímu</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEVÝ SLOUPEC: PRACOVNÁ DOBA A FIRMA */}
        <div className="space-y-12">
          
          {/* SEKCIJA: PRACOVNÁ DOBA */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🕒</span>
              <h2 className="text-xl font-black uppercase tracking-tight text-red-500 italic">Pracovná doba</h2>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Začiatok dňa</label>
                  <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xl font-black text-white focus:border-red-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Koniec dňa</label>
                  <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xl font-black text-white focus:border-red-600 outline-none transition-all" />
                </div>
              </div>
              <button onClick={saveWorkTime} className="w-full bg-white text-black hover:bg-red-600 hover:text-white font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-lg">
                {saveStatus || 'Uložiť pracovnú dobu'}
              </button>
            </div>
          </section>

          {/* SEKCIJA: FAKTURAČNÉ ÚDAJE FIRMY (AutoAlma) */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🏢</span>
              <h2 className="text-xl font-black uppercase tracking-tight text-red-500 italic">Fakturačné údaje firmy</h2>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl space-y-4">
              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Obchodné meno / Názov</label>
                <input type="text" value={billingData.company_name} onChange={(e) => setBillingData({...billingData, company_name: e.target.value})} placeholder="AutoAlma s.r.o." className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">IČO</label>
                  <input type="text" value={billingData.ico} onChange={(e) => setBillingData({...billingData, ico: e.target.value})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">DIČ / IČ DPH</label>
                  <input type="text" value={billingData.dic} onChange={(e) => setBillingData({...billingData, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Ulica a číslo</label>
                <input type="text" value={billingData.address} onChange={(e) => setBillingData({...billingData, address: e.target.value})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="text" value={billingData.zip} onChange={(e) => setBillingData({...billingData, zip: e.target.value})} placeholder="PSČ" className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                <input type="text" value={billingData.city} onChange={(e) => setBillingData({...billingData, city: e.target.value})} placeholder="Mesto" className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Bankový účet (IBAN)</label>
                <input type="text" value={billingData.bank_account} onChange={(e) => setBillingData({...billingData, bank_account: e.target.value})} placeholder="SK00 0000 0000..." className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              </div>

              <button onClick={saveBillingData} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-lg mt-4">
                {billingSaveStatus || 'Uložiť firemné údaje'}
              </button>
            </div>
          </section>
        </div>

        {/* PRAVÝ SLOUPEC: SPRÁVA TÍMU */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔧</span>
            <h2 className="text-xl font-black uppercase tracking-tight text-red-500 italic">Tím a mechanici</h2>
          </div>

          <form onSubmit={addEmployee} className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[2rem] mb-6 shadow-xl space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Celé meno" className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold">
                <option value="mechanik">Mechanik</option>
                <option value="diagnostik">Diagnostik</option>
                <option value="prijem">Prijímací technik</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="E-mail (prihlasovací)" className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
              <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Heslo" className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
            </div>
            <div className="flex items-center gap-3">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-12 h-12 bg-black border border-zinc-800 p-1 rounded-xl cursor-pointer shadow-lg" title="Farba v kalendári" />
              <button type="submit" disabled={loading} className="flex-grow bg-red-600 py-3 rounded-xl font-black hover:bg-red-700 transition-colors shadow-lg uppercase text-xs">
                {loading ? 'Vytváram prístup...' : 'Vytvoriť profil zamestnanca +'}
              </button>
            </div>
          </form>

          <div className="space-y-8">
            {/* AKTÍVNY TÍM */}
            <div>
              <h3 className="text-[10px] font-black uppercase text-red-600 mb-4 tracking-[0.3em] italic">Aktívny Tím</h3>
              <div className="space-y-3">
                {employees.filter(e => e.active).map((emp) => (
                  <div key={emp.id} className="flex justify-between items-center bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl group transition-all hover:border-red-600/50 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input type="color" value={emp.color || '#dc2626'} onChange={(e) => updateEmployeeColor(emp.id, e.target.value)} className="w-10 h-10 bg-transparent border-none cursor-pointer rounded-full overflow-hidden border-2 border-zinc-800" />
                      </div>
                      <div>
                        <p className="font-bold uppercase text-sm tracking-tight text-white italic">{emp.name}</p>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{emp.role} • {emp.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(emp)} className="p-2 text-zinc-400 hover:text-white transition-colors text-xs" title="Upraviť">✏️</button>
                      <button onClick={() => toggleActive(emp.id, emp.active)} className="text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-green-600/30 text-green-500 bg-green-600/5 hover:bg-green-600/10 transition-all font-bold">
                        AKTÍVNY
                      </button>
                      <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors text-xs" title="Vymazať">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NEAKTÍVNY TÍM */}
            {employees.some(e => !e.active) && (
              <div>
                <h3 className="text-[10px] font-black uppercase text-zinc-600 mb-4 tracking-[0.3em] italic">Deaktivované profily</h3>
                <div className="space-y-3 opacity-60 grayscale transition-all">
                  {employees.filter(e => !e.active).map((emp) => (
                    <div key={emp.id} className="flex justify-between items-center bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full border border-zinc-800 shadow-inner" style={{ backgroundColor: emp.color }}></div>
                        <div>
                          <p className="font-bold uppercase text-sm text-zinc-500 italic">{emp.name}</p>
                          <p className="text-[9px] font-black text-zinc-600 uppercase italic">Neaktívny</p>
                        </div>
                      </div>
                      <button onClick={() => toggleActive(emp.id, emp.active)} className="text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white transition-all font-bold">
                        AKTIVOVAŤ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODÁLNE OKNO PRE EDITÁCIU --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black uppercase italic mb-8 text-center tracking-tighter">Upraviť <span className="text-red-600 text-3xl">údaje</span></h2>
            
            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Celé meno</label>
                <input required type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-bold focus:border-red-600 outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Prihlasovací E-mail</label>
                <input required type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Nové Heslo (len ak chcete zmeniť)</label>
                <input type="password" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} placeholder="Ponechajte prázdne pre zachovanie" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Rola</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold">
                    <option value="mechanik">Mechanik</option>
                    <option value="diagnostik">Diagnostik</option>
                    <option value="prijem">Prijímací technik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Farba</label>
                  <input type="color" value={editForm.color} onChange={(e) => setEditForm({...editForm, color: e.target.value})} className="w-full h-[58px] bg-zinc-900 border border-zinc-800 p-2 rounded-2xl cursor-pointer shadow-lg" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all font-bold">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl font-bold">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}