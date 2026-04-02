'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function NastaveniaPage() {
  // Stavy pre zamestnancov
  const [employees, setEmployees] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('mechanik');
  
  // Stavy pre pracovnú dobu
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // 1. Načítanie všetkých dát pri štarte
  const fetchData = async () => {
    setLoading(true);
    
    // Načítanie zamestnancov
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true });
    if (empData) setEmployees(empData);

    // Načítanie nastavení pracovnej doby
    const { data: setData } = await supabase.from('business_settings').select('*');
    if (setData) {
      const start = setData.find(s => s.id === 'work_start')?.value;
      const end = setData.find(s => s.id === 'work_end')?.value;
      if (start) setWorkStart(start);
      if (end) setWorkEnd(end);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Logika pre zamestnancov
  const addEmployee = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('employees').insert([{ name: newName, role: newRole }]);
    if (!error) {
      setNewName('');
      fetchData();
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

  // 3. Logika pre uloženie pracovnej doby
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

  return (
    <div className="p-8 max-w-6xl mx-auto bg-black min-h-screen text-white">
      <header className="mb-12 border-l-4 border-red-600 pl-6">
        <h1 className="text-4xl font-black uppercase tracking-tighter italic">Nastavenia Systému</h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Konfigurácia dielne a kapacity</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* SEKCIJA 1: PRACOVNÁ DOBA (To nové, čo si chcel) */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🕒</span>
            <h2 className="text-xl font-black uppercase tracking-tight text-red-500">Pracovná doba</h2>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
            <p className="text-zinc-400 text-xs mb-6 italic">Nastavte rozsah hodín, ktoré uvidíte v kalendári. Kalendár sa automaticky roztiahne na celú výšku podľa tohto času.</p>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Začiatok dňa</label>
                <input 
                  type="time" 
                  value={workStart} 
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xl font-black text-white focus:border-red-600 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Koniec dňa</label>
                <input 
                  type="time" 
                  value={workEnd} 
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xl font-black text-white focus:border-red-600 outline-none transition-all"
                />
              </div>
            </div>

            <button 
              onClick={saveWorkTime}
              className="w-full bg-white text-black hover:bg-red-600 hover:text-white font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-[0.2em] shadow-lg"
            >
              {saveStatus || 'Uložiť pracovnú dobu'}
            </button>
          </div>
        </section>

        {/* SEKCIJA 2: SPRÁVA TÍMU */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔧</span>
            <h2 className="text-xl font-black uppercase tracking-tight text-red-500">Tím a mechanici</h2>
          </div>

          {/* Form na pridanie */}
          <form onSubmit={addEmployee} className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[2rem] mb-6">
            <div className="flex gap-3">
              <input 
                required type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Meno nového kolegu"
                className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600"
              />
              <select 
                value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none"
              >
                <option value="mechanik">Mechanik</option>
                <option value="diagnostik">Diagnostik</option>
                <option value="prijem">Príjem</option>
              </select>
              <button type="submit" className="bg-red-600 px-6 rounded-xl font-black">+</button>
            </div>
          </form>

          {/* Zoznam zamestnancov */}
          <div className="space-y-3">
            {employees.map((emp) => (
              <div key={emp.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-2xl group transition-all hover:border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${emp.active ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-zinc-700'}`}></div>
                  <div>
                    <p className="font-bold uppercase text-sm tracking-tight">{emp.name}</p>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{emp.role}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(emp.id, emp.active)} className="text-[9px] font-black uppercase bg-black px-3 py-1.5 rounded-lg hover:bg-zinc-800 border border-zinc-800 transition-all">
                    {emp.active ? 'Deaktivovať' : 'Aktivovať'}
                  </button>
                  <button onClick={() => deleteEmployee(emp.id)} className="text-zinc-700 hover:text-red-500 transition-colors px-2">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}