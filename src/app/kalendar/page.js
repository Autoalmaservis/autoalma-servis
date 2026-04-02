'use client';
import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import daygridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../lib/supabase';

export default function KalendarPage() {
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Dynamická pracovná doba z databázy
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // Stavy pre formulár rezervácie
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [plate, setPlate] = useState('');
  const [title, setTitle] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isKnown, setIsKnown] = useState(false);
  const [carData, setCarData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Načítanie dát (Mechanici, Nastavenia, Eventy)
  const fetchData = async () => {
    setLoading(true);
    
    // Načítanie nastavení pracovnej doby
    const { data: settings } = await supabase.from('business_settings').select('*');
    if (settings) {
      const start = settings.find(s => s.id === 'work_start')?.value;
      const end = settings.find(s => s.id === 'work_end')?.value;
      if (start) setWorkStart(start);
      if (end) setWorkEnd(end);
    }

    // Načítanie mechanikov
    const { data: empData } = await supabase.from('employees').select('*').eq('active', true);
    setEmployees(empData || []);

    // Načítanie rezervácií
    const { data: evData } = await supabase.from('calendar_events').select('*, employees(name)');
    const formattedEvents = (evData || []).map(ev => ({
      id: ev.id,
      title: `${ev.title} (${ev.employees?.name || '?'})`,
      start: ev.start_datetime,
      end: ev.end_datetime,
      backgroundColor: '#dc2626',
      borderColor: 'transparent'
    }));
    setEvents(formattedEvents);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Kontrola ŠPZ v archíve
  const handlePlateBlur = async (spz) => {
    if (spz.length < 5) return;
    const { data } = await supabase
      .from('job_tickets')
      .select('*')
      .eq('plate_number', spz.toUpperCase())
      .limit(1);

    if (data && data.length > 0) {
      setIsKnown(true);
      setCarData(data[0]);
      setTitle(`${data[0].customer_name} - ${data[0].car_brand_model || data[0].car_model}`);
    } else {
      setIsKnown(false);
      setCarData(null);
    }
  };

  const handleDateClick = (arg) => {
    const datePart = arg.dateStr.split('T')[0];
    const timePart = arg.dateStr.split('T')[1]?.substring(0, 5) || '08:00';
    setSelectedDate(datePart);
    setStartTime(timePart);
    setIsModalOpen(true);
  };

  const saveReservation = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('calendar_events').insert([{
      title: title,
      start_datetime: `${selectedDate}T${startTime}:00`,
      end_datetime: `${selectedDate}T${endTime}:00`,
      employee_id: selectedEmployee,
      description: `ŠPZ: ${plate}`
    }]);
    
    if (!error) {
      setIsModalOpen(false);
      setPlate('');
      setTitle('');
      fetchData();
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam systém...</div>;

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden select-none p-6">
      <style>{`
        .fc { --fc-border-color: #18181b; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #18181b !important; }
        .fc-button-primary { background: #18181b !important; border: 1px solid #27272a !important; text-transform: uppercase; font-size: 0.7rem !important; font-weight: bold !important; border-radius: 8px !important; }
        .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
        .fc-toolbar-title { font-weight: 900 !important; text-transform: uppercase; font-size: 1.1rem !important; font-style: italic; letter-spacing: -0.025em; }
        
        .fc-view-harness { background: #09090b; border-radius: 2rem; overflow: hidden; border: 1px solid #18181b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .fc-timegrid-slot { height: 4em !important; } 
        .fc-event { border-radius: 8px !important; padding: 4px !important; font-weight: 700 !important; font-size: 0.75rem !important; }
        .fc-v-event { border-left: 4px solid white !important; }
        .fc-now-indicator { border-color: #dc2626 !important; }
      `}</style>
      
      {/* VRCHNÁ LIŠTA */}
      <div className="pb-6 flex justify-between items-end bg-black">
        <div className="border-l-4 border-red-600 pl-5">
          <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">
            Harmonogram <span className="text-red-600">Dielne</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-2">AutoAlma Capacity Management</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900/50 px-5 py-2.5 rounded-2xl border border-zinc-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-zinc-600 rounded-full animate-pulse"></span>
            Režim: <span className="text-white">{workStart} — {workEnd}</span>
          </div>
        </div>
      </div>

      {/* PLOCHA KALENDÁRA */}
      <div className="flex-grow relative bg-black mb-6">
        <FullCalendar
          plugins={[daygridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth'
          }}
          buttonText={{ today: 'Dnes', month: 'Mesiac', week: 'Týždeň', day: 'Deň' }}
          locale="sk"
          firstDay={1}
          events={events}
          dateClick={handleDateClick}
          height="100%"
          expandRows={true}
          allDaySlot={false}
          slotMinTime={`${workStart}:00`}
          slotMaxTime={`${workEnd}:00`}
          nowIndicator={true}
        />
      </div>

      {/* SPODNÝ STATUS PANEL */}
      <div className="flex justify-between items-center px-6 py-3 bg-zinc-950 border border-zinc-900 rounded-[1.5rem]">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full"></span>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Obsadený slot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Mechanici online: {employees.length}</span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-700 font-mono font-bold uppercase tracking-widest italic">System v1.1 | Terminal ID: 001</p>
      </div>

      {/* MODAL OKNO PRE REZERVÁCIU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-10 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">Nová rezervácia</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white text-2xl transition-colors">✕</button>
            </div>
            
            <form onSubmit={saveReservation} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-[0.2em]">ŠPZ Vozidla</label>
                <input 
                  required 
                  type="text" 
                  value={plate} 
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onBlur={(e) => handlePlateBlur(e.target.value)}
                  className={`w-full bg-black border ${isKnown ? 'border-green-600 shadow-[0_0_20px_rgba(22,163,74,0.1)]' : 'border-zinc-800'} p-5 rounded-2xl text-white font-black text-2xl tracking-widest focus:border-red-600 outline-none transition-all`} 
                  placeholder="SPZ..."
                />
              </div>

              {isKnown && (
                <div className="p-5 bg-green-950/20 border border-green-600/30 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-xl shadow-lg">✅</div>
                  <div>
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Klient identifikovaný</p>
                    <p className="text-md font-black text-white uppercase italic">{carData.car_brand_model} • {carData.customer_name}</p>
                  </div>
                </div>
              )}

              {!isKnown && plate.length > 4 && (
                <div className="p-6 bg-zinc-800/30 border border-dashed border-zinc-700 rounded-3xl text-center space-y-4">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nové vozidlo v systéme</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl flex flex-col items-center gap-2 text-[9px] font-black uppercase transition-all shadow-lg">
                      <span className="text-xl">📷</span> Sken TP
                    </button>
                    <button type="button" className="bg-blue-900/20 border border-blue-500/30 hover:bg-blue-900/40 p-4 rounded-2xl flex flex-col items-center gap-2 text-[9px] font-black uppercase text-blue-400 transition-all shadow-lg">
                      <span className="text-xl">🌐</span> Overiť
                    </button>
                    <button type="button" onClick={() => setIsKnown(true)} className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl flex flex-col items-center gap-2 text-[9px] font-black uppercase transition-all shadow-lg">
                      <span className="text-xl">⌨️</span> Ručne
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Čas príchodu</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Predpokladaný koniec</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Zobrazenie (Zákazník / Auto)</label>
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Pridelený mechanik</label>
                <select required value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none cursor-pointer appearance-none">
                  <option value="">-- Vyberte voľného kolegu --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-600/20 uppercase text-xs tracking-[0.3em] transition-all">Potvrdiť rezerváciu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}