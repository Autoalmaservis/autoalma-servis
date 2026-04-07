'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function NovaPonukaPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [zakazka, setZakazka] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [offerItems, setOfferItems] = useState([]);
  
  const [newItem, setNewItem] = useState({ 
    group_name: '', 
    name: '', 
    quantity: 1, 
    unit: 'ks', 
    unit_price: 0, 
    type: 'Materiál' 
  });

  useEffect(() => {
    if (id) {
      loadInitialData();
    }
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [jobRes, catalogRes] = await Promise.all([
        supabase.from('job_tickets').select('*').eq('id', id).single(),
        supabase.from('inventory_catalog').select('*').order('name', { ascending: true })
      ]);

      if (jobRes.data) setZakazka(jobRes.data);
      if (catalogRes.data) setCatalog(catalogRes.data);
    } catch (err) {
      console.error("Chyba pri načítaní:", err);
    }
    setLoading(false);
  };

  const addItemToOffer = (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.group_name) {
      alert("Vyplňte názov skupiny aj názov položky.");
      return;
    }

    const itemToAdd = {
      ...newItem,
      id: crypto.randomUUID(),
      group_name: newItem.group_name.trim().toUpperCase()
    };

    setOfferItems([...offerItems, itemToAdd]);
    setNewItem({ ...newItem, name: '', quantity: 1, unit_price: 0 });
  };

  const removeItem = (tempId) => {
    setOfferItems(offerItems.filter(item => item.id !== tempId));
  };

  const calculateTotal = () => {
    const subtotal = offerItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const tax = subtotal * 0.23;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const saveOffer = async () => {
    if (offerItems.length === 0) {
      alert("Ponuka musí obsahovať aspoň jednu položku.");
      return;
    }
    setSaving(true);
    const { subtotal } = calculateTotal();

    const { error } = await supabase.from('price_offers').insert([{
      job_id: id,
      items_json: offerItems,
      total_amount: subtotal,
      status: 'Odoslané'
    }]);

    if (error) {
      alert("Chyba: " + error.message);
    } else {
      router.push(`/zakazky/${id}`);
    }
    setSaving(false);
  };

  const groupedItems = offerItems.reduce((groups, item) => {
    const group = groups[item.group_name] || [];
    group.push(item);
    groups[item.group_name] = group;
    return groups;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic animate-pulse tracking-widest uppercase">
      Pripravujem konfigurátor...
    </div>
  );

  const { subtotal, tax, total } = calculateTotal();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-12 font-sans font-bold">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs uppercase font-black tracking-widest">← Zrušiť</button>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Cenová <span className="text-blue-500">Ponuka</span></h1>
          <button onClick={saveOffer} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 transition-all tracking-widest">
            {saving ? 'Ukladám...' : '💾 Odoslať ponuku'}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Zákazník</p>
            <p className="text-xl italic uppercase font-black text-blue-400">{zakazka?.customer_name}</p>
          </div>
          <div className="md:text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Vozidlo</p>
            <p className="text-xl italic uppercase font-black">{zakazka?.car_brand_model} <span className="text-blue-500 text-sm ml-2">[{zakazka?.plate_number}]</span></p>
          </div>
        </div>

        {/* Form Box */}
        <div className="bg-zinc-900 border-t-4 border-blue-600 p-8 rounded-[2.5rem] mb-8 shadow-2xl">
          <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] mb-6 italic">Nová položka do rozpočtu</h2>
          <form onSubmit={addItemToOffer} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            <div className="md:col-span-3">
              <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest font-black">Skupina opráv</label>
              <input 
                type="text" 
                placeholder="Napr. MOTOR..." 
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase focus:border-blue-500 outline-none transition-colors"
                value={newItem.group_name}
                onChange={(e) => setNewItem({...newItem, group_name: e.target.value})}
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest font-black">Položka (Diel/Práca)</label>
              <input 
                list="catalog-list"
                type="text"
                placeholder="Hľadať v katalógu..."
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-colors"
                value={newItem.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const match = catalog.find(c => c.name === val.toUpperCase());
                  if (match) {
                    setNewItem({ ...newItem, name: val, unit_price: match.unit_price, unit: match.unit, type: match.type === 'práca' ? 'Práca' : 'Materiál' });
                  } else {
                    setNewItem({...newItem, name: val});
                  }
                }}
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest text-center font-black">Mn.</label>
              <input type="number" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-center text-xs font-black focus:border-blue-500 outline-none" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
            </div>

            <div className="md:col-span-2">
              <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest text-right font-black">Cena/J (€)</label>
              <input type="number" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-right text-xs font-black focus:border-blue-500 outline-none" value={newItem.unit_price} onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value)})} />
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-black py-3 rounded-xl transition-all border border-blue-600/30 text-xl shadow-lg shadow-blue-900/10">+</button>
            </div>
          </form>
          <datalist id="catalog-list">
            {catalog.map((c, i) => (<option key={i} value={c.name}>{c.unit_price} €</option>))}
          </datalist>
        </div>

        {/* Table Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 tracking-widest italic">
              <tr>
                <th className="p-4">Typ</th>
                <th className="p-4">Položka</th>
                <th className="p-4 text-center">Množstvo</th>
                <th className="p-4 text-right">Cena/J</th>
                <th className="p-4 text-right">Spolu</th>
                <th className="p-4 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-black italic uppercase">
              {Object.keys(groupedItems).map((groupName) => (
                <div key={groupName} style={{ display: 'contents' }}>
                  <tr className="bg-blue-600/10 border-l-4 border-blue-600">
                    <td colSpan="6" className="p-4 text-blue-400 text-[11px] font-black tracking-widest uppercase italic">
                      📂 {groupName}
                    </td>
                  </tr>
                  {groupedItems[groupName].map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-all group">
                      <td className="p-4">
                        <span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800' : 'text-orange-400 border-orange-800'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="p-4 text-xs tracking-tight">{item.name}</td>
                      <td className="p-4 text-center text-xs font-mono">{item.quantity} {item.unit}</td>
                      <td className="p-4 text-right text-xs font-mono">{item.unit_price.toFixed(2)} €</td>
                      <td className="p-4 text-right text-xs font-mono">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                      <td className="p-4 text-center">
                        <button onClick={() => removeItem(item.id)} className="text-zinc-800 group-hover:text-red-600 transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </div>
              ))}
              
              {offerItems.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-zinc-700 uppercase text-[10px] tracking-[0.4em] italic font-black">
                    Zatiaľ neboli pridané žiadne položky.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Recap Box */}
          <div className="p-10 bg-black/40 border-t border-zinc-800 flex flex-col items-end space-y-2">
            <div className="flex justify-between w-64 text-zinc-500 text-[10px] font-black uppercase italic tracking-widest">
              <span>Základ:</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between w-64 text-zinc-500 text-[10px] font-black uppercase italic tracking-widest border-b border-zinc-800 pb-3">
              <span>DPH (23%):</span>
              <span>{tax.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between w-80 pt-4 items-center">
              <span className="text-blue-500 font-black uppercase italic text-xl tracking-tighter">Celkom ponuka:</span>
              <span className="text-4xl font-black italic tracking-tighter leading-none">{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}