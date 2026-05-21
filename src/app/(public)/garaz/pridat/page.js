'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { trackAddVehicle } from '@/app/lib/analytics';

export default function PridatAutoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false); 
  
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    plate_number: '',
    vin: '',
    year: '',
    engine_volume: '',
    engine_power: '',
    fuel_type: 'Diesel',
    mileage: ''
  });

  // --- FUNKCIA 1: NACÍTANIE Z API (ŠPZ) - ZACHOVANÁ A OPRAVENÁ PRE TVOJ JSON ---
  const handleLookup = async () => {
    if (!formData.plate_number) {
      alert("Najprv zadajte ŠPZ (EČV)!");
      return;
    }
    setApiLoading(true);
    try {
      const res = await fetch(`/api/vehicle-lookup?ecv=${formData.plate_number.toUpperCase().replace(/\s/g, '')}`);
      const result = await res.json();
      
      // Upravené na tvoj reálny JSON ("vehicle")
      if (result && result.vehicle) {
        const v = result.vehicle;
        const yearOnly = v.dat_prva_evid ? v.dat_prva_evid.split('.').pop() : '';
        
        setFormData({
          ...formData,
          brand: v.znacka || '',
          model: v.obch_nazov || '',
          vin: v.vin || '',
          year: yearOnly,
          engine_volume: v.objem || '',
          engine_power: v.vykon || '',
          fuel_type: v.druh_paliva === 'Nafta' ? 'Diesel' : (v.druh_paliva || 'Diesel'),
          plate_number: v.ecv || formData.plate_number
        });
        alert(`Vozidlo ${v.znacka} nájdené!`);
      } else {
        alert("Vozidlo sa v databáze nenašlo.");
      }
    } catch (err) {
      alert("Chyba pri načítaní údajov z databázy vozidiel.");
    } finally {
      setApiLoading(false);
    }
  };

  // --- FUNKCIA 2: SCAN TP (AI) - CLIENT-SIDE ---
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
      setFormData(prev => ({
        ...prev,
        brand: carData.brand || prev.brand,
        model: carData.model || prev.model,
        vin: carData.vin || prev.vin,
        year: carData.year || prev.year,
        engine_volume: carData.engine_volume || prev.engine_volume,
        engine_power: carData.engine_power || prev.engine_power,
        fuel_type: carData.fuel_type || prev.fuel_type,
      }));
      alert("Údaje z TP načítané pomocou AI!");
    } catch (err) {
      console.error("AI Error:", err);
      alert("Chyba pri skenovaní TP AI modelom.");
    }
    setApiLoading(false);
  };

  // --- FUNKCIA 3: ZÁPIS DO SUPABASE - MAPOVANIE NA TVOJU TABUĽKU ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Užívateľ nie je prihlásený.");

      // Mapovanie presne na tvoje stĺpce v DB
      const payload = {
        license_plate: formData.plate_number.toUpperCase().replace(/\s/g, ''),
        vin_number: formData.vin.toUpperCase().trim(),
        brand_model: `${formData.brand} ${formData.model}`.trim(),
        year_produced: formData.year ? parseFloat(formData.year) : null,
        engine_volume: formData.engine_volume ? parseInt(formData.engine_volume) : null,
        engine_power: formData.engine_power ? parseInt(formData.engine_power) : null,
        fuel_type: formData.fuel_type,
        mileage: formData.mileage ? parseInt(formData.mileage) : 0,
        owner_id: user.id,
        owner_email: user.email,
        owner_name: user.user_metadata?.full_name || user.email.split('@')[0],
        delete_requested: false
      };

      const { error: insertError } = await supabase.from('vehicles').insert([payload]);
      if (insertError) throw insertError;

      trackAddVehicle();
      router.push('/garaz');
      router.refresh();
    } catch (error) {
      alert("Chyba pri ukladaní: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center font-bold">
      <div className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-2xl border border-zinc-800 shadow-2xl my-10 font-bold">
        <h1 className="text-2xl font-black uppercase italic mb-8">
          Pridať <span className="text-red-600">vozidlo do garáže</span>
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ŠPZ / EČV */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold">ŠPZ (EČV)</label>
            <div className="flex gap-2 font-bold">
              <input 
                placeholder="KE123AB" 
                value={formData.plate_number}
                className="flex-grow bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold uppercase" 
                onChange={e => setFormData({...formData, plate_number: e.target.value})} 
              />
              <button 
                type="button"
                onClick={handleLookup}
                disabled={apiLoading}
                className="px-6 rounded-xl font-black text-[10px] uppercase bg-red-600/10 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all"
              >
                {apiLoading ? 'Hľadám...' : '⚡ Načítať'}
              </button>
            </div>
          </div>

          {/* AI SKENER TP */}
          <div className="mt-4 p-4 border-2 border-dashed border-zinc-800 rounded-2xl text-center bg-black/30">
            <label className="cursor-pointer block">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-red-600 transition-colors">
                {apiLoading ? 'Skenujem dokument...' : '📷 Odfotiť alebo nahrať Technický preukaz'}
              </span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoUpload} 
                disabled={apiLoading}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Značka</label>
              <input required value={formData.brand} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Model</label>
              <input required value={formData.model} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, model: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold">VIN (17 znakov)</label>
            <input required maxLength={17} value={formData.vin} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-mono text-sm uppercase font-bold" 
              onChange={e => setFormData({...formData, vin: e.target.value})} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Objem (cm³)</label>
              <input type="number" value={formData.engine_volume} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, engine_volume: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Výkon (kW)</label>
              <input type="number" value={formData.engine_power} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, engine_power: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Palivo</label>
              <select className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold appearance-none cursor-pointer"
                value={formData.fuel_type}
                onChange={e => setFormData({...formData, fuel_type: e.target.value})}>
                <option value="Diesel">Diesel</option>
                <option value="Benzín">Benzín</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Elektro">Elektro</option>
                <option value="LPG/CNG">LPG/CNG</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Rok výroby</label>
              <input type="number" value={formData.year} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, year: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Tachometer (km)</label>
              <input type="number" value={formData.mileage} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, mileage: e.target.value})} />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg mt-6 font-bold"
          >
            {loading ? 'Zapisujem...' : 'Uložiť do mojej garáže'}
          </button>
        </form>
      </div>
    </div>
  );
}