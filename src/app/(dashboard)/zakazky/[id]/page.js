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
  const [loading, setLoading] = useState(true);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
    }
  }, [id]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchDetail(), fetchItems(), fetchTasks()]);
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
        // Pre istotu konvertujeme hodnoty na skutočný boolean
        const formattedTasks = data.map(t => ({
          ...t,
          is_completed: t.is_completed === true || t.is_completed === 'true'
        }));
        setTasks(formattedTasks);
      }
    } catch (err) { console.error("Chyba úkonov:", err.message); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const { error } = await supabase.from('job_tasks').insert([{ job_id: id, task_description: newTaskText, is_completed: false }]);
    if (!error) {
      setNewTaskText('');
      fetchTasks();
    }
  };

  // --- OPRAVENÁ FUNKCIA PREPÍNANIA STAVU ---
  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = !currentStatus;

    // 1. OKAMŽITÁ AKTUALIZÁCIA V UI (aby si hneď videl zmenu farby)
    setTasks(prevTasks => 
      prevTasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t)
    );

    // 2. AKTUALIZÁCIA V DATABÁZE
    const { error } = await supabase
      .from('job_tasks')
      .update({ is_completed: newStatus })
      .eq('id', taskId);
    
    if (error) {
      console.error("Chyba DB:", error.message);
      // Ak nastane chyba, vrátime pôvodný stav
      fetchTasks();
    }
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
    if (!error) fetchTasks();
  };

  const deleteWholeJob = async () => {
    try {
      const { error } = await supabase.from('job_tickets').delete().eq('id', id);
      if (error) throw error;
      router.push('/zakazky');
    } catch (err) { alert("Chyba pri mazaní: " + err.message); }
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
      
      {/* OVLÁDANIE */}
      <div className="flex justify-between items-center mb-8 no-print max-w-5xl mx-auto gap-4">
        <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest">← Späť</button>
        <div className="flex gap-3">
          <button onClick={() => setIsDeleteModalOpen(true)} className="bg-zinc-900 border border-red-900/30 text-red-900 hover:bg-red-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest">🗑️ Vymazať</button>
          <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest">🖨️ Tlačiť protokol</button>
        </div>
      </div>

      <div className="printable-area bg-zinc-900 border border-zinc-800 p-8 md:p-16 rounded-[3rem] shadow-2xl max-w-5xl mx-auto text-white">
        
        {/* LOGO A INFO */}
        <div className="flex justify-between items-start border-b-2 border-red-600 pb-8 mb-8">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">AutoAlma <span className="text-red-600">Servis</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Slovenská ulica 12, Košice | www.autoalma.sk</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Zákazkový list</p>
            <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">#{zakazka.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* INFO BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-b border-zinc-800 pb-8">
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dátum</p><p>{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Zodp. Mechanik</p><p className="text-red-500 uppercase italic">{zakazka.technician_name || 'Pridelený tím'}</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Tachometer</p><p>{zakazka.mileage || '---'} km</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">ŠPZ Vozidla</p><p className="text-xl tracking-widest italic">{zakazka.plate_number}</p></div>
        </div>

        {/* KLIENT A VOZIDLO DETAIL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          <div className="space-y-4">
             <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">Partner a Technika</h2>
             <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div>
                  <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">{zakazka.customer_name}</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">{zakazka.customer_phone} | {zakazka.customer_email}</p>
                </div>
                {(zakazka.ico || zakazka.company_name) && (
                  <div className="pt-4 border-t border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-400">
                    <p className="text-white mb-1">{zakazka.company_name}</p>
                    <p>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
                    <p>IČ DPH: {zakazka.ic_dph || '---'}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-800/50">
                  <p className="text-lg font-black uppercase text-zinc-300 italic tracking-tight leading-none">{zakazka.car_brand_model}</p>
                  <p className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase mt-1">VIN: {zakazka.vin_number || '---'}</p>
                </div>
             </div>
          </div>

          {/* CHECKLIST ÚKONOV - FINÁLNA FAREBNÁ LOGIKA */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
                <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
                <span className="text-[9px] font-black text-zinc-500 uppercase">{tasks.filter(t => t.is_completed === true).length} / {tasks.length} HOTOVO</span>
            </div>
            <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
              {tasks.map((task) => {
                const done = task.is_completed === true;

                return (
                  <div 
                    key={task.id} 
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      done 
                        ? 'bg-green-600/10 border-green-600 text-green-500 shadow-[0_0_15px_rgba(22,163,74,0.1)]' 
                        : 'bg-red-600/5 border-red-600/40 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.05)]'
                    }`}
                  >
                    <div 
                      className="flex items-center gap-4 cursor-pointer flex-grow no-print" 
                      onClick={() => toggleTaskStatus(task.id, task.is_completed)}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        done 
                          ? 'bg-green-600 border-green-600 shadow-lg shadow-green-900/40' 
                          : 'bg-transparent border-red-600'
                      }`}>
                        {done ? (
                          <span className="text-white text-xs font-black">✓</span>
                        ) : (
                          <span className="text-red-600 text-[10px] font-black uppercase tracking-tighter">X</span>
                        )}
                      </div>
                      
                      <span className={`text-sm font-black uppercase tracking-tight italic ${done ? 'line-through opacity-50' : ''}`}>
                        {task.task_description}
                      </span>
                    </div>

                    <button 
                      onClick={() => deleteTask(task.id)} 
                      className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              
              <form onSubmit={addTask} className="flex gap-2 mt-4 no-print">
                <input 
                  type="text" 
                  value={newTaskText} 
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="+ Pridať ďalšiu úlohu..." 
                  className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all font-black italic tracking-widest"
                />
                <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
              </form>

              <div className="hidden print-block space-y-2">
                {tasks.map(t => (
                   <p key={t.id} className="text-xs uppercase font-bold text-black flex gap-2">
                     <span>{t.is_completed === true ? '[X]' : '[  ]'}</span> {t.task_description}
                   </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TABUĽKA POLOŽIEK */}
        <div className="space-y-4 mb-12">
          <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">2. Rozpis materiálu a servisných prác</h2>
          <div className="bg-black/30 rounded-3xl border border-zinc-800 overflow-hidden shadow-inner">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 font-bold tracking-widest italic">
                <tr>
                  <th className="p-4 w-24">Typ</th>
                  <th className="p-4">Položka / Úkon</th>
                  <th className="p-4 text-center w-24">Množstvo</th>
                  <th className="p-4 text-right">Cena/J</th>
                  <th className="p-4 text-right">Spolu</th>
                  <th className="p-4 text-center no-print w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-black italic uppercase">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4">
                      <span className={`text-[8px] font-black px-2 py-1 rounded uppercase border ${item.type === 'Práca' ? 'bg-blue-900/30 text-blue-400 border-blue-800 shadow-lg' : 'bg-orange-900/30 text-orange-400 border-orange-800 shadow-lg'}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="p-4 font-black uppercase text-xs tracking-tight">{item.name}</td>
                    <td className="p-4 text-center font-mono text-xs">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-right font-mono text-xs">{parseFloat(item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-right font-black text-xs">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-center no-print">
                      <button onClick={() => deleteItem(item.id)} className="text-zinc-800 hover:text-red-600 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
                
                <tr className="no-print bg-black/50 border-t-2 border-red-600/20">
                  <td className="p-3">
                    <select className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-[9px] font-black uppercase outline-none focus:border-red-600 cursor-pointer" value={newItem.type} onChange={(e) => setNewItem({...newItem, type: e.target.value})}>
                      <option value="Materiál">MATERIÁL</option>
                      <option value="Práca">PRÁCA</option>
                    </select>
                  </td>
                  <td className="p-3"><input type="text" placeholder="Názov položky..." className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs font-black uppercase italic" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} /></td>
                  <td className="p-3 flex gap-1">
                    <input type="number" className="w-14 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-center text-xs font-bold" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
                    <select className="bg-zinc-900 border border-zinc-800 p-1 rounded-lg text-[8px] font-black uppercase outline-none" value={newItem.unit} onChange={(e) => setNewItem({...newItem, unit: e.target.value})}>
                      <option value="ks">ks</option><option value="hod">hod</option><option value="l">l</option>
                    </select>
                  </td>
                  <td className="p-3 w-32"><input type="number" placeholder="Cena" className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-right text-xs font-black outline-none focus:border-red-600" value={newItem.unit_price} onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value)})} /></td>
                  <td className="p-3"><button onClick={addItem} className="w-full bg-red-600 text-white font-black py-3 rounded-xl hover:bg-red-500 transition-all shadow-xl text-lg">+</button></td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>

            <div className="p-8 bg-zinc-800/20 flex flex-col items-end space-y-3 font-black italic uppercase">
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest"><span>Materiál (Základ):</span><span className="text-white">{subtotalMaterial.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-3"><span>Práca (Základ):</span><span className="text-blue-400">{subtotalWork.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest pt-1"><span>Základ dane:</span><span className="text-white">{subtotal.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b-2 border-zinc-800 pb-3"><span>DPH (23%):</span><span className="text-white">{tax.toFixed(2)} €</span></div>
              <div className="flex justify-between w-80 pt-4"><span className="text-red-600 font-black uppercase italic tracking-tighter text-xl leading-none">Spolu k úhrade:</span><span className="text-4xl font-black italic tracking-tighter leading-none">{total.toFixed(2)} €</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-20 mt-20 text-center font-black italic tracking-[0.4em] uppercase">
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500">Pečiatka a podpis servisu</div>
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500">Podpis zákazníka</div>
        </div>
      </div>

      {/* MODAL MAZANIA */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-black uppercase italic mb-4 tracking-tighter text-white">Vymazať zákazku?</h3>
            <p className="text-zinc-500 text-xs mb-8 font-black uppercase tracking-widest leading-relaxed">Táto akcia natrvalo odstráni celý záznam.</p>
            <div className="flex flex-col gap-3 font-black">
              <button onClick={deleteWholeJob} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all italic">Definitívne vymazať</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] hover:text-white transition-all italic tracking-widest">Zrušiť</button>
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