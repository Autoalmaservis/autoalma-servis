'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';

function PrijemForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Načítanie dát z kalendára (z URL adresy)
  const [formData, setFormData] = useState({
    customer_name: searchParams.get('klient') || '',
    plate_number: searchParams.get('spz') || '',
    description: searchParams.get('popis') || '',
    status: 'Otvorená', // Nová zákazka začína ako otvorená
    car_brand_model: '',
    vin_number: '',
    customer_phone: ''
  });

  const [loading, setLoading] = useState(false);

  // Automatické dotiahnutie detailov o aute a klientovi z databázy podľa ŠPZ
  useEffect(() => {
    const autoDoplnenie = async () => {
      if (formData.plate_number) {
        const { data } = await supabase
          .from('job_tickets')
          .select('*')
          .eq('plate_number', formData.plate_number.toUpperCase())
          .limit(1)
          .single();

        if (data) {
          setFormData(prev => ({
            ...prev,
            car_brand_model: data.car_brand_model || '',
            vin_number: data.vin_number || '',
            customer_phone: data.customer_phone || '',
            customer_name: data.customer_name || prev.customer_name
          }));
        }
      }
    };
    autoDoplnenie();
  }, [formData.plate_number]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('job_tickets')
      .insert([formData]);

    if (!error) {
      alert("Zákazkový list úspešne vytvorený!");
      router.push('/'); // Návrat na dashboard
    } else {
      alert("Chyba: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white">
      <header className="mb-12 border-l-4 border-blue-600 pl-6">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">
          Nový <span className="text-blue-600">Zákazkový List</span>
        </h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Príjem vozidla do opravy
        </p>
      </header>

      <form onSubmit={handleSave} className="max-w-4xl bg-zinc-900/40 border border-zinc-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
        
        {/* SEKCIA: VOZIDLO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">ŠPZ Vozidla</label>
            <input 
              required 
              type="text" 
              value={formData.plate_number} 
              onChange={(e) => setFormData({...formData, plate_number: e.target.value.toUpperCase()})}
              className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-blue-600 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka a Model</label>
            <input 
              type="text" 
              value={formData.car_brand_model} 
              onChange={(e) => setFormData({...formData, car_brand_model: e.target.value})}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-blue-600"
              placeholder="napr. Škoda Octavia"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label>
            <input 
              type="text" 
              value={formData.vin_number} 
              onChange={(e) => setFormData({...formData, vin_number: e.target.value.toUpperCase()})}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-mono outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <hr className="border-zinc-800" />

        {/* SEKCIA: KLIENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Meno Zákazníka</label>
            <input 
              required
              type="text" 
              value={formData.customer_name} 
              onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Telefón</label>
            <input 
              type="text" 
              value={formData.customer_phone} 
              onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* SEKCIA: POPIS ZÁVADY */}
        <div>
          <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Popis závady a požiadavky</label>
          <textarea 
            rows="4"
            value={formData.description} 
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-white outline-none focus:border-blue-600 resize-none"
            placeholder="Popíšte čo treba opraviť..."
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 transition-all"
        >
          {loading ? 'Ukladám...' : 'Potvrdiť príjem a otvoriť zákazku'}
        </button>
      </form>
    </div>
  );
}

// Obalenie do Suspense je nutné kvôli useSearchParams
export default function PrijemPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white animate-pulse uppercase font-black">Načítavam formulár...</div>}>
      <PrijemForm />
    </Suspense>
  );
}