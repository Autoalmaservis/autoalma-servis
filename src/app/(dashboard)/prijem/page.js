'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';

function PrijemForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // 1. STAVY - PRIDANÉ POLE PRE ÚKONY (TASKS)
  const [formData, setFormData] = useState({
    customer_name: searchParams.get('klient') || '',
    plate_number: searchParams.get('spz') || '',
    status: 'Prebieha', 
    car_brand_model: '',
    vin_number: '',
    customer_phone: '',
    customer_email: '',
    address: '',
    city: '',
    zip: '',
    client_type: 'Osoba',
    company_name: '', 
    ico: '',          
    dic: '',          
    ic_dph: '',
    assigned_worker_id: '',
    technician_name: ''
  });

  const [tasks, setTasks] = useState([{ description: '' }]); // Pole úkonov
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  // 2. NAČÍTANIE ZAMESTNANCOV
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true);
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  // 3. LOGIKA AUTODOPLNENIA (ZACHOVANÁ)
  useEffect(() => {
    const autoDoplnenie = async () => {
      if (formData.plate_number && formData.plate_number.length >= 4) {
        const { data: vData } = await supabase.from('vehicles').select('*').eq('license_plate', formData.plate_number.toUpperCase()).maybeSingle();
        if (vData) {
          const { data: pData } = await supabase.from('user_profiles').select('*').eq('id', vData.owner_id).maybeSingle();
          setFormData(prev => ({
            ...prev,
            car_brand_model: vData.brand_model || '',
            vin_number: vData.vin || '',
            customer_name: vData.owner_name || prev.customer_name,
            customer_email: vData.owner_email || prev.customer_email,
            customer_phone: pData?.phone || prev.customer_phone,
            address: pData?.address || '',
            city: pData?.city || '',
            zip: pData?.zip || '',
            company_name: pData?.company_name || '',
            ico: pData?.ico || '',
            dic: pData?.dic || '',
            ic_dph: pData?.ic_dph || '',
            client_type: pData?.company_name ? 'Firma' : 'Osoba'
          }));
          return;
        }
        const { data: jData } = await supabase.from('job_tickets').select('*').eq('plate_number', formData.plate_number.toUpperCase()).neq('plate_number', 'NOVÝ-KLIENT').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (jData) {
          setFormData(prev => ({
            ...prev,
            car_brand_model: jData.car_brand_model || '',
            vin_number: jData.vin_number || '',
            customer_phone: jData.customer_phone || '',
            customer_name: jData.customer_name || prev.customer_name,
            customer_email: jData.customer_email || '',
            address: jData.address || '',
            city: jData.city || '',
            zip: jData.zip || '',
            company_name: jData.company_name || '',
            ico: jData.ico || '',
            dic: jData.dic || '',
            ic_dph: jData.ic_dph || ''
          }));
        }
      }
    };
    autoDoplnenie();
  }, [formData.plate_number]);

  // MANIPULÁCIA S ÚKONMI
  const addTaskRow = () => setTasks([...tasks, { description: '' }]);
  const removeTaskRow = (index) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTask = (index, val) => {
    const newTasks = [...tasks];
    newTasks[index].description = val;
    setTasks(newTasks);
  };

  // 4. LOGIKA UKLADANIA (DVOJFÁZOVÁ)
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Filter prázdnych úkonov
    const finalTasks = tasks.filter(t => t.description.trim() !== '');
    if (finalTasks.length === 0) {
      alert("Pridajte aspoň jeden servisný úkon!");
      setLoading(false);
      return;
    }

    // A. Vytvorenie zákazky
    const { data: job, error: jobError } = await supabase
      .from('job_tickets')
      .insert([{ ...formData, updated_at: new Date() }])
      .select()
      .single();

    if (jobError) {
      alert("Chyba lístka: " + jobError.message);
      setLoading(false);
      return;
    }

    // B. Hromadné pridanie úkonov do job_tasks
    const tasksToInsert = finalTasks.map(t => ({
      job_id: job.id,
      task_description: t.description,
      is_completed: false
    }));

    const { error: tasksError } = await supabase.from('job_tasks').insert(tasksToInsert);

    if (!tasksError) {
      alert("Zákazka s úkonmi úspešne vytvorená!");
      router.push('/zakazky'); 
    } else {
      alert("Chyba pri ukladaní úkonov: " + tasksError.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white font-sans font-bold">
      <header className="mb-12 border-l-4 border-blue-600 pl-6 text-white font-black uppercase italic tracking-tighter leading-none">
        <h1 className="text-3xl font-black">Nový <span className="text-blue-600">Zákazkový List</span></h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Príjem vozidla a definícia prác</p>
      </header>

      <form onSubmit={handleSave} className="max-w-[1200px] bg-zinc-900/40 border border-zinc-800 p-10 rounded-[3rem] shadow-2xl space-y-10">
        
        {/* SEKCIA: VOZIDLO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-black/30 p-6 rounded-[2rem] border border-zinc-800/50">
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-red-600 uppercase mb-3 ml-2 block tracking-widest italic font-bold">ŠPZ Vozidla</label>
            <input required type="text" value={formData.plate_number} onChange={(e) => setFormData({...formData, plate_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-red-600 outline-none transition-all shadow-xl uppercase" placeholder="KE123AB" />
          </div>
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 ml-2 block tracking-widest font-bold">Značka a Model</label>
            <input type="text" value={formData.car_brand_model} onChange={(e) => setFormData({...formData, car_brand_model: e.target.value})} className="w-full bg-black border border-zinc-800 p-6 rounded-2xl text-white font-bold outline-none focus:border-blue-600 h-[78px]" placeholder="BMW M3" />
          </div>
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 ml-2 block tracking-widest font-bold">VIN Číslo</label>
            <input type="text" maxLength={17} value={formData.vin_number} onChange={(e) => setFormData({...formData, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-6 rounded-2xl text-white font-mono font-bold outline-none focus:border-blue-600 h-[78px]" placeholder="VIN KÓD" />
          </div>
        </div>

        {/* SEKCIA: KLIENT - 3 STĹPCE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
             <label className="text-[10px] font-black text-zinc-600 uppercase ml-2 block tracking-widest">Osobné údaje</label>
             <input required type="text" value={formData.customer_name} onChange={(e) => setFormData({...formData, customer_name: e.target.value})} placeholder="Meno zákazníka" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             <input type="tel" value={formData.customer_phone} onChange={(e) => setFormData({...formData, customer_phone: e.target.value})} placeholder="Telefón" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             <input type="email" value={formData.customer_email} onChange={(e) => setFormData({...formData, customer_email: e.target.value})} placeholder="Email" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
          </div>
          
          <div className="space-y-4">
             <label className="text-[10px] font-black text-zinc-600 uppercase ml-2 block tracking-widest">Adresa trvalého pobytu</label>
             <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Ulica a súpisné č." className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             <div className="grid grid-cols-2 gap-2">
                <input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} placeholder="Mesto" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
                <input type="text" value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} placeholder="PSČ" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             </div>
          </div>

          <div className="space-y-4 bg-black/20 p-5 rounded-3xl border border-zinc-800/50 shadow-inner">
             <label className="text-[10px] font-black text-blue-500 uppercase ml-2 block tracking-widest italic font-bold">Fakturačné údaje firmy</label>
             <input type="text" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} placeholder="Obchodné meno (Firma)" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             <input type="text" value={formData.ico} onChange={(e) => setFormData({...formData, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             <div className="grid grid-cols-2 gap-2">
                <input type="text" value={formData.dic} onChange={(e) => setFormData({...formData, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
                <input type="text" value={formData.ic_dph} onChange={(e) => setFormData({...formData, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600" />
             </div>
          </div>
        </div>

        {/* SEKUNDÁRNA ČASŤ: MECHANIK A POLOŽKY PRÁCE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="bg-black/30 p-6 rounded-[2rem] border border-zinc-800/50 h-full">
              <label className="text-[10px] font-black text-blue-400 uppercase mb-4 ml-2 block tracking-widest font-black">Pridelený Mechanik</label>
              <select required value={formData.assigned_worker_id} onChange={(e) => {
                const selectedEmp = employees.find(emp => emp.id === e.target.value);
                setFormData({ ...formData, assigned_worker_id: e.target.value, technician_name: selectedEmp ? selectedEmp.name : '' });
              }} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 appearance-none cursor-pointer">
                <option value="">-- Vyberte mechanika --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-black/30 p-8 rounded-[2rem] border border-zinc-800/50 shadow-inner space-y-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 block tracking-widest font-black">Zoznam servisných úkonov (Checklist pre mechanika)</label>
                <button type="button" onClick={addTaskRow} className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] px-4 py-2 rounded-xl transition-all font-black uppercase">+ Pridať úkon</button>
              </div>
              
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <div key={index} className="flex gap-3 animate-in slide-in-from-left duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex-none bg-zinc-800 text-zinc-500 w-12 h-14 flex items-center justify-center rounded-xl font-black">{index + 1}.</div>
                    <input 
                      required 
                      type="text" 
                      value={task.description} 
                      onChange={(e) => updateTask(index, e.target.value)} 
                      placeholder="Napr. Výmena oleja a filtra..." 
                      className="flex-grow bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-600"
                    />
                    {tasks.length > 1 && (
                      <button type="button" onClick={() => removeTaskRow(index)} className="flex-none bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white w-12 h-14 flex items-center justify-center rounded-xl transition-all">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-7 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all disabled:opacity-50">
          {loading ? 'Generujem zákazku...' : 'Otvoriť nový servisný prípad'}
        </button>
      </form>
    </div>
  );
}

export default function PrijemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase tracking-widest animate-pulse">Pripravujem formulár...</div>}>
      <PrijemForm />
    </Suspense>
  );
}