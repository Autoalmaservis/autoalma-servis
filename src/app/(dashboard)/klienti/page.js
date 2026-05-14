'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function KlientiPage() {
  const [klienti, setKlienti] = useState([]);
  const [selectedKlient, setSelectedKlient] = useState(null); // Obsahuje meno partnera (kľúč)
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [originalName, setOriginalName] = useState('');

  const [confirmDeleteName, setConfirmDeleteName] = useState(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [clientForm, setClientForm] = useState({ 
    customer_name: '', customer_phone: '', customer_email: '',
    client_type: 'Osoba', address: '', city: '', zip: '', ico: '', dic: '', ic_dph: '', company_name: '',
    password: '' 
  });

  const [carForm, setCarForm] = useState({ 
    id: '', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel', mileage: ''
  });

  useEffect(() => { fetchKlienti(); }, []);

  // --- 1. NAČÍTANIE KLIENTOV ---
  const fetchKlienti = async () => {
    setLoading(true);
    const { data: webProfiles } = await supabase
      .from('user_profiles')
      .select('*')
      .or('role.eq.zakaznik,role.eq.klient'); 

    const { data: vehiclesData } = await supabase.from('vehicles').select('*');
    const mapaKlientov = {};

    webProfiles?.forEach(p => {
      const hlavneZobrazovaneMeno = p.company_name || p.full_name || p.email || "Neznámy partner";
      mapaKlientov[hlavneZobrazovaneMeno] = { 
        ...p, 
        customer_name: hlavneZobrazovaneMeno, 
        db_full_name: p.full_name, 
        db_company_name: p.company_name,
        customer_phone: p.phone || '', 
        customer_email: p.email || '',
        all_plates: [], 
        client_type: (p.ico || p.company_name) ? 'Firma' : 'Osoba' 
      };
    });

    vehiclesData?.forEach(v => {
      const majitel = Object.values(mapaKlientov).find(k => 
        (k.id === v.owner_id) || (k.email === v.owner_email) || (k.customer_name === v.owner_name)
      );
      if (majitel && v.license_plate) {
        if (!mapaKlientov[majitel.customer_name].all_plates.includes(v.license_plate)) {
          mapaKlientov[majitel.customer_name].all_plates.push(v.license_plate);
        }
      }
    });

    setKlienti(Object.values(mapaKlientov).sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '')));
    setLoading(false);
  };

  // --- 2. NAČÍTANIE VOZIDIEL KLIENTA ---
  const nacitajVozidla = async (klientObj) => {
    const meno = klientObj.customer_name;
    const email = klientObj.customer_email;
    const realFullName = klientObj.db_full_name;
    const realCompName = klientObj.db_company_name;
    setSelectedKlient(meno);
    
    const { data: ticketCars } = await supabase.from('job_tickets').select('*, job_items(*)').or(`customer_name.eq."${meno}",customer_name.eq."${realFullName}",customer_name.eq."${realCompName}"`);
    const { data: webCars } = await supabase.from('vehicles').select('*').or(`owner_name.eq."${meno}",owner_name.eq."${realFullName}",owner_name.eq."${realCompName}",owner_email.eq."${email}"`);

    let finalVehicles = [];
    if (webCars) {
      finalVehicles = webCars.map(wc => {
        const history = ticketCars?.filter(d => d.plate_number === wc.license_plate).map(h => {
           const subtotal = h.job_items?.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0) || 0;
           return { ...h, total_price: subtotal * 1.23 };
        }) || [];
        return {
          id: wc.id, plate_number: wc.license_plate, car_brand_model: wc.brand_model, vin_number: wc.vin_number,
          engine_volume: wc.engine_volume, engine_power: wc.engine_power, year_produced: wc.year_produced,
          fuel_type: wc.fuel_type, mileage: wc.mileage, owner_email: wc.owner_email, full_history: history
        };
      });
    }
    setVozidla(finalVehicles);
  };

  // --- 3. LOGIKA NACÍTANIA CEZ API (ŠPZ) ---
  const handleCarLookup = async () => {
    if (!carForm.plate_number) { alert("Zadajte ŠPZ!"); return; }
    setApiLoading(true);
    try {
      const res = await fetch(`/api/vehicle-lookup?ecv=${carForm.plate_number.toUpperCase().replace(/\s/g, '')}`);
      const result = await res.json();
      if (result && result.vehicle) {
        const v = result.vehicle;
        const yearOnly = v.dat_prva_evid ? v.dat_prva_evid.split('.').pop() : '';
        setCarForm({
          ...carForm,
          brand: v.znacka || '',
          model: v.obch_nazov || '',
          vin_number: v.vin || '',
          year_produced: yearOnly,
          engine_volume: v.objem || '',
          engine_power: v.vykon || '',
          fuel_type: v.druh_paliva === 'Nafta' ? 'Diesel' : (v.druh_paliva || 'Diesel')
        });
      } else { alert("Vozidlo sa v databáze nenašlo."); }
    } catch (err) { alert("Chyba pri načítaní údajov z API."); }
    finally { setApiLoading(false); }
  };

  // --- 4. AI SKENOVANIE TP ---
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setApiLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/scan-tp', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || 'Chyba AI');
      const carData = json.data;
      setCarForm(prev => ({
        ...prev,
        brand: carData.brand || prev.brand, model: carData.model || prev.model, vin_number: carData.vin || prev.vin_number,
        year_produced: carData.year || prev.year_produced, engine_volume: carData.engine_volume || prev.engine_volume,
        engine_power: carData.engine_power || prev.engine_power, fuel_type: carData.fuel_type || prev.fuel_type,
      }));
    } catch (err) { alert("Chyba pri AI skenovaní: " + err.message); }
    setApiLoading(false);
  };

  // --- 5. UKLADANIE VOZIDLA DO SUPABASE ---
  const handleSaveCar = async (e) => {
    e.preventDefault();
    const klientInfo = klienti.find(k => k.customer_name === selectedKlient);
    const payload = {
      owner_name: selectedKlient,
      owner_email: klientInfo?.customer_email || '',
      owner_id: klientInfo?.id || null,
      license_plate: carForm.plate_number.toUpperCase().replace(/\s/g, ''),
      brand_model: `${carForm.brand} ${carForm.model}`.trim(),
      vin_number: carForm.vin_number.toUpperCase().trim(),
      engine_volume: carForm.engine_volume ? parseInt(carForm.engine_volume) : null,
      engine_power: carForm.engine_power ? parseInt(carForm.engine_power) : null,
      year_produced: carForm.year_produced ? parseInt(carForm.year_produced) : null,
      fuel_type: carForm.fuel_type,
      mileage: carForm.mileage ? parseInt(carForm.mileage) : 0,
      delete_requested: false
    };

    let res;
    if (carForm.id) { res = await supabase.from('vehicles').update(payload).eq('id', carForm.id); }
    else { res = await supabase.from('vehicles').insert([payload]); }

    if (!res.error) {
      setIsCarModalOpen(false);
      fetchKlienti(); 
      if (klientInfo) nacitajVozidla(klientInfo);
    } else { alert("Chyba pri ukladaní: " + res.error.message); }
  };

  // --- 6. OSTATNÉ FUNKCIE (KLIENT, DELETE...) ---
  const handleSaveClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let userId = clientForm.id;
      if (!editMode && clientForm.password) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: clientForm.customer_email, password: clientForm.password,
          options: { data: { full_name: clientForm.customer_name, role: 'zakaznik' } }
        });
        if (authError) throw authError;
        userId = authData.user?.id;
      }
      const profilePayload = {
        id: userId, full_name: clientForm.customer_name, company_name: clientForm.company_name,
        phone: clientForm.customer_phone, email: clientForm.customer_email, address: clientForm.address,
        city: clientForm.city, zip: clientForm.zip, ico: clientForm.ico, dic: clientForm.dic,
        ic_dph: clientForm.ic_dph, role: 'zakaznik'
      };
      let res;
      if (editMode) {
        const { id: _id, ...updatePayload } = profilePayload;
        res = await supabase.from('user_profiles').update(updatePayload).eq('id', clientForm.id);
        if (!res.error && res.count === 0) {
          res = await supabase.from('user_profiles').update(updatePayload).eq('email', clientForm.customer_email);
        }
      } else { res = await supabase.from('user_profiles').insert([profilePayload]); }
      if (res.error) throw res.error;

      if (!editMode && clientForm.customer_email) {
        fetchWithAuth('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: clientForm.customer_email,
            name: clientForm.customer_name,
            password: clientForm.password,
            createdByAdmin: true,
          }),
        }).catch(() => {});
      }

      setIsClientModalOpen(false);
      fetchKlienti();
    } catch (err) { alert("Chyba: " + err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteKlient = async (klient) => {
    if (confirmDeleteName !== klient.customer_name) { setConfirmDeleteName(klient.customer_name); return; }
    const { error } = await supabase.from('user_profiles').delete().eq('email', klient.customer_email);
    if (!error) { setConfirmDeleteName(null); fetchKlienti(); setSelectedKlient(null); }
  };

  const handleDeleteCar = async (v) => {
    if (confirm(`Naozaj vymazať ${v.plate_number}?`)) {
      await supabase.from('vehicles').delete().eq('id', v.id);
      const k = klienti.find(c => c.customer_name === selectedKlient);
      if (k) nacitajVozidla(k);
      fetchKlienti();
    }
  };

  const openEditClientModal = (k) => {
    setEditMode(true); setOriginalName(k.customer_name);
    setClientForm({ ...k, customer_name: k.db_full_name || k.customer_name, password: '' }); 
    setIsClientModalOpen(true);
  };

  const openEditCarModal = (car) => {
    setEditMode(true);
    const brandModel = car.car_brand_model || '';
    const parts = brandModel.split(' ');
    setCarForm({
      id: car.id, plate_number: car.plate_number, brand: parts[0] || '', model: parts.slice(1).join(' ') || '',
      vin_number: car.vin_number, engine_volume: car.engine_volume, engine_power: car.engine_power,
      year_produced: car.year_produced, fuel_type: car.fuel_type, mileage: car.mileage || ''
    });
    setIsCarModalOpen(true);
  };

  const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filteredKlienti = klienti.filter(k => {
    const s = nd(searchTerm);
    return nd(k.customer_name).includes(s) || nd(k.db_full_name).includes(s) || (k.all_plates || []).some(p => nd(p).includes(s));
  });

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none font-bold">
      {/* HEADER */}
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Garáž <span className="text-red-600 text-4xl">Dielne</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic uppercase">Správa Partnerov</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => {
            const dataToExport = klienti.map(k => ({ Meno: k.customer_name, Telefon: k.customer_phone, Email: k.customer_email, Vozidla: (k.all_plates || []).join(', ') }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Klienti");
            XLSX.writeFile(wb, "Partneri_Dielne.xlsx");
          }} className="bg-zinc-900 text-zinc-400 font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase hover:text-white transition-all border border-zinc-800">Export XLSX</button>
          <button onClick={() => { setEditMode(false); setClientForm({customer_name:'', customer_phone:'', customer_email:'', client_type:'Osoba', address:'', city:'', zip:'', ico:'', dic:'', ic_dph:'', company_name: '', password: ''}); setIsClientModalOpen(true); }} className="bg-white text-black font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-xl font-bold">+ Nový Partner</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ZOZNAM KLIENTOV */}
        <div className="lg:col-span-1">
          <input type="text" placeholder="Hľadať partnera / ŠPZ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-6 shadow-inner" />
          <div className="space-y-3 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {filteredKlienti.map((k, i) => (
              <div key={i} className="relative group">
                <button onClick={() => nacitajVozidla(k)} className={`w-full text-left p-6 rounded-3xl border transition-all relative font-bold ${selectedKlient === k.customer_name ? 'bg-red-600 border-red-600 shadow-2xl' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'}`}>
                  <p className="text-2xl font-black uppercase tracking-tight italic">{k.customer_name}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {k.all_plates?.length > 0 ? k.all_plates.map(p => (
                        <span key={p} className="text-[10px] bg-black/40 px-2.5 py-1 rounded-lg text-zinc-300 font-mono border border-zinc-800 uppercase tracking-widest">{p}</span>
                    )) : <span className="text-[10px] text-zinc-600 italic uppercase">Bez vozidla</span>}
                  </div>
                </button>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 font-bold">
                  <span onClick={(e) => { e.stopPropagation(); openEditClientModal(k); }} className="bg-black/50 p-3 rounded-xl text-xs hover:bg-white hover:text-black transition-all border border-zinc-800 cursor-pointer">✏️</span>
                  <span onClick={(e) => { e.stopPropagation(); handleDeleteKlient(k); }} className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${confirmDeleteName === k.customer_name ? 'bg-white text-red-600 border-white' : 'bg-black/50 text-zinc-600 border-zinc-800 hover:text-red-500'}`}>{confirmDeleteName === k.customer_name ? 'ZMAZAŤ?' : '🗑️'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KARTA KLIENTA */}
        <div className="lg:col-span-2">
          {selectedKlient ? (
            <div className="space-y-10 animate-in fade-in duration-500 font-bold">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-none font-bold">Karta: <span className="text-red-600">{selectedKlient}</span></h2>
                <button onClick={() => { setEditMode(false); setCarForm({id:'', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel', mileage: '' }); setIsCarModalOpen(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase border border-zinc-700 shadow-lg">+ Pridať Vozidlo</button>
              </div>
              <div className="space-y-16">
                {vozidla.map((v) => (
                  <div key={v.id} className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[3.5rem] relative shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div>
                          <div className="flex items-center gap-3 mb-6">
                            <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-2xl tracking-widest shadow-2xl uppercase">{v.plate_number}</span>
                            <button onClick={() => openEditCarModal(v)} className="bg-zinc-800 hover:bg-white border border-zinc-700 text-white hover:text-black p-2.5 rounded-xl transition-all text-xs font-bold">✏️</button>
                            <button onClick={() => handleDeleteCar(v)} className="bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white p-2.5 rounded-xl transition-all text-xs font-bold">🗑️</button>
                          </div>
                          <h3 className="text-3xl font-black uppercase italic mb-4">{v.car_brand_model}</h3>
                          <div className="space-y-2 bg-black/40 p-5 rounded-2xl border border-zinc-800 text-[11px] font-black uppercase tracking-widest text-zinc-400 italic">
                             <p className="flex justify-between border-b border-zinc-800 pb-2"><span>VIN:</span> <span className="text-white font-mono">{v.vin_number || '---'}</span></p>
                             <p className="flex justify-between border-b border-zinc-800 py-2"><span>Motor:</span> <span className="text-white">{v.engine_volume} ccm / {v.engine_power} kW</span></p>
                             <p className="flex justify-between pt-2"><span>Km / Rok:</span> <span className="text-white">{v.mileage || 0} KM • {v.year_produced}</span></p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4 flex items-center gap-2 italic"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span> História návštev</h4>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar italic">
                             {v.full_history?.length > 0 ? v.full_history.map((h) => (
                                <Link href={`/zakazky/${h.id}`} key={h.id} className="block group">
                                   <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl hover:border-red-600 transition-all flex justify-between items-center">
                                      <div>
                                          <p className="text-[10px] font-black text-zinc-500 uppercase">{new Date(h.created_at).toLocaleDateString('sk-SK')}</p>
                                          <p className="text-xs font-bold text-white group-hover:text-red-500 transition-colors uppercase italic line-clamp-1">{h.status}</p>
                                      </div>
                                      <p className="text-[10px] font-black text-white">{h.total_price?.toFixed(2)} €</p>
                                   </div>
                                </Link>
                             )) : <p className="text-[10px] uppercase text-zinc-600 font-bold tracking-widest text-center py-4">Žiadna história návštev</p>}
                          </div>
                          <Link href={`/prijem?spz=${v.plate_number}&meno=${encodeURIComponent(selectedKlient)}`} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all shadow-lg mt-4 italic font-bold">📋 Nová zákazka</Link>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40 uppercase font-black tracking-[0.5em] text-sm text-center px-10 italic">Vyberte partnera v ľavom menu</div>
          )}
        </div>
      </div>

      {/* MODAL VOZIDLA (S API A AI) */}
      {isCarModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] w-full max-w-4xl shadow-2xl my-auto font-bold">
            <h2 className="text-4xl font-black uppercase italic mb-8 text-white text-center tracking-tighter">Technické údaje</h2>
            
            {/* AI SKENER SEKCIA */}
            <div className="mb-8 p-6 border-2 border-dashed border-zinc-800 rounded-3xl text-center bg-black/30">
              <label className="cursor-pointer block">
                <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-red-600 transition-colors">
                  {apiLoading ? 'Spracovávam dokument...' : '📷 Odfotiť alebo nahrať Technický preukaz (AI)'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={apiLoading} />
              </label>
            </div>

            <form onSubmit={handleSaveCar} className="grid grid-cols-1 md:grid-cols-2 gap-6 italic">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest uppercase">ŠPZ Vozidla</label>
                <div className="flex gap-2">
                  <input required type="text" value={carForm.plate_number} onChange={(e) => setCarForm({...carForm, plate_number: e.target.value.toUpperCase()})} className="flex-grow bg-white border-none p-6 rounded-3xl text-black font-black text-4xl tracking-widest focus:ring-4 focus:ring-red-600 outline-none uppercase shadow-2xl" />
                  <button type="button" onClick={handleCarLookup} disabled={apiLoading} className="px-6 bg-red-600/10 border border-red-600 text-red-600 rounded-3xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">
                    {apiLoading ? '...' : 'Načítať ⚡'}
                  </button>
                </div>
              </div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka</label><input required type="text" value={carForm.brand} onChange={(e) => setCarForm({...carForm, brand: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" /></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Model</label><input required type="text" value={carForm.model} onChange={(e) => setCarForm({...carForm, model: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" /></div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label><input required type="text" maxLength={17} value={carForm.vin_number} onChange={(e) => setCarForm({...carForm, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-mono font-bold outline-none focus:border-red-600 uppercase tracking-widest" /></div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-blue-500 uppercase mb-3 ml-2 block tracking-widest italic">Aktuálny stav tachometra (KM)</label><input type="number" value={carForm.mileage} onChange={(e) => setCarForm({...carForm, mileage: e.target.value})} className="w-full bg-black border border-blue-600/30 p-5 rounded-2xl text-white font-black text-2xl outline-none focus:border-blue-500" /></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Objem (cm³)</label><input type="text" value={carForm.engine_volume} onChange={(e) => setCarForm({...carForm, engine_volume: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Výkon (kW)</label><input type="text" value={carForm.engine_power} onChange={(e) => setCarForm({...carForm, engine_power: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Rok výroby</label><input type="number" value={carForm.year_produced} onChange={(e) => setCarForm({...carForm, year_produced: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Palivo</label><select value={carForm.fuel_type} onChange={(e) => setCarForm({...carForm, fuel_type: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none appearance-none focus:border-red-600"><option value="Diesel">Diesel</option><option value="Benzín">Benzín</option><option value="Hybrid">Hybrid</option><option value="Elektro">Elektro</option></select></div>
              <div className="flex gap-5 pt-8 md:col-span-2">
                <button type="button" onClick={() => setIsCarModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">Zrušiť</button>
                <button type="submit" disabled={apiLoading} className="flex-[2] bg-red-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-widest hover:bg-red-500 transition-all shadow-xl">Uložiť technické zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KLIENT */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-4xl shadow-2xl my-auto">
            <h2 className="text-4xl font-black uppercase italic mb-10 text-white text-center tracking-tighter">{editMode ? 'Úprava Partnera' : 'Nový Partner'}</h2>
            <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold">
              <div className="space-y-6">
                <div className="flex bg-black p-1 rounded-2xl border border-zinc-800 font-bold">
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Osoba'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Osoba' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Osoba</button>
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Firma'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Firma' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Firma</button>
                </div>
                <input required type="text" value={clientForm.customer_name} onChange={(e) => setClientForm({...clientForm, customer_name: e.target.value})} placeholder="Meno partnera" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input type="text" value={clientForm.customer_phone} onChange={(e) => setClientForm({...clientForm, customer_phone: e.target.value})} placeholder="Telefón" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input required type="email" value={clientForm.customer_email} onChange={(e) => setClientForm({...clientForm, customer_email: e.target.value})} placeholder="E-mail" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                {!editMode && (
                  <div className="bg-red-600/5 p-4 rounded-2xl border border-red-600/20">
                    <label className="text-[10px] font-black text-red-600 uppercase mb-2 ml-2 block tracking-widest italic font-bold">Heslo do Garáže</label>
                    <input required type="text" value={clientForm.password} onChange={(e) => setClientForm({...clientForm, password: e.target.value})} placeholder="Zadajte heslo" className="w-full bg-black border border-red-600/30 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-xl"/>
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <input type="text" value={clientForm.address} onChange={(e) => setClientForm({...clientForm, address: e.target.value})} placeholder="Ulica a č." className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <div className="grid grid-cols-2 gap-4 font-bold">
                  <input type="text" value={clientForm.zip} onChange={(e) => setClientForm({...clientForm, zip: e.target.value})} placeholder="PSČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                  <input type="text" value={clientForm.city} onChange={(e) => setClientForm({...clientForm, city: e.target.value})} placeholder="Mesto" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                </div>
                {clientForm.client_type === 'Firma' && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-300 font-bold">
                    <input type="text" value={clientForm.company_name} onChange={(e) => setClientForm({...clientForm, company_name: e.target.value})} placeholder="Obchodné meno" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <input type="text" value={clientForm.ico} onChange={(e) => setClientForm({...clientForm, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <div className="grid grid-cols-2 gap-4">
                       <input type="text" value={clientForm.dic} onChange={(e) => setClientForm({...clientForm, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                       <input type="text" value={clientForm.ic_dph} onChange={(e) => setClientForm({...clientForm, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex gap-5 pt-6">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest hover:text-white transition-all">Zrušiť</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-white text-black font-black py-6 rounded-3xl uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-2xl"> {loading ? 'Spracovávam...' : (editMode ? 'Uložiť zmeny' : 'Registrovať Partnera')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}