'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GarazPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const router = useRouter();

  // --- STAVY PRE EDITÁCIU VOZIDLA (Všetky polia) ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editForm, setEditForm] = useState({
    brand_model: '',
    license_plate: '',
    vin: '',
    year: '',
    engine_volume: '',
    engine_power: '',
    fuel_type: 'Diesel',
    mileage: ''
  });

  // --- STAVY PRE EDITÁCIU PROFILU ---
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    company_name: '',
    ico: '',
    dic: '',
    ic_dph: '',
    country: 'Slovensko'
  });

  useEffect(() => {
    checkUserAndData();
  }, []);

  const checkUserAndData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // 1. Načítame profil klienta
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
        setProfileForm({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
          city: profile.city || '',
          zip: profile.zip || '',
          company_name: profile.company_name || '',
          ico: profile.ico || '',
          dic: profile.dic || '',
          ic_dph: profile.ic_dph || '',
          country: profile.country || 'Slovensko'
        });
      }

      // 2. Načítame vozidlá
      const { data: vehicleData, error: vehError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_id', user.id);
      
      if (vehError) throw vehError;
      setVehicles(vehicleData || []);
    } catch (err) {
      console.error("Chyba pri načítaní:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIKA PROFILU ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(profileForm)
        .eq('id', userProfile.id);

      if (error) throw error;
      setIsProfileModalOpen(false);
      checkUserAndData();
    } catch (err) {
      alert("Chyba pri ukladaní profilu: " + err.message);
    }
  };

  // --- LOGIKA VOZIDIEL ---
  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setEditForm({
      brand_model: vehicle.brand_model || '',
      license_plate: vehicle.license_plate || '',
      vin: vehicle.vin || '',
      year: vehicle.year || '',
      engine_volume: vehicle.engine_volume || '',
      engine_power: vehicle.engine_power || '',
      fuel_type: vehicle.fuel_type || 'Diesel',
      mileage: vehicle.mileage || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          brand_model: editForm.brand_model,
          license_plate: editForm.license_plate.toUpperCase().trim(),
          vin: editForm.vin.toUpperCase().trim(),
          year: editForm.year,
          engine_volume: editForm.engine_volume,
          engine_power: editForm.engine_power,
          fuel_type: editForm.fuel_type,
          mileage: editForm.mileage
        })
        .eq('id', editingVehicle.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      checkUserAndData();
    } catch (err) {
      alert("Chyba pri aktualizácii: " + err.message);
    }
  };

  const handleDelete = async (id, plate) => {
    if (confirm(`Naozaj chcete odstrániť vozidlo ${plate} zo svojej garáže?`)) {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (!error) {
        setVehicles(vehicles.filter(v => v.id !== id));
      } else {
        alert("Chyba pri mazaní: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-zinc-500 uppercase font-black text-[10px] tracking-widest">Otváram garáž...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* HLAVIČKA */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-zinc-800 pb-8 gap-4">
          <div>
            <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Moja Klientska Zóna</p>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none flex items-center gap-4">
              {userProfile?.full_name}
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="text-[10px] bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl hover:bg-white hover:text-black transition-all not-italic tracking-normal font-black uppercase"
              >
                ⚙️ Upraviť profil
              </button>
            </h1>
          </div>
          <button onClick={handleLogout} className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all">
            Odhlásiť sa
          </button>
        </header>

        {/* ZOZNAM VOZIDIEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] relative group hover:border-zinc-700 transition-all shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-xl tracking-tighter shadow-lg">{vehicle.license_plate}</div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(vehicle)} className="p-3 bg-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                  <button onClick={() => handleDelete(vehicle.id, vehicle.license_plate)} className="p-3 bg-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs">🗑️</button>
                </div>
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tight mb-1">{vehicle.brand_model}</h2>
              <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-8">VIN: {vehicle.vin || 'Neuvedené'}</p>
              <div className="grid grid-cols-2 gap-4">
                <button className="bg-zinc-800 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all">História</button>
                <button className="bg-red-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-lg">Objednať</button>
              </div>
            </div>
          ))}
          <button onClick={() => router.push('/garaz/pridat')} className="border-2 border-dashed border-zinc-800 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-red-600/50 transition-all group min-h-[300px]">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-3xl group-hover:bg-red-600 transition-all">+</div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 group-hover:text-white">Zaparkovať nové vozidlo</span>
          </button>
        </div>
      </div>

      {/* MODAL PROFILU */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-3xl shadow-2xl my-auto">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600">Moje klientske údaje</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">Meno a kontakt</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} placeholder="Meno a Priezvisko" />
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} placeholder="Telefón" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">Adresa trvalého bydliska</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} placeholder="Ulica a č." />
                  <div className="grid grid-cols-2 gap-2">
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.city} onChange={(e) => setProfileForm({...profileForm, city: e.target.value})} placeholder="Mesto" />
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.zip} onChange={(e) => setProfileForm({...profileForm, zip: e.target.value})} placeholder="PSČ" />
                  </div>
                </div>
              </div>
              
              <div className="border-t border-zinc-800 pt-8 space-y-4">
                <label className="text-[10px] font-black text-blue-500 uppercase ml-2 tracking-widest">Fakturačné údaje firmy</label>
                <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600" value={profileForm.company_name} onChange={(e) => setProfileForm({...profileForm, company_name: e.target.value})} placeholder="Obchodné meno spoločnosti" />
                <div className="grid grid-cols-3 gap-2">
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600" value={profileForm.ico} onChange={(e) => setProfileForm({...profileForm, ico: e.target.value})} placeholder="IČO" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600" value={profileForm.dic} onChange={(e) => setProfileForm({...profileForm, dic: e.target.value})} placeholder="DIČ" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600" value={profileForm.ic_dph} onChange={(e) => setProfileForm({...profileForm, ic_dph: e.target.value})} placeholder="IČ DPH" />
                </div>
              </div>

              <div className="flex gap-6 pt-6">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all shadow-xl">Uložiť klientske dáta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOZIDLA (Všetky technické polia) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-auto">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600">Úprava technických údajov</h2>
            <form onSubmit={handleUpdateVehicle} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Značka a Model</label>
                <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold" value={editForm.brand_model} onChange={(e) => setEditForm({...editForm, brand_model: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">ŠPZ</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold uppercase tracking-widest" value={editForm.license_plate} onChange={(e) => setEditForm({...editForm, license_plate: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Rok výroby</label>
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">VIN číslo</label>
                <input required maxLength={17} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-mono text-sm uppercase" value={editForm.vin} onChange={(e) => setEditForm({...editForm, vin: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Objem (cm³)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={editForm.engine_volume} onChange={(e) => setEditForm({...editForm, engine_volume: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Výkon (kW)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={editForm.engine_power} onChange={(e) => setEditForm({...editForm, engine_power: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Palivo</label>
                  <select className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 appearance-none" value={editForm.fuel_type} onChange={(e) => setEditForm({...editForm, fuel_type: e.target.value})}>
                    <option value="Diesel">Diesel</option>
                    <option value="Benzín">Benzín</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Elektro">Elektro</option>
                    <option value="LPG/CNG">LPG/CNG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest">Stav tachometra (km)</label>
                <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={editForm.mileage} onChange={(e) => setEditForm({...editForm, mileage: e.target.value})} />
              </div>

              <div className="flex gap-6 pt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-700 transition-all shadow-xl">Uložiť vozidlo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}