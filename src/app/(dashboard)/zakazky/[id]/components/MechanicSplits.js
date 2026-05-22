'use client';

export default function MechanicSplits({ items, employees }) {
  const summary = (() => {
    const map = {};
    (items || []).forEach(item => {
      if (!item.worker_id) return;
      let hours = 0;
      if (item.type === 'Práca') hours = Number(item.quantity) || 0;
      else if (item.type === 'Úkon') hours = Number(item.mechanic_hours) || 0;
      if (!hours) return;
      if (!map[item.worker_id]) {
        const emp = (employees || []).find(e => e.id === item.worker_id);
        map[item.worker_id] = { name: emp?.name || 'Neznámy', color: emp?.color || '#888', hours: 0 };
      }
      map[item.worker_id].hours += hours;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  })();

  if (summary.length === 0) return null;

  const totalHours = summary.reduce((s, m) => s + m.hours, 0);

  return (
    <div className="mt-8 no-print font-bold">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-yellow-400 font-black uppercase text-[10px] tracking-widest italic">Hodiny mechanikov</h2>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Spolu: <span className="text-white">{totalHours.toFixed(2)} hod</span>
          </span>
        </div>
        <div className="space-y-2">
          {summary.map(m => (
            <div key={m.name} className="flex items-center gap-3 bg-black/30 px-4 py-3 rounded-2xl border border-zinc-800">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              <span className="flex-1 text-sm font-black uppercase italic tracking-tight">{m.name}</span>
              <span className="text-white font-black text-sm">{m.hours.toFixed(2)}</span>
              <span className="text-zinc-500 text-[10px] font-black uppercase">hod</span>
              <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${totalHours > 0 ? (m.hours / totalHours * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
