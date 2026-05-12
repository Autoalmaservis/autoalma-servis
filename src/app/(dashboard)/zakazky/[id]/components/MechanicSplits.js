'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function MechanicSplits({ jobId, zakazka, items, employees }) {
  const [splits, setSplits] = useState([]);
  const [savingSplits, setSavingSplits] = useState(false);
  const [showAddMechanic, setShowAddMechanic] = useState(false);
  const [newMechanicId, setNewMechanicId] = useState('');

  useEffect(() => {
    if (zakazka.mechanic_splits?.length > 0) {
      setSplits(zakazka.mechanic_splits);
    } else if (zakazka.assigned_worker_id) {
      const totalHrs = items.filter(i => i.type === 'Práca').reduce((a, i) => a + Number(i.quantity), 0);
      const emp = employees.find(e => e.id === zakazka.assigned_worker_id);
      if (emp) setSplits([{ employee_id: emp.id, name: emp.name, hours: totalHrs }]);
    }
  }, [zakazka.id]);

  const saveSplits = async (updated) => {
    setSavingSplits(true);
    await supabase.from('job_tickets').update({ mechanic_splits: updated }).eq('id', jobId);
    setSavingSplits(false);
  };

  const handleAddMechanic = () => {
    if (!newMechanicId) return;
    const emp = employees.find(e => e.id === newMechanicId);
    if (!emp || splits.find(s => s.employee_id === newMechanicId)) return;
    const updated = [...splits, { employee_id: emp.id, name: emp.name, hours: 0 }];
    setSplits(updated);
    saveSplits(updated);
    setNewMechanicId('');
    setShowAddMechanic(false);
  };

  const handleRemoveMechanic = (employeeId) => {
    const updated = splits.filter(s => s.employee_id !== employeeId);
    setSplits(updated);
    saveSplits(updated);
  };

  const handleSplitHoursChange = (employeeId, val) => {
    setSplits(prev => prev.map(s => s.employee_id === employeeId ? { ...s, hours: val } : s));
  };

  const totalWorkHours = items.filter(i => i.type === 'Práca').reduce((a, i) => a + Number(i.quantity), 0);
  const splitTotal = splits.reduce((a, s) => a + Number(s.hours), 0);
  const diff = totalWorkHours - splitTotal;

  return (
    <div className="mt-12 no-print font-bold">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-yellow-400 font-black uppercase text-[10px] tracking-widest italic">Hodiny mechanikov</h2>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Zo zákazky: <span className="text-white">{totalWorkHours.toFixed(2)} hod</span>
          </span>
        </div>

        <div className="space-y-2 mb-4">
          {splits.map(s => (
            <div key={s.employee_id} className="flex items-center gap-3 bg-black/30 px-4 py-3 rounded-2xl border border-zinc-800">
              <span className="flex-1 text-sm font-black uppercase italic tracking-tight">{s.name}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={s.hours}
                onChange={e => handleSplitHoursChange(s.employee_id, e.target.value)}
                onFocus={e => e.target.select()}
                className="w-20 bg-zinc-800 border border-zinc-700 focus:border-yellow-500 px-3 py-1.5 rounded-xl text-white text-[12px] font-black outline-none text-right"
              />
              <span className="text-zinc-500 text-[10px] font-black uppercase">hod</span>
              {splits.length > 1 && (
                <button onClick={() => handleRemoveMechanic(s.employee_id)} className="text-zinc-700 hover:text-red-500 transition-colors text-lg px-1">✕</button>
              )}
            </div>
          ))}
          {splits.length === 0 && (
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest text-center py-2">Žiadny mechanik priradený</p>
          )}
        </div>

        {showAddMechanic ? (
          <div className="flex gap-2 items-center mb-4">
            <select
              value={newMechanicId}
              onChange={e => setNewMechanicId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-yellow-500 px-3 py-2 rounded-xl text-white text-[11px] font-black outline-none"
            >
              <option value="">Vybrať mechanika...</option>
              {employees.filter(e => !splits.find(s => s.employee_id === e.id)).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <button onClick={handleAddMechanic} className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Pridať</button>
            <button onClick={() => { setShowAddMechanic(false); setNewMechanicId(''); }} className="bg-zinc-800 text-zinc-400 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all">Zrušiť</button>
          </div>
        ) : (
          <button onClick={() => setShowAddMechanic(true)} className="text-[9px] font-black uppercase text-zinc-500 hover:text-yellow-400 border border-zinc-800 hover:border-yellow-600 px-4 py-2 rounded-xl transition-all tracking-widest mb-4 inline-block">
            + Pridať ďalšieho mechanika
          </button>
        )}

        <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mt-2">
          <div className="text-[10px] font-black uppercase tracking-widest">
            <span className="text-zinc-500">Rozdelené: </span>
            <span className={splitTotal > 0 ? 'text-white' : 'text-zinc-600'}>{splitTotal.toFixed(2)} hod</span>
            {Math.abs(diff) > 0.001 && (
              <span className={`ml-3 ${diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {diff > 0 ? `· zostatok: ${diff.toFixed(2)} hod` : `· prečerpané: ${Math.abs(diff).toFixed(2)} hod`}
              </span>
            )}
            {Math.abs(diff) <= 0.001 && splitTotal > 0 && <span className="text-green-500 ml-3">· rozdelené správne ✓</span>}
          </div>
          <button
            onClick={() => saveSplits(splits)}
            disabled={savingSplits}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            {savingSplits ? 'Ukladám...' : '💾 Uložiť hodiny'}
          </button>
        </div>
      </div>
    </div>
  );
}
