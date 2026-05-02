'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function DatabazaPage() {
  const [activeTab, setActiveTab] = useState('materiál');

  // --- MATERIÁL ---
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState({ name: '', unit_price: 0, unit: 'ks', type: 'materiál' });

  // --- PRÁCA (SERVICE NORMS) ---
  const [categories, setCategories] = useState([]);
  const [norms, setNorms] = useState([]);
  const [normsLoading, setNormsLoading] = useState(true);
  const [normSearch, setNormSearch] = useState('');
  const [normFilter, setNormFilter] = useState('all');
  const [newCatName, setNewCatName] = useState('');
  const [newNorm, setNewNorm] = useState({ category_id: '', service_name: '', duration_minutes: 30 });
  const [showCatPanel, setShowCatPanel] = useState(false);
  const [editNorm, setEditNorm] = useState(null);

  useEffect(() => {
    fetchCatalog();
    fetchNorms();
  }, []);

  // ---- MATERIÁL FUNKCIE ----
  const fetchCatalog = async () => {
    setItemsLoading(true);
    const { data } = await supabase.from('inventory_catalog').select('*').order('name');
    if (data) setItems(data);
    setItemsLoading(false);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const payload = { name: currentItem.name, unit_price: parseFloat(currentItem.unit_price), unit: currentItem.unit, type: currentItem.type };
    if (currentItem.id) {
      await supabase.from('inventory_catalog').update(payload).eq('id', currentItem.id);
    } else {
      await supabase.from('inventory_catalog').insert([payload]);
    }
    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
    fetchCatalog();
  };

  const deleteItem = async (id) => {
    if (confirm('Naozaj vymazať túto položku?')) {
      await supabase.from('inventory_catalog').delete().eq('id', id);
      fetchCatalog();
    }
  };

  const openEdit = (item) => { setCurrentItem(item); setIsEditModalOpen(true); };
  const openAdd = () => { setCurrentItem({ name: '', unit_price: 0, unit: 'ks', type: 'materiál' }); setIsAddModalOpen(true); };

  const nd = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = items.filter(i => i.type === 'materiál' && nd(i.name).includes(nd(searchTerm)));

  // ---- PRÁCA / NORMY FUNKCIE ----
  const fetchNorms = async () => {
    setNormsLoading(true);
    const { data: catData } = await supabase.from('service_categories').select('*').order('name');
    if (catData) setCategories(catData);
    const { data: normData } = await supabase.from('service_norms').select('*, service_categories(name)').order('service_name');
    if (normData) setNorms(normData);
    setNormsLoading(false);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await supabase.from('service_categories').insert([{ name: newCatName.toUpperCase() }]);
    setNewCatName('');
    fetchNorms();
  };

  const deleteCategory = async (id) => {
    if (!confirm('Zmazaním kategórie zmažete aj všetky priradené práce. Pokračovať?')) return;
    await supabase.from('service_categories').delete().eq('id', id);
    fetchNorms();
  };

  const addNorm = async (e) => {
    e.preventDefault();
    if (!newNorm.service_name || !newNorm.category_id) return;
    await supabase.from('service_norms').insert([newNorm]);
    setNewNorm({ ...newNorm, service_name: '' });
    fetchNorms();
  };

  const updateNorm = async (id, field, value) => {
    await supabase.from('service_norms').update({ [field]: value }).eq('id', id);
  };

  const saveEditNorm = async (e) => {
    e.preventDefault();
    await supabase.from('service_norms').update({
      service_name: editNorm.service_name,
      duration_minutes: parseInt(editNorm.duration_minutes),
      category_id: editNorm.category_id,
    }).eq('id', editNorm.id);
    setEditNorm(null);
    fetchNorms();
  };

  const deleteNorm = async (id) => {
    if (confirm('Naozaj vymazať túto prácu?')) {
      await supabase.from('service_norms').delete().eq('id', id);
      fetchNorms();
    }
  };

  const filteredNorms = norms.filter(n =>
    (normFilter === 'all' || n.category_id === normFilter) &&
    nd(n.service_name).includes(nd(normSearch))
  );

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white font-bold">

      <header className="mb-10 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Databáza <span className="text-red-600 text-4xl">Cenník</span></h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mt-2 font-black italic">Správa náhradných dielov a prác</p>
        </div>
        {activeTab === 'materiál' && (
          <button onClick={openAdd} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest flex items-center gap-3">
            + Pridať diel
          </button>
        )}
      </header>

      {/* ZÁLOŽKY */}
      <div className="flex bg-zinc-900/50 p-1.5 rounded-[1.8rem] border border-zinc-800 mb-8 w-full md:w-auto inline-flex">
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
          🛠️ Práce
        </button>
      </div>

      {/* ===== TAB: MATERIÁL ===== */}
      {activeTab === 'materiál' && (
        <>
          <div className="relative w-full md:w-80 mb-8">
            <input type="text" placeholder="Hľadať diel..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-4 px-6 rounded-2xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest" />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
          </div>
          <div className="space-y-3">
            {itemsLoading ? (
              <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
            ) : filtered.length > 0 ? filtered.map(item => (
              <div key={item.id} className="bg-zinc-900/20 border border-zinc-800 p-5 md:px-10 rounded-[2rem] flex flex-col md:flex-row justify-between items-center group hover:border-red-600/50 transition-all gap-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-10 flex-grow w-full">
                  <div className="min-w-[80px]">
                    <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1">Jednotka</span>
                    <span className="bg-white text-black px-3 py-1 rounded-lg font-black text-[10px] uppercase">{item.unit}</span>
                  </div>
                  <div className="flex-grow">
                    <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1">Názov</span>
                    <h3 className="text-lg font-black uppercase italic tracking-tight text-zinc-200">{item.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-600 text-[8px] uppercase font-black tracking-widest block mb-1">Cena bez DPH</span>
                    <p className="text-2xl font-black italic">{item.unit_price.toFixed(2)} €</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-4 bg-zinc-800/50 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                  <button onClick={() => deleteItem(item.id)} className="p-4 bg-zinc-800/50 rounded-xl hover:bg-red-600 transition-all text-xs">🗑️</button>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">Databáza je prázdna</div>
            )}
          </div>
        </>
      )}

      {/* ===== TAB: PRÁCE ===== */}
      {activeTab === 'práca' && (
        <div className="space-y-6">

          {/* INFO BANNER */}
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl px-6 py-4 flex items-center gap-4">
            <span className="text-2xl">💡</span>
            <p className="text-blue-300 text-xs font-bold leading-relaxed">
              Práce zadané tu si môže zákazník vybrať pri online objednávaní servisu. Každá práca patrí do kategórie a má zadaný čas trvania.
            </p>
          </div>

          {/* KATEGÓRIE */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
            <button
              onClick={() => setShowCatPanel(!showCatPanel)}
              className="w-full flex items-center justify-between p-6 hover:bg-zinc-900/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Kategórie prác</span>
                <span className="text-[9px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-lg">{categories.length}</span>
              </div>
              <span className="text-zinc-600 text-sm">{showCatPanel ? '▲' : '▼'}</span>
            </button>
            {showCatPanel && (
              <div className="border-t border-zinc-900 p-6 space-y-4">
                <form onSubmit={addCategory} className="flex gap-3">
                  <input required type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    placeholder="Nová kategória (napr. MOTOR)" className="flex-grow bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black uppercase text-sm outline-none transition-all" />
                  <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all">+ Pridať</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-white">{cat.name}</span>
                      <button onClick={() => deleteCategory(cat.id)} className="text-zinc-600 hover:text-red-500 transition-colors text-xs font-bold">✕</button>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-zinc-700 text-xs font-bold italic">Zatiaľ žiadne kategórie</p>}
                </div>
              </div>
            )}
          </div>

          {/* PRIDAŤ PRÁCU */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4">Pridať prácu</p>
            <form onSubmit={addNorm} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_120px_auto] gap-3 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Kategória</label>
                <select required value={newNorm.category_id} onChange={e => setNewNorm({ ...newNorm, category_id: e.target.value })}
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-xs outline-none transition-all cursor-pointer">
                  <option value="">-- Kategória --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Názov práce</label>
                <input required type="text" value={newNorm.service_name} onChange={e => setNewNorm({ ...newNorm, service_name: e.target.value })}
                  placeholder="napr. Výmena oleja a filtrov"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Minúty</label>
                <input required type="number" min="5" value={newNorm.duration_minutes} onChange={e => setNewNorm({ ...newNorm, duration_minutes: parseInt(e.target.value) })}
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-center outline-none transition-all" />
              </div>
              <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all whitespace-nowrap">
                + Pridať
              </button>
            </form>
          </div>

          {/* FILTER + VYHĽADÁVANIE */}
          <div className="flex flex-col md:flex-row gap-3">
            <select value={normFilter} onChange={e => setNormFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 focus:border-zinc-600 p-3 rounded-xl text-zinc-400 text-[10px] font-black uppercase outline-none cursor-pointer transition-all">
              <option value="all">Všetky kategórie</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <div className="relative flex-grow">
              <input type="text" placeholder="Hľadať prácu..." value={normSearch} onChange={e => setNormSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 p-3 px-5 rounded-xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-5 rounded-xl">
              <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">Celkom:</span>
              <span className="text-white font-black text-sm">{filteredNorms.length}</span>
            </div>
          </div>

          {/* ZOZNAM PRÁC */}
          {normsLoading ? (
            <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
          ) : filteredNorms.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">
              Žiadne práce
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNorms.map(norm => (
                <div key={norm.id} className="bg-zinc-950 border border-zinc-900 hover:border-zinc-700 p-4 md:px-6 rounded-2xl flex items-center gap-4 group transition-all">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg shrink-0 hidden md:block whitespace-nowrap">
                    {norm.service_categories?.name}
                  </span>
                  <span className="flex-grow text-sm font-black uppercase italic text-zinc-300 truncate">
                    {norm.service_name}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[8px] text-zinc-600 block uppercase font-black">min</span>
                      <span className="text-white font-black text-sm">{norm.duration_minutes}</span>
                    </div>
                    <button onClick={() => setEditNorm({ id: norm.id, service_name: norm.service_name, duration_minutes: norm.duration_minutes, category_id: norm.category_id })}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                    <button onClick={() => deleteNorm(norm.id)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT NORMY */}
      {editNorm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">
              Upraviť <span className="text-red-600">prácu</span>
            </h2>
            <form onSubmit={saveEditNorm} className="space-y-5">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Kategória</label>
                <select required value={editNorm.category_id}
                  onChange={e => setEditNorm({ ...editNorm, category_id: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 cursor-pointer transition-all">
                  <option value="">-- Vyber kategóriu --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Názov práce</label>
                <input required type="text" value={editNorm.service_name}
                  onChange={e => setEditNorm({ ...editNorm, service_name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 italic transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Trvanie (minúty)</label>
                <input required type="number" min="5" value={editNorm.duration_minutes}
                  onChange={e => setEditNorm({ ...editNorm, duration_minutes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 text-center text-xl transition-all" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditNorm(null)}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                  Zrušiť
                </button>
                <button type="submit"
                  className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl">
                  Uložiť zmeny
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MATERIÁL */}
      {(isEditModalOpen || isAddModalOpen) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">
              {isEditModalOpen ? 'Upraviť' : 'Pridať'} <span className="text-red-600">diel</span>
            </h2>
            <form onSubmit={handleSaveItem} className="space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Názov dielu</label>
                <input required type="text" value={currentItem.name}
                  onChange={e => setCurrentItem({ ...currentItem, name: e.target.value.toUpperCase() })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 italic mt-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Cena (€ bez DPH)</label>
                  <input required type="number" step="0.01" value={currentItem.unit_price}
                    onChange={e => setCurrentItem({ ...currentItem, unit_price: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 mt-2" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest">Jednotka</label>
                  <select value={currentItem.unit} onChange={e => setCurrentItem({ ...currentItem, unit: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 mt-2 cursor-pointer">
                    <option value="ks">ks</option>
                    <option value="hod">hod</option>
                    <option value="l">l</option>
                    <option value="sada">sada</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                  Zrušiť
                </button>
                <button type="submit"
                  className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl">
                  {isEditModalOpen ? 'Uložiť zmeny' : 'Vytvoriť'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
