'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import SmsPanel from './SmsPanel';

function PrijemForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    customer_name: searchParams.get('meno') || '', 
    plate_number: searchParams.get('spz') || '',
    status: 'Prebieha', 
    car_brand_model: '',
    vin_number: '',
    mileage: '', 
    engine_volume: '', 
    engine_power: '', 
    year_produced: '', 
    fuel_type: 'Diesel',
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
    technician_name: '',
    customer_id: null 
  });

  const [tasks, setTasks] = useState([{ description: '' }]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true);
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  // --- NOVÁ LOGIKA: PREVZATIE ZÁVAD Z KALENDÁRA ---
  useEffect(() => {
    const fetchCalendarInfo = async () => {
      const spz = searchParams.get('spz');
      if (!spz) return;

      const { data: calData } = await supabase
        .from('calendar_events')
        .select('issue_description')
        .eq('plate_number', spz.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (calData?.issue_description) {
        const lines = calData.issue_description
          .split('\n')
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(line => line !== '');

        if (lines.length > 0) {
          setTasks(lines.map(l => ({ description: l })));
        }
      }
    };
    fetchCalendarInfo();
  }, [searchParams]);

  useEffect(() => {
    const autoDoplnenie = async () => {
      const spzToQuery = formData.plate_number || searchParams.get('spz');
      const menoFromUrl = searchParams.get('meno');

      if (spzToQuery && spzToQuery.length >= 4) {
        const { data: vData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('license_plate', spzToQuery.toUpperCase())
          .maybeSingle();
        
        if (vData) {
          const menoMajitela = menoFromUrl || vData.owner_name;
          
          const { data: pData } = await supabase
            .from('user_profiles')
            .select('*')
            .or(`full_name.eq."${menoMajitela}",company_name.eq."${menoMajitela}",email.eq."${vData.owner_email}"`)
            .maybeSingle();
          
          setFormData(prev => ({
            ...prev,
            plate_number: vData.license_plate,
            car_brand_model: vData.brand_model || '',
            vin_number: vData.vin_number || '', 
            mileage: vData.mileage || '',
            engine_volume: vData.engine_volume || '', 
            engine_power: vData.engine_power || '',   
            year_produced: vData.year_produced || '', 
            fuel_type: vData.fuel_type || 'Diesel',
            customer_name: menoMajitela || pData?.full_name || prev.customer_name,
            customer_email: pData?.email || vData.owner_email || prev.customer_email,
            customer_phone: pData?.phone || prev.customer_phone,
            address: pData?.address || '',
            city: pData?.city || '',
            zip: pData?.zip || '',
            company_name: pData?.company_name || '',
            ico: pData?.ico || '',
            dic: pData?.dic || '',
            ic_dph: pData?.ic_dph || '',
            client_type: (pData?.company_name || pData?.ico) ? 'Firma' : 'Osoba',
            customer_id: pData?.id || vData.owner_id || null 
          }));
        }
      }
    };
    autoDoplnenie();
  }, [formData.plate_number, searchParams]);

  const addTaskRow = () => setTasks([...tasks, { description: '' }]);
  const removeTaskRow = (index) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTask = (index, val) => {
    const newTasks = [...tasks];
    newTasks[index].description = val;
    setTasks(newTasks);
  };

  // --- NOVÁ FUNKCIA: GENEROVANIE ČÍSLA ZÁKAZKY ZDDMMRRCCC ---
  const generateFinalJobNumber = async () => {
    const teraz = new Date();
    const dd = String(teraz.getDate()).padStart(2, '0');
    const mm = String(teraz.getMonth() + 1).padStart(2, '0');
    const rr = String(teraz.getFullYear()).slice(-2);
    const dnesnyPrefix = `${dd}${mm}${rr}`;

    const startOfDay = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate()).toISOString();
    
    const { count } = await supabase
      .from('job_tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    const ccc = String((count || 0) + 1).padStart(3, '0');
    return `Z${dnesnyPrefix}${ccc}`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const finalTasks = tasks.filter(t => t.description.trim() !== '');
    if (finalTasks.length === 0) {
      alert("Pridajte aspoň jeden servisný úkon!");
      setLoading(false);
      return;
    }

    // VYGENEROVANIE UNIKÁTNEHO ČÍSLA ZÁKAZKY
    const newJobNumber = await generateFinalJobNumber();

    const payload = {
      job_number: newJobNumber, // ULOŽENIE DO DB
      customer_name: formData.customer_name,
      plate_number: formData.plate_number,
      status: formData.status,
      car_brand_model: formData.car_brand_model,
      vin_number: formData.vin_number,
      mileage: formData.mileage ? parseInt(formData.mileage) : null,
      engine_volume: formData.engine_volume,
      engine_power: formData.engine_power,
      year_produced: formData.year_produced,
      fuel_type: formData.fuel_type,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      address: formData.address,
      city: formData.city,
      zip: formData.zip,
      client_type: formData.client_type,
      company_name: formData.company_name,
      ico: formData.ico,
      dic: formData.dic,
      ic_dph: formData.ic_dph,
      assigned_worker_id: formData.assigned_worker_id || null,
      technician_name: formData.technician_name,
      updated_at: new Date(),
      customer_id: formData.customer_id 
    };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (formData.customer_id && !uuidRegex.test(formData.customer_id)) {
      payload.customer_id = null;
    }

    let { data: job, error: jobError } = await supabase
      .from('job_tickets')
      .insert([payload])
      .select()
      .single();

    if (jobError && jobError.code === '23503') {
      payload.customer_id = null;
      const retry = await supabase.from('job_tickets').insert([payload]).select().single();
      job = retry.data;
      jobError = retry.error;
    }

    if (jobError) {
      alert("Chyba pri ukladaní: " + jobError.message);
      setLoading(false);
      return;
    }

    const tasksToInsert = finalTasks.map(t => ({
      job_id: job.id,
      task_description: t.description,
      is_completed: false
    }));

    const { error: tasksError } = await supabase.from('job_tasks').insert(tasksToInsert);

    if (!tasksError) {
      await supabase.from('vehicles')
        .update({ mileage: payload.mileage || 0 })
        .eq('license_plate', formData.plate_number.toUpperCase());

      alert(`Zákazka ${newJobNumber} úspešne vytvorená!`);
      router.push('/zakazky'); 
    }
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white font-sans font-bold">
      <header className="mb-12 border-l-4 border-blue-600 pl-6 text-white font-black uppercase italic tracking-tighter leading-none">
        <h1 className="text-3xl font-black">Nový <span className="text-blue-600 text-4xl">Zákazkový List</span></h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Otvorenie servisného prípadu</p>
      </header>

      <form onSubmit={handleSave} className="max-w-[1200px] bg-zinc-900/40 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] shadow-2xl space-y-12">
        
        <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-zinc-800/50 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <div>
              <label className="text-[10px] font-black text-red-600 uppercase mb-3 ml-2 block tracking-widest italic">ŠPZ Vozidla</label>
              <input required type="text" value={formData.plate_number} onChange={(e) => setFormData({...formData, plate_number: e.target.value.toUpperCase()})} className="w-full bg-white border-none p-6 rounded-3xl text-black font-black text-4xl tracking-widest focus:ring-4 focus:ring-red-600 outline-none shadow-2xl uppercase" placeholder="SPZ" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 ml-2 block tracking-widest">Značka a Model</label>
              <input type="text" value={formData.car_brand_model} onChange={(e) => setFormData({...formData, car_brand_model: e.target.value})} className="w-full bg-black border border-zinc-800 p-6 rounded-2xl text-white font-bold outline-none focus:border-blue-600" placeholder="napr. Škoda Octavia" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label>
              <input type="text" maxLength={17} value={formData.vin_number} onChange={(e) => setFormData({...formData, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-6 rounded-2xl text-white font-mono font-bold outline-none focus:border-blue-600 uppercase" placeholder="VIN KÓD" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-600/20">
                <label className="text-[9px] font-black text-blue-500 uppercase mb-2 ml-2 block tracking-widest italic">Stav tachometra (KM)</label>
                <input type="number" value={formData.mileage} onChange={(e) => setFormData({...formData, mileage: e.target.value})} className="w-full bg-black border border-blue-600/30 p-4 rounded-xl text-white font-black text-xl outline-none focus:border-blue-500" placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase mb-2 ml-2 block tracking-widest uppercase">Objem motora</label>
                <input type="text" value={formData.engine_volume} onChange={(e) => setFormData({...formData, engine_volume: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl text-zinc-400 font-bold outline-none" placeholder="cm3" />
              </div>
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase mb-2 ml-2 block tracking-widest uppercase">Výkon (kW)</label>
                <input type="text" value={formData.engine_power} onChange={(e) => setFormData({...formData, engine_power: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl text-zinc-400 font-bold outline-none" placeholder="kW" />
              </div>
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase mb-2 ml-2 block tracking-widest uppercase">Rok výroby</label>
                <input type="text" value={formData.year_produced} onChange={(e) => setFormData({...formData, year_produced: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl text-zinc-400 font-bold outline-none" placeholder="2024" />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 block tracking-widest uppercase">Partner / Zákazník</label>
            <input required type="text" value={formData.customer_name} onChange={(e) => setFormData({...formData, customer_name: e.target.value})} placeholder="Meno alebo názov firmy" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
            <input type="tel" value={formData.customer_phone} onChange={(e) => setFormData({...formData, customer_phone: e.target.value})} placeholder="Telefón" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
            <input type="email" value={formData.customer_email} onChange={(e) => setFormData({...formData, customer_email: e.target.value})} placeholder="Email" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
          </div>
          
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 block tracking-widest uppercase">Sídlo / Adresa</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Ulica a číslo" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
            <div className="grid grid-cols-2 gap-3">
                <input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} placeholder="Mesto" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
                <input type="text" value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} placeholder="PSČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner" />
            </div>
          </div>

          <div className="space-y-4 bg-red-600/5 p-6 rounded-[2rem] border border-red-600/10 shadow-inner">
            <label className="text-[10px] font-black text-red-500 uppercase ml-2 block tracking-widest italic font-bold">Fakturačné údaje firmy (ak sú)</label>
            <input type="text" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} placeholder="Obchodné meno (Autoalma)" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-red-600" />
            <input type="text" value={formData.ico} onChange={(e) => setFormData({...formData, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-red-600" />
            <div className="grid grid-cols-2 gap-2">
                <input type="text" value={formData.dic} onChange={(e) => setFormData({...formData, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-red-600" />
                <input type="text" value={formData.ic_dph} onChange={(e) => setFormData({...formData, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white font-bold outline-none focus:border-red-600" />
            </div>
          </div>
        </div>

        <div className="w-full">
          <SmsPanel 
            phone={formData.customer_phone} 
            plate={formData.plate_number} 
            customerName={formData.customer_name}
            userId={formData.customer_id}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <div className="bg-blue-600/10 p-8 rounded-[3rem] border border-blue-600/20 h-full shadow-lg">
              <label className="text-[10px] font-black text-blue-400 uppercase mb-5 ml-2 block tracking-widest italic">Zodpovedný Mechanik</label>
              <select required value={formData.assigned_worker_id} onChange={(e) => {
                const selectedEmp = employees.find(emp => emp.id === e.target.value);
                setFormData({ ...formData, assigned_worker_id: e.target.value, technician_name: selectedEmp ? selectedEmp.name : '' });
              }} className="w-full bg-black border border-zinc-800 p-6 rounded-2xl text-white font-black text-lg outline-none focus:border-blue-600 appearance-none cursor-pointer shadow-2xl">
                <option value="">-- VYBERTE MECHANIKA --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>)}
              </select>
              <p className="text-[9px] text-zinc-600 mt-4 px-2 uppercase tracking-widest italic">Mechanikovi bude zákazka pridelená</p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-black/40 p-8 md:p-10 rounded-[3.5rem] border border-zinc-800/50 shadow-inner space-y-8">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 block tracking-widest italic">Definícia servisných úkonov</label>
                <button type="button" onClick={addTaskRow} className="bg-white text-black text-[9px] px-6 py-3 rounded-xl transition-all font-black uppercase hover:bg-blue-600 hover:text-white shadow-xl">+ Pridať ďalší úkon</button>
              </div>
              
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <div key={index} className="flex gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="flex-none bg-zinc-900 text-zinc-600 w-14 h-16 flex items-center justify-center rounded-2xl font-black text-xl border border-zinc-800 italic">{index + 1}</div>
                    <input 
                      required 
                      type="text" 
                      value={task.description} 
                      onChange={(e) => updateTask(index, e.target.value)} 
                      placeholder="Popíšte závadu alebo požadovaný úkon..." 
                      className="flex-grow bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner uppercase italic"
                    />
                    {tasks.length > 1 && (
                      <button type="button" onClick={() => removeTaskRow(index)} className="flex-none bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white w-14 h-16 flex items-center justify-center rounded-2xl transition-all border border-red-600/20">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-8 rounded-[2.5rem] uppercase text-sm tracking-[0.4em] shadow-2xl shadow-blue-900/60 hover:bg-blue-500 hover:scale-[1.01] transition-all disabled:opacity-50 italic">
          {loading ? 'Spracovávam...' : 'Otvoriť a odovzdať do dielne'}
        </button>
      </form>

      <style jsx global>{`
        input::placeholder { color: #3f3f46; text-transform: none; font-style: normal; }
      `}</style>
    </div>
  );
}

export default function PrijemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex flex-col items-center justify-center text-white font-black uppercase tracking-widest italic animate-pulse">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      Pripravujem príjem...
    </div>}>
      <PrijemForm />
    </Suspense>
  );
}