'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';
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
  const [validationErrors, setValidationErrors] = useState({});
  const [savingToDb, setSavingToDb] = useState(false);
  const [garazModal, setGarazModal] = useState(false);
  const [garazPassword, setGarazPassword] = useState('');
  const [garazLoading, setGarazLoading] = useState(false);
  const [garazStep, setGarazStep] = useState(1);
  const [dbSaveMsg, setDbSaveMsg] = useState('');

  const validate = () => {
    const errors = {};
    if (!formData.customer_name.trim()) errors.customer_name = 'Meno zákazníka je povinné';
    if (!formData.plate_number.trim()) {
      errors.plate_number = 'ŠPZ je povinná';
    } else if (!/^[A-Z0-9]{4,8}$/.test(formData.plate_number.replace(/\s/g, ''))) {
      errors.plate_number = 'Neplatný formát ŠPZ (napr. BA123AB)';
    }
    if (formData.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
      errors.customer_email = 'Neplatný e-mail';
    }
    if (formData.customer_phone && !/^[\d\s\+\-]{9,15}$/.test(formData.customer_phone)) {
      errors.customer_phone = 'Neplatné telefónne číslo';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true);
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  // --- PREVZATIE ÚDAJOV Z KALENDÁRA ---
  useEffect(() => {
    const fetchCalendarInfo = async () => {
      const spz = searchParams.get('spz');
      if (!spz) return;

      // Úkony — primárne z URL param ?popis= (priamo zo zvoleného eventu)
      const popisFromUrl = searchParams.get('popis');
      const parseLines = (text) => text
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line !== '' && !line.endsWith(':'));

      if (popisFromUrl) {
        const lines = parseLines(popisFromUrl);
        if (lines.length > 0) setTasks(lines.map(l => ({ description: l })));
      }

      const { data: calData } = await supabase
        .from('calendar_events')
        .select('issue_description, customer_phone, customer_email, customer_name, user_id')
        .eq('plate_number', spz.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!calData) return;

      // Úkony z DB — len ak URL param nebol k dispozícii
      if (!popisFromUrl && calData.issue_description) {
        const lines = parseLines(calData.issue_description);
        if (lines.length > 0) setTasks(lines.map(l => ({ description: l })));
      }

      // Kontaktné údaje z kalendárnej udalosti (fallback ak autoDoplnenie nenašlo vozidlo)
      setFormData(prev => ({
        ...prev,
        customer_name: prev.customer_name || calData.customer_name || '',
        customer_phone: prev.customer_phone || calData.customer_phone || '',
        customer_email: prev.customer_email || calData.customer_email || '',
      }));

      // Ak má zákazník účet (user_id), načítame profil pre adresu/mesto/PSČ
      if (calData.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name, email, phone, address, city, zip, ico, dic, ic_dph')
          .eq('id', calData.user_id)
          .maybeSingle();

        if (profile) {
          setFormData(prev => ({
            ...prev,
            customer_name: prev.customer_name || profile.company_name || profile.full_name || '',
            customer_phone: prev.customer_phone || profile.phone || '',
            customer_email: prev.customer_email || profile.email || '',
            address: prev.address || profile.address || '',
            city: prev.city || profile.city || '',
            zip: prev.zip || profile.zip || '',
            company_name: prev.company_name || profile.company_name || '',
            ico: prev.ico || profile.ico || '',
            dic: prev.dic || profile.dic || '',
            ic_dph: prev.ic_dph || profile.ic_dph || '',
            client_type: prev.client_type || (profile.company_name ? 'Firma' : 'Osoba'),
            customer_id: prev.customer_id || calData.user_id,
          }));
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
        // 1. Hľadáme auto v tabuľke vehicles
        const { data: vData } = await supabase
          .from('vehicles')
          .select('id, license_plate, brand_model, vin_number, mileage, engine_volume, engine_power, year_produced, fuel_type, owner_id, owner_name, owner_email, owner_phone')
          .eq('license_plate', spzToQuery.toUpperCase())
          .maybeSingle();
        
        if (vData) {
          // 2. Hľadáme profil v user_profiles — najprv podľa owner_id, fallback podľa emailu
          let pData = null;
          const profileSelect = 'id, full_name, company_name, email, phone, address, city, zip, ico, dic, ic_dph';
          if (vData.owner_id) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select(profileSelect)
              .eq('id', vData.owner_id)
              .maybeSingle();
            pData = profile;
          }
          if (!pData && vData.owner_email) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select(profileSelect)
              .eq('email', vData.owner_email)
              .maybeSingle();
            pData = profile;
          }
          
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
            // Logika mena: uprednostníme profil (company_name pre firmu, full_name pre osobu), inak meno z vehicles
            customer_name: pData?.company_name || pData?.full_name || menoFromUrl || vData.owner_name || prev.customer_name,
            customer_email: pData?.email || vData.owner_email || prev.customer_email,
            customer_phone: pData?.phone || vData.owner_phone || prev.customer_phone,
            address: pData?.address || prev.address || '',
            city: pData?.city || prev.city || '',
            zip: pData?.zip || prev.zip || '',
            company_name: pData?.company_name || prev.company_name || '',
            ico: pData?.ico || prev.ico || '',
            dic: pData?.dic || prev.dic || '',
            ic_dph: pData?.ic_dph || prev.ic_dph || '',
            client_type: pData ? (pData.company_name ? 'Firma' : 'Osoba') : prev.client_type,
            customer_id: vData.owner_id || prev.customer_id || null
          }));
        }
      }
    };
    autoDoplnenie();
  }, [formData.plate_number, searchParams]); // Ponechané obe závislosti kvôli chybe v konzole

  const genPassword = () => {
    const chars = 'ABCDEFGHJKMNPRSTUVWXYZabcdefghjkmnprstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleUlozitDoKlientov = async () => {
    if (!formData.customer_name.trim()) { alert('Zadajte meno zákazníka.'); return; }
    setSavingToDb(true);
    setDbSaveMsg('');
    try {
      // Upsert do customers
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .or(`full_name.eq."${formData.customer_name.trim()}"${formData.customer_email ? `,email.eq."${formData.customer_email}"` : ''}`)
        .maybeSingle();

      const custPayload = {
        full_name: formData.customer_name.trim(),
        phone: formData.customer_phone || null,
        email: formData.customer_email || null,
        address: formData.address || null,
        city: formData.city || null,
        zip: formData.zip || null,
        client_type: formData.client_type || 'Osoba',
        company_name: formData.company_name || null,
        ico: formData.ico || null,
        dic: formData.dic || null,
        ic_dph: formData.ic_dph || null,
      };

      let customerId;
      if (existing?.id) {
        await supabase.from('customers').update(custPayload).eq('id', existing.id);
        customerId = existing.id;
      } else {
        const { data: newCust } = await supabase.from('customers').insert([custPayload]).select('id').single();
        customerId = newCust?.id;
      }

      // Upsert vozidla ak je ŠPZ
      if (formData.plate_number.trim() && customerId) {
        const { data: existVeh } = await supabase.from('vehicles').select('id').eq('license_plate', formData.plate_number.toUpperCase()).maybeSingle();
        const vehPayload = {
          owner_id: customerId,
          owner_name: formData.customer_name.trim(),
          owner_email: formData.customer_email || null,
          license_plate: formData.plate_number.toUpperCase(),
          brand_model: formData.car_brand_model || null,
          vin_number: formData.vin_number || null,
          engine_volume: formData.engine_volume || null,
          engine_power: formData.engine_power || null,
          year_produced: formData.year_produced || null,
          fuel_type: formData.fuel_type || 'Diesel',
          mileage: formData.mileage ? parseInt(formData.mileage) : 0,
        };
        if (existVeh?.id) {
          await supabase.from('vehicles').update(vehPayload).eq('id', existVeh.id);
        } else {
          await supabase.from('vehicles').insert([vehPayload]);
        }
      }

      setDbSaveMsg('Klient uložený do databázy.');
    } catch (err) {
      setDbSaveMsg('Chyba: ' + err.message);
    }
    setSavingToDb(false);
  };

  const openGarazWizard = () => {
    setGarazPassword(genPassword());
    setGarazStep(1);
    setGarazModal(true);
  };

  const handleVytvoritGaraz = async () => {
    if (!formData.customer_email) { alert('E-mail zákazníka je povinný pre prístup do garáže.'); return; }
    setGarazLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/create-zakaznik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.customer_name,
          email: formData.customer_email,
          password: garazPassword,
          phone: formData.customer_phone,
          clientType: formData.client_type,
          company_name: formData.company_name,
          ico: formData.ico,
          dic: formData.dic,
          ic_dph: formData.ic_dph,
          address: formData.address,
          city: formData.city,
          zip: formData.zip,
          vehicle: formData.plate_number ? {
            license_plate: formData.plate_number,
            brand_model: formData.car_brand_model,
            vin: formData.vin_number,
            year_produced: formData.year_produced || null,
            engine_volume: formData.engine_volume || null,
            engine_power: formData.engine_power || null,
            fuel_type: formData.fuel_type,
            mileage: formData.mileage ? parseInt(formData.mileage) : 0,
          } : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Chyba pri vytváraní účtu');

      await fetchWithAuth('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.customer_email,
          name: formData.customer_name,
          password: garazPassword,
          createdByAdmin: true,
        }),
      }).catch(() => {});

      setGarazModal(false);
      alert(`Prístup do garáže vytvorený. Heslo: ${garazPassword}\nUvítací e-mail bol odoslaný na ${formData.customer_email}.`);
    } catch (err) {
      alert('Chyba: ' + err.message);
    }
    setGarazLoading(false);
  };

  const addTaskRow = () => setTasks([...tasks, { description: '' }]);
  const removeTaskRow = (index) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTask = (index, val) => {
    const newTasks = [...tasks];
    newTasks[index].description = val;
    setTasks(newTasks);
  };

  // --- GENEROVANIE ČÍSLA ZÁKAZKY cez DB funkciu (bez race condition) ---
  const generateFinalJobNumber = async () => {
    const { data, error } = await supabase.rpc('generate_job_number');
    if (error || !data) throw new Error('Chyba pri generovaní čísla zákazky');
    return data;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
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

  const inp = (extra = '') => `w-full bg-black border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner text-sm ${extra}`;

  return (
    <div className="p-3 md:p-10 min-h-screen bg-black text-white font-sans font-bold">
      <header className="mb-6 md:mb-12 border-l-4 border-blue-600 pl-4 md:pl-6 text-white font-black uppercase italic tracking-tighter leading-none">
        <h1 className="text-xl md:text-3xl font-black">Nový <span className="text-blue-600 text-2xl md:text-4xl">Zákazkový List</span></h1>
        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic">Otvorenie servisného prípadu</p>
      </header>

      <form onSubmit={handleSave} className="max-w-[1200px] bg-zinc-900/40 border border-zinc-800 p-4 md:p-12 rounded-2xl md:rounded-[3.5rem] shadow-2xl space-y-6 md:space-y-12">

        {/* ŠPZ + vozidlo */}
        <div className="space-y-4 md:space-y-8 bg-black/40 p-4 md:p-8 rounded-xl md:rounded-[3rem] border border-zinc-800/50 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-end">
            <div>
              <label className="text-[9px] font-black text-red-600 uppercase mb-2 ml-1 block tracking-widest italic">ŠPZ Vozidla *</label>
              <input required type="text" value={formData.plate_number}
                onChange={(e) => { setFormData({...formData, plate_number: e.target.value.toUpperCase()}); setValidationErrors(v => ({...v, plate_number: undefined})); }}
                className={`w-full bg-white border-none p-4 md:p-6 rounded-2xl md:rounded-3xl text-black font-black text-2xl md:text-4xl tracking-widest focus:ring-4 outline-none shadow-2xl uppercase ${validationErrors.plate_number ? 'ring-4 ring-red-600' : 'focus:ring-red-600'}`}
                placeholder="SPZ" />
              {validationErrors.plate_number && <p className="text-red-500 text-[9px] mt-1 ml-1 font-bold uppercase tracking-widest">{validationErrors.plate_number}</p>}
            </div>
            <div>
              <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 ml-1 block tracking-widest">Značka a Model</label>
              <input type="text" value={formData.car_brand_model} onChange={(e) => setFormData({...formData, car_brand_model: e.target.value})} className={inp()} placeholder="napr. Škoda Octavia" />
            </div>
            <div>
              <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 ml-1 block tracking-widest">VIN Číslo</label>
              <input type="text" maxLength={17} value={formData.vin_number} onChange={(e) => setFormData({...formData, vin_number: e.target.value.toUpperCase()})} className={inp('font-mono uppercase')} placeholder="VIN KÓD" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <div className="bg-blue-600/5 p-3 rounded-xl border border-blue-600/20 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-blue-500 uppercase mb-1 ml-1 block tracking-widest italic">Km</label>
              <input type="number" value={formData.mileage} onChange={(e) => setFormData({...formData, mileage: e.target.value})} className="w-full bg-black border border-blue-600/30 p-2 md:p-4 rounded-lg text-white font-black text-base md:text-xl outline-none focus:border-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase mb-1 ml-1 block tracking-widest">Objem (cm³)</label>
              <input type="text" value={formData.engine_volume} onChange={(e) => setFormData({...formData, engine_volume: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-2 md:p-5 rounded-xl text-zinc-400 font-bold outline-none text-sm" placeholder="cm3" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase mb-1 ml-1 block tracking-widest">Výkon (kW)</label>
              <input type="text" value={formData.engine_power} onChange={(e) => setFormData({...formData, engine_power: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-2 md:p-5 rounded-xl text-zinc-400 font-bold outline-none text-sm" placeholder="kW" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase mb-1 ml-1 block tracking-widest">Rok výroby</label>
              <input type="text" value={formData.year_produced} onChange={(e) => setFormData({...formData, year_produced: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-800 p-2 md:p-5 rounded-xl text-zinc-400 font-bold outline-none text-sm" placeholder="2024" />
            </div>
          </div>
        </div>

        {/* Zákazník + adresa + fakturácia */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-10">
          <div className="space-y-3">
            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 block tracking-widest">Partner / Zákazník</label>
            <div>
              <input required type="text" value={formData.customer_name}
                onChange={(e) => { setFormData({...formData, customer_name: e.target.value}); setValidationErrors(v => ({...v, customer_name: undefined})); }}
                placeholder="Meno alebo názov firmy"
                className={`${inp()} ${validationErrors.customer_name ? 'border-red-600' : ''}`} />
              {validationErrors.customer_name && <p className="text-red-500 text-[9px] mt-1 ml-1 font-bold uppercase tracking-widest">{validationErrors.customer_name}</p>}
            </div>
            <div>
              <input type="tel" value={formData.customer_phone}
                onChange={(e) => { setFormData({...formData, customer_phone: e.target.value}); setValidationErrors(v => ({...v, customer_phone: undefined})); }}
                placeholder="Telefón" className={`${inp()} ${validationErrors.customer_phone ? 'border-red-600' : ''}`} />
              {validationErrors.customer_phone && <p className="text-red-500 text-[9px] mt-1 ml-1 font-bold uppercase tracking-widest">{validationErrors.customer_phone}</p>}
            </div>
            <div>
              <input type="email" value={formData.customer_email}
                onChange={(e) => { setFormData({...formData, customer_email: e.target.value}); setValidationErrors(v => ({...v, customer_email: undefined})); }}
                placeholder="Email" className={`${inp()} ${validationErrors.customer_email ? 'border-red-600' : ''}`} />
              {validationErrors.customer_email && <p className="text-red-500 text-[9px] mt-1 ml-1 font-bold uppercase tracking-widest">{validationErrors.customer_email}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 block tracking-widest">Sídlo / Adresa</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Ulica a číslo" className={inp()} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} placeholder="Mesto" className={inp()} />
              <input type="text" value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} placeholder="PSČ" className={inp()} />
            </div>
          </div>

          <div className="space-y-3 bg-red-600/5 p-4 rounded-xl md:rounded-[2rem] border border-red-600/10 shadow-inner">
            <label className="text-[9px] font-black text-red-500 uppercase ml-1 block tracking-widest italic">Fakturačné údaje firmy</label>
            <input type="text" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} placeholder="Obchodné meno" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold outline-none focus:border-red-600 text-sm" />
            <input type="text" value={formData.ico} onChange={(e) => setFormData({...formData, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold outline-none focus:border-red-600 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={formData.dic} onChange={(e) => setFormData({...formData, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold outline-none focus:border-red-600 text-sm" />
              <input type="text" value={formData.ic_dph} onChange={(e) => setFormData({...formData, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold outline-none focus:border-red-600 text-sm" />
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

        {/* Akcie pre klienta */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handleUlozitDoKlientov} disabled={savingToDb}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all disabled:opacity-50">
            {savingToDb ? 'Ukladám...' : '💾 Uložiť do klientov'}
          </button>
          <button type="button" onClick={openGarazWizard}
            className="flex-1 bg-zinc-900 hover:bg-red-600/20 border border-red-600/40 text-red-400 hover:text-red-300 font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all">
            🔑 Prístup do garáže
          </button>
          {dbSaveMsg && <p className="sm:col-span-2 text-green-400 text-xs font-bold self-center">{dbSaveMsg}</p>}
        </div>

        {/* Mechanik + úkony */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-10">
          <div className="lg:col-span-1">
            <div className="bg-blue-600/10 p-4 md:p-8 rounded-xl md:rounded-[3rem] border border-blue-600/20 shadow-lg">
              <label className="text-[9px] font-black text-blue-400 uppercase mb-3 ml-1 block tracking-widest italic">Zodpovedný Mechanik</label>
              <select required value={formData.assigned_worker_id} onChange={(e) => {
                const selectedEmp = employees.find(emp => emp.id === e.target.value);
                setFormData({ ...formData, assigned_worker_id: e.target.value, technician_name: selectedEmp ? selectedEmp.name : '' });
              }} className="w-full bg-black border border-zinc-800 p-3 md:p-6 rounded-xl md:rounded-2xl text-white font-black text-sm md:text-lg outline-none focus:border-blue-600 appearance-none cursor-pointer shadow-2xl">
                <option value="">-- VYBERTE MECHANIKA --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-black/40 p-4 md:p-10 rounded-xl md:rounded-[3.5rem] border border-zinc-800/50 shadow-inner space-y-4 md:space-y-8">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 block tracking-widest italic">Servisné úkony</label>
                <button type="button" onClick={addTaskRow} className="bg-white text-black text-[9px] px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl transition-all font-black uppercase hover:bg-blue-600 hover:text-white shadow-xl">+ Úkon</button>
              </div>

              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <div key={index} className="flex gap-2 md:gap-4">
                    <div className="flex-none bg-zinc-900 text-zinc-600 w-10 h-11 md:w-14 md:h-16 flex items-center justify-center rounded-xl md:rounded-2xl font-black text-base md:text-xl border border-zinc-800 italic">{index + 1}</div>
                    <input
                      required
                      type="text"
                      value={task.description}
                      onChange={(e) => updateTask(index, e.target.value)}
                      placeholder="Popíšte závadu alebo úkon..."
                      className="flex-grow bg-black border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-blue-600 shadow-inner uppercase italic text-sm"
                    />
                    {tasks.length > 1 && (
                      <button type="button" onClick={() => removeTaskRow(index)} className="flex-none bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white w-10 h-11 md:w-14 md:h-16 flex items-center justify-center rounded-xl md:rounded-2xl transition-all border border-red-600/20 text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 md:py-8 rounded-2xl md:rounded-[2.5rem] uppercase text-sm tracking-[0.3em] shadow-2xl shadow-blue-900/60 hover:bg-blue-500 transition-all disabled:opacity-50 italic">
          {loading ? 'Spracovávam...' : 'Otvoriť a odovzdať do dielne'}
        </button>
      </form>

      <style jsx global>{`
        input::placeholder { color: #3f3f46; text-transform: none; font-style: normal; }
      `}</style>

      {/* Modal — Prístup do garáže */}
      {garazModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-600/30 rounded-3xl p-6 md:p-10 w-full max-w-lg shadow-2xl space-y-6">
            <div className="border-l-4 border-red-600 pl-4">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Krok {garazStep} / 2</p>
              <h2 className="text-xl font-black uppercase italic text-white">
                {garazStep === 1 ? '🔑 Prístup do garáže' : '🚗 Vozidlo zákazníka'}
              </h2>
            </div>

            {garazStep === 1 && (
              <div className="space-y-4">
                <div className="bg-black/50 rounded-2xl p-4 space-y-2 text-sm">
                  <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">Meno</span><br/><strong className="text-white">{formData.customer_name || '—'}</strong></p>
                  <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">E-mail</span><br/><strong className="text-white">{formData.customer_email || <span className="text-red-500">chýba!</span>}</strong></p>
                  <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">Telefón</span><br/><strong className="text-white">{formData.customer_phone || '—'}</strong></p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-2">Vygenerované heslo</p>
                  <p className="text-white font-mono text-2xl font-black tracking-wider">{garazPassword}</p>
                  <p className="text-yellow-600 text-[9px] mt-1 uppercase tracking-widest">Bude odoslané v uvítacom e-maili</p>
                </div>
                <button type="button" onClick={() => setGarazPassword(genPassword())} className="text-zinc-500 hover:text-white text-xs underline">Vygenerovať iné heslo</button>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setGarazModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest">Zrušiť</button>
                  <button type="button" onClick={() => setGarazStep(2)} disabled={!formData.customer_email}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest disabled:opacity-40">
                    Ďalej →
                  </button>
                </div>
              </div>
            )}

            {garazStep === 2 && (
              <div className="space-y-4">
                <div className="bg-black/50 rounded-2xl p-4 space-y-2 text-sm">
                  <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">ŠPZ</span><br/><strong className="text-white text-xl font-mono">{formData.plate_number || '—'}</strong></p>
                  <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">Vozidlo</span><br/><strong className="text-white">{formData.car_brand_model || '—'}</strong></p>
                  {formData.vin_number && <p className="text-zinc-400"><span className="text-zinc-600 text-xs uppercase">VIN</span><br/><span className="text-zinc-300 font-mono text-xs">{formData.vin_number}</span></p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setGarazStep(1)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest">← Späť</button>
                  <button type="button" onClick={handleVytvoritGaraz} disabled={garazLoading}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest disabled:opacity-50">
                    {garazLoading ? 'Vytvárám...' : '✓ Vytvoriť prístup'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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