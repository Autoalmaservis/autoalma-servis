'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link'; // PRIDANÉ: Potrebné pre navigáciu

const CAR_DATABASE = {
  "Škoda": ["Octavia", "Superb", "Fabia", "Karoq", "Kodiaq", "Scala", "Kamiq", "Enyaq"],
  "Volkswagen": ["Golf", "Passat", "Tiguan", "Touareg", "Touran", "Polo", "Arteon", "ID.4"],
  "Audi": ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron"],
  "BMW": ["Rad 1", "Rad 3", "Rad 5", "Rad 7", "X1", "X3", "X5", "X6"],
  "Mercedes-Benz": ["Trieda A", "Trieda C", "Trieda E", "Trieda S", "GLC", "GLE"],
  "Hyundai": ["i20", "i30", "Tucson", "Santa Fe", "Kona"],
  "Kia": ["Ceed", "Sportage", "Sorento", "Rio", "EV6"],
  "Toyota": ["Corolla", "Yaris", "RAV4", "Hilux", "C-HR"],
  "Ford": ["Focus", "Mondeo", "Kuga", "Ranger"],
  "Peugeot": ["208", "308", "508", "2008", "3008"],
  "Renault": ["Clio", "Megane", "Captur", "Master"]
};

export default function KlientiPage() {
  const [klienti, setKlienti] = useState([]);
  const [selectedKlient, setSelectedKlient] = useState(null);
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [clientForm, setClientForm] = useState({ customer_name: '', customer_phone: '', customer_email: '' });
  const [carForm, setCarForm] = useState({ 
    id: '', 
    plate_number: '', 
    brand: '', 
    model: '', 
    vin_number: '', 
    engine_volume: '', 
    engine_power: '', 
    year_produced: '',
    fuel_type: 'Diesel'
  });

  useEffect(() => { fetchKlienti(); }, []);

  const fetchKlienti = async () => {
    setLoading(true);
    const { data } = await supabase.from('job_tickets').select('customer_name, customer_phone, customer_email').order('customer_name');
    if (data) {
      const unique = Array.from(new Set(data.map(a => a.customer_name))).map(name => data.find(a => a.customer_name === name));
      setKlienti(unique);
    }
    setLoading(false);
  };

  const nacitajVozidla = async (meno) => {
    setSelectedKlient(meno);
    const { data } = await supabase.from('job_tickets').select('*').eq('customer_name', meno);
    if (data) {
      const uniqueVozidla = Array.from(new Set(data.map(a => a.plate_number)))
        .map(plate => data.find(a => a.plate_number === plate))
        .filter(v => v.plate_number && v.plate_number !== 'NOVÝ-KLIENT');
      setVozidla(uniqueVozidla);
    }
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (editMode) {
      await supabase.from('job_tickets').update({ customer_phone: clientForm.customer_phone, customer_email: clientForm.customer_email }).eq('customer_name', clientForm.customer_name);
    } else {
      await supabase.from('job_tickets').insert([{ customer_name: clientForm.customer_name, customer_phone: clientForm.customer_phone, customer_email: clientForm.customer_email, plate_number: 'NOVÝ-KLIENT' }]);
    }
    setIsClientModalOpen(false);
    fetchKlienti();
  };

  const handleDeleteCar = async (carId) => {
    if (confirm('Naozaj chcete vymazať toto vozidlo z garáže?')) {
      const { error } = await supabase.from('job_tickets').delete().eq('id', carId);
      if (!error) nacitajVozidla(selectedKlient);
    }
  };

  const openEditCarModal = (car) => {
    setEditMode(true);
    const parts = car.car_brand_model.split(' ');
    const brand = parts[0];
    const model = parts.slice(1).join(' ');
    setCarForm({
      id: car.id,
      plate_number: car.plate_number,
      brand: brand,
      model: model,
      vin_number: car.vin_number || '',
      engine_volume: car.engine_volume || '',
      engine_power: car.engine_power || '',
      year_produced: car.year_produced || '',
      fuel_type: car.fuel_type || 'Diesel'
    });
    setIsCarModalOpen(true);
  };

  const handleSaveCar = async (e) => {
    e.preventDefault();
    const spzUpper = carForm.plate_number.toUpperCase().trim();
    
    if (!carForm.id) {
      const { data: existing } = await supabase.from('job_tickets').select('customer_name').eq('plate_number', spzUpper).limit(1);
      if (existing && existing.length > 0) {
        alert(`CHYBA: ŠPZ ${spzUpper} už existuje u klienta: ${existing[0].customer_name}`);
        return;
      }
    }

    const payload = {
      customer_name: selectedKlient,
      plate_number: spzUpper,
      car_brand_model: `${carForm.brand} ${carForm.model}`,
      vin_number: carForm.vin_number.toUpperCase(),
      engine_volume: carForm.engine_volume,
      engine_power: carForm.engine_power,
      year_produced: carForm.year_produced,
      fuel_type: carForm.fuel_type,
      status: 'Archivované'
    };

    const { error } = carForm.id 
      ? await supabase.from('job_tickets').update(payload).eq('id', carForm.id)
      : await supabase.from('job_tickets').insert([payload]);

    if (!error) {
      setIsCarModalOpen(false);
      setCarForm({ id: '', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel' });
      nacitajVozidla(selectedKlient);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none">
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex justify-between items-center text-white">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Garáž <span className="text-red-600 text-4xl">Dielne</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Správa klientov a technických dát</p>
        </div>
        <button onClick={() => { setEditMode(false); setClientForm({customer_name:'', customer_phone:'', customer_email:''}); setIsClientModalOpen(true); }} className="bg-white text-black font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl">+ Nový Klient</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-3">
          {klienti.map((k, i) => (
            <div key={i} className="group relative">
              <button onClick={() => nacitajVozidla(k.customer_name)} className={`w-full text-left p-6 rounded-3xl border transition-all ${selectedKlient === k.customer_name ? 'bg-red-600 border-red-600 shadow-2xl' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'}`}>
                <p className="font-black uppercase tracking-tight italic">{k.customer_name}</p>
                <p className={`text-[10px] font-mono mt-1 ${selectedKlient === k.customer_name ? 'text-white/60' : 'text-zinc-600'}`}>{k.customer_phone || 'BEZ KONTAKTU'}</p>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setEditMode(true); setClientForm(k); setIsClientModalOpen(true); }} className="absolute right-6 top-7 opacity-0 group-hover:opacity-100 bg-black/50 p-2 rounded-lg hover:text-red-500 transition-all text-xs">✏️</button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedKlient ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">Vozidlá: <span className="text-red-600">{selectedKlient}</span></h2>
                <button onClick={() => { setEditMode(false); setCarForm({id:'', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel' }); setIsCarModalOpen(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase border border-zinc-700 shadow-lg">+ Pridať Vozidlo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {vozidla.map((v) => (
                  <div key={v.id} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] relative group hover:border-red-600/40 transition-all shadow-xl">
                    <div className="absolute top-6 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCarModal(v)} className="bg-zinc-800 p-2 rounded-lg hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                      <button onClick={() => handleDeleteCar(v.id)} className="bg-zinc-800 p-2 rounded-lg hover:bg-red-600 text-white transition-all text-xs">🗑️</button>
                    </div>
                    <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-xl mb-6 inline-block shadow-2xl tracking-widest">{v.plate_number}</span>
                    <h3 className="text-2xl font-black uppercase italic mb-6">{v.car_brand_model}</h3>
                    
                    <div className="space-y-3 bg-black/40 p-5 rounded-2xl border border-zinc-800/50 text-[11px] font-black uppercase tracking-widest text-zinc-300 mb-6">
                      <p className="flex justify-between font-mono border-b border-zinc-800/50 pb-2"><span className="text-zinc-600">VIN:</span> {v.vin_number || '---'}</p>
                      <p className="flex justify-between italic border-b border-zinc-800/50 pb-2"><span className="text-zinc-600">Spec:</span> {v.engine_volume} / {v.engine_power} kW</p>
                      <p className="flex justify-between"><span className="text-zinc-600">Rok:</span> {v.year_produced || '---'}</p>
                    </div>

                    {/* PRIDANÉ TLAČIDLO PRE HISTÓRIU OPRÁV */}
                    <Link 
                      href={`/historia/${v.id}`}
                      className="w-full flex items-center justify-center gap-3 bg-red-600/10 border border-red-600/20 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-600/5"
                    >
                      📊 História Opráv
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40 uppercase font-black tracking-[0.5em] text-sm">Vyberte klienta vľavo</div>
          )}
        </div>
      </div>

      {isCarModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] w-full max-w-3xl shadow-2xl relative overflow-y-auto max-h-[95vh]">
            <h2 className="text-4xl font-black uppercase italic mb-10 text-white tracking-tighter text-center">{carForm.id ? 'Úprava vozidla' : 'Registrácia vozidla'}</h2>
            <form onSubmit={handleSaveCar} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">ŠPZ Vozidla</label>
                <input required type="text" value={carForm.plate_number} onChange={(e) => setCarForm({...carForm, plate_number: e.target.value.toUpperCase()})} placeholder="SPZ..." className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-red-600 outline-none transition-all shadow-inner"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka</label>
                <select required value={carForm.brand} onChange={(e) => setCarForm({...carForm, brand: e.target.value, model: ''})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 appearance-none">
                  <option value="">-- Značka --</option>
                  {Object.keys(CAR_DATABASE).map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Model</label>
                <select required value={carForm.model} onChange={(e) => setCarForm({...carForm, model: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 appearance-none disabled:opacity-20" disabled={!carForm.brand}>
                  <option value="">-- Model --</option>
                  {carForm.brand && CAR_DATABASE[carForm.brand].map(model => <option key={model} value={model}>{model}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label>
                <input required type="text" maxLength={17} value={carForm.vin_number} onChange={(e) => setCarForm({...carForm, vin_number: e.target.value.toUpperCase()})} placeholder="VIN..." className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-mono font-bold outline-none focus:border-red-600 tracking-wider"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Objem (cm³)</label>
                <input type="text" value={carForm.engine_volume} onChange={(e) => setCarForm({...carForm, engine_volume: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Výkon (kW)</label>
                <input type="text" value={carForm.engine_power} onChange={(e) => setCarForm({...carForm, engine_power: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Rok výroby</label>
                <input type="number" value={carForm.year_produced} onChange={(e) => setCarForm({...carForm, year_produced: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Palivo</label>
                <select value={carForm.fuel_type} onChange={(e) => setCarForm({...carForm, fuel_type: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 appearance-none">
                  <option value="Diesel">Diesel</option>
                  <option value="Benzín">Benzín</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Elektro">Elektro</option>
                </select>
              </div>
              <div className="flex gap-5 pt-8 md:col-span-2">
                <button type="button" onClick={() => setIsCarModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-2xl shadow-red-600/30 hover:bg-red-500 transition-all">{carForm.id ? 'Uložiť zmeny' : 'Uložiť do Garáže'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3.5rem] w-full max-md shadow-2xl">
            <h2 className="text-3xl font-black uppercase italic mb-10 text-white tracking-tighter">{editMode ? 'Úprava kontaktu' : 'Nový Klient'}</h2>
            <form onSubmit={handleSaveClient} className="space-y-6">
              <input required type="text" value={clientForm.customer_name} disabled={editMode} onChange={(e) => setClientForm({...clientForm, customer_name: e.target.value})} placeholder="Meno a Priezvisko" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 disabled:opacity-30"/>
              <input type="text" value={clientForm.customer_phone} onChange={(e) => setClientForm({...clientForm, customer_phone: e.target.value})} placeholder="Telefón" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600"/>
              <input type="email" value={clientForm.customer_email} onChange={(e) => setClientForm({...clientForm, customer_email: e.target.value})} placeholder="E-mail" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600"/>
              <div className="flex gap-5 pt-10">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-5 rounded-3xl uppercase text-xs tracking-widest shadow-xl hover:bg-red-600 transition-all hover:text-white">{editMode ? 'Uložiť zmeny' : 'Vytvoriť profil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}