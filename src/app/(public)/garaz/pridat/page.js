'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PridatAutoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false); // Pre tlačidlo načítania
  
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

  // --- NOVÁ FUNKCIA: NACÍTANIE Z API (databazavozidiel.sk) ---
  const handleLookup = async () => {
    if (!formData.plate_number) {
      alert("Najprv zadajte ŠPZ (EČV)!");
      return;
    }

    setApiLoading(true);
    try {
      // Voláme tvoj interný mostík (Route), ktorý vytvoríš v /api/vehicle-lookup/route.js
      const res = await fetch(`/api/vehicle-lookup?ecv=${formData.plate_number.toUpperCase().replace(/\s/g, '')}`);
      const result = await res.json();

      if (result.status && result.car) {
        const c = result.car;
        
        // Získanie roku z formátu "15.11.2018"
        const yearOnly = c.dat_prva_evid ? c.dat_prva_evid.split('.').pop() : '';

        // Automatické priradenie hodnôt do formulára
        setFormData({
          ...formData,
          brand: c.znacka || '',
          model: c.obch_nazov || '',
          vin: c.vin || '',
          year: yearOnly,
          engine_volume: c.objem || '',
          engine_power: c.vykon || '',
          // Ak API vráti "Nafta", prepneme na "Diesel" kvôli tvojmu selectu
          fuel_type: c.druh_paliva === 'Nafta' ? 'Diesel' : (c.druh_paliva || 'Diesel'),
        });
      } else {
        alert("Vozidlo s touto ŠPZ sa v databáze nenašlo.");
      }
    } catch (err) {
      alert("Chyba pri načítaní údajov z databázy.");
      console.error(err);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.vin.length !== 17) {
      alert("VIN číslo musí mať presne 17 znakov!");
      return;
    }
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Užívateľ nie je prihlásený.");

      const { data: profiles } = await supabase.from('user_profiles').select('full_name').eq('id', user.id);
      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (!profile) {
        const defaultName = user.user_metadata?.full_name || user.email.split('@')[0];
        const { data: newProfile } = await supabase.from('user_profiles').insert([{ id: user.id, full_name: defaultName, email: user.email }]).select().single();
        profile = newProfile;
      }

      const finalOwnerName = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];

      const payload = {
        brand_model: `${formData.brand} ${formData.model}`.trim(),
        license_plate: formData.plate_number.toUpperCase().replace(/\s/g, ''),
        vin_number: formData.vin.toUpperCase().trim(),
        year_produced: formData.year || null,
        engine_volume: formData.engine_volume,
        engine_power: formData.engine_power,
        fuel_type: formData.fuel_type,
        mileage: formData.mileage,
        owner_id: user.id,
        owner_email: user.email,
        owner_name: finalOwnerName
      };

      const { error: insertError } = await supabase.from('vehicles').insert([payload]);
      if (insertError) throw insertError;

      router.push('/garaz');
      router.refresh();
    } catch (error) {
      alert("Chyba: " + error.message);
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
          
          {/* ŠPZ S TLAČIDLOM NAČÍTANIA */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold">ŠPZ (EČV)</label>
            <div className="flex gap-2 font-bold">
              <input 
                required 
                placeholder="KE123AB" 
                value={formData.plate_number}
                className="flex-grow bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold tracking-widest uppercase" 
                onChange={e => setFormData({...formData, plate_number: e.target.value})} 
              />
              <button 
                type="button"
                onClick={handleLookup}
                disabled={apiLoading}
                className={`px-6 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all border ${apiLoading ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-red-600/10 border-red-600 text-red-600 hover:bg-red-600 hover:text-white shadow-lg shadow-red-900/20'}`}
              >
                {apiLoading ? 'Hľadám...' : '⚡ Načítať z databázy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 font-bold">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Značka</label>
              <input required placeholder="napr. Škoda" value={formData.brand} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Model</label>
              <input required placeholder="napr. Octavia" value={formData.model} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, model: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold">VIN (17 znakov)</label>
            <input required maxLength={17} placeholder="VINKOD12345678901" value={formData.vin} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-mono text-sm uppercase font-bold" 
              onChange={e => setFormData({...formData, vin: e.target.value})} />
          </div>

          <div className="grid grid-cols-3 gap-4 font-bold">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Objem (cm³)</label>
              <input type="number" placeholder="1968" value={formData.engine_volume} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, engine_volume: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Výkon (kW)</label>
              <input type="number" placeholder="110" value={formData.engine_power} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
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

          <div className="grid grid-cols-2 gap-4 font-bold">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Rok výroby</label>
              <input type="number" placeholder="2020" value={formData.year} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, year: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Tachometer (km)</label>
              <input type="number" placeholder="150000" value={formData.mileage} className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, mileage: e.target.value})} />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg mt-6 active:scale-95 font-bold"
          >
            {loading ? 'Zapisujem...' : 'Uložiť do mojej garáže'}
          </button>
        </form>
      </div>
    </div>
  );
}