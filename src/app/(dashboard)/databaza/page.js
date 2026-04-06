'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function DatabazaPage() {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('materiál');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Stavy pre Modálne okná
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState({ name: '', unit_price: 0, unit: 'ks', type: 'materiál' });

  useEffect(() => { fetchCatalog(); }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_catalog').select('*').order('name', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const payload = {
      name: currentItem.name,
      unit_price: parseFloat(currentItem.unit_price),
      unit: currentItem.unit,
      type: currentItem.type
    };

    if (currentItem.id) {
      // Update
      await supabase.from('inventory_catalog').update(payload).eq('id', currentItem.id);
    } else {
      // Insert
      await supabase.from('inventory_catalog').insert([payload]);
    }

    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
    fetchCatalog();
  };

  const deleteItem = async (id) => {
    if (confirm('Naozaj vymazať túto položku z databázy?')) {
      await supabase.from('inventory_catalog').delete().eq('id', id);
      fetchCatalog();
    }
  };

  const openEdit = (item) => {
    setCurrentItem(item);
    setIsEditModalOpen(true);
  };

  const openAdd = () => {
    setCurrentItem({ name: '', unit_price: 0, unit: activeTab === 'materiál' ? 'ks' : 'hod', type: activeTab });
    setIsAddModalOpen(true);
  };

  const filtered = items.filter(i => i.type === activeTab && i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white font-bold">
      <header className="mb-10 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Databáza <span className="text-red-600 text-4xl">Cenník</span></h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mt-2 font-black italic">Správa náhradných dielov a prác</p>
        </div>
        <button 
          onClick={openAdd}
          className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl shadow-red-900/20 tracking-widest flex items-center gap-3"
        >
          <span>+ Pridať novú položku</span>
        </button>
      </header>

      {/* HORNE MENU ZALOZKY A VYHLADAVANIE */}
      <div className="flex flex-col md:flex-row gap-6 mb-10 items-center justify-between bg-zinc-900/30 p-4 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
        <div className="flex bg-black p-1.5 rounded-[1.8rem] border border-zinc-800 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('materiál')} 
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'materiál' ? 'bg-red-600 text-white italic shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            📦 Náhradné diely
          </button>
          <button 
            onClick={() => setActiveTab('práca')} 
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'práca' ? 'bg-red-600 text-white italic shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            🛠️ Práca
          </button>
        </div>
        
        <div className="relative w-full md:w-80 group">
          <input 
            type="text" 
            placeholder="Hľadať v databáze..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-4 px-6 rounded-2xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest"
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
        </div>
      </div>

      {/* ZOZNAM POLOZIEK NA CELY RIADOK */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map(item => (
            <div key={item.id} className="bg-zinc-900/20 border border-zinc-800 p-5 md:px-10 rounded-[2rem] flex flex-col md:flex-row justify-between items-center group hover:border-red-600/50 transition-all gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-10 flex-grow w-full md:w-auto">
                <div className="min-w-[100px]">
                  <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1 italic">Jednotka</span>
                  <span className="bg-white text-black px-3 py-1 rounded-lg font-black text-[10px] uppercase">{item.unit}</span>
                </div>
                <div className="flex-grow">
                  <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1 italic">Názov položky</span>
                  <h3 className="text-lg font-black uppercase italic leading-none tracking-tight text-zinc-200">{item.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1 italic">Cena bez DPH</span>
                  <p className="text-2xl font-black text-white italic tracking-tighter">{item.unit_price.toFixed(2)} €</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEdit(item)}
                    className="p-4 bg-zinc-800/50 rounded-xl hover:bg-white hover:text-black transition-all text-xs"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)} 
                    className="p-4 bg-zinc-800/50 rounded-xl hover:bg-red-600 transition-all text-xs"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">
            Databáza je prázdna
          </div>
        )}
      </div>

      {/* MODAL PRE PRIDANIE / EDITACIU */}
      {(isEditModalOpen || isAddModalOpen) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">
              {isEditModalOpen ? 'Upraviť' : 'Pridať'} <span className="text-red-600">položku</span>
            </h2>
            
            <form onSubmit={handleSaveItem} className="space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Názov (Práca alebo diel)</label>
                <input 
                  required type="text" value={currentItem.name} 
                  onChange={(e) => setCurrentItem({...currentItem, name: e.target.value.toUpperCase()})}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 italic mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Cena (€ bez DPH)</label>
                  <input 
                    required type="number" step="0.01" value={currentItem.unit_price} 
                    onChange={(e) => setCurrentItem({...currentItem, unit_price: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 mt-2"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Jednotka</label>
                  <select 
                    value={currentItem.unit} 
                    onChange={(e) => setCurrentItem({...currentItem, unit: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 mt-2 cursor-pointer"
                  >
                    <option value="ks">ks</option>
                    <option value="hod">hod</option>
                    <option value="l">l</option>
                    <option value="sada">sada</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all"
                >
                  Zrušiť
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-900/40"
                >
                  {isEditModalOpen ? 'Uložiť zmeny' : 'Vytvoriť v databáze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}