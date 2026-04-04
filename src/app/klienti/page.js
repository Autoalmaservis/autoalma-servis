'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function KlientiPage() {
  const [klienti, setKlienti] = useState([]);
  const [selectedKlient, setSelectedKlient] = useState(null);
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [originalName, setOriginalName] = useState('');

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [clientForm, setClientForm] = useState({ 
    customer_name: '', customer_phone: '', customer_email: '',
    client_type: 'Osoba', address: '', city: '', zip: '', ico: '', dic: '', ic_dph: ''
  });

  const [carForm, setCarForm] = useState({ 
    id: '', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel'
  });

  useEffect(() => { fetchKlienti(); }, []);

  const fetchKlienti = async () => {
    setLoading(true);
    const { data } = await supabase.from('job_tickets').select('*').order('customer_name');
    if (data) {
      const unique = data.reduce((acc, current) => {
        const x = acc.find(item => item.customer_name === current.customer_name);
        if (!x) {
          return acc.concat([{
            ...current,
            all_plates: current.plate_number && current.plate_number !== 'NOVÝ-KLIENT' ? [current.plate_number] : [],
            all_vins: current.vin_number ? [current.vin_number] : []
          }]);
        } else {
          if (current.plate_number && current.plate_number !== 'NOVÝ-KLIENT' && !x.all_plates.includes(current.plate_number)) {
            x.all_plates.push(current.plate_number);
          }
          if (current.vin_number && !x.all_vins.includes(current.vin_number)) {
            x.all_vins.push(current.vin_number);
          }
          return acc;
        }
      }, []);
      setKlienti(unique);
    }
    setLoading(false);
  };

  const nacitajVozidla = async (meno) => {
    setSelectedKlient(meno);
    const { data } = await supabase.from('job_tickets').select('*').eq('customer_name', meno).neq('plate_number', 'NOVÝ-KLIENT');
    if (data) {
      const uniqueVozidla = Array.from(new Set(data.map(a => a.plate_number))).map(plate => data.find(a => a.plate_number === plate));
      setVozidla(uniqueVozidla);
    }
  };

  const filteredKlienti = klienti.filter(k => {
    const s = searchTerm.toLowerCase();
    return (
      (k.customer_name || '').toLowerCase().includes(s) ||
      (k.all_plates || []).some(p => p.toLowerCase().includes(s)) ||
      (k.all_vins || []).some(v => v.toLowerCase().includes(s))
    );
  });

  const handleSaveClient = async (e) => {
    e.preventDefault();
    const payload = {
      customer_name: clientForm.customer_name.trim(),
      customer_phone: clientForm.customer_phone || '',
      customer_email: clientForm.customer_email || '',
      client_type: clientForm.client_type || 'Osoba',
      address: clientForm.address || '',
      city: clientForm.city || '',
      zip: clientForm.zip || '',
      ico: clientForm.ico || '',
      dic: clientForm.dic || '',
      ic_dph: clientForm.ic_dph || ''
    };

    let error;
    if (editMode) {
      const res = await supabase.from('job_tickets').update(payload).eq('customer_name', originalName);
      error = res.error;
    } else {
      const res = await supabase.from('job_tickets').insert([{ ...payload, plate_number: 'NOVÝ-KLIENT', status: 'Archivované' }]);
      error = res.error;
    }

    if (error) alert("Chyba: " + error.message);
    else { setIsClientModalOpen(false); fetchKlienti(); }
  };

  const handleSaveCar = async (e) => {
    e.preventDefault();
    const kData = klienti.find(k => k.customer_name === selectedKlient);
    const payload = {
      customer_name: selectedKlient,
      customer_phone: kData?.customer_phone || '',
      customer_email: kData?.customer_email || '',
      client_type: kData?.client_type || 'Osoba',
      address: kData?.address || '',
      city: kData?.city || '',
      zip: kData?.zip || '',
      ico: kData?.ico || '',
      dic: kData?.dic || '',
      ic_dph: kData?.ic_dph || '',
      plate_number: (carForm.plate_number || '').toUpperCase().trim(),
      car_brand_model: `${carForm.brand} ${carForm.model}`.trim(),
      vin_number: (carForm.vin_number || '').toUpperCase(),
      engine_volume: carForm.engine_volume || '', 
      engine_power: carForm.engine_power || '',
      year_produced: carForm.year_produced || '', 
      fuel_type: carForm.fuel_type || 'Diesel',
      status: 'Prebieha',
      updated_at: new Date()
    };
    const res = carForm.id ? await supabase.from('job_tickets').update(payload).eq('id', carForm.id) : await supabase.from('job_tickets').insert([payload]);
    if (!res.error) { setIsCarModalOpen(false); nacitajVozidla(selectedKlient); fetchKlienti(); }
    else { alert("Chyba: " + res.error.message); }
  };

  const openEditClientModal = (k) => {
    setEditMode(true);
    setOriginalName(k.customer_name);
    setClientForm({
      customer_name: k.customer_name || '', customer_phone: k.customer_phone || '', customer_email: k.customer_email || '',
      client_type: k.client_type || 'Osoba', address: k.address || '', city: k.city || '', zip: k.zip || '',
      ico: k.ico || '', dic: k.dic || '', ic_dph: k.ic_dph || ''
    });
    setIsClientModalOpen(true);
  };

  const openEditCarModal = (car) => {
    setEditMode(true);
    const brandModel = car.car_brand_model || '';
    const parts = brandModel.split(' ');
    setCarForm({
      id: car.id, plate_number: car.plate_number || '', brand: parts[0] || '', model: parts.slice(1).join(' ') || '',
      vin_number: car.vin_number || '', engine_volume: car.engine_volume || '', engine_power: car.engine_power || '',
      year_produced: car.year_produced || '', fuel_type: car.fuel_type || 'Diesel'
    });
    setIsCarModalOpen(true);
  };

  const handleDeleteCar = async (carId) => {
    if (confirm('Naozaj vymazať toto vozidlo?')) {
      const { error } = await supabase.from('job_tickets').delete().eq('id', carId);
      if (!error) { nacitajVozidla(selectedKlient); fetchKlienti(); }
    }
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      const formattedData = data.map(row => ({
        customer_name: String(row.Meno || row.Firma || ''),
        customer_phone: String(row.Telefon || ''),
        customer_email: String(row.Email || ''),
        client_type: row.ICO ? 'Firma' : 'Osoba',
        address: String(row.Adresa || ''),
        city: String(row.Mesto || ''),
        zip: String(row.PSC || ''),
        ico: String(row.ICO || ''),
        dic: String(row.DIC || ''),
        ic_dph: String(row.ICDPH || ''),
        plate_number: 'NOVÝ-KLIENT',
        status: 'Archivované'
      })).filter(item => item.customer_name !== '');
      if (formattedData.length > 0) {
        const { error } = await supabase.from('job_tickets').insert(formattedData);
        if (error) alert("Chyba: " + error.message); else fetchKlienti();
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none">
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Garáž <span className="text-red-600 text-4xl">Dielne</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Filter: ŠPZ / MENO / VIN / ADRESA</p>
        </div>
        <div className="flex gap-3">
          <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase transition-all flex items-center gap-2 border border-zinc-700">
            📥 Import Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>
          <button onClick={() => { setEditMode(false); setClientForm({customer_name:'', customer_phone:'', customer_email:'', client_type:'Osoba', address:'', city:'', zip:'', ico:'', dic:'', ic_dph:''}); setIsClientModalOpen(true); }} className="bg-white text-black font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-xl">+ Nový Klient</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <input type="text" placeholder="Hľadať čokoľvek..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-6 shadow-inner" />
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {filteredKlienti.map((k, i) => (
              <button key={i} onClick={() => nacitajVozidla(k.customer_name)} className={`w-full text-left p-6 rounded-3xl border transition-all relative group ${selectedKlient === k.customer_name ? 'bg-red-600 border-red-600 shadow-2xl' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'}`}>
                <p className="text-2xl font-black uppercase tracking-tight italic">{k.customer_name}</p>
                <div className="flex flex-wrap gap-1 mt-2">{(k.all_plates || []).map(p => <span key={p} className="text-sm bg-black/30 px-2 py-0.5 rounded text-zinc-400 font-mono">{p}</span>)}</div>
                <span onClick={(e) => { e.stopPropagation(); openEditClientModal(k); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-3 rounded-xl text-xs hover:bg-white hover:text-black transition-all border border-zinc-800 cursor-pointer">✏️</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedKlient ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Vozidlá: <span className="text-red-600">{selectedKlient}</span></h2>
                <button onClick={() => { setEditMode(false); setCarForm({id:'', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel' }); setIsCarModalOpen(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase border border-zinc-700 shadow-lg">+ Pridať Vozidlo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {vozidla.map((v) => (
                  <div key={v.id} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] relative group hover:border-red-600 shadow-xl transition-all">
                    <div className="absolute top-6 right-8 flex gap-2 z-10">
                      <button onClick={() => openEditCarModal(v)} className="bg-zinc-800/80 hover:bg-white border border-zinc-700 text-white hover:text-black p-3 rounded-xl transition-all text-xs">✏️</button>
                      <button onClick={() => handleDeleteCar(v.id)} className="bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white p-3 rounded-xl transition-all text-xs">🗑️</button>
                    </div>
                    <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-2xl mb-6 inline-block shadow-2xl tracking-widest">{v.plate_number}</span>
                    <h3 className="text-2xl font-black uppercase italic mb-6">{v.car_brand_model}</h3>
                    <div className="space-y-3 bg-black/40 p-5 rounded-2xl border border-zinc-800/50 text-[11px] font-black uppercase tracking-widest text-zinc-300 mb-6">
                      <p className="flex justify-between font-mono border-b border-zinc-800/50 pb-2"><span>VIN:</span> <span>{v.vin_number || '---'}</span></p>
                      <p className="flex justify-between italic border-b border-zinc-800/50 pb-2"><span>Spec:</span> <span>{v.engine_volume} / {v.engine_power} kW</span></p>
                      <p className="flex justify-between font-bold italic"><span>Palivo/Rok:</span> <span>{v.fuel_type} • {v.year_produced || '---'}</span></p>
                    </div>
                    <Link href={`/zakazky/${v.id}`} className="w-full flex items-center justify-center gap-3 bg-red-600/10 border border-red-600/20 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all shadow-lg">📋 Otvoriť Zákazku</Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40 uppercase font-black tracking-[0.5em] text-sm text-center px-10">Vyberte klienta vľavo pre správu garáže</div>
          )}
        </div>
      </div>

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-4xl shadow-2xl my-auto">
            <h2 className="text-4xl font-black uppercase italic mb-10 text-white text-center tracking-tighter">{editMode ? 'Profil Partnera' : 'Nový Partner'}</h2>
            <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex bg-black p-1 rounded-2xl border border-zinc-800">
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Osoba'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Osoba' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Súkromná Osoba</button>
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Firma'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Firma' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Firma / Živnostník</button>
                </div>
                <input required type="text" value={clientForm.customer_name || ''} onChange={(e) => setClientForm({...clientForm, customer_name: e.target.value})} placeholder="Meno / Obchodné meno" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input type="text" value={clientForm.customer_phone || ''} onChange={(e) => setClientForm({...clientForm, customer_phone: e.target.value})} placeholder="Telefónne číslo" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input type="email" value={clientForm.customer_email || ''} onChange={(e) => setClientForm({...clientForm, customer_email: e.target.value})} placeholder="E-mailová adresa" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
              </div>
              <div className="space-y-6">
                <input type="text" value={clientForm.address || ''} onChange={(e) => setClientForm({...clientForm, address: e.target.value})} placeholder="Ulica a súpisné číslo" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={clientForm.zip || ''} onChange={(e) => setClientForm({...clientForm, zip: e.target.value})} placeholder="PSČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                  <input type="text" value={clientForm.city || ''} onChange={(e) => setClientForm({...clientForm, city: e.target.value})} placeholder="Mesto" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                </div>
                {clientForm.client_type === 'Firma' && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-300">
                    <input type="text" value={clientForm.ico || ''} onChange={(e) => setClientForm({...clientForm, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <input type="text" value={clientForm.dic || ''} onChange={(e) => setClientForm({...clientForm, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <input type="text" value={clientForm.ic_dph || ''} onChange={(e) => setClientForm({...clientForm, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex gap-5 pt-6">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest transition-colors hover:text-white">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-6 rounded-3xl uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-2xl">{editMode ? 'Uložiť zmeny partnera' : 'Registrovať partnera'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCarModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] w-full max-w-4xl shadow-2xl my-auto">
            <h2 className="text-4xl font-black uppercase italic mb-10 text-white text-center tracking-tighter">Technické údaje</h2>
            <form onSubmit={handleSaveCar} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow w-full">
                  <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">ŠPZ Vozidla</label>
                  <input required type="text" value={carForm.plate_number || ''} onChange={(e) => setCarForm({...carForm, plate_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-red-600 outline-none shadow-inner uppercase" />
                </div>
                <button type="button" className="bg-zinc-800 hover:bg-red-600 text-zinc-400 hover:text-white font-black px-6 py-6 rounded-3xl text-[10px] uppercase transition-all border border-zinc-700 whitespace-nowrap h-[78px]">
                  🔍 Načítať podľa ŠPZ (čoskoro)
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka (Brand)</label>
                <input required type="text" value={carForm.brand || ''} onChange={(e) => setCarForm({...carForm, brand: e.target.value})} placeholder="napr. Škoda" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner" />
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Model</label>
                <input required type="text" value={carForm.model || ''} onChange={(e) => setCarForm({...carForm, model: e.target.value})} placeholder="napr. Octavia III" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner" />
              </div>

              <div className="md:col-span-2"><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label><input required type="text" maxLength={17} value={carForm.vin_number || ''} onChange={(e) => setCarForm({...carForm, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-mono font-bold outline-none tracking-wider focus:border-red-600 shadow-inner" /></div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Objem (cm³)</label><input type="text" value={carForm.engine_volume || ''} onChange={(e) => setCarForm({...carForm, engine_volume: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner"/></div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Výkon (kW)</label><input type="text" value={carForm.engine_power || ''} onChange={(e) => setCarForm({...carForm, engine_power: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner"/></div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Rok výroby</label><input type="number" value={carForm.year_produced || ''} onChange={(e) => setCarForm({...carForm, year_produced: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner"/></div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Palivo</label><select value={carForm.fuel_type || 'Diesel'} onChange={(e) => setCarForm({...carForm, fuel_type: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none appearance-none focus:border-red-600 shadow-inner"><option value="Diesel">Diesel</option><option value="Benzín">Benzín</option><option value="Hybrid">Hybrid</option><option value="Elektro">Elektro</option></select></div>
              
              <div className="flex gap-5 pt-8 md:col-span-2">
                <button type="button" onClick={() => setIsCarModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest transition-colors hover:text-white">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-widest shadow-xl hover:bg-red-500 transition-all">Uložiť technické zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}