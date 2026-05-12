'use client';
import { useState } from 'react';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function WarehouseModal({ warehouseItems, onSelect, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = warehouseItems.filter(w => {
    const q = nd(search);
    return nd(w.name).includes(q) || (w.part_number && nd(w.part_number).includes(q));
  });

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex items-center justify-center p-6 no-print">
      <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] max-w-2xl w-full shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Vybrať diel <span className="text-red-600">zo skladu</span></h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">{warehouseItems.length} položiek na sklade</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-800">✕</button>
        </div>
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <input type="text" placeholder="Hľadať diel alebo číslo dielu..." value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-800 p-3 px-5 rounded-xl text-white font-black text-xs outline-none focus:border-red-600 uppercase italic tracking-widest transition-all" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(w => (
            <button key={w.id} type="button" onClick={() => onSelect(w)}
              className="w-full text-left px-6 py-4 hover:bg-zinc-900 transition-all flex items-center justify-between gap-4 border-b border-zinc-800/40 last:border-0 group">
              <div className="min-w-0 flex-grow">
                <span className="text-white font-black text-sm uppercase italic block truncate group-hover:text-red-400 transition-colors">{w.name}</span>
                {w.part_number && (
                  <span className="text-yellow-400 text-[9px] font-black bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded mt-1 inline-block">{w.part_number}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-zinc-500 text-[8px] font-black uppercase block">jednotka</span>
                  <span className="text-zinc-400 font-black text-xs">{w.unit}</span>
                </div>
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
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-zinc-600 font-black uppercase text-xs tracking-widest italic">Žiadne výsledky</div>
          )}
        </div>
      </div>
    </div>
  );
}
