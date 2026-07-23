'use client';
import { useState } from 'react';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function WarehouseModal({ warehouseItems, onSelectMultiple, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});

  const filtered = warehouseItems.filter(w => {
    const q = nd(search);
    return nd(w.name).includes(q) || (w.part_number && nd(w.part_number).includes(q));
  });

  const toggle = (w) => {
    setSelected(prev => {
      if (prev[w.id]) {
        const next = { ...prev };
        delete next[w.id];
        return next;
      }
      return { ...prev, [w.id]: { item: w, qty: 1 } };
    });
  };

  const setQty = (id, val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], qty: num } }));
  };

  const selectedList = Object.values(selected);
  const count = selectedList.length;

  const handleConfirm = () => {
    if (!count) return;
    onSelectMultiple(selectedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex items-center justify-center p-6 no-print">
      <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Vybrať diely <span className="text-red-600">zo skladu</span></h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">{warehouseItems.length} položiek · zoradené podľa dátumu</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-800">✕</button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <input type="text" placeholder="Hľadať diel alebo číslo dielu..." value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-800 p-3 px-5 rounded-xl text-white font-black text-xs outline-none focus:border-red-600 uppercase italic tracking-widest transition-all" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.map(w => {
            const isSelected = !!selected[w.id];
            return (
              <div key={w.id}
                className={`w-full text-left px-6 py-4 transition-all flex items-center gap-4 border-b border-zinc-800/40 last:border-0 ${isSelected ? 'bg-red-950/30' : 'hover:bg-zinc-900'}`}>

                {/* Checkbox + name */}
                <button type="button" onClick={() => toggle(w)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-red-500 bg-red-600' : 'border-zinc-700'}`}>
                    {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`font-black text-sm uppercase italic block truncate transition-colors ${isSelected ? 'text-red-400' : 'text-white'}`}>{w.name}</span>
                    {w.part_number && (
                      <span className="text-yellow-400 text-[9px] font-black bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded mt-1 inline-block">{w.part_number}</span>
                    )}
                  </div>
                </button>

                {/* Meta + qty */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-zinc-500 text-[8px] font-black uppercase block">na sklade</span>
                    <span className={`font-black text-sm px-2 py-0.5 rounded-lg border ${parseFloat(w.quantity) > 0 ? 'text-green-400 border-green-600/30 bg-green-500/10' : 'text-red-400 border-red-600/30 bg-red-500/10'}`}>
                      {parseFloat(w.quantity).toFixed(0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 text-[8px] font-black uppercase block">cena bez DPH</span>
                    <span className="text-white font-black text-sm">{parseFloat(w.sale_price).toFixed(2)} €</span>
                  </div>
                  {isSelected && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-zinc-500 text-[8px] font-black uppercase">počet</span>
                      <div className="flex items-center gap-1">
                        <button type="button"
                          onClick={() => setQty(w.id, (selected[w.id]?.qty || 1) - 1)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-white font-black text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center">−</button>
                        <input type="number" min="0.01" step="1"
                          value={selected[w.id]?.qty ?? 1}
                          onChange={e => setQty(w.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-12 bg-zinc-900 border border-zinc-700 text-white font-black text-sm text-center rounded-lg p-1 outline-none focus:border-red-500" />
                        <button type="button"
                          onClick={() => setQty(w.id, (selected[w.id]?.qty || 1) + 1)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-white font-black text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center">+</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-zinc-600 font-black uppercase text-xs tracking-widest italic">Žiadne výsledky</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 flex items-center justify-between gap-4">
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">
            {count > 0 ? <span className="text-white">{count} {count === 1 ? 'diel' : count < 5 ? 'diely' : 'dielov'} vybraných</span> : 'Klikni na diel na výber'}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors">
              Zrušiť
            </button>
            <button type="button" onClick={handleConfirm} disabled={!count}
              className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${count > 0 ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
              Pridať {count > 0 ? `(${count})` : ''} do zákazky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
