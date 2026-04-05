'use client';
import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import daygridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function KalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(null); // 'ask', 'order', 'block'
  const [editingEventId, setEditingEventId] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(true);

  const [allClients, setAllClients] = useState([]); 
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
  
  const [tempCustomerContact, setTempCustomerContact] = useState({ phone: '', email: '' });

  const [isKnown, setIsKnown] = useState(false);
  const [carData, setCarData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. NAČÍTANIE DÁT ---
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

    const { data: clientData } = await supabase.from('user_profiles').select('full_name, company_name');
    if (clientData) {
      const uniqueNames = [...new Set(clientData.map(c => c.company_name || c.full_name))];
      setAllClients(uniqueNames.sort());
    }

    const { data: evData } = await supabase.from('calendar_events').select('*, employees(name, color)');
    
    const formattedEvents = (evData || []).map(ev => {
      const isOnlinePending = ev.is_confirmed === false;
      const isBlocked = ev.is_blocked === true;
      
      let displayTitle = ev.title;
      if (isBlocked) displayTitle = `🚫 BLOKOVANÝ ČAS: ${ev.title}`;
      else if (ev.issue_description) displayTitle = `${ev.title} (${ev.issue_description})`;

      return {
        id: ev.id,
        title: isOnlinePending ? `⚠️ NOVÁ ŽIADOSŤ: ${ev.plate_number}` : displayTitle,
        start: ev.start_datetime,
        end: ev.end_datetime,
        backgroundColor: isBlocked ? '#3f3f46' : (isOnlinePending ? '#f59e0b' : (ev.employees?.color || '#dc2626')),
        borderColor: isOnlinePending ? '#ffffff' : 'transparent',
        classNames: isOnlinePending ? ['animate-pulse', 'border-2'] : [],
        extendedProps: { 
          pureTitle: ev.title, 
          employeeName: ev.employees?.name,
          employeeId: ev.employee_id,
          customerName: ev.customer_name,
          plateNumber: ev.plate_number,
          issueDescription: ev.issue_description,
          plannedWork: ev.planned_work,
          isConfirmed: ev.is_confirmed,
          isBlocked: ev.is_blocked,
          customerPhone: ev.customer_phone,
          customerEmail: ev.customer_email
        }
      };
    });
    setEvents(formattedEvents);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- 2. LOGIKA VOZIDIEL ---
  const loadCarDetails = async (spz) => {
    if (!spz || spz.length < 5 || spz === 'BLOK') return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('license_plate', spz.toUpperCase())
      .maybeSingle();

    if (data) {
      setCarData(data);
      setIsKnown(true);
      setSelectedClientName(data.owner_name);
    } else {
      const { data: fallback } = await supabase.from('job_tickets').select('*').eq('plate_number', spz.toUpperCase()).limit(1).maybeSingle();
      if (fallback) {
        setCarData({
          license_plate: fallback.plate_number,
          brand_model: fallback.car_brand_model,
          vin_number: fallback.vin_number,
          owner_name: fallback.customer_name,
          customer_phone: fallback.customer_phone
        });
        setIsKnown(true);
        setSelectedClientName(fallback.customer_name);
      } else {
        setCarData(null);
        setIsKnown(false);
      }
    }
  };

  // --- 3. MANIPULÁCIA S KALENDÁROM ---
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
    } else {
      fetchData();
    }
  };

  // --- 4. KLIKNUTIE NA UDALOSŤ (EDITÁCIA) ---
  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    const props = ev.extendedProps;

    setEditingEventId(ev.id);
    
    // NASTAVENIE MÓDU (Dôležité pre editáciu)
    const currentMode = props.isBlocked ? 'block' : 'order';
    setSelectionMode(currentMode);
    
    setIsConfirmed(props.isConfirmed !== false);
    setTitle(props.pureTitle || ev.title);
    
    // Oprava formátu dátumu a času pre inputy
    const startObj = new Date(ev.start);
    const endObj = ev.end ? new Date(ev.end) : startObj;
    
    setSelectedDate(startObj.toISOString().split('T')[0]);
    setStartTime(startObj.toTimeString().substring(0, 5));
    setEndTime(endObj.toTimeString().substring(0, 5));
    
    setPlate(props.plateNumber || '');
    setSelectedEmployee(props.employeeId || '');
    setSelectedClientName(props.customerName || '');
    setIssueDescription(props.issueDescription || '');
    setPlannedWork(props.plannedWork || '');
    setTempCustomerContact({ phone: props.customerPhone || '', email: props.customerEmail || '' });
    
    if (props.plateNumber && props.plateNumber !== 'BLOK') {
        loadCarDetails(props.plateNumber);
    }
    
    setIsModalOpen(true);
  };

  const handlePlateBlur = async (spz) => { loadCarDetails(spz); };

  const handleSelect = (arg) => {
    setEditingEventId(null);
    setIsConfirmed(true);
    const datePart = arg.startStr.split('T')[0];
    const timeStart = arg.startStr.split('T')[1]?.substring(0, 5) || '08:00';
    const timeEnd = arg.endStr.split('T')[1]?.substring(0, 5) || '10:00';
    
    setSelectedDate(datePart);
    setStartTime(timeStart);
    setEndTime(timeEnd);
    
    setPlate('');
    setTitle('');
    setSelectedClientName('');
    setIssueDescription('');
    setPlannedWork('');
    setCarData(null);
    setTempCustomerContact({ phone: '', email: '' });
    setSelectedEmployee('');
    
    setSelectionMode('ask');
    setIsModalOpen(true);
  };

  // --- 5. UKLADANIE / MAZANIE ---
  const saveReservation = async (e) => {
    if (e) e.preventDefault();
    
    const isBlocking = selectionMode === 'block';
    const reservationData = {
      title: isBlocking ? (title || 'Servisná pauza / Blokované') : (title || `Zákazka ${plate}`),
      start_datetime: `${selectedDate}T${startTime}:00`,
      end_datetime: `${selectedDate}T${endTime}:00`,
      employee_id: selectedEmployee || null,
      customer_name: isBlocking ? 'INTERNÉ' : (selectedClientName || (carData ? (carData.owner_name || carData.customer_name) : '')),
      plate_number: isBlocking ? 'BLOK' : plate,
      issue_description: isBlocking ? 'Blokovaný čas technikom' : issueDescription,
      planned_work: plannedWork,
      is_confirmed: true,
      is_blocked: isBlocking,
      status: isBlocking ? 'Blokované' : 'Naplánované'
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
      setSelectionMode(null);
      fetchData();
    } else {
      alert("Chyba pri ukladaní: " + error.message);
    }
  };

  const deleteReservation = async () => {
    if (!confirm("Naozaj chcete zmazať tento záznam?")) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', editingEventId);
    if (!error) { setIsModalOpen(false); setEditingEventId(null); fetchData(); }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam systém...</div>;

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden select-none p-6 text-white font-sans">
      <style>{`
        .fc { --fc-border-color: #18181b; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #18181b !important; }
        .fc-button-primary { background: #18181b !important; border: 1px solid #27272a !important; text-transform: uppercase; font-size: 0.7rem !important; font-weight: bold !important; border-radius: 8px !important; }
        .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
        .fc-toolbar-title { font-weight: 900 !important; text-transform: uppercase; font-size: 1.1rem !important; font-style: italic; letter-spacing: -0.025em; }
        .fc-view-harness { background: #09090b; border-radius: 2rem; overflow: hidden; border: 1px solid #18181b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .fc-event { border-radius: 12px !important; padding: 6px !important; font-weight: 700 !important; font-size: 0.75rem !important; cursor: pointer; border: none !important; }
        .fc-timegrid-slot { height: 3em !important; }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>
      
      <div className="pb-6 flex justify-between items-end bg-black font-bold">
        <div className="border-l-4 border-red-600 pl-5">
          <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">
            Harmonogram <span className="text-red-600">Dielne</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-2 italic">AutoAlma Capacity Management</p>
        </div>
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">← Späť</button>
      </div>

      <div className="flex-grow relative bg-black mb-6">
        <FullCalendar
          plugins={[daygridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          locale="sk"
          events={events}
          editable={true}
          selectable={true}
          select={handleSelect}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
          eventClick={handleEventClick}
          slotMinTime={`${workStart}:00`}
          slotMaxTime={`${workEnd}:00`}
          allDaySlot={false}
          height="100%"
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in fade-in duration-200 font-bold italic uppercase">
          
          {/* HEADER MODALU */}
          <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950 font-black font-bold">
            <div>
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">
                {selectionMode === 'ask' ? 'Vyberte akciu' : (selectionMode === 'block' ? 'Blokovanie času' : (editingEventId ? 'Úprava Rezervácie' : 'Nová Rezervácia'))}
              </h2>
            </div>
            <button onClick={() => { setIsModalOpen(false); setSelectionMode(null); setEditingEventId(null); }} className="bg-zinc-900 hover:bg-white hover:text-black p-4 rounded-full transition-all">✕</button>
          </div>

          <div className="flex-grow overflow-y-auto">
            {selectionMode === 'ask' ? (
              <div className="h-full flex items-center justify-center p-12 gap-8 font-bold">
                <button 
                  onClick={() => setSelectionMode('order')}
                  className="group flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-12 rounded-[3rem] hover:bg-red-600 transition-all w-80 aspect-square shadow-2xl"
                >
                  <span className="text-5xl mb-6">🚗</span>
                  <span className="font-black uppercase tracking-widest group-hover:text-white font-bold">Nová Objednávka</span>
                </button>
                <button 
                  onClick={() => setSelectionMode('block')}
                  className="group flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-12 rounded-[3rem] hover:bg-zinc-700 transition-all w-80 aspect-square shadow-2xl"
                >
                  <span className="text-5xl mb-6">🚫</span>
                  <span className="font-black uppercase tracking-widest group-hover:text-white font-bold">Blokovať Čas</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 h-full font-bold">
                <form onSubmit={saveReservation} className="p-8 md:p-12 space-y-8 border-r border-zinc-900 font-bold">
                  <div className="bg-zinc-900/30 p-6 rounded-[2rem] border border-zinc-800 space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-red-500 uppercase mb-2 ml-1 tracking-widest font-bold">Dátum opravy</label>
                      <input required type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all"/>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Príchod</label>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest font-bold">Odchod (odhad)</label>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" />
                      </div>
                    </div>
                  </div>

                  {selectionMode === 'order' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top duration-300 font-bold">
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">ŠPZ Vozidla</label>
                        <input required type="text" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} onBlur={(e) => handlePlateBlur(e.target.value)} className="w-full bg-white text-black border-none p-5 rounded-3xl font-black text-3xl tracking-widest focus:ring-4 focus:ring-red-600 outline-none uppercase shadow-2xl font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Pridelený mechanik</label>
                        <select required value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full h-[76px] bg-zinc-900 border border-zinc-800 p-4 rounded-3xl text-white font-black uppercase outline-none focus:border-red-600 cursor-pointer">
                          <option value="">-- Kolega --</option>
                          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Dôvod návštevy / Popis</label>
                    <input 
                      type="text" 
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)} 
                      placeholder={selectionMode === 'block' ? "Napr. Dovolenka, Školenie..." : "Napr. Brzdy, Olej..."}
                      className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-4 uppercase italic" 
                    />
                    {selectionMode === 'order' && (
                      <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Podrobnosti o závade..." className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-3xl text-white text-sm outline-none focus:border-red-600 h-24 resize-none uppercase" />
                    )}
                  </div>

                  <div className="flex flex-col gap-4 pt-4 font-bold">
                    {selectionMode === 'order' && editingEventId && isConfirmed && (
                      <Link href={{ pathname: '/prijem', query: { meno: selectedClientName, spz: plate, popis: issueDescription } }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-[0.3em] text-center shadow-lg transition-all italic font-bold font-bold font-bold">
                        📋 Otvoriť Zákazkový list
                      </Link>
                    )}
                    <button type="submit" className={`w-full ${selectionMode === 'block' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-700'} text-white font-black py-6 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-xl transition-all italic font-bold font-bold`}>
                      {editingEventId ? 'Uložiť zmeny' : (selectionMode === 'block' ? 'Zablokovať čas v dielni' : 'Potvrdiť termín')}
                    </button>
                    {editingEventId && (
                      <button type="button" onClick={deleteReservation} className="text-zinc-600 hover:text-red-500 font-bold uppercase text-[9px] tracking-widest transition-all mt-4 font-bold">Odstrániť z harmonogramu</button>
                    )}
                  </div>
                </form>

                {/* PRAVÝ PANEL - DETAIL VOZIDLA */}
                <div className="bg-zinc-950 p-8 md:p-12 space-y-10 border-l border-zinc-900 font-bold">
                  <h3 className="text-sm font-black uppercase text-zinc-600 tracking-[0.4em] border-b border-zinc-900 pb-4 italic font-black font-bold font-bold">Detail Vozidla a Partnera</h3>
                  {selectionMode === 'block' ? (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[4rem] text-zinc-600 text-center p-12">
                      <span className="text-6xl mb-4">🔒</span>
                      <p className="font-black uppercase tracking-widest text-xs">Termín je nedostupný</p>
                      <p className="text-[10px] mt-2 italic font-bold">Pre online rezervácie bude tento čas neviditeľný.</p>
                    </div>
                  ) : carData ? (
                    <div className="space-y-12 animate-in slide-in-from-right duration-500 font-bold">
                      <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group font-bold">
                        <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-xl tracking-widest mb-6 inline-block shadow-2xl font-bold uppercase">{carData.license_plate || carData.plate_number}</span>
                        <h4 className="text-4xl font-black uppercase italic mb-8 tracking-tighter leading-tight font-bold">{carData.brand_model || carData.car_brand_model}</h4>
                        <div className="grid grid-cols-2 gap-y-10 gap-x-12 text-zinc-300 italic">
                          <div><p className="text-[9px] font-black text-red-600 uppercase mb-2 tracking-widest">Identifikácia VIN</p><span className="font-mono text-xs font-bold">{carData.vin_number || '---'}</span></div>
                          <div><p className="text-[9px] font-black text-red-600 uppercase mb-2 tracking-widest">Partner / Majiteľ</p>{carData.owner_name || carData.customer_name}</div>
                          <div><p className="text-[9px] font-black text-red-600 uppercase mb-2 tracking-widest">Telefónny kontakt</p>{carData.customer_phone || '---'}</div>
                          <div><p className="text-[9px] font-black text-red-600 uppercase mb-2 tracking-widest font-bold">Zodpovedný kolega</p>{employees.find(e => e.id === selectedEmployee)?.name || '---'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-800 text-center p-12 italic text-[10px] uppercase tracking-[0.5em] leading-relaxed">
                      Zadajte platnú ŠPZ<br/>pre načítanie dát z databázy
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}