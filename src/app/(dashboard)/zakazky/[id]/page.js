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
  
  // --- NOVÉ STAVY PRE KATALÓG, SADZBY A CENOVÉ PONUKY ---
  const [catalog, setCatalog] = useState([]);
  const [globalRates, setGlobalRates] = useState({ m1: 0, m2: 0, e1: 0, e2: 0 });
  const [activeOffer, setActiveOffer] = useState(null);

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

  // --- REAL-TIME ODBERY (Postrážené, aby nič nevypadlo) ---
  useEffect(() => {
    if (id) {
      loadAllData();

      const subscription = supabase
        .channel(`job-detail-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tasks', filter: `job_id=eq.${id}` }, () => { fetchTasks(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_tickets', filter: `id=eq.${id}` }, () => { fetchDetail(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_items', filter: `job_id=eq.${id}` }, () => { fetchItems(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'price_offers', filter: `job_id=eq.${id}` }, () => { fetchCurrentOffer(); })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [id]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDetail(), 
      fetchItems(), 
      fetchTasks(), 
      fetchEmployees(), 
      fetchCatalog(),
      fetchSettings(),
      fetchCurrentOffer()
    ]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*');
    if (data) {
      setGlobalRates({
        m1: parseFloat(data.find(s => s.id === 'rate_m1')?.value || 0),
        m2: parseFloat(data.find(s => s.id === 'rate_m2')?.value || 0),
        e1: parseFloat(data.find(s => s.id === 'rate_e1')?.value || 0),
        e2: parseFloat(data.find(s => s.id === 'rate_e2')?.value || 0),
      });
    }
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

  const fetchCatalog = async () => {
    const { data } = await supabase.from('inventory_catalog').select('*').order('name', { ascending: true });
    if (data) setCatalog(data);
  };

  const fetchCurrentOffer = async () => {
    const { data } = await supabase
      .from('price_offers')
      .select('*')
      .eq('job_id', id)
      .not('status', 'eq', 'Preklopené')
      .maybeSingle();
    setActiveOffer(data || null);
  };

  const createPriceOffer = async () => {
    if (items.length === 0) {
      alert("Najprv pridajte položky do rozpisu, ktoré chcete poslať na schválenie.");
      return;
    }
    const { subtotal } = calculateTotal();
    const { data, error } = await supabase.from('price_offers').insert([{
      job_id: id,
      items_json: items,
      total_amount: subtotal,
      status: 'Odoslané'
    }]).select().single();

    if (!error) {
      setActiveOffer(data);
      const link = `${window.location.origin}/ponuka/${data.id}`;
      prompt("Cenová ponuka vytvorená! Link pre zákazníka:", link);
    }
  };

  const convertOfferToItems = async () => {
    if (!activeOffer || activeOffer.status !== 'Schválené') return;
    if (!confirm("Položky z ponuky sa pridajú do rozpisu zákazky. Pokračovať?")) return;

    try {
      const itemsToInsert = activeOffer.items_json.map(item => {
        const { id: oldId, created_at, job_id: oldJobId, ...cleanItem } = item;
        return { ...cleanItem, job_id: id };
      });

      const { error: insertError } = await supabase.from('job_items').insert(itemsToInsert);
      if (insertError) throw insertError;

      await supabase.from('price_offers').update({ status: 'Preklopené' }).eq('id', activeOffer.id);
      
      setActiveOffer(null);
      fetchItems();
      alert("Položky z ponuky boli úspešne pridané do zákazky.");
    } catch (err) {
      alert("Chyba pri preklápaní: " + err.message);
    }
  };

  const syncToCatalog = async (item) => {
    if (['M1', 'M2', 'E1', 'E2'].includes(item.type)) return;
    const payload = {
      name: item.name.trim().toUpperCase(),
      unit_price: item.unit_price,
      unit: item.unit,
      type: item.type === 'Práca' ? 'práca' : 'materiál'
    };
    await supabase.from('inventory_catalog').upsert([payload], { onConflict: 'name,type' });
    fetchCatalog();
  };

  const updateJobStatus = async (newStatus) => {
    const { error } = await supabase.from('job_tickets').update({ status: newStatus, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, status: newStatus }));
    else alert("Chyba pri zmene stavu: " + error.message);
  };

  const updateMechanic = async (employeeId) => {
    const selectedEmp = employees.find(e => e.id === employeeId);
    if (!selectedEmp) return;
    const { error } = await supabase.from('job_tickets').update({ assigned_worker_id: employeeId, technician_name: selectedEmp.name, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, assigned_worker_id: employeeId, technician_name: selectedEmp.name }));
  };

  // --- TU JE OPRAVENÁ FUNKCIA HANDLE FINALIZE JOB ---
  const handleFinalizeJob = async (isOfficial) => {
    setInvoiceLoading(true);
    try {
      const { subtotal, tax, total } = calculateTotal();
      
      const invoicePayload = {
        invoice_number: `F${Date.now()}`, 
        job_id: id,
        customer_name: zakazka.customer_name,
        customer_email: zakazka.customer_email || null,
        customer_phone: zakazka.customer_phone || null,
        items_json: items,
        subtotal_amount: subtotal || 0, // DOPLNENÉ
        tax_amount: tax || 0,           // DOPLNENÉ
        total_amount: total || 0,       // OPRAVENÉ
        is_official: isOfficial,
        // Pridávame detaily pre históriu
        company_details: { 
          company_name: zakazka.company_name, 
          ico: zakazka.ico, 
          dic: zakazka.dic 
        },
        car_details: { 
          brand: zakazka.car_brand_model, 
          plate: zakazka.plate_number, 
          vin: zakazka.vin_number,
          mileage: zakazka.mileage
        }
      };

      const { error: invError } = await supabase.from('invoices').insert([invoicePayload]);
      if (invError) throw invError;

      await updateJobStatus('Archivované');
      router.push('/faktury');
    } catch (err) { 
      alert("Chyba pri vytváraní faktúry: " + err.message); 
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
    
    let itemToSave = { ...newItem };
    if (['M1', 'M2', 'E1', 'E2'].includes(newItem.type)) {
        itemToSave.name = `SERVISNÁ PRÁCA ${newItem.type}`;
        itemToSave.unit_price = globalRates[newItem.type.toLowerCase()] || 0;
        itemToSave.type = 'Práca';
        itemToSave.unit = 'hod';
    }

    syncToCatalog(itemToSave);

    const { error } = await supabase.from('job_items').insert([{ ...itemToSave, job_id: id }]);
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

  if (!zakazka) return <div className="min-h-screen bg-black flex items-center justify-center">ZÁKAZKA NENÁJDENÁ</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-12 relative font-sans font-bold">
      
      {/* OVLÁDANIE - TOP BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 no-print max-w-5xl mx-auto gap-4">
        <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest">← Späť</button>
        
        <div className="flex bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 gap-2">
            <button onClick={() => updateJobStatus('Prebieha')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Prebieha' ? 'bg-amber-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Prebieha</button>
            <button onClick={() => updateJobStatus('Dokončené')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Dokončené' ? 'bg-green-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Dokončené</button>
            <button onClick={() => updateJobStatus('Archivované')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Archivované' ? 'bg-zinc-700 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Archivovať</button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsDeleteModalOpen(true)} className="bg-zinc-900 border border-red-900/30 text-red-900 hover:bg-red-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest font-bold">🗑️ Vymazať</button>
          <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest font-bold">🖨️ Tlačiť protokol</button>
        </div>
      </div>

      <div className="printable-area bg-zinc-900 border border-zinc-800 p-8 md:p-16 rounded-[3rem] shadow-2xl max-w-5xl mx-auto text-white">
        
        {/* LOGO A INFO */}
        <div className="flex justify-between items-start border-b-2 border-red-600 pb-8 mb-8 font-bold">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">AutoAlma <span className="text-red-600">Servis</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic uppercase">Slovenská ulica 12, Košice | www.autoalma.sk</p>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border inline-block mb-3 ${zakazka.status === 'Dokončené' ? 'border-green-600 text-green-500' : 'border-amber-600 text-amber-500'}`}>{zakazka.status}</span>
            <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Zákazkový list</p>
            <p className="text-2xl font-black uppercase italic tracking-tighter leading-none font-bold">#{zakazka.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* INFO BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-b border-zinc-800 pb-8 font-bold">
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dátum príjmu</p><p className="font-bold">{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</p></div>
          <div className="relative group">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Zodp. Mechanik</p>
            <div className="relative no-print">
                <select 
                  className="bg-black/40 border-2 border-zinc-700 hover:border-red-600 rounded-xl px-3 py-2 text-[11px] font-black uppercase text-red-600 outline-none cursor-pointer appearance-none w-full"
                  value={zakazka.assigned_worker_id || ''}
                  onChange={(e) => updateMechanic(e.target.value)}
                >
                  <option value="" disabled>VYBRAŤ...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-zinc-900 text-white font-sans not-italic font-bold">{emp.name.toUpperCase()}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-red-600 text-[8px]">▼</div>
            </div>
            <p className="hidden print-block text-red-600 uppercase italic font-black text-sm">{zakazka.technician_name || 'Pridelený tím'}</p>
          </div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">KM</p><p className="font-bold">{zakazka.mileage || '---'} km</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">ŠPZ</p><p className="text-xl tracking-widest italic font-black uppercase">{zakazka.plate_number}</p></div>
        </div>

        {/* --- BOX CENOVÁ PONUKA --- */}
        {activeOffer && (
          <div className={`mb-10 p-8 rounded-[2.5rem] border-2 flex flex-col md:flex-row justify-between items-center shadow-2xl no-print gap-6 ${activeOffer.status === 'Schválené' ? 'bg-green-600/10 border-green-600 animate-pulse' : 'bg-blue-600/10 border-blue-600'}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic font-bold">Cenová ponuka</p>
              <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${activeOffer.status === 'Schválené' ? 'text-green-500' : 'text-blue-500'}`}>
                {activeOffer.status === 'Schválené' ? '✅ Zákazník schválil ponuku' : '📩 Ponuka odoslaná na schválenie'}
              </h3>
            </div>
            <div className="flex gap-3">
              {activeOffer.status === 'Schválené' ? (
                <button onClick={convertOfferToItems} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-xl tracking-widest">
                  📥 Preklopiť do zákazky
                </button>
              ) : (
                <button onClick={() => prompt("Link pre zákazníka:", `${window.location.origin}/ponuka/${activeOffer.id}`)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-xl tracking-widest font-bold">
                  🔗 Zdieľať link
                </button>
              )}
            </div>
          </div>
        )}

        {/* KLIENT A CHECKLIST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12 font-bold">
          <div className="space-y-4">
              <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">Partner a Technika</h2>
              <div className="bg-black/30 p-8 rounded-3xl border border-zinc-800 space-y-4">
                <div>
                  <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">{zakazka.customer_name}</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">{zakazka.customer_phone} | {zakazka.customer_email}</p>
                </div>
                {(zakazka.ico || zakazka.company_name) && (
                  <div className="pt-4 border-t border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-400">
                    <p className="text-white mb-1">{zakazka.company_name}</p>
                    <p>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-800/50">
                  <p className="text-lg font-black uppercase text-zinc-300 italic tracking-tight leading-none">{zakazka.car_brand_model}</p>
                  <p className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase mt-1">VIN: {zakazka.vin_number || '---'}</p>
                </div>
              </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
                <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
                <span className="text-[9px] font-black text-zinc-500 uppercase">{tasks.filter(t => t.is_completed === true).length} / {tasks.length} HOTOVO</span>
            </div>
            <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
              {tasks.map((task) => {
                const done = task.is_completed === true;
                return (
                  <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${done ? 'bg-green-600/10 border-green-600 text-green-500 shadow-[0_0_15px_rgba(22,163,74,0.1)]' : 'bg-red-600/5 border-red-600/40 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.05)]'}`}>
                    <div className="flex items-center gap-4 cursor-pointer flex-grow no-print" onClick={() => toggleTaskStatus(task.id, task.is_completed)}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${done ? 'bg-green-600 border-green-600 shadow-lg shadow-green-900/40 font-bold' : 'bg-transparent border-red-600 font-bold'}`}>
                        {done ? <span className="text-white text-xs font-black font-bold">✓</span> : <span className="text-red-600 text-[10px] font-black uppercase tracking-tighter">X</span>}
                      </div>
                      <span className={`text-sm font-black uppercase tracking-tight italic ${done ? 'line-through opacity-50' : ''}`}>{task.task_description}</span>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg">✕</button>
                  </div>
                );
              })}
              <form onSubmit={addTask} className="flex gap-2 mt-4 no-print">
                <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="+ Pridať ďalšiu úlohu..." className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all font-black italic tracking-widest" />
                <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
              </form>
            </div>
          </div>
        </div>

        {/* ROZPIS POLOŽIEK */}
        <div className="space-y-4 mb-12 font-bold">
          <div className="flex justify-between items-center">
            <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">2. Rozpis materiálu a servisných prác</h2>
            {!activeOffer && items.length > 0 && (
              <button onClick={createPriceOffer} className="no-print bg-blue-600/20 border border-blue-600 text-blue-500 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                📝 Vytvoriť cenovú ponuku
              </button>
            )}
          </div>
          <div className="bg-black/30 rounded-3xl border border-zinc-800 overflow-hidden shadow-inner font-bold">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 tracking-widest italic">
                <tr>
                  <th className="p-4 w-32">Typ</th>
                  <th className="p-4">Položka</th>
                  <th className="p-4 text-center w-24">Množ.</th>
                  <th className="p-4 text-right">Cena/J</th>
                  <th className="p-4 text-right font-bold">Spolu</th>
                  <th className="p-4 text-center no-print w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-black italic uppercase font-bold">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4"><span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800 shadow-lg' : 'text-orange-400 border-orange-800 shadow-lg'}`}>{item.type}</span></td>
                    <td className="p-4 font-black uppercase text-xs tracking-tight">{item.name}</td>
                    <td className="p-4 text-center font-mono text-xs">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-right font-mono text-xs">{parseFloat(item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-right font-black text-xs">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-center no-print font-bold"><button onClick={() => deleteItem(item.id)} className="text-zinc-800 hover:text-red-600 transition-colors">✕</button></td>
                  </tr>
                ))}
                
                <tr className="no-print bg-black/50 border-t-2 border-red-600/20">
                  <td className="p-3">
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-[9px] font-black uppercase outline-none focus:border-red-600 cursor-pointer" 
                      value={newItem.type} 
                      onChange={(e) => {
                        const t = e.target.value;
                        setNewItem({...newItem, type: t, unit: t === 'Materiál' ? 'ks' : 'hod'});
                      }}
                    >
                      <option value="Materiál">MATERIÁL</option>
                      <option value="M1">M1</option>
                      <option value="M2">M2</option>
                      <option value="E1">E1</option>
                      <option value="E2">E2</option>
                    </select>
                  </td>
                  <td className="p-3 relative">
                    <input 
                      list="catalog-list"
                      type="text" 
                      placeholder="Názov položky..." 
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs font-black uppercase italic" 
                      value={newItem.name} 
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = catalog.find(c => c.name === val.toUpperCase());
                        if (match) {
                           setNewItem({ ...newItem, name: val, unit_price: match.unit_price, unit: match.unit, type: match.type === 'práca' ? 'Práca' : 'Materiál' });
                        } else {
                           setNewItem({...newItem, name: val});
                        }
                      }} 
                    />
                    <datalist id="catalog-list">
                      {catalog.map((c, i) => (<option key={i} value={c.name}>{c.unit_price} €</option>))}
                    </datalist>
                  </td>
                  <td className="p-3">
                    <input type="number" className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-center text-xs font-bold" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
                  </td>
                  <td className="p-3 w-32">
                    <input 
                      type="number" 
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-right text-xs font-black outline-none" 
                      value={ (['M1', 'M2', 'E1', 'E2'].includes(newItem.type) ? globalRates[newItem.type.toLowerCase()] : newItem.unit_price) || 0 }
                      disabled={['M1', 'M2', 'E1', 'E2'].includes(newItem.type)}
                      onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value)})}
                    />
                  </td>
                  <td className="p-3"><button onClick={addItem} className="w-full bg-red-600 text-white font-black py-3 rounded-xl hover:bg-red-500 transition-all shadow-xl text-lg">+</button></td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
            <div className="p-8 bg-zinc-800/20 flex flex-col items-end space-y-3 font-black italic uppercase font-bold">
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest font-bold"><span>Materiál (Základ):</span><span className="text-white font-bold">{subtotalMaterial.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-3 font-bold"><span>Práca (Základ):</span><span className="text-blue-400 font-bold">{subtotalWork.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest pt-1 font-bold"><span>Základ dane:</span><span className="text-white font-bold">{subtotal.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b-2 border-zinc-800 pb-3 font-bold"><span>DPH (23%):</span><span className="text-white font-bold">{tax.toFixed(2)} €</span></div>
              <div className="flex justify-between w-80 pt-4 font-bold"><span className="text-red-600 font-black uppercase italic tracking-tighter text-xl leading-none font-bold">Spolu k úhrade:</span><span className="text-4xl font-black italic tracking-tighter leading-none font-bold">{total.toFixed(2)} €</span></div>
            </div>
          </div>
        </div>

        {/* TLAČIDLO UZAVRETIA */}
        <div className="mt-12 no-print font-bold">
            <button 
                onClick={() => setIsInvoiceModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-[2rem] uppercase text-sm tracking-[0.4em] shadow-2xl transition-all italic hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-4 shadow-blue-900/40"
            >
                <span className="text-2xl font-bold">💰</span> UZAVRIEŤ ZÁKAZKU A VYÚČTOVAŤ
            </button>
        </div>

        <div className="grid grid-cols-2 gap-20 mt-20 text-center font-black italic tracking-[0.4em] uppercase font-bold">
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 font-bold">Pečiatka a podpis servisu</div>
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 font-bold">Podpis zákazníka</div>
        </div>
      </div>

      {/* MODAL FAKTURÁCIA */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl">
            <h3 className="text-4xl font-black uppercase italic mb-6 tracking-tighter text-white font-bold">Finalizácia zákazky</h3>
            <p className="text-zinc-500 text-xs mb-10 font-black uppercase tracking-widest leading-relaxed font-bold italic">Chcete vytvoriť oficiálnu faktúru alebo iba odložiť doklad o servise?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold">
              <button disabled={invoiceLoading} onClick={() => handleFinalizeJob(true)} className="bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all italic shadow-xl flex flex-col items-center gap-2 font-bold">📄 VYSTAVIŤ FAKTÚRU</button>
              <button disabled={invoiceLoading} onClick={() => handleFinalizeJob(false)} className="bg-zinc-800 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all italic flex flex-col items-center gap-2 font-bold">📂 IBA ODLOŽIŤ</button>
            </div>
            <button onClick={() => setIsInvoiceModalOpen(false)} className="mt-8 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all italic font-bold">Späť k úpravám</button>
          </div>
        </div>
      )}

      {/* MODAL MAZANIA */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-sm w-full text-center shadow-2xl font-bold">
            <h3 className="text-xl font-black uppercase italic mb-4 tracking-tighter text-white font-bold">Vymazať zákazku?</h3>
            <div className="flex flex-col gap-3 font-black font-bold">
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