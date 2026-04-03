'use client';
import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import daygridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

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
  const [carData, setCarData] = useState(null); // Tu budeme držať technické info z garáže
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

  // FUNKCIA NA NAČÍTANIE TECHNICKÝCH DÁT Z GARÁŽE (JOB_TICKETS)
  const loadCarDetails = async (spz) => {
    if (!spz || spz.length < 5) return;
    const { data } = await supabase
      .from('job_tickets')
      .select('*')
      .eq('plate_number', spz.toUpperCase())
      .neq('car_brand_model', null) // Chceme tie záznamy, kde sú technické dáta
      .limit(1)
      .single();

    if (data) {
      setCarData(data);
      setIsKnown(true);
      setSelectedClientName(data.customer_name);
    } else {
      setCarData(null);
      setIsKnown(false);
    }
  };

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
    
    // Hneď načítame technické info o aute ak máme ŠPZ
    if (props.plateNumber) loadCarDetails(props.plateNumber);
    
    setIsModalOpen(true);
  };

  const handlePlateBlur = async (spz) => {
    loadCarDetails(spz);
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
    setCarData(null);
    
    setIsModalOpen(true);
  };

  const deleteReservation = async () => {
    if (!confirm("Naozaj chcete zmazať túto rezerváciu?")) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', editingEventId);
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
      const result = await supabase.from('calendar_events').update(reservationData).eq('id', editingEventId);
      error = result.error;
    } else {
      const result = await supabase.from('calendar_events').insert([reservationData]);
      error = result.error;
    }
    
    if (!error) {
      setIsModalOpen(false);
      setEditingEventId(null);
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
        .fc-event { border-radius: 12px !important; padding: 6px !important; font-weight: 700 !important; font-size: 0.75rem !important; cursor: pointer; border: none !important; }
      `}</style>
      
      <div className="pb-6 flex justify-between items-end bg-black">
        <div className="border-l-4 border-red-600 pl-5">
          <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">
            Harmonogram <span className="text-red-600">Dielne</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-2">AutoAlma Capacity Management</p>
        </div>
      </div>

      <div className="flex-grow relative bg-black mb-6">
        <FullCalendar
          plugins={[daygridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          locale="sk"
          events={events}
          dateClick={handleDateClick}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
          eventClick={handleEventClick}
          slotMinTime={`${workStart}:00`}
          slotMaxTime={`${workEnd}:00`}
          height="100%"
        />
      </div>

      {/* MODAL OKNO - ZVÄČŠENÉ NA CELÚ OBRAZOVKU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          {/* HLAVIČKA MODALU */}
          <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
            <div>
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">
                {editingEventId ? 'Detail Rezervácie' : 'Nová Rezervácia'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">
                {plate || 'Zadajte ŠPZ pre technické detaily'}
              </p>
            </div>
            <button 
              onClick={() => { setIsModalOpen(false); setEditingEventId(null); setCarData(null); }} 
              className="bg-zinc-900 hover:bg-white hover:text-black p-4 rounded-full transition-all"
            >
              ✕
            </button>
          </div>

          <div className="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-2">
            
            {/* ĽAVÁ STRANA: FORMULÁR */}
            <form onSubmit={saveReservation} className="p-8 md:p-12 space-y-8 border-r border-zinc-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">ŠPZ Vozidla</label>
                  <input 
                    required 
                    type="text" 
                    value={plate} 
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    onBlur={(e) => handlePlateBlur(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white font-black text-3xl tracking-widest focus:border-red-600 outline-none transition-all" 
                    placeholder="SPZ..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Pridelený mechanik</label>
                  <select 
                    required 
                    value={selectedEmployee} 
                    onChange={(e) => setSelectedEmployee(e.target.value)} 
                    className="w-full h-[76px] bg-zinc-900 border border-zinc-800 p-4 rounded-3xl text-white font-black uppercase outline-none cursor-pointer appearance-none focus:border-red-600"
                  >
                    <option value="">-- Vyberte kolegu --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Čas príchodu</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white font-bold outline-none focus:border-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Predpokladaný koniec</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white font-bold outline-none focus:border-red-600" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Popis závady (čo hlási zákazník)</label>
                  <textarea 
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white text-sm outline-none focus:border-red-600 h-24 resize-none"
                    placeholder="Opíšte problém..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Interný plán prác</label>
                  <textarea 
                    value={plannedWork}
                    onChange={(e) => setPlannedWork(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white text-sm outline-none focus:border-blue-600 h-24 resize-none"
                    placeholder="Čo presne budeme na aute robiť?"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                {editingEventId && (
                  <Link 
                    href={{ pathname: '/prijem', query: { klient: selectedClientName, spz: plate, popis: issueDescription } }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-3xl uppercase text-xs tracking-[0.3em] transition-all text-center shadow-lg"
                  >
                    📋 Vytvoriť zákazkový list
                  </Link>
                )}
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-xl shadow-red-600/20 transition-all">
                  {editingEventId ? 'Uložiť zmeny rezervácie' : 'Potvrdiť rezerváciu'}
                </button>
                {editingEventId && (
                  <button type="button" onClick={deleteReservation} className="text-zinc-600 hover:text-red-500 font-bold uppercase text-[9px] tracking-widest transition-all">
                    Odstrániť tento záznam
                  </button>
                )}
              </div>
            </form>

            {/* PRAVÁ STRANA: INFORMÁCIE Z GARÁŽE */}
            <div className="bg-zinc-950 p-8 md:p-12 space-y-10">
              <h3 className="text-sm font-black uppercase text-zinc-600 tracking-[0.4em] border-b border-zinc-900 pb-4">Technická vizitka z garáže</h3>
              
              {carData ? (
                <div className="space-y-12 animate-in fade-in slide-in-from-right duration-500">
                  {/* AUTO INFO */}
                  <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-red-600/10"></div>
                    <span className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-lg tracking-widest mb-4 inline-block shadow-xl">{carData.plate_number}</span>
                    <h4 className="text-4xl font-black uppercase italic mb-8">{carData.car_brand_model}</h4>
                    
                    <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">VIN Číslo</p>
                        <p className="font-mono text-sm text-zinc-300 tracking-tighter">{carData.vin_number || 'Nezadané'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Rok výroby</p>
                        <p className="text-sm font-bold text-white italic">{carData.year_produced || '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Špecifikácia motora</p>
                        <p className="text-sm font-bold text-white">{carData.engine_volume} / {carData.engine_power} kW</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Palivo</p>
                        <p className="text-sm font-bold text-white uppercase italic">{carData.fuel_type || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* MAJITEĽ INFO */}
                  <div className="border-l-2 border-red-600 pl-8 space-y-4">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Registrovaný majiteľ</p>
                    <div>
                      <p className="text-2xl font-black uppercase italic text-white leading-none">{carData.customer_name}</p>
                      <p className="text-zinc-500 font-bold mt-2">{carData.customer_phone || 'Telefón chýba'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-800 text-center p-12">
                  <div className="text-5xl mb-6 opacity-10">🚗</div>
                  <p className="uppercase font-black tracking-[0.3em] text-xs max-w-xs leading-loose">
                    Zadajte platnú ŠPZ vľavo pre načítanie technickej karty vozidla z databázy garáže.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}