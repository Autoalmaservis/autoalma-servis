'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function VerejnyKalendarPage() {
  const [events, setEvents] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(1); 
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();

  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 - 17:00

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    const { count, error: empError } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);
    
    if (!empError) setEmployeeCount(count || 1);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('start_datetime, end_datetime')
      .gte('start_datetime', weekDays[0].toISOString())
      .lte('start_datetime', weekDays[4].toISOString());

    if (!error) setEvents(data);
    setLoading(false);
  };

  // Logika pre sfarbenie na základe počtu áut
  const getCellDetails = (day, hour) => {
    const checkTime = new Date(day);
    checkTime.setHours(hour, 0, 0, 0);
    
    const count = events.filter(e => {
      const start = new Date(e.start_datetime);
      const end = new Date(e.end_datetime);
      return checkTime >= start && checkTime < end;
    }).length;

    if (count === 0) return { bg: 'bg-zinc-900/20', label: 'Voľno', opacity: 0 };
    if (count >= employeeCount) return { bg: 'bg-red-600', label: 'Obsadené', opacity: 1 };
    
    // Výpočet odtieňa modrej (čím viac áut, tým silnejšia modrá)
    const intensity = (count / employeeCount) * 100;
    return { 
      bg: 'bg-blue-600', 
      label: `Voľné (${employeeCount - count} miesta)`, 
      opacity: (count / employeeCount).toFixed(2),
      count: count
    };
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans font-bold italic">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <button onClick={() => router.back()} className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mb-4 hover:text-white transition-all not-italic">← Späť do garáže</button>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Dostupnosť <span className="text-red-600">Termínov</span></h1>
            <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest not-italic">Kapacita: {employeeCount} súbežné opravy</p>
          </div>
          <div className="flex gap-4 items-center bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-4 hover:text-red-600 transition-all text-xl">←</button>
            <span className="text-[10px] uppercase tracking-widest px-4 font-black">{weekDays[0].toLocaleDateString('sk-SK')} - {weekDays[4].toLocaleDateString('sk-SK')}</span>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-4 hover:text-red-600 transition-all text-xl">→</button>
          </div>
        </header>

        {loading ? (
          <div className="h-[60vh] flex items-center justify-center text-red-600 animate-pulse uppercase tracking-[0.5em] text-xs">Synchronizujem kapacity...</div>
        ) : (
          <div className="bg-zinc-900/20 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl overflow-x-auto border-t-4 border-t-zinc-700">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-zinc-900/50">
                  <th className="p-6 border-b border-zinc-800 w-24"></th>
                  {weekDays.map((day, i) => (
                    <th key={i} className="p-6 border-b border-zinc-800 text-center border-l border-zinc-800/20">
                      <p className="text-[9px] text-zinc-500 uppercase mb-1 not-italic tracking-widest">{day.toLocaleDateString('sk-SK', { weekday: 'long' })}</p>
                      <p className="text-xl font-black uppercase">{day.getDate()}.{day.getMonth() + 1}.</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(hour => (
                  <tr key={hour} className="group border-b border-zinc-800/30">
                    <td className="p-4 text-center text-zinc-600 text-[10px] font-black not-italic">{hour}:00</td>
                    {weekDays.map((day, i) => {
                      const cell = getCellDetails(day, hour);
                      return (
                        <td key={i} className="p-1 border-l border-zinc-800/30 h-16 relative">
                          <div 
                            className={`absolute inset-1 rounded-xl transition-all duration-500 ${cell.bg}`}
                            style={{ opacity: cell.opacity || 0.05 }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-[8px] uppercase tracking-tighter font-black opacity-0 group-hover:opacity-100 transition-opacity">
                               {cell.label}
                             </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DYNAMICKÁ LEGENDA */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-800">
          <div className="flex flex-col gap-4">
             <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black mb-2 not-italic text-center md:text-left">Vysvetlivky obsadenosti</p>
             <div className="flex items-center gap-1">
                <div className="w-12 h-8 rounded-lg bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center text-[8px] text-zinc-500">0%</div>
                <div className="w-12 h-8 rounded-lg bg-blue-600 opacity-[0.3] flex items-center justify-center text-[8px]">~30%</div>
                <div className="w-12 h-8 rounded-lg bg-blue-600 opacity-[0.6] flex items-center justify-center text-[8px]">~60%</div>
                <div className="w-12 h-8 rounded-lg bg-blue-600 opacity-[0.9] flex items-center justify-center text-[8px]">~90%</div>
                <div className="w-12 h-8 rounded-lg bg-red-600 flex items-center justify-center text-[8px] font-black italic">PLNÉ</div>
             </div>
             <div className="flex justify-between px-1 text-[8px] uppercase text-zinc-600 font-black not-italic">
                <span>Voľno</span>
                <span>Plne obsadené</span>
             </div>
          </div>

          <div className="max-w-sm text-right">
             <p className="text-[10px] text-zinc-400 leading-relaxed uppercase not-italic">
               <span className="text-blue-500 font-black italic">Modré odtiene</span> znázorňujú čiastočnú vyťaženosť. Aj keď vidíte modrú, stále máme voľného mechanika. <span className="text-red-600 font-black italic">Červená</span> znamená, že všetky zdviháky sú v daný čas obsadené.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}