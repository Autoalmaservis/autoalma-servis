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
  
  const [editingEventId, setEditingEventId] = useState(null);

  const [allClients, setAllClients] = useState([]); 
  const [clientCars, setClientCars] = useState([]); 
  const [selectedClientName, setSelectedClientName] = useState(''); 

  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [plate, setPlate] = useState('');
  const [title, setTitle] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  const [issueDescription, setIssueDescription] = useState('');
  const [plannedWork, setPlannedWork] = useState('');

  const [isKnown, setIsKnown] = useState(false);
  const [carData, setCarData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: settings } = await supabase.from('business_settings').select('*');
    if (settings) {
      const start = settings.find(s => s.id === 'work_start')?.value;
      const end = settings.find(s => s.id === 'work_end')?.value;
      if (start) setWorkStart(start);
      if (end) setWorkEnd(end);
    }

    const { data: empData } = await supabase.from('employees').select('*').eq('active', true);
    setEmployees(empData || []);

    const { data: clientData } = await supabase.from('job_tickets').select('customer_name');
    if (clientData) {
      const uniqueNames = [...new Set(clientData.map(c => c.customer_name))];
      setAllClients(uniqueNames.sort());
    }

    // ÚPRAVA: Teraz ťaháme aj farbu (color) zo spojenej tabuľky employees
    const { data: evData } = await supabase.from('calendar_events').select('*, employees(name, color)');
    
    const formattedEvents = (evData || []).map(ev => {
      const displayTitle = ev.issue_description 
        ? `${ev.title} (${ev.issue_description})` 
        : ev.title;

      return {
        id: ev.id,
        title: displayTitle,
        start: ev.start_datetime,
        end: ev.end_datetime,
        // ÚPRAVA: Použijeme farbu mechanika z databázy, ak ju nemá, dáme AutoAlma červenú
        backgroundColor: ev.employees?.color || '#dc2626',
        borderColor: 'transparent',
        extendedProps: { 
          pureTitle: ev.title, 
          employeeName: ev.employees?.name,
          employeeId: ev.employee_id,
          customerName: ev.customer_name,
          plateNumber: ev.plate_number,
          issueDescription: ev.issue_description,
          plannedWork: ev.planned_work
        }
      };
    });
    setEvents(formattedEvents);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleEventChange = async (changeInfo) => {
    const { event } = changeInfo;
    const { error } = await supabase
      .from('calendar_events')
      .update({
        start_datetime: event.start.toISOString(),
        end_datetime: event.end ? event.end.toISOString() : event.start.toISOString(),
      })
      .eq('id', event.id);

    if (error) {
      alert("Chyba pri aktualizácii: " + error.message);
      changeInfo.revert();
    }
  };

  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    const props = ev.extendedProps;

    setEditingEventId(ev.id);
    
    setTitle(props.pureTitle || ev.title);
    setSelectedDate(ev.startStr.split('T')[0]);
    setStartTime(ev.startStr.split('T')[1].substring(0, 5));
    setEndTime(ev.endStr ? ev.endStr.split('T')[1].substring(0, 5) : '');
    setPlate(props.plateNumber || '');
    setSelectedEmployee(props.employeeId || '');
    setSelectedClientName(props.customerName || '');
    setIssueDescription(props.issueDescription || '');
    setPlannedWork(props.plannedWork || '');
    
    setIsModalOpen(true);
  };

  const handleClientChange = async (meno) => {
    setSelectedClientName(meno);
    if (!meno) {
      setClientCars([]);
      return;
    }
    const { data } = await supabase.from('job_tickets').select('*').eq('customer_name', meno);
    if (data) {
      setClientCars(data.filter(v => v.plate_number && v.plate_number !== 'NOVÝ-KLIENT'));
    }
  };

  const handleCarSelect = (car) => {
    setPlate(car.plate_number);
    setCarData(car);
    setTitle(`${car.customer_name} - ${car.car_brand_model || car.car_model}`);
    setIsKnown(true);
  };

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
      setSelectedClientName(data[0].customer_name);
      setTitle(`${data[0].customer_name} - ${data[0].car_brand_model || data[0].car_model}`);
    } else {
      setIsKnown(false);
      setCarData(null);
    }
  };

  const handleDateClick = (arg) => {
    setEditingEventId(null);
    const datePart = arg.dateStr.split('T')[0];
    const timePart = arg.dateStr.split('T')[1]?.substring(0, 5) || '08:00';
    setSelectedDate(datePart);
    setStartTime(timePart);
    
    setPlate('');
    setTitle('');
    setSelectedClientName('');
    setIssueDescription('');
    setPlannedWork('');
    
    setIsModalOpen(true);
  };

  const deleteReservation = async () => {
    if (!confirm("Naozaj chcete zmazať túto rezerváciu?")) return;
    
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', editingEventId);

    if (!error) {
      setIsModalOpen(false);
      setEditingEventId(null);
      fetchData();
    } else {
      alert("Chyba pri mazaní: " + error.message);
    }
  };

  const saveReservation = async (e) => {
    e.preventDefault();
    const reservationData = {
      title: title,
      start_datetime: `${selectedDate}T${startTime}:00`,
      end_datetime: `${selectedDate}T${endTime}:00`,
      employee_id: selectedEmployee,
      customer_name: selectedClientName || (carData ? carData.customer_name : ''),
      plate_number: plate,
      issue_description: issueDescription,
      planned_work: plannedWork,
      status: 'Naplánované'
    };

    let error;
    if (editingEventId) {
      const result = await supabase
        .from('calendar_events')
        .update(reservationData)
        .eq('id', editingEventId);
      error = result.error;
    } else {
      const result = await supabase
        .from('calendar_events')
        .insert([reservationData]);
      error = result.error;
    }
    
    if (!error) {
      setIsModalOpen(false);
      setEditingEventId(null);
      setPlate('');
      setTitle('');
      setSelectedClientName('');
      setIssueDescription(''); 
      setPlannedWork('');      
      setClientCars([]);
      fetchData();
    } else {
        alert("Chyba pri ukladaní: " + error.message);
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam systém...</div>;

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden select-none p-6 text-white">
      <style>{`
        .fc { --fc-border-color: #18181b; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #18181b !important; }
        .fc-button-primary { background: #18181b !important; border: 1px solid #27272a !important; text-transform: uppercase; font-size: 0.7rem !important; font-weight: bold !important; border-radius: 8px !important; }
        .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
        .fc-toolbar-title { font-weight: 900 !important; text-transform: uppercase; font-size: 1.1rem !important; font-style: italic; letter-spacing: -0.025em; }
        .fc-view-harness { background: #09090b; border-radius: 2rem; overflow: hidden; border: 1px solid #18181b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .fc-timegrid-slot { height: 4em !important; } 
        .fc-event { border-radius: 12px !important; padding: 6px !important; font-weight: 700 !important; font-size: 0.75rem !important; cursor: pointer; transition: transform 0.1s; border: none !important; }
        .fc-event:active { transform: scale(0.98); }
        .fc-v-event { border-left: 5px solid rgba(255,255,255,0.3) !important; }
        .fc-now-indicator { border-color: #dc2626 !important; }
      `}</style>
      
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
          editable={true}
          eventStartEditable={true}
          eventDurationEditable={true}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
          eventClick={handleEventClick}
          height="100%"
          expandRows={true}
          allDaySlot={false}
          slotMinTime={`${workStart}:00`}
          slotMaxTime={`${workEnd}:00`}
          nowIndicator={true}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-10 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">
                {editingEventId ? 'Upraviť rezerváciu' : 'Nová rezervácia'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setSelectedClientName(''); setClientCars([]); setEditingEventId(null); }} className="text-zinc-500 hover:text-white text-2xl transition-colors">✕</button>
            </div>
            
            <form onSubmit={saveReservation} className="space-y-6">
              {!editingEventId && (
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-[0.2em]">Rýchly výber podľa klienta</label>
                  <select 
                    value={selectedClientName}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-red-600 appearance-none cursor-pointer"
                  >
                    <option value="">-- Vyhladať v databáze --</option>
                    {allClients.map(name => (
                      <option key={name} value={name}>{name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              {clientCars.length > 0 && !editingEventId && (
                <div className="p-4 bg-zinc-800/30 border border-zinc-700 rounded-2xl animate-in fade-in zoom-in duration-300">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-3 text-center tracking-widest">Vozidlá v garáži klienta:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {clientCars.map(car => (
                      <button 
                        key={car.id} 
                        type="button"
                        onClick={() => handleCarSelect(car)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${plate === car.plate_number ? 'bg-red-600 border-red-600 text-white' : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-500'}`}
                      >
                        {car.plate_number} • {car.car_brand_model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-zinc-800 my-4" />

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-[0.2em]">ŠPZ Vozidla</label>
                <input 
                  required 
                  type="text" 
                  value={plate} 
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onBlur={(e) => handlePlateBlur(e.target.value)}
                  className={`w-full bg-black border ${isKnown ? 'border-green-600' : 'border-zinc-800'} p-5 rounded-2xl text-white font-black text-2xl tracking-widest focus:border-red-600 outline-none transition-all`} 
                  placeholder="SPZ..."
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Popis závady / nahlásený problém</label>
                  <textarea 
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-red-600 h-20 resize-none"
                    placeholder="Čo hlási zákazník?"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Plánované úkony mechanika</label>
                  <textarea 
                    value={plannedWork}
                    onChange={(e) => setPlannedWork(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-red-600 h-20 resize-none"
                    placeholder="Čo sa bude na aute robiť?"
                  />
                </div>
              </div>

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
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Zobrazenie v kalendári</label>
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Pridelený mechanik</label>
                <select required value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none cursor-pointer appearance-none">
                  <option value="">-- Vyberte kolegu --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-red-600/20 uppercase text-xs tracking-[0.3em] transition-all">
                  {editingEventId ? 'Uložiť zmeny' : 'Potvrdiť rezerváciu'}
                </button>
                
                {editingEventId && (
                  <button 
                    type="button"
                    onClick={deleteReservation}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-4 rounded-3xl uppercase text-[9px] tracking-[0.3em] transition-all border border-zinc-700"
                  >
                    Zmazať rezerváciu
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}