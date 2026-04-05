'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function DetailZakazkyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [zakazka, setZakazka] = useState(null);
  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]); 
  const [employees, setEmployees] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const [newItem, setNewItem] = useState({ 
    name: '', 
    quantity: 1, 
    unit: 'ks', 
    unit_price: 0, 
    type: 'Materiál' 
  });

  useEffect(() => {
    if (id) {
      loadAllData();

      const subscription = supabase
        .channel(`job-detail-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tasks', filter: `job_id=eq.${id}` }, () => { fetchTasks(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_tickets', filter: `id=eq.${id}` }, () => { fetchDetail(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_items', filter: `job_id=eq.${id}` }, () => { fetchItems(); })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [id]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchDetail(), fetchItems(), fetchTasks(), fetchEmployees()]);
    setLoading(false);
  };

  const fetchDetail = async () => {
    try {
      const { data, error } = await supabase.from('job_tickets').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) setZakazka(data);
    } catch (err) { console.error("Chyba detailu:", err.message); }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from('job_items').select('*').eq('job_id', id).order('type', { ascending: false }).order('created_at', { ascending: true });
      if (error) throw error;
      if (data) setItems(data);
    } catch (err) { console.error("Chyba položiek:", err.message); }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase.from('job_tasks').select('*').eq('job_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        const formattedTasks = data.map(t => ({
          ...t,
          is_completed: t.is_completed === true || t.is_completed === 'true'
        }));
        setTasks(formattedTasks);
      }
    } catch (err) { console.error("Chyba úkonov:", err.message); }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true);
      if (data) setEmployees(data);
    } catch (err) { console.error("Chyba zamestnancov:", err.message); }
  };

  const updateJobStatus = async (newStatus) => {
    const { error } = await supabase
      .from('job_tickets')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', id);

    if (!error) {
      setZakazka(prev => ({ ...prev, status: newStatus }));
    } else {
      alert("Chyba pri zmene stavu: " + error.message);
    }
  };

  const updateMechanic = async (employeeId) => {
    const selectedEmp = employees.find(e => e.id === employeeId);
    if (!selectedEmp) return;
    const { error } = await supabase
      .from('job_tickets')
      .update({ assigned_worker_id: employeeId, technician_name: selectedEmp.name, updated_at: new Date() })
      .eq('id', id);
    if (!error) {
      setZakazka(prev => ({ ...prev, assigned_worker_id: employeeId, technician_name: selectedEmp.name }));
    }
  };

  // --- LOGIKA FAKTURÁCIE ---
  const generateInvoiceNumber = async (isOfficial) => {
    const now = new Date();
    const DD = String(now.getDate()).padStart(2, '0');
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const RR = String(now.getFullYear()).slice(-2);
    const datePrefix = `${DD}${MM}${RR}`;
    
    // Hľadáme dnešné faktúry pre CCC (counter)
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .ilike('invoice_number', `%${datePrefix}%`);

    const count = (data?.length || 0) + 1;
    const CCC = String(count).padStart(3, '0');
    
    return isOfficial ? `${datePrefix}${CCC}` : `A${datePrefix}${CCC}`;
  };

  const handleFinalizeJob = async (isOfficial) => {
    setInvoiceLoading(true);
    try {
      const invoiceNum = await generateInvoiceNumber(isOfficial);
      const { subtotal, tax, total } = calculateTotal();

      const invoicePayload = {
        invoice_number: invoiceNum,
        job_id: id,
        customer_name: zakazka.customer_name,
        customer_email: zakazka.customer_email,
        customer_phone: zakazka.customer_phone,
        company_details: {
            company_name: zakazka.company_name,
            ico: zakazka.ico,
            dic: zakazka.dic,
            ic_dph: zakazka.ic_dph,
            address: zakazka.address,
            city: zakazka.city,
            zip: zakazka.zip
        },
        car_details: {
            brand_model: zakazka.car_brand_model,
            plate_number: zakazka.plate_number,
            vin: zakazka.vin_number,
            mileage: zakazka.mileage
        },
        items_json: items,
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: total,
        is_official: isOfficial
      };

      const { error: invError } = await supabase.from('invoices').insert([invoicePayload]);
      if (invError) throw invError;

      // Nastavíme zákazku ako dokončenú
      await updateJobStatus('Archivované');
      
      alert(isOfficial ? `Faktúra ${invoiceNum} vytvorená!` : `Doklad ${invoiceNum} uložený!`);
      setIsInvoiceModalOpen(false);
      router.push('/faktury');
    } catch (err) {
      alert("Chyba fakturácie: " + err.message);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const { error } = await supabase.from('job_tasks').insert([{ job_id: id, task_description: newTaskText, is_completed: false }]);
    if (!error) { setNewTaskText(''); fetchTasks(); }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = !currentStatus;
    setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));
    await supabase.from('job_tasks').update({ is_completed: newStatus }).eq('id', taskId);
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
    if (!error) fetchTasks();
  };

  const deleteWholeJob = async () => {
    const { error } = await supabase.from('job_tickets').delete().eq('id', id);
    if (!error) router.push('/zakazky');
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name) return;
    const { error } = await supabase.from('job_items').insert([{ ...newItem, job_id: id }]);
    if (!error) {
      setNewItem({ name: '', quantity: 1, unit: 'ks', unit_price: 0, type: newItem.type });
      fetchItems();
    }
  };

  const deleteItem = async (itemId) => {
    const { error } = await supabase.from('job_items').delete().eq('id', itemId);
    if (!error) fetchItems();
  };

  const calculateTotal = () => {
    const subtotalMaterial = items.filter(i => i.type === 'Materiál').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const subtotalWork = items.filter(i => i.type === 'Práca').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const subtotal = subtotalMaterial + subtotalWork;
    const tax = subtotal * 0.23;
    const total = subtotal + tax;
    return { subtotalMaterial, subtotalWork, subtotal, tax, total };
  };

  const { subtotalMaterial, subtotalWork, subtotal, tax, total } = calculateTotal();
  const handlePrint = () => window.print();

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center py-20 font-sans font-bold uppercase italic tracking-widest text-red-600 animate-pulse">
      Generujem rozpis...
    </div>
  );

  if (!zakazka) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-red-500 font-black uppercase tracking-tighter italic">Zákazka nenájdená</p></div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-12 relative font-sans font-bold">
      
      {/* OVLÁDANIE - TOP BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 no-print max-w-5xl mx-auto gap-4">
        <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest font-bold">← Späť</button>
        
        <div className="flex bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 gap-2">
            <button onClick={() => updateJobStatus('Prebieha')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Prebieha' ? 'bg-amber-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Prebieha</button>
            <button onClick={() => updateJobStatus('Dokončené')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Dokončené' ? 'bg-green-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Dokončené</button>
            <button onClick={() => updateJobStatus('Archivované')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Archivované' ? 'bg-zinc-700 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Archivovať</button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsDeleteModalOpen(true)} className="bg-zinc-900 border border-red-900/30 text-red-900 hover:bg-red-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest font-bold font-bold font-bold font-bold">🗑️ Vymazať</button>
          <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest font-bold">🖨️ Tlačiť protokol</button>
        </div>
      </div>

      <div className="printable-area bg-zinc-900 border border-zinc-800 p-8 md:p-16 rounded-[3rem] shadow-2xl max-w-5xl mx-auto text-white">
        
        {/* LOGO A INFO */}
        <div className="flex justify-between items-start border-b-2 border-red-600 pb-8 mb-8 font-bold">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none font-bold">AutoAlma <span className="text-red-600">Servis</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic uppercase">Slovenská ulica 12, Košice | www.autoalma.sk</p>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border inline-block mb-3 ${zakazka.status === 'Dokončené' ? 'border-green-600 text-green-500 font-bold' : 'border-amber-600 text-amber-500 font-bold'}`}>{zakazka.status}</span>
            <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Zákazkový list</p>
            <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">#{zakazka.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* INFO BAR - S ROZKLIKÁVACÍM MECHANIKOM */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-b border-zinc-800 pb-8">
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dátum príjmu</p><p className="font-bold">{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</p></div>
          
          <div className="relative group">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Zodp. Mechanik</p>
            <div className="relative no-print">
                <select 
                  className="bg-black/40 border-2 border-zinc-700 hover:border-red-600 rounded-xl px-3 py-2 text-[11px] font-black uppercase italic tracking-tighter text-red-600 outline-none cursor-pointer appearance-none transition-all pr-8 shadow-inner w-full"
                  value={zakazka.assigned_worker_id || ''}
                  onChange={(e) => updateMechanic(e.target.value)}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-zinc-900 text-white font-sans not-italic font-bold font-bold font-bold">{emp.name.toUpperCase()}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-red-600 text-[8px] font-bold">▼</div>
            </div>
            <p className="hidden print-block text-red-600 uppercase italic font-black text-sm">{zakazka.technician_name || 'Pridelený tím'}</p>
          </div>

          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Tachometer</p><p className="font-bold">{zakazka.mileage || '---'} km</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">ŠPZ Vozidla</p><p className="text-xl tracking-widest italic font-black uppercase">{zakazka.plate_number}</p></div>
        </div>

        {/* KLIENT A VOZIDLO DETAIL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          <div className="space-y-4">
             <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic font-bold">Partner a Technika</h2>
             <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-4 font-bold">
                <div>
                  <p className="text-2xl font-black uppercase italic tracking-tighter leading-none font-bold">{zakazka.customer_name}</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1 font-bold">{zakazka.customer_phone} | {zakazka.customer_email}</p>
                </div>
                {(zakazka.ico || zakazka.company_name) && (
                  <div className="pt-4 border-t border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-400 font-bold">
                    <p className="text-white mb-1 font-bold">{zakazka.company_name}</p>
                    <p className="font-bold">IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
                    <p className="font-bold">IČ DPH: {zakazka.ic_dph || '---'}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-800/50 font-bold">
                  <p className="text-lg font-black uppercase text-zinc-300 italic tracking-tight leading-none font-bold">{zakazka.car_brand_model}</p>
                  <p className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase mt-1 font-bold">VIN: {zakazka.vin_number || '---'}</p>
                </div>
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end font-bold">
                <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic font-bold">1. Priebeh prác (Checklist)</h2>
                <span className="text-[9px] font-black text-zinc-500 uppercase font-bold">{tasks.filter(t => t.is_completed === true).length} / {tasks.length} HOTOVO</span>
            </div>
            <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px] font-bold">
              {tasks.map((task) => {
                const done = task.is_completed === true;
                return (
                  <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 font-bold ${done ? 'bg-green-600/10 border-green-600 text-green-500 shadow-[0_0_15px_rgba(22,163,74,0.1)]' : 'bg-red-600/5 border-red-600/40 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.05)]'}`}>
                    <div className="flex items-center gap-4 cursor-pointer flex-grow no-print" onClick={() => toggleTaskStatus(task.id, task.is_completed)}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${done ? 'bg-green-600 border-green-600 shadow-lg shadow-green-900/40 font-bold' : 'bg-transparent border-red-600 font-bold'}`}>
                        {done ? <span className="text-white text-xs font-black font-bold">✓</span> : <span className="text-red-600 text-[10px] font-black uppercase tracking-tighter font-bold">X</span>}
                      </div>
                      <span className={`text-sm font-black uppercase tracking-tight italic font-bold ${done ? 'line-through opacity-50' : ''}`}>{task.task_description}</span>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg font-bold font-bold font-bold font-bold">✕</button>
                  </div>
                );
              })}
              <form onSubmit={addTask} className="flex gap-2 mt-4 no-print font-bold">
                <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="+ Pridať ďalšiu úlohu..." className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all font-black italic tracking-widest font-bold" />
                <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
              </form>
              <div className="hidden print-block space-y-2">
                {tasks.map(t => (
                    <p key={t.id} className="text-xs uppercase font-bold text-black flex gap-2 font-bold font-bold">
                      <span className="font-bold">{t.is_completed === true ? '[X]' : '[  ]'}</span> {t.task_description}
                    </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROZPIS POLOŽIEK */}
        <div className="space-y-4 mb-12 font-bold font-bold font-bold font-bold">
          <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic font-bold font-bold font-bold">2. Rozpis materiálu a servisných prác</h2>
          <div className="bg-black/30 rounded-3xl border border-zinc-800 overflow-hidden shadow-inner font-bold font-bold font-bold font-bold">
            <table className="w-full text-left text-sm font-bold font-bold font-bold font-bold">
              <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 font-bold tracking-widest italic font-bold font-bold font-bold">
                <tr>
                  <th className="p-4 w-24 font-bold">Typ</th>
                  <th className="p-4 font-bold">Položka / Úkon</th>
                  <th className="p-4 text-center w-24 font-bold">Množstvo</th>
                  <th className="p-4 text-right font-bold">Cena/J</th>
                  <th className="p-4 text-right font-bold font-bold">Spolu</th>
                  <th className="p-4 text-center no-print w-10 font-bold font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-black italic uppercase font-bold font-bold font-bold">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all font-bold font-bold font-bold">
                    <td className="p-4"><span className={`text-[8px] font-black px-2 py-1 rounded uppercase border font-bold ${item.type === 'Práca' ? 'bg-blue-900/30 text-blue-400 border-blue-800 shadow-lg' : 'bg-orange-900/30 text-orange-400 border-orange-800 shadow-lg'}`}>{item.type}</span></td>
                    <td className="p-4 font-black uppercase text-xs tracking-tight font-bold font-bold">{item.name}</td>
                    <td className="p-4 text-center font-mono text-xs font-bold font-bold">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-right font-mono text-xs font-bold font-bold">{parseFloat(item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-right font-black text-xs font-bold font-bold font-bold">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-center no-print font-bold font-bold"><button onClick={() => deleteItem(item.id)} className="text-zinc-800 hover:text-red-600 transition-colors font-bold font-bold">✕</button></td>
                  </tr>
                ))}
                <tr className="no-print bg-black/50 border-t-2 border-red-600/20 font-bold font-bold font-bold font-bold">
                  <td className="p-3 font-bold">
                    <select className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-[9px] font-black uppercase outline-none focus:border-red-600 cursor-pointer font-bold font-bold font-bold" value={newItem.type} onChange={(e) => setNewItem({...newItem, type: e.target.value})}>
                      <option value="Materiál">MATERIÁL</option><option value="Práca">PRÁCA</option>
                    </select>
                  </td>
                  <td className="p-3 font-bold"><input type="text" placeholder="Názov..." className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs font-black uppercase italic font-bold font-bold" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} /></td>
                  <td className="p-3 flex gap-1 font-bold font-bold">
                    <input type="number" className="w-14 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-center text-xs font-bold" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
                    <select className="bg-zinc-900 border border-zinc-800 p-1 rounded-lg text-[8px] font-black uppercase outline-none" value={newItem.unit} onChange={(e) => setNewItem({...newItem, unit: e.target.value})}>
                      <option value="ks">ks</option><option value="hod">hod</option><option value="l">l</option>
                    </select>
                  </td>
                  <td className="p-3 w-32 font-bold"><input type="number" placeholder="Cena" className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-right text-xs font-black outline-none focus:border-red-600" value={newItem.unit_price} onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value)})} /></td>
                  <td className="p-3"><button onClick={addItem} className="w-full bg-red-600 text-white font-black py-3 rounded-xl hover:bg-red-500 transition-all shadow-xl text-lg">+</button></td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
            <div className="p-8 bg-zinc-800/20 flex flex-col items-end space-y-3 font-black italic uppercase font-bold">
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest font-bold font-bold font-bold"><span>Materiál (Základ):</span><span className="text-white font-bold">{subtotalMaterial.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-3 font-bold font-bold font-bold font-bold"><span>Práca (Základ):</span><span className="text-blue-400 font-bold">{subtotalWork.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest pt-1 font-bold font-bold font-bold"><span>Základ dane:</span><span className="text-white font-bold">{subtotal.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b-2 border-zinc-800 pb-3 font-bold font-bold font-bold"><span>DPH (23%):</span><span className="text-white font-bold">{tax.toFixed(2)} €</span></div>
              <div className="flex justify-between w-80 pt-4 font-bold font-bold font-bold font-bold font-bold font-bold font-bold font-bold"><span className="text-red-600 font-black uppercase italic tracking-tighter text-xl leading-none font-bold">Spolu k úhrade:</span><span className="text-4xl font-black italic tracking-tighter leading-none font-bold">{total.toFixed(2)} €</span></div>
            </div>
          </div>
        </div>

        {/* TLAČIDLO UZAVRIEŤ ZÁKAZKU - DOMINANTNÉ NA KONCI */}
        <div className="mt-12 no-print">
            <button 
                onClick={() => setIsInvoiceModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-[2rem] uppercase text-sm tracking-[0.4em] shadow-2xl transition-all italic hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-4 shadow-blue-900/40"
            >
                <span className="text-2xl">💰</span> UZAVRIEŤ ZÁKAZKU A VYÚČTOVAŤ
            </button>
        </div>

        <div className="grid grid-cols-2 gap-20 mt-20 text-center font-black italic tracking-[0.4em] uppercase font-bold font-bold font-bold font-bold">
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 font-bold font-bold">Pečiatka a podpis servisu</div>
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 font-bold font-bold">Podpis zákazníka</div>
        </div>
      </div>

      {/* MODAL FAKTURÁCIA */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl">
            <h3 className="text-4xl font-black uppercase italic mb-6 tracking-tighter text-white font-bold">Finalizácia zákazky</h3>
            <p className="text-zinc-500 text-xs mb-10 font-black uppercase tracking-widest leading-relaxed font-bold italic">
                Chcete vytvoriť oficiálnu faktúru alebo iba odložiť doklad o servise?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                disabled={invoiceLoading}
                onClick={() => handleFinalizeJob(true)} 
                className="bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all italic shadow-xl flex flex-col items-center gap-2"
              >
                <span className="text-xl">📄</span> VYSTAVIŤ FAKTÚRU
                <span className="text-[8px] opacity-50">Číslo: DDMMRRCCC</span>
              </button>
              <button 
                disabled={invoiceLoading}
                onClick={() => handleFinalizeJob(false)} 
                className="bg-zinc-800 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all italic flex flex-col items-center gap-2"
              >
                <span className="text-xl">📂</span> IBA ODLOŽIŤ
                <span className="text-[8px] opacity-50">Číslo: ADDMMRRCCC</span>
              </button>
            </div>
            <button 
                onClick={() => setIsInvoiceModalOpen(false)}
                className="mt-8 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all italic"
            >
                Späť k úpravám
            </button>
          </div>
        </div>
      )}

      {/* MODAL MAZANIA */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl font-bold font-bold font-bold font-bold">
            <h3 className="text-xl font-black uppercase italic mb-4 tracking-tighter text-white font-bold font-bold font-bold">Vymazať zákazku?</h3>
            <p className="text-zinc-500 text-xs mb-8 font-black uppercase tracking-widest leading-relaxed font-bold font-bold font-bold">Odstráni celý záznam z databázy.</p>
            <div className="flex flex-col gap-3 font-black font-bold font-bold font-bold">
              <button onClick={deleteWholeJob} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all italic font-bold">Definitívne vymazať</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] hover:text-white transition-all italic tracking-widest font-bold">Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT STYLES */}
      <style jsx global>{`
        .print-block { display: none; }
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          .printable-area { border: none !important; box-shadow: none !important; background: white !important; width: 100% !important; max-width: none !important; color: black !important; padding: 0 !important; }
          .bg-zinc-900, .bg-black, .bg-black/30, .bg-zinc-800/50, .bg-zinc-800/20, .bg-zinc-900/30 { background: white !important; }
          .text-white, .text-zinc-300, .text-zinc-400, .text-zinc-500, .text-zinc-600 { color: black !important; }
          .border-zinc-800, .border-zinc-700 { border-color: #ddd !important; }
          .text-red-600 { color: #dc2626 !important; font-weight: 900 !important; }
          .text-blue-400, .text-orange-400 { color: black !important; border-color: #000 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}