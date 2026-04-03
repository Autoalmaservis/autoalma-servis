'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function DetailZakazky() {
  const { id } = useParams();
  const router = useRouter();
  const [zakazka, setZakazka] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Stavy pre pridávanie položiek
  const [workItems, setWorkItems] = useState([]);
  const [newItem, setNewItem] = useState({ description: '', price: '' });

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('job_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (!error) {
      setZakazka(data);
      // Predpokladáme, že prácu ukladáme do stĺpca 'work_json' ako pole objektov
      // Ak ten stĺpec nemáš, zatiaľ to budeme držať v stave
      setWorkItems(data.work_json || []);
    }
    setLoading(false);
  };

  const addItem = () => {
    if (!newItem.description || !newItem.price) return;
    const updatedItems = [...workItems, { ...newItem, id: Date.now() }];
    setWorkItems(updatedItems);
    setNewItem({ description: '', price: '' });
  };

  const removeItem = (itemId) => {
    setWorkItems(workItems.filter(item => item.id !== itemId));
  };

  const saveToDatabase = async () => {
    const { error } = await supabase
      .from('job_tickets')
      .update({ 
        work_json: workItems,
        total_price: workItems.reduce((sum, item) => sum + parseFloat(item.price), 0)
      })
      .eq('id', id);

    if (!error) {
      alert("Zmeny uložené!");
    } else {
      alert("Chyba: " + error.message);
    }
  };

  if (loading) return <div className="p-10 text-white animate-pulse">Načítavam detaily...</div>;
  if (!zakazka) return <div className="p-10 text-white">Zákazka sa nenašla.</div>;

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white">
      {/* HLAVIČKA S INFO O AUTE */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white mb-4 block text-xs uppercase font-black">← Späť na zoznam</button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter italic">
            {zakazka.plate_number} <span className="text-blue-600">/ Detail</span>
          </h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest mt-2">{zakazka.customer_name} • {zakazka.car_brand_model}</p>
        </div>
        <div className="text-right">
          <span className="bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
            Stav: {zakazka.status}
          </span>
          <h2 className="text-3xl font-black mt-4 text-green-500">
            {workItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0).toFixed(2)} €
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* FORMULÁR NA PRIDÁVANIE PRÁCE/MATERIÁLU */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem]">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-zinc-400">Pridať prácu alebo materiál</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Názov úkonu / súčiastky" 
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                className="flex-grow bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-600"
              />
              <input 
                type="number" 
                placeholder="Cena €" 
                value={newItem.price}
                onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                className="w-full md:w-32 bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-600 font-bold"
              />
              <button 
                onClick={addItem}
                className="bg-white text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] hover:bg-blue-600 hover:text-white transition-all"
              >
                Pridať
              </button>
            </div>
          </div>

          {/* ZOZNAM POLOŽIEK */}
          <div className="space-y-3">
            {workItems.map((item) => (
              <div key={item.id} className="bg-zinc-900/30 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center group">
                <span className="font-bold">{item.description}</span>
                <div className="flex items-center gap-6">
                  <span className="font-black text-blue-500">{parseFloat(item.price).toFixed(2)} €</span>
                  <button onClick={() => removeItem(item.id)} className="text-zinc-700 hover:text-red-600 transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={saveToDatabase}
            className="w-full bg-blue-600 py-5 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all"
          >
            Uložiť zmeny v zákazke
          </button>
        </div>

        {/* BOČNÝ PANEL S INFO */}
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 p-8 rounded-[2.5rem]">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Pôvodná požiadavka</h3>
            <p className="text-sm italic text-zinc-300">"{zakazka.description || 'Žiadny popis závady.'}"</p>
            <hr className="my-6 border-zinc-800" />
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">VIN Číslo</p>
                <p className="font-mono text-xs">{zakazka.vin_number || '---'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Kontakt</p>
                <p className="text-sm">{zakazka.customer_phone || '---'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}