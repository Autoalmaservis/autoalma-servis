'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function NastaveniaPage() {
  // Stavy pre zamestnancov
  const [employees, setEmployees] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('mechanik');
  const [newColor, setNewColor] = useState('#dc2626');
  
  // Stavy pre MODÁLNE OKNO (Editácia)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', role: '', color: '' });

  // Stavy pre pracovnú dobu
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // 1. Načítanie všetkých dát
  const fetchData = async () => {
    setLoading(true);
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true });
    if (empData) setEmployees(empData);

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

  // 2. Logika pre pridanie nového zamestnanca
  const addEmployee = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const { error } = await supabase.from('employees').insert([
      { name: newName, role: newRole, color: newColor, active: true }
    ]);
    
    if (!error) {
      setNewName('');
      setNewColor('#dc2626');
      fetchData(); // Okamžitá obnova zoznamu
    } else {
      alert("Chyba pri pridávaní: " + error.message);
    }
  };

  // 3. Logika pre OTVORENIE modálneho okna
  const openEditModal = (emp) => {
    setEditForm({ id: emp.id, name: emp.name, role: emp.role, color: emp.color });
    setIsEditModalOpen(true);
  };

  // 4. Logika pre ULOŽENIE zmien z modálneho okna
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('employees')
      .update({ name: editForm.name, role: editForm.role, color: editForm.color })
      .eq('id', editForm.id);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchData(); // Obnova dát po uložení v okne
    } else {
      alert("Chyba pri aktualizácii: " + error.message);
    }
  };

  // 5. Logika pre rýchlu zmenu farby priamo v zozname
  const updateEmployeeColor = async (id, color) => {
    const { error } = await supabase
      .from('employees')
      .update({ color: color })
      .eq('id', id);
    
    if (!error) {
      fetchData(); // Obnova dát po zmene farby
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

  // 6. Logika pre uloženie pracovnej doby
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
    <div className="p-8 max-w-6xl mx-auto bg-black min-h-screen text-white relative">
      <header className="mb-12 border-l-4 border-red-600 pl-6">
        <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">Nastavenia <span className="text-red-600">Systému</span></h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-2">Konfigurácia dielne a kapacity</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* SEKCIJA 1: PRACOVNÁ DOBA */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🕒</span>
            <h2 className="text-xl font-black uppercase tracking-tight text-red-500">Pracovná doba</h2>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
            <p className="text-zinc-400 text-xs mb-6 italic">Nastavte rozsah hodín pre kalendár.</p>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Začiatok dňa</label>
                <input 
                  type="time" 
                  value={workStart} 
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xl font-black text-white focus:border-red-600 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Koniec dňa</label>
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

          {/* Form na pridanie NOVÉHO */}
          <form onSubmit={addEmployee} className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[2rem] mb-6 shadow-xl flex flex-wrap gap-3">
            <input 
              required type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Meno nového člena"
              className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 min-w-[150px]"
            />
            
            <input 
              type="color" 
              value={newColor} 
              onChange={(e) => setNewColor(e.target.value)}
              className="w-12 h-12 bg-black border border-zinc-800 p-1 rounded-xl cursor-pointer"
              title="Farba v kalendári"
            />

            <select 
              value={newRole} onChange={(e) => setNewRole(e.target.value)}
              className="bg-black border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600"
            >
              <option value="mechanik">Mechanik</option>
              <option value="diagnostik">Diagnostik</option>
              <option value="prijem">Príjem</option>
            </select>
            <button type="submit" className="bg-red-600 px-6 rounded-xl font-black hover:bg-red-700 transition-colors shadow-lg">+</button>
          </form>

          {/* Zoznam zamestnancov */}
          <div className="space-y-3">
            {employees.map((emp) => (
              <div key={emp.id} className="flex justify-between items-center bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl group transition-all hover:border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <input 
                      type="color" 
                      value={emp.color || '#dc2626'} 
                      onChange={(e) => updateEmployeeColor(emp.id, e.target.value)}
                      className="w-10 h-10 bg-transparent border-none cursor-pointer rounded-full overflow-hidden border-2 border-zinc-800"
                    />
                  </div>
                  <div>
                    <p className="font-bold uppercase text-sm tracking-tight text-white">{emp.name}</p>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{emp.role}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(emp)} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors text-xs" title="Upraviť">✏️</button>
                  <button onClick={() => toggleActive(emp.id, emp.active)} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-zinc-800 transition-all ${emp.active ? 'bg-green-600/10 text-green-500' : 'text-zinc-600'}`}>
                    {emp.active ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors text-xs" title="Vymazať">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* --- MODÁLNE OKNO PRE EDITÁCIU --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black uppercase italic mb-8 text-center tracking-tighter">Upraviť <span className="text-red-600 text-3xl">údaje</span></h2>
            
            <form onSubmit={handleUpdateEmployee} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Meno zamestnanca</label>
                <input 
                  required 
                  type="text" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-bold focus:border-red-600 outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Rola</label>
                  <select 
                    value={editForm.role} 
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})} 
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold"
                  >
                    <option value="mechanik">Mechanik</option>
                    <option value="diagnostik">Diagnostik</option>
                    <option value="prijem">Príjem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Farba v kalendári</label>
                  <input 
                    type="color" 
                    value={editForm.color} 
                    onChange={(e) => setEditForm({...editForm, color: e.target.value})} 
                    className="w-full h-[58px] bg-zinc-900 border border-zinc-800 p-2 rounded-2xl cursor-pointer" 
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all"
                >
                  Zrušiť
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] bg-white text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl"
                >
                  Uložiť zmeny
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}