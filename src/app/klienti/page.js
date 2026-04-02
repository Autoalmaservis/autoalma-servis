'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function KlientiPage() {
  const [klienti, setKlienti] = useState([]);
  const [selectedKlient, setSelectedKlient] = useState(null);
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stavy pre Modaly
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Dáta formulárov
  const [clientForm, setClientForm] = useState({ customer_name: '', customer_phone: '', customer_email: '' });
  const [carForm, setCarForm] = useState({ plate_number: '', car_brand_model: '', vin_number: '', engine_volume: '', year_produced: '' });

  useEffect(() => { fetchKlienti(); }, []);

  const fetchKlienti = async () => {
    setLoading(true);
    const { data } = await supabase.from('job_tickets').select('customer_name, customer_phone, customer_email').order('customer_name');
    if (data) {
      const unique = Array.from(new Set(data.map(a => a.customer_name)))
        .map(name => data.find(a => a.customer_name === name));
      setKlienti(unique);
    }
    setLoading(false);
  };

  const nacitajVozidla = async (meno) => {
    setSelectedKlient(meno);
    const { data } = await supabase.from('job_tickets').select('*').eq('customer_name', meno);
    if (data) {
      // Filtrujeme záznamy, ktoré majú ŠPZ (ignorujeme fiktívne záznamy len pre kontakt)
      const uniqueVozidla = Array.from(new Set(data.map(a => a.plate_number)))
        .map(plate => data.find(a => a.plate_number === plate))
        .filter(v => v.plate_number && v.plate_number !== 'NOVÝ-KLIENT');
      setVozidla(uniqueVozidla);
    }
  };

  // Uloženie/Editácia klienta
  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (editMode) {
      await supabase.from('job_tickets').update({
        customer_phone: clientForm.customer_phone,
        customer_email: clientForm.customer_email
      }).eq('customer_name', clientForm.customer_name);
    } else {
      await supabase.from('job_tickets').insert([{
        customer_name: clientForm.customer_name,
        customer_phone: clientForm.customer_phone,
        customer_email: clientForm.customer_email,
        plate_number: 'NOVÝ-KLIENT'
      }]);
    }
    setIsClientModalOpen(false);
    setEditMode(false);
    fetchKlienti();
  };

  // Uloženie nového auta ku klientovi
  const handleAddCar = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('job_tickets').insert([{
      customer_name: selectedKlient,
      plate_number: carForm.plate_number.toUpperCase(),
      car_brand_model: carForm.car_brand_model,
      vin_number: carForm.vin_number.toUpperCase(),
      engine_volume: carForm.engine_volume,
      year_produced: carForm.year_produced,
      status: 'Archivované'
    }]);

    if (!error) {
      setIsCarModalOpen(false);
      setCarForm({ plate_number: '', car_brand_model: '', vin_number: '', engine_volume: '', year_produced: '' });
      nacitajVozidla(selectedKlient);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none">
      
      {/* HLAVIČKA */}
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
            Garáž <span className="text-red-600 text-4xl">Dielne</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Správa klientov a technických dát</p>
        </div>
        <button 
          onClick={() => { setEditMode(false); setClientForm({customer_name:'', customer_phone:'', customer_email:''}); setIsClientModalOpen(true); }}
          className="bg-white text-black font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-white/5"
        >
          + Nový Klient
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* ZOZNAM KLIENTOV (Vľavo) */}
        <div className="lg:col-span-1 space-y-3">
          <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em] mb-4 ml-2">Databáza mien</p>
          {loading ? (
            <div className="p-10 text-zinc-800 font-black uppercase animate-pulse italic">Načítavam...</div>
          ) : (
            klienti.map((k, i) => (
              <div key={i} className="group relative">
                <button 
                  onClick={() => nacitajVozidla(k.customer_name)}
                  className={`w-full text-left p-6 rounded-3xl border transition-all flex justify-between items-center ${
                    selectedKlient === k.customer_name 
                    ? 'bg-red-600 border-red-600 shadow-2xl shadow-red-600/20' 
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div>
                    <p className="font-black uppercase tracking-tight text-md italic">{k.customer_name}</p>
                    <p className={`text-[10px] font-mono mt-1 ${selectedKlient === k.customer_name ? 'text-white/60' : 'text-zinc-600'}`}>
                      {k.customer_phone || 'BEZ KONTAKTU'}
                    </p>
                  </div>
                  <span className={`text-xl transition-transform ${selectedKlient === k.customer_name ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`}>→</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditMode(true); setClientForm(k); setIsClientModalOpen(true); }}
                  className="absolute right-12 top-7 opacity-0 group-hover:opacity-100 bg-black/50 p-2 rounded-lg hover:text-red-500 transition-all text-xs"
                >
                  ✏️
                </button>
              </div>
            ))
          )}
        </div>

        {/* DETAIL VOZIDIEL (Vpravo) */}
        <div className="lg:col-span-2">
          {selectedKlient ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">
                    Vozový park: <span className="text-red-600 underline decoration-zinc-800 underline-offset-8">{selectedKlient}</span>
                  </h2>
                </div>
                <button 
                  onClick={() => setIsCarModalOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all border border-zinc-700 shadow-lg"
                >
                  + Pridať Vozidlo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {vozidla.length > 0 ? vozidla.map((v) => (
                  <div key={v.id} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] relative group hover:border-red-600/40 transition-all shadow-xl">
                    <div className="flex justify-between items-start mb-8">
                      <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-xl tracking-[0.15em] shadow-2xl border-2 border-zinc-200">
                        {v.plate_number}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase italic mb-6 leading-none group-hover:text-red-500 transition-colors">
                      {v.car_brand_model}
                    </h3>
                    <div className="space-y-3 bg-black/40 p-5 rounded-2xl border border-zinc-800/50">
                      <div className="flex justify-between text-[11px] uppercase font-black"><span className="text-zinc-600">VIN:</span> <span className="text-zinc-300 font-mono tracking-tighter">{v.vin_number || '---'}</span></div>
                      <div className="flex justify-between text-[11px] uppercase font-black"><span className="text-zinc-600">Spec:</span> <span className="text-zinc-300 italic">{v.engine_volume} {v.engine_power}</span></div>
                      <div className="flex justify-between text-[11px] uppercase font-black"><span className="text-zinc-600">Rok:</span> <span className="text-zinc-300">{v.year_produced || '---'}</span></div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-2 text-center py-24 bg-zinc-950 border-2 border-dashed border-zinc-900 rounded-[4rem]">
                    <p className="text-zinc-800 font-black uppercase text-sm tracking-[0.4em] italic leading-relaxed">
                      Zatiaľ žiadne registrované auto<br/>
                      <span className="text-zinc-900 text-xs font-bold normal-case tracking-normal">Použite tlačidlo vyššie pre pridanie nového vozidla.</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40">
              <span className="text-8xl mb-6 grayscale">🏎️</span>
              <p className="font-black uppercase tracking-[0.5em] text-sm">Vyberte klienta v zozname</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: PRIDAŤ VOZIDLO */}
      {isCarModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-10 md:p-14 rounded-[4rem] w-full max-w-2xl shadow-2xl relative animate-in zoom-in duration-300">
            <h2 className="text-4xl font-black uppercase italic mb-2 text-white tracking-tighter">Registrácia auta</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-12 border-l-2 border-red-600 pl-4">Vlastník: {selectedKlient}</p>
            
            {/* INTELIGENTNÉ ZDROJE DÁT */}
            <div className="grid grid-cols-3 gap-5 mb-12">
              <button className="bg-zinc-800/50 hover:bg-zinc-800 p-6 rounded-[2rem] flex flex-col items-center gap-4 transition-all border border-zinc-800 hover:border-zinc-600 group">
                <span className="text-4xl group-hover:scale-110 transition-transform">📷</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Skenovať TP</span>
              </button>
              <button className="bg-blue-900/10 border border-blue-500/20 hover:bg-blue-900/20 p-6 rounded-[2rem] flex flex-col items-center gap-4 transition-all text-blue-400 group">
                <span className="text-4xl group-hover:scale-110 transition-transform">🌐</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Externé Dáta</span>
              </button>
              <button className="bg-zinc-800/50 hover:bg-zinc-800 p-6 rounded-[2rem] flex flex-col items-center gap-4 transition-all border border-zinc-800 hover:border-zinc-600 group">
                <span className="text-4xl group-hover:scale-110 transition-transform">⌨️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Manuálne</span>
              </button>
            </div>

            <form onSubmit={handleAddCar} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">ŠPZ Vozidla</label>
                <input required type="text" value={carForm.plate_number} onChange={(e) => setCarForm({...carForm, plate_number: e.target.value.toUpperCase()})} placeholder="napr. BL123XX" className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-red-600 outline-none transition-all shadow-inner"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka a Model</label>
                <input required type="text" value={carForm.car_brand_model} onChange={(e) => setCarForm({...carForm, car_brand_model: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label>
                <input type="text" value={carForm.vin_number} onChange={(e) => setCarForm({...carForm, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-mono outline-none focus:border-red-600"/>
              </div>
              <div className="flex gap-5 pt-8 md:col-span-2">
                <button type="button" onClick={() => setIsCarModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-2xl shadow-red-600/30 hover:bg-red-500 transition-all">Uložiť do Garáže</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVÝ/UPRAVIŤ KLIENTA */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black uppercase italic mb-10 text-white tracking-tighter">
              {editMode ? 'Úprava kontaktu' : 'Nový Klient'}
            </h2>
            <form onSubmit={handleSaveClient} className="space-y-6 text-left">
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Meno a Priezvisko</label>
                <input required type="text" value={clientForm.customer_name} disabled={editMode} onChange={(e) => setClientForm({...clientForm, customer_name: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 disabled:opacity-30"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Mobil / Telefón</label>
                <input type="text" value={clientForm.customer_phone} onChange={(e) => setClientForm({...clientForm, customer_phone: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">E-mail</label>
                <input type="email" value={clientForm.customer_email} onChange={(e) => setClientForm({...clientForm, customer_email: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600"/>
              </div>
              <div className="flex gap-5 pt-10">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-5 rounded-3xl uppercase text-xs tracking-widest shadow-xl hover:bg-red-600 hover:text-white transition-all">
                  {editMode ? 'Uložiť zmeny' : 'Vytvoriť profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}