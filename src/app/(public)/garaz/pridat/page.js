'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PridatAutoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    plate_number: '',
    vin: '',
    year: '',
    engine_volume: '', // NOVÉ
    engine_power: '',  // NOVÉ
    fuel_type: 'Diesel', // NOVÉ
    mileage: ''       // NOVÉ
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.vin.length !== 17) {
      alert("VIN číslo musí mať presne 17 znakov!");
      return;
    }

    setLoading(true);

    try {
      // 1. Získame aktuálneho užívateľa
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Užívateľ nie je prihlásený.");

      // 2. SKONTROLUJEME PROFIL
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id);

      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // 3. Ak profil po resete neexistuje, vytvoríme ho
      if (!profile) {
        const defaultName = user.user_metadata?.full_name || user.email.split('@')[0];
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert([{ 
            id: user.id, 
            full_name: defaultName, 
            email: user.email 
          }])
          .select()
          .single();
        
        if (createError) {
          console.error("Nepodarilo sa vytvoriť profil:", createError);
        } else {
          profile = newProfile;
        }
      }

      // 4. PRÍPRAVA DÁT PRE AUTO (Zosúladené názvy stĺpcov s DB)
      const finalOwnerName = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];

      const payload = {
        brand_model: `${formData.brand} ${formData.model}`.trim(),
        license_plate: formData.plate_number.toUpperCase().replace(/\s/g, ''),
        vin_number: formData.vin.toUpperCase().trim(), // OPRAVENÉ: vin -> vin_number
        year_produced: formData.year || null,          // OPRAVENÉ: year -> year_produced
        engine_volume: formData.engine_volume,
        engine_power: formData.engine_power,
        fuel_type: formData.fuel_type,
        mileage: formData.mileage,
        owner_id: user.id,
        owner_email: user.email,
        owner_name: finalOwnerName
      };

      // 5. ZÁPIS DO TABUĽKY VEHICLES
      const { error: insertError } = await supabase
        .from('vehicles')
        .insert([payload]);

      if (insertError) throw insertError;

      // 6. PRESMEROVANIE
      router.push('/garaz');
      router.refresh();

    } catch (error) {
      console.error("Detail chyby:", error);
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
          {/* ZNAČKA A MODEL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Značka</label>
              <input required placeholder="napr. Škoda" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Model</label>
              <input required placeholder="napr. Octavia" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, model: e.target.value})} />
            </div>
          </div>

          {/* ŠPZ A VIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">ŠPZ</label>
              <input required placeholder="KE123AB" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold tracking-widest uppercase" 
                onChange={e => setFormData({...formData, plate_number: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">VIN (17 znakov)</label>
              <input required maxLength={17} placeholder="VINKOD12345678901" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-mono text-sm uppercase" 
                onChange={e => setFormData({...formData, vin: e.target.value})} />
            </div>
          </div>

          {/* MOTORIZÁCIA A PALIVO */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Objem (cm³)</label>
              <input type="number" placeholder="1968" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, engine_volume: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Výkon (kW)</label>
              <input type="number" placeholder="110" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, engine_power: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Palivo</label>
              <select className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold appearance-none cursor-pointer"
                onChange={e => setFormData({...formData, fuel_type: e.target.value})}>
                <option value="Diesel">Diesel</option>
                <option value="Benzín">Benzín</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Elektro">Elektro</option>
                <option value="LPG/CNG">LPG/CNG</option>
              </select>
            </div>
          </div>

          {/* ROK A KILOMETRE */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Rok výroby</label>
              <input type="number" placeholder="2020" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, year: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Stav tachometra (km)</label>
              <input type="number" placeholder="150000" className="w-full bg-black p-4 rounded-xl border border-zinc-800 outline-none focus:border-red-600 font-bold" 
                onChange={e => setFormData({...formData, mileage: e.target.value})} />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg mt-6 active:scale-95"
          >
            {loading ? 'Zapisujem...' : 'Uložiť do mojej garáže'}
          </button>
        </form>
      </div>
    </div>
  );
}