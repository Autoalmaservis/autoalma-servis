'use client';

import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import daygridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SmsPanel from '../prijem/SmsPanel'; // Import SMS panela

export default function KalendarPage() {
  const router = useRouter();
  const calendarRef = useRef(null); 
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false); 
  const [selectionMode, setSelectionMode] = useState(null); 
  const [editingEventId, setEditingEventId] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(true);

  const [allClients, setAllClients] = useState([]); 
  const [selectedClientName, setSelectedClientName] = useState(''); 

  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  const [selectedDate, setSelectedDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [plate, setPlate] = useState('');
  const [title, setTitle] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  const [issueDescription, setIssueDescription] = useState('');
  const [plannedWork, setPlannedWork] = useState('');
  
  const [tempCustomerContact, setTempCustomerContact] = useState({ phone: '', email: '', customerName: '', userId: null });
  const [eventCustomerNote, setEventCustomerNote] = useState('');

  const [isKnown, setIsKnown] = useState(false);
  const [carData, setCarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');

  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientVehicles, setClientVehicles] = useState([]);
  const searchRef = useRef(null);

  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(null);

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalStep, setClientModalStep] = useState(1);
  const [clientForm, setClientForm] = useState({
    clientType: 'Osoba', full_name: '', phone: '', email: '', password: '',
    company_name: '', ico: '', dic: '', ic_dph: '',
    address: '', city: '', zip: '', country: 'Slovensko',
  });
  const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', vin: '', year: '', engine_volume: '', engine_power: '', fuel_type: 'Diesel', mileage: '' });
  const [clientModalLoading, setClientModalLoading] = useState(false);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);

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
      const isActuallyBlocked = ev.is_blocked === true || ev.plate_number === 'BLOK';
      
      let displayTitle = ev.title;
      if (isActuallyBlocked) displayTitle = `🚫 BLOKOVANÉ: ${ev.title}`;
      else if (ev.issue_description) displayTitle = `${ev.title} (${ev.issue_description})`;

      return {
        id: ev.id,
        title: isOnlinePending ? `⚠️ ŽIADOSŤ: ${ev.plate_number}` : displayTitle,
        start: ev.start_datetime,
        end: ev.end_datetime,
        backgroundColor: isActuallyBlocked ? '#3f3f46' : (isOnlinePending ? '#f59e0b' : (ev.employees?.color || '#dc2626')),
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
          isBlocked: isActuallyBlocked,
          employeeColor: ev.employees?.color || null,
          customerPhone: ev.customer_phone,
          customerEmail: ev.customer_email,
          userId: ev.user_id,
          customerNote: ev.customer_note || ''
        }
      };
    });
    setEvents(formattedEvents);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const pendingRequests = events.filter(ev => ev.extendedProps.isConfirmed === false);

  const loadCarDetails = async (spz) => {
    if (!spz || spz === 'BLOK' || spz === '') return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('license_plate', spz.toUpperCase())
      .maybeSingle();

    if (data) {
      setCarData(data);
      setIsKnown(true);
      setSelectedClientName(data.owner_name);
      setTempCustomerContact(prev => ({
        ...prev,
        phone: prev.phone || data.owner_phone || '',
        email: prev.email || data.owner_email || '',
        customerName: prev.customerName || data.owner_name || '',
        userId: prev.userId || data.owner_id || null
      }));
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

  // --- 3. MANIPULÁCIA S KALENDÁROM (OPRAVA DRAG & DROP) ---
  const handleEventChange = async (changeInfo) => {
    const { event } = changeInfo;
    
    if (!changeInfo.event.startStr || !changeInfo.event.endStr) return;

    const startStr = changeInfo.event.startStr.split('+')[0].split('Z')[0];
    const endStr = changeInfo.event.endStr.split('+')[0].split('Z')[0];

    const { error } = await supabase
      .from('calendar_events')
      .update({
        start_datetime: startStr,
        end_datetime: endStr,
      })
      .eq('id', event.id);

    if (error) {
      alert("Chyba pri aktualizácii: " + error.message);
      changeInfo.revert();
    } else {
      fetchData();
    }
  };

  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    const props = ev.extendedProps;

    setEditingEventId(ev.id);
    const isPending = props.isConfirmed === false;
    const isOrder = isPending || (props.plateNumber && props.plateNumber !== 'BLOK' && props.plateNumber !== '');

    if (isOrder) {
      setSelectionMode('order');
      if (props.plateNumber && props.plateNumber !== 'BLOK') loadCarDetails(props.plateNumber);
    } else {
      setSelectionMode('block');
      setCarData(null);
    }
    
    setIsConfirmed(props.isConfirmed !== false);
    setTitle(props.pureTitle || ev.title);
    
    // OPRAVA: Prenos času aj z Inboxu (ak startStr nie je dostupné, použijeme objekt start)
    let startStr = ev.startStr;
    let endStr = ev.endStr;

    if (!startStr && ev.start) {
        const d = new Date(ev.start);
        const offset = d.getTimezoneOffset() * 60000;
        startStr = new Date(d.getTime() - offset).toISOString();
    }
    if (!endStr && ev.end) {
        const d = new Date(ev.end);
        const offset = d.getTimezoneOffset() * 60000;
        endStr = new Date(d.getTime() - offset).toISOString();
    }
    
    if (startStr && startStr.includes('T')) {
      setSelectedDate(startStr.split('T')[0]);
      setStartTime(startStr.split('T')[1].substring(0, 5));
    }
    if (endStr && endStr.includes('T')) {
      setEndTime(endStr.split('T')[1].substring(0, 5));
    }
    
    setPlate(props.plateNumber || '');
    setSelectedEmployee(props.employeeId || '');
    setSelectedClientName(props.customerName || '');
    setIssueDescription(props.issueDescription || '');
    setPlannedWork(props.plannedWork || '');
    setTempCustomerContact({
      phone: props.customerPhone || '',
      email: props.customerEmail || '',
      customerName: props.customerName || '',
      userId: props.userId || null
    });
    setEventCustomerNote(props.customerNote || '');
    setClientSearch(''); setClientSearchResults([]); setClientVehicles([]);

    setIsModalOpen(true);
  };

  const openRequestFromPanel = (ev) => {
    const calendarApi = calendarRef.current.getApi();
    calendarApi.changeView('timeGridDay');
    calendarApi.gotoDate(ev.start);
    setIsInboxOpen(false);
  };

  const searchClients = async (q) => {
    if (q.length < 2) { setClientSearchResults([]); return; }
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, email, company_name')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(8);
    setClientSearchResults(data || []);
  };

  const handleClientSearchChange = (e) => {
    const q = e.target.value;
    setClientSearch(q);
    setClientVehicles([]);
    searchClients(q);
  };

  const selectClientFromSearch = async (client) => {
    const displayName = client.company_name || client.full_name;
    setClientSearch(displayName);
    setClientSearchResults([]);
    setSelectedClientName(displayName);
    setTempCustomerContact({ phone: client.phone || '', email: client.email || '', customerName: displayName, userId: client.id });

    const { data } = await supabase.from('vehicles').select('*').eq('owner_id', client.id);
    const vehicles = data || [];

    if (vehicles.length === 1) {
      const v = vehicles[0];
      setPlate(v.license_plate);
      setCarData(v);
      setIsKnown(true);
      setClientVehicles([]);
    } else if (vehicles.length > 1) {
      setClientVehicles(vehicles);
      setPlate('');
      setCarData(null);
    } else {
      setClientVehicles([]);
      setPlate('');
      setCarData(null);
    }
  };

  const selectVehicleFromPicker = (v) => {
    setPlate(v.license_plate);
    setCarData(v);
    setIsKnown(true);
    setClientVehicles([]);
  };

  const handlePlateBlur = async (spz) => { loadCarDetails(spz); };

  // --- OPRAVA VÝBERU NOVÉHO TERMÍNU (SELECT) ---
  const handleSelect = (arg) => {
    setEditingEventId(null);
    setIsConfirmed(true);
    
    // OPRAVA: Bezpečné získanie dátumu a času
    const startStr = arg.startStr || "";
    const endStr = arg.endStr || "";
    
    if (startStr.includes('T')) {
      setSelectedDate(startStr.split('T')[0]);
      setStartTime(startStr.split('T')[1].substring(0, 5));
    }
    if (endStr.includes('T')) {
      setEndTime(endStr.split('T')[1].substring(0, 5));
    }
    
    setPlate(''); setTitle(''); setSelectedClientName(''); setIssueDescription(''); setPlannedWork(''); setEventCustomerNote('');
    setCarData(null); setTempCustomerContact({ phone: '', email: '', customerName: '', userId: null }); setSelectedEmployee('');
    setClientSearch(''); setClientSearchResults([]); setClientVehicles([]);
    setEndDate('');
    setSelectionMode('ask');
    setIsModalOpen(true);
  };

  // --- 5. UKLADANIE ---
  const saveReservation = async (e) => {
    if (e) e.preventDefault();
    
    const isBlocking = selectionMode === 'block';
    
    const finalStart = `${selectedDate}T${startTime}:00`;
    // Pre BLOK: ak je zadaný endDate, použijeme ho; inak rovnaký deň
    const finalEndDate = (isBlocking && endDate) ? endDate : selectedDate;
    const finalEnd = `${finalEndDate}T${endTime}:00`;

    const reservationData = {
      // Ak potvrdzujeme flexi termín, odstránime značku FLEXI z titulku
      title: isBlocking ? (title || 'Servisná pauza') : (title.replace('FLEXI:', 'ZÁKAZKA:').replace('⚠️ ŽIADOSŤ:', 'ZÁKAZKA:') || `Zákazka ${plate}`),
      start_datetime: finalStart,
      end_datetime: finalEnd,
      employee_id: selectedEmployee || null,
      customer_name: isBlocking ? 'INTERNÉ' : (selectedClientName || tempCustomerContact.customerName || 'Neznámy'),
      plate_number: isBlocking ? 'BLOK' : plate,
      issue_description: isBlocking ? 'Blokovaný čas' : issueDescription,
      planned_work: plannedWork,
      is_confirmed: true, // Zmeníme na true, čo spustí Realtime zvonček v garáži
      is_blocked: isBlocking,
      status: isBlocking ? 'Blokované' : 'Naplánované',
      customer_phone: tempCustomerContact.phone,
      customer_email: tempCustomerContact.email,
      user_id: tempCustomerContact.userId
    };

    let error;
    if (editingEventId) {
      const result = await supabase.from('calendar_events').update(reservationData).eq('id', editingEventId);
      error = result.error;
    } else {
      const result = await supabase.from('calendar_events').insert([reservationData]).select();
      error = result.error;
    }
    
    if (!error) {
      if (tempCustomerContact.userId && !isBlocking && editingEventId && !isConfirmed) {
        await supabase.from('notifications').insert([{
          user_id: tempCustomerContact.userId,
          title: '✅ Termín bol potvrdený',
          content: `Váš servisný termín pre vozidlo ${plate} bol potvrdený na ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('sk-SK')} o ${startTime}. Tešíme sa na Vás!`,
          type: 'success'
        }]);
      }
      // Opýtaj sa technika či poslať potvrdzujúci email
      // — nová rezervácia, alebo potvrdenie čakajúcej žiadosti zákazníka
      const isConfirmingPending = editingEventId && !isConfirmed;
      if (!isBlocking && tempCustomerContact.email && (!editingEventId || isConfirmingPending)) {
        setPendingEmailConfirm({
          email: tempCustomerContact.email,
          customerName: selectedClientName || tempCustomerContact.customerName || '',
          plateNumber: plate,
          date: selectedDate,
          startTime,
          issueDescription,
        });
      }
      setIsModalOpen(false);
      setEditingEventId(null);
      setSelectionMode(null);
      fetchData();
    } else {
      alert("Chyba pri ukladaní: " + error.message);
    }
  };

  const openEventFromList = (ev) => {
    const props = ev.extendedProps;
    setEditingEventId(ev.id);
    const isPending = props.isConfirmed === false;
    const isOrder = isPending || (props.plateNumber && props.plateNumber !== 'BLOK' && props.plateNumber !== '');
    if (isOrder) { setSelectionMode('order'); if (props.plateNumber && props.plateNumber !== 'BLOK') loadCarDetails(props.plateNumber); }
    else { setSelectionMode('block'); setCarData(null); }
    setIsConfirmed(props.isConfirmed !== false);
    setTitle(props.pureTitle || ev.title);
    const s = typeof ev.start === 'string' ? ev.start : ev.start?.toISOString?.() || '';
    const e = typeof ev.end === 'string' ? ev.end : ev.end?.toISOString?.() || '';
    if (s.includes('T')) { setSelectedDate(s.split('T')[0]); setStartTime(s.split('T')[1].substring(0, 5)); }
    if (e.includes('T')) { setEndTime(e.split('T')[1].substring(0, 5)); }
    setPlate(props.plateNumber || '');
    setSelectedEmployee(props.employeeId || '');
    setSelectedClientName(props.customerName || '');
    setIssueDescription(props.issueDescription || '');
    setPlannedWork(props.plannedWork || '');
    setTempCustomerContact({ phone: props.customerPhone || '', email: props.customerEmail || '', customerName: props.customerName || '', userId: props.userId || null });
    setEventCustomerNote(props.customerNote || '');
    setIsModalOpen(true);
  };

  const lookupVehicleForClient = async (spz) => {
    const ecv = (spz || plate || '').toUpperCase().replace(/\s/g, '');
    if (!ecv) return;
    setVehicleLookupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/vehicle-lookup?ecv=${ecv}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const result = await res.json();
      if (result?.vehicle) {
        const v = result.vehicle;
        const yearOnly = v.dat_prva_evid ? v.dat_prva_evid.split('.').pop() : '';
        setVehicleForm(p => ({
          ...p,
          brand: v.znacka || '',
          model: v.obch_nazov || '',
          vin: v.vin || '',
          year: yearOnly,
          engine_volume: v.objem || '',
          engine_power: v.vykon || '',
          fuel_type: v.druh_paliva === 'Nafta' ? 'Diesel' : (v.druh_paliva || 'Diesel'),
        }));
      }
    } catch {}
    setVehicleLookupLoading(false);
  };

  const handleCreateClientFull = async (e) => {
    e.preventDefault();
    setClientModalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/create-zakaznik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          full_name: clientForm.full_name,
          email: clientForm.email.trim(),
          password: clientForm.password,
          phone: clientForm.phone,
          clientType: clientForm.clientType,
          company_name: clientForm.company_name,
          ico: clientForm.ico,
          dic: clientForm.dic,
          ic_dph: clientForm.ic_dph,
          address: clientForm.address,
          city: clientForm.city,
          zip: clientForm.zip,
          country: clientForm.country,
          vehicle: plate ? {
            license_plate: plate,
            brand_model: `${vehicleForm.brand} ${vehicleForm.model}`.trim(),
            vin: vehicleForm.vin,
            year_produced: vehicleForm.year ? parseInt(vehicleForm.year) : null,
            engine_volume: vehicleForm.engine_volume ? parseInt(vehicleForm.engine_volume) : null,
            engine_power: vehicleForm.engine_power ? parseInt(vehicleForm.engine_power) : null,
            fuel_type: vehicleForm.fuel_type,
            mileage: vehicleForm.mileage ? parseInt(vehicleForm.mileage) : 0,
          } : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chyba pri vytváraní klienta');

      fetchWithAuth('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientForm.email.trim(), name: clientForm.full_name, password: clientForm.password, createdByAdmin: true }),
      }).catch(() => {});

      const displayName = clientForm.clientType === 'Firma' ? (clientForm.company_name || clientForm.full_name) : clientForm.full_name;
      setCarData({ license_plate: plate, brand_model: `${vehicleForm.brand} ${vehicleForm.model}`.trim(), vin_number: vehicleForm.vin, owner_name: displayName, owner_id: json.userId });
      setTempCustomerContact({ phone: clientForm.phone, email: clientForm.email.trim(), customerName: displayName, userId: json.userId });
      setSelectedClientName(displayName);
      setIsKnown(true);
      setShowClientModal(false);
    } catch (err) {
      alert('Chyba: ' + err.message);
    } finally {
      setClientModalLoading(false);
    }
  };

  const deleteReservation = async () => {
    if (!confirm("Naozaj chcete zmazať tento záznam?")) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', editingEventId);
    if (!error) { setIsModalOpen(false); setEditingEventId(null); fetchData(); }
  };

  const sendPendingEmail = () => {
    const data = pendingEmailConfirm;
    setPendingEmailConfirm(null);
    fetch('/api/send-reservation-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-red-600 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam systém...</div>;

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden select-none p-6 text-white font-sans font-bold">
      <style>{`
        .fc { --fc-border-color: #18181b; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #18181b !important; }
        .fc-button-primary { background: #18181b !important; border: 1px solid #27272a !important; text-transform: uppercase; font-size: 0.7rem !important; font-weight: bold !important; border-radius: 8px !important; }
        .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
        .fc-view-harness { background: #09090b; border-radius: 2rem; overflow: hidden; border: 1px solid #18181b; }
        .fc-event { border-radius: 12px !important; padding: 6px !important; font-weight: 700 !important; cursor: pointer; border: none !important; }
        .fc-blok-strip { width: 26px !important; min-width: 26px !important; max-width: 26px !important; border-radius: 8px !important; padding: 4px 2px !important; overflow: hidden; }
        .fc-timegrid-slot { height: 3em !important; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}</style>
      
      <div className="pb-6 flex justify-between items-end bg-black font-bold">
        <div className="border-l-4 border-red-600 pl-5">
          <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none"> Harmonogram <span className="text-red-600">Dielne</span> </h1>
        </div>
        
        <div className="flex gap-3 items-center">
          {/* PREPÍNAČ ZOBRAZENIA */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
            <button onClick={() => {
                if (viewMode === 'calendar') {
                  calendarRef.current?.getApi().today();
                } else {
                  setViewMode('calendar');
                }
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
              📅 Kalendár
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
              ☰ Zoznam
            </button>
          </div>
          <button onClick={() => setIsInboxOpen(true)} className={`relative px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${pendingRequests.length > 0 ? 'bg-red-600 animate-pulse text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
            🔔 Žiadosti {pendingRequests.length > 0 && <span className="bg-white text-red-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">{pendingRequests.length}</span>}
          </button>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">← Späť</button>
        </div>
      </div>

      {isInboxOpen && (
        <div className="fixed inset-0 z-[150] flex justify-end font-bold">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsInboxOpen(false)}></div>
          <div className="relative w-full max-w-md bg-zinc-950 border-l border-zinc-900 shadow-2xl h-full flex flex-col">
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-black">
              <h2 className="text-xl uppercase italic text-red-600 tracking-widest font-black">Nové požiadavky</h2>
              <button onClick={() => setIsInboxOpen(false)} className="text-zinc-500 hover:text-white text-2xl font-bold">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {pendingRequests.map(req => (
                <div key={req.id} onClick={() => openRequestFromPanel(req)} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] hover:border-red-600 transition-all cursor-pointer group font-bold">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-white text-black px-3 py-1 rounded-lg font-black text-xs uppercase font-bold">{req.extendedProps.plateNumber}</span>
                  </div>
                  <p className="font-black text-white uppercase italic group-hover:text-red-500 font-bold">{req.extendedProps.customerName}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase">{req.extendedProps.pureTitle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="flex-grow relative bg-black mb-6 font-bold">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={new Date()}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek' }}
            locale="sk"
            firstDay={1}
            events={events}
            editable={true}
            selectable={true}
            select={handleSelect}
            eventDrop={handleEventChange}
            eventResize={handleEventChange}
            eventClick={handleEventClick}
            eventContent={(arg) => {
              if (arg.event.extendedProps.isBlocked) {
                const worker = arg.event.extendedProps.employeeName || '';
                const reason = arg.event.extendedProps.pureTitle || '';
                const label = ('🚫 ' + [worker, reason].filter(Boolean).join(' – ')).split('');
                return (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', paddingTop: '3px', gap: '0px' }}>
                    {label.map((ch, i) => (
                      <span key={i} style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.9)', lineHeight: 1.15, textTransform: 'uppercase', userSelect: 'none', flexShrink: 0 }}>
                        {ch === ' ' ? ' ' : ch}
                      </span>
                    ))}
                  </div>
                );
              }
              // Explicitný render pre bežné eventy (FullCalendar nevie fallbackovať na default keď je eventContent definovaný)
              return (
                <div style={{ padding: '2px 4px', overflow: 'hidden', height: '100%' }}>
                  {arg.timeText && <div style={{ fontSize: '10px', opacity: 0.75, fontWeight: 700, lineHeight: 1.2 }}>{arg.timeText}</div>}
                  <div style={{ fontSize: '11px', fontWeight: 800, lineHeight: 1.3, overflow: 'hidden' }}>{arg.event.title}</div>
                </div>
              );
            }}
            eventDidMount={(info) => {
              if (info.event.extendedProps.isBlocked) {
                const color = info.event.extendedProps.employeeColor || '#dc2626';
                info.el.style.setProperty('border', `2px solid ${color}`, 'important');
                info.el.classList.add('fc-blok-strip');
              }
            }}
            slotMinTime={`${workStart}:00`}
            slotMaxTime={`${workEnd}:00`}
            allDaySlot={false}
            height="100%"
          />
        </div>
      ) : (
        /* RIADKOVÝ ZOZNAM */
        <div className="flex-grow overflow-y-auto mb-6 space-y-6">
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const sorted = [...events]
              .filter(ev => !ev.extendedProps.isBlocked)
              .filter(ev => {
                const d = typeof ev.start === 'string' ? ev.start : ev.start?.toISOString?.() || '';
                return d >= todayStr;
              })
              .sort((a, b) => {
                const sa = typeof a.start === 'string' ? a.start : a.start?.toISOString?.() || '';
                const sb = typeof b.start === 'string' ? b.start : b.start?.toISOString?.() || '';
                return sa.localeCompare(sb);
              });

            if (sorted.length === 0) return (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-700 font-black uppercase tracking-widest text-sm italic">
                Žiadne nadchádzajúce objednávky
              </div>
            );

            const grouped = {};
            sorted.forEach(ev => {
              const d = typeof ev.start === 'string' ? ev.start.split('T')[0] : ev.start?.toISOString?.().split('T')[0] || '';
              if (!grouped[d]) grouped[d] = [];
              grouped[d].push(ev);
            });

            return Object.entries(grouped).map(([date, dayEvents]) => {
              const isToday = date === todayStr;
              const dateObj = new Date(date + 'T12:00:00');
              const dayLabel = dateObj.toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

              return (
                <div key={date}>
                  {/* DEŇ HEADER */}
                  <div className={`flex items-center gap-4 mb-3 px-1`}>
                    <div className={`flex items-center gap-3 ${isToday ? 'text-red-500' : 'text-zinc-400'}`}>
                      {isToday && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />}
                      <span className="text-[11px] font-black uppercase tracking-[0.3em]">{dayLabel}</span>
                      {isToday && <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-lg tracking-widest">DNES</span>}
                    </div>
                    <div className="flex-grow h-px bg-zinc-900" />
                    <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{dayEvents.length} objednávok</span>
                  </div>

                  {/* RIADKY */}
                  <div className="space-y-2">
                    {dayEvents.map(ev => {
                      const props = ev.extendedProps;
                      const isPending = props.isConfirmed === false;
                      const s = typeof ev.start === 'string' ? ev.start : ev.start?.toISOString?.() || '';
                      const e = typeof ev.end === 'string' ? ev.end : ev.end?.toISOString?.() || '';
                      const timeFrom = s.includes('T') ? s.split('T')[1].substring(0, 5) : '';
                      const timeTo = e.includes('T') ? e.split('T')[1].substring(0, 5) : '';
                      const emp = employees.find(em => em.id === props.employeeId);

                      return (
                        <button key={ev.id} onClick={() => openEventFromList(ev)}
                          className={`w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all group ${isPending ? 'bg-amber-600/10 border-amber-600/30 hover:border-amber-500' : 'bg-zinc-950 border-zinc-900 hover:border-red-600/40'}`}>

                          {/* ČAS */}
                          <div className="shrink-0 text-center w-16">
                            <p className="text-sm font-black text-white">{timeFrom}</p>
                            <p className="text-[10px] text-zinc-600 font-bold">{timeTo}</p>
                          </div>

                          <div className="w-px h-8 bg-zinc-800 shrink-0" />

                          {/* SPZ */}
                          <span className="shrink-0 bg-white text-black font-black text-xs tracking-widest px-3 py-1.5 rounded-lg uppercase">
                            {props.plateNumber}
                          </span>

                          {/* ZÁKAZNÍK + POPIS */}
                          <div className="flex-grow min-w-0">
                            <p className="text-white font-black uppercase italic text-sm truncate group-hover:text-red-400 transition-colors">
                              {props.customerName || props.pureTitle}
                            </p>
                            {props.issueDescription && (
                              <p className="text-zinc-500 text-[10px] font-bold truncate">{props.issueDescription}</p>
                            )}
                          </div>

                          {/* MECHANIK */}
                          {emp && (
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: emp.color || '#dc2626' }} />
                              <span className="text-[10px] font-black uppercase text-zinc-400 hidden md:block">{emp.name}</span>
                            </div>
                          )}

                          {/* STATUS */}
                          {isPending && (
                            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-600/20 border border-amber-600/30 px-2 py-1 rounded-lg animate-pulse">
                              ⚠️ Čaká
                            </span>
                          )}

                          <span className="shrink-0 text-zinc-700 group-hover:text-red-500 transition-colors">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex pl-0 md:pl-[260px] font-bold uppercase italic">
          <div className="flex-grow flex flex-col bg-black border-l border-zinc-900 shadow-2xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950 font-bold shrink-0">
              <h2 className="text-lg md:text-3xl font-black italic text-white tracking-tighter">
                {selectionMode === 'block' ? '🚫 Blokovaný čas' : '🚗 Servisná objednávka'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setSelectionMode(null); setEditingEventId(null); }} className="bg-zinc-900 hover:bg-white hover:text-black p-3 md:p-4 rounded-full transition-all font-bold">✕</button>
            </div>

            <div className="flex-grow overflow-y-auto">
              {selectionMode === 'ask' ? (
                <div className="h-full flex flex-col md:flex-row items-center justify-center p-6 md:p-12 gap-4 md:gap-8 font-bold">
                  <button onClick={() => setSelectionMode('order')} className="flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] hover:bg-red-600 transition-all w-full md:w-80 md:aspect-square shadow-2xl">
                    <span className="text-4xl md:text-5xl mb-4 md:mb-6">🚗</span> <span className="font-black tracking-widest font-bold text-sm md:text-base">Nová Objednávka</span>
                  </button>
                  <button onClick={() => setSelectionMode('block')} className="flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] hover:bg-zinc-700 transition-all w-full md:w-80 md:aspect-square shadow-2xl">
                    <span className="text-4xl md:text-5xl mb-4 md:mb-6">🚫</span> <span className="font-black tracking-widest font-bold text-sm md:text-base">Blokovať Čas</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 h-full font-bold">
                  <form onSubmit={saveReservation} className="p-4 md:p-12 space-y-4 md:space-y-8 border-r border-zinc-900 font-bold overflow-y-auto">
                    <div className="bg-zinc-900/30 p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-zinc-800 space-y-4 md:space-y-6">
                      {selectionMode === 'block' ? (
                        /* BLOK: od dátumu+čas DO dátumu+čas */
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase">Od dátumu</label>
                              <div className="relative">
                                <input required type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                  className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl text-white font-black outline-none focus:border-red-600 transition-all cursor-pointer text-sm" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase">Do dátumu</label>
                              <div className="relative">
                                <input type="date" value={endDate} min={selectedDate} onChange={(e) => setEndDate(e.target.value)}
                                  className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl text-white font-black outline-none focus:border-red-600 transition-all cursor-pointer text-sm" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:gap-6">
                            <div>
                              <label className="block text-[9px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase">Od času</label>
                              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl text-white font-bold outline-none text-sm" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase">Do času</label>
                              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl text-white font-bold outline-none text-sm" />
                            </div>
                          </div>
                          {endDate && endDate > selectedDate && (
                            <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">
                              🗓 Blokovanie od {selectedDate} {startTime} do {endDate} {endTime}
                            </p>
                          )}
                        </>
                      ) : (
                        /* OBJEDNÁVKA: jeden deň */
                        <>
                          <div>
                            <label className="block text-[9px] font-black text-red-500 mb-2 ml-1 tracking-widest uppercase font-bold">Dátum opravy</label>
                            <div className="relative group">
                              <input required type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full bg-black border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all font-bold pr-10 cursor-pointer text-sm" />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">📅</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:gap-6 font-bold">
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none text-sm" />
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none text-sm" />
                          </div>
                        </>
                      )}
                    </div>

                    {selectionMode === 'order' && (
                      <div className="space-y-5 font-bold">
                        {/* VYHĽADÁVANIE ZÁKAZNÍKA */}
                        <div
                          ref={searchRef}
                          className="relative"
                          onBlur={(e) => { if (!searchRef.current?.contains(e.relatedTarget)) setClientSearchResults([]); }}
                        >
                          <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Vyhľadať zákazníka</label>
                          <input
                            type="text"
                            value={clientSearch}
                            onChange={handleClientSearchChange}
                            placeholder="Meno, telefón, email, firma..."
                            className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all text-sm"
                          />
                          {clientSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-20 bg-zinc-900 border border-zinc-700 rounded-2xl mt-1 shadow-2xl overflow-hidden">
                              {clientSearchResults.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => selectClientFromSearch(c)}
                                  className="w-full text-left px-5 py-4 hover:bg-zinc-800 flex justify-between items-center border-b border-zinc-800 last:border-0 transition-all"
                                >
                                  <span className="font-black uppercase text-sm text-white">{c.company_name || c.full_name}</span>
                                  <span className="text-zinc-500 text-xs">{c.phone}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* VÝBER VOZIDLA (ak má klient viac vozidiel) */}
                        {clientVehicles.length > 1 && (
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Vyberte vozidlo zákazníka</label>
                            <div className="grid gap-2">
                              {clientVehicles.map(v => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => selectVehicleFromPicker(v)}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${plate === v.license_plate ? 'border-red-600 bg-red-600/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}
                                >
                                  <span className="bg-white text-black font-black text-sm tracking-widest px-3 py-1.5 rounded-lg uppercase shrink-0">{v.license_plate}</span>
                                  <span className="text-zinc-300 font-bold text-sm">{v.brand_model}</span>
                                  {v.year_produced && <span className="text-zinc-600 text-xs ml-auto">{v.year_produced}</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ŠPZ + MECHANIK */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">ŠPZ Vozidla</label>
                            <input required type="text" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} onBlur={(e) => handlePlateBlur(e.target.value)} className="w-full bg-white text-black border-none p-3 md:p-5 rounded-2xl md:rounded-3xl font-black text-xl md:text-3xl tracking-widest focus:ring-4 focus:ring-red-600 outline-none uppercase shadow-2xl font-bold" />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Mechanik</label>
                            <select required value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-3xl text-white font-black uppercase outline-none focus:border-red-600 cursor-pointer font-bold text-sm">
                              <option value="">-- Vybrať --</option>
                              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* MENO KLIENTA + TELEFÓN */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Meno klienta</label>
                            <input
                              type="text"
                              value={selectedClientName}
                              onChange={e => setSelectedClientName(e.target.value)}
                              placeholder="Ján Novák..."
                              className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-red-600 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Telefón</label>
                            <input
                              type="tel"
                              value={tempCustomerContact.phone}
                              onChange={e => setTempCustomerContact(p => ({ ...p, phone: e.target.value }))}
                              placeholder="+421 900 000 000"
                              className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-red-600 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {selectionMode === 'block' && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Mechanik</label>
                        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-black uppercase outline-none focus:border-red-600 cursor-pointer font-bold text-sm">
                          <option value="">-- Všetci / Interné --</option>
                          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="font-bold">
                      <label className="block text-[10px] font-bold text-zinc-500 mb-2 ml-1 tracking-widest uppercase font-bold">Popis / Dôvod</label>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Napr. Výmena oleja..." className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-3 uppercase italic font-bold text-sm" />
                      {selectionMode === 'order' && <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Podrobnosti závady..." className="w-full bg-zinc-900 border border-zinc-800 p-3 md:p-5 rounded-xl md:rounded-3xl text-white text-sm outline-none focus:border-red-600 h-20 resize-none uppercase font-bold" />}
                    </div>

                    <div className="flex flex-col gap-4 pt-4 font-bold">
                      {selectionMode === 'order' && editingEventId && (
                        <Link href={{ pathname: '/prijem', query: { meno: selectedClientName, spz: plate, popis: issueDescription } }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl uppercase text-xs tracking-[0.2em] text-center shadow-lg transition-all italic font-bold block"> 📋 Otvoriť Zákazkový list </Link>
                      )}
                      <button type="submit" className={`w-full ${selectionMode === 'block' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-700'} text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl uppercase text-xs tracking-[0.2em] shadow-xl transition-all italic font-bold`}>
                        {editingEventId ? 'Uložiť a Potvrdiť' : 'Zapísať do harmonogramu'}
                      </button>

                      {editingEventId && (
                        <button
                          type="button"
                          onClick={deleteReservation}
                          className="w-full bg-zinc-900 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl uppercase text-xs tracking-[0.2em] shadow-xl transition-all italic font-bold"
                        >
                          🗑️ Vymazať objednávku
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="hidden lg:block bg-zinc-950 p-8 md:p-12 space-y-10 border-l border-zinc-900 font-bold overflow-y-auto">
                    <h3 className="text-sm font-black uppercase text-zinc-600 tracking-[0.4em] border-b border-zinc-900 pb-4 italic font-black">Detail Vozidla a Partnera</h3>
                    
                    {selectionMode === 'block' ? (
                      <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[4rem] text-zinc-600 text-center p-12 font-bold"> <span className="text-6xl mb-4">🔒</span> <p className="font-black uppercase tracking-widest text-xs font-bold">Termín je zablokovaný</p> </div>
                    ) : (
                      <div className="space-y-8 animate-in slide-in-from-right duration-500 font-bold">
                        
                        {!isConfirmed && (
                          <div className="border-2 border-amber-500 rounded-[3rem] shadow-2xl shadow-amber-600/10 overflow-hidden">
                            <div className="bg-amber-600/30 px-8 py-4 flex items-center gap-3">
                              <span className="text-amber-400 text-base animate-pulse">⚠️</span>
                              <p className="text-[10px] font-black text-amber-400 tracking-[0.3em] uppercase">Čakajúca žiadosť o termín</p>
                            </div>
                            <div className="bg-amber-600/10 p-8 space-y-5">
                              <h4 className="text-3xl font-black text-white uppercase italic leading-tight">
                                {tempCustomerContact.customerName || selectedClientName || 'Neznámy zákazník'}
                              </h4>
                              <div className="space-y-2">
                                {tempCustomerContact.phone && (
                                  <a href={`tel:${tempCustomerContact.phone}`} className="flex items-center gap-3 group">
                                    <span className="text-zinc-500 text-sm">📞</span>
                                    <span className="text-xl font-black text-white tracking-widest group-hover:text-amber-400 transition-colors">{tempCustomerContact.phone}</span>
                                  </a>
                                )}
                                {tempCustomerContact.email && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-zinc-500 text-sm">✉️</span>
                                    <span className="text-sm text-zinc-300">{tempCustomerContact.email}</span>
                                  </div>
                                )}
                              </div>
                              {plate && (
                                <div>
                                  <span className="bg-white text-black px-4 py-2 rounded-xl font-black text-lg tracking-widest uppercase">{plate}</span>
                                </div>
                              )}
                              {issueDescription && (
                                <div className="border-t border-amber-600/30 pt-5">
                                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">Požadované úkony</p>
                                  <div className="bg-black/40 rounded-2xl p-4 space-y-1">
                                    {issueDescription.split('\n').filter(Boolean).map((line, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5 text-xs shrink-0">•</span>
                                        <span className="text-sm text-zinc-300 font-bold">{line}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {eventCustomerNote && (
                                <div className="border-2 border-yellow-400/60 bg-yellow-400/10 rounded-2xl p-4">
                                  <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-2">💬 Poznámka zákazníka</p>
                                  <p className="text-white font-bold text-sm leading-relaxed">{eventCustomerNote}</p>
                                </div>
                              )}
                              <p className="text-[9px] text-zinc-500 font-bold leading-relaxed uppercase border-t border-zinc-800 pt-4">
                                Nastavte presný čas, priraďte mechanika a kliknite „Uložiť a Potvrdiť". Zákazník dostane notifikáciu.
                              </p>
                            </div>
                          </div>
                        )}

                        {(tempCustomerContact.phone || tempCustomerContact.email) && (
                            <div className="bg-red-600/10 border border-red-600/20 p-8 rounded-[3rem] shadow-xl space-y-4 font-bold">
                              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest font-bold">Kontakt</p>
                              <h4 className="text-2xl font-black text-white uppercase italic font-bold">{tempCustomerContact.customerName || selectedClientName || 'Zákazník'}</h4>
                              <p className="text-xs text-zinc-400 font-bold flex items-center gap-2 font-bold"> 📞 <span className="text-white text-lg tracking-widest font-bold">{tempCustomerContact.phone}</span> </p>
                              <div className="flex flex-col gap-4 mt-4">
                                <a href={`tel:${tempCustomerContact.phone}`} className="w-full text-center bg-red-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest font-bold hover:bg-red-500 transition-all">Zavolať ihneď</a>
                                
                                {/* SMS PANEL INTEGRÁCIA */}
                                <div className="border-t border-zinc-800 pt-4 mt-2">
                                  {tempCustomerContact.phone && (
                                    <SmsPanel 
                                      phone={tempCustomerContact.phone} 
                                      plate={plate} 
                                      customerName={tempCustomerContact.customerName || selectedClientName}
                                      userId={tempCustomerContact.userId}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                        )}

                        {carData ? (
                          <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group font-bold">
                            <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-xl tracking-widest mb-6 inline-block uppercase font-bold">{carData.license_plate}</span>
                            <h4 className="text-4xl font-black uppercase italic mb-8 tracking-tighter leading-tight font-bold">{carData.brand_model}</h4>
                            <div className="grid grid-cols-1 gap-y-4 text-zinc-300 italic font-bold">
                              <div><p className="text-[9px] font-black text-red-600 uppercase mb-1 font-bold">VIN</p><span className="font-mono text-xs font-bold">{carData.vin_number || '---'}</span></div>
                              <div><p className="text-[9px] font-black text-red-600 uppercase mb-1 font-bold">Majiteľ</p>{carData.owner_name}</div>
                            </div>
                            <Link href={{ pathname: '/prijem', query: { spz: plate, meno: carData.owner_name } }} className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all">
                              📋 Otvoriť zákazku
                            </Link>
                          </div>
                        ) : plate ? (
                          <div className="border-2 border-dashed border-zinc-800 rounded-[3rem] p-8 space-y-4">
                            <p className="text-center text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em]">Vozidlo nie je v DB</p>
                            <button onClick={() => {
                              setShowClientModal(true);
                              setVehicleForm({ brand: '', model: '', vin: '', year: '', fuel_type: 'Diesel', mileage: '' });
                              setClientForm(p => ({
                                ...p,
                                full_name: tempCustomerContact.customerName || '',
                                phone: tempCustomerContact.phone || '',
                                email: tempCustomerContact.email || '',
                              }));
                            }} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all">
                              + Nový zákazník
                            </button>
                          </div>
                        ) : (
                          <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-800 text-center p-12 italic text-[10px] uppercase tracking-[0.5em] leading-relaxed font-bold">Zadajte ŠPZ</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODÁL — NOVÝ ZÁKAZNÍK (2-krokový wizard) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3rem] w-full max-w-3xl shadow-2xl my-auto">

            {/* HEADER + KROKY */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Nový <span className="text-red-600">Zákazník</span></h2>
                <div className="flex items-center gap-3 mt-3">
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${clientModalStep === 1 ? 'text-white' : 'text-zinc-600'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${clientModalStep === 1 ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>1</span>
                    Zákazník
                  </div>
                  <span className="text-zinc-700">→</span>
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${clientModalStep === 2 ? 'text-white' : 'text-zinc-600'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${clientModalStep === 2 ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>2</span>
                    Vozidlo
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowClientModal(false); setClientModalStep(1); }} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all text-lg">✕</button>
            </div>

            {/* ── KROK 1: ZÁKAZNÍK ── */}
            {clientModalStep === 1 && (
              <div className="space-y-6">
                <div className="flex bg-black p-1 rounded-2xl border border-zinc-800">
                  <button type="button" onClick={() => setClientForm(p => ({...p, clientType: 'Osoba'}))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.clientType === 'Osoba' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Súkromná Osoba</button>
                  <button type="button" onClick={() => setClientForm(p => ({...p, clientType: 'Firma'}))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.clientType === 'Firma' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Firma / Živnostník</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Prihlasovacie údaje</p>
                    <input required type="email" placeholder="E-mailová adresa" value={clientForm.email} onChange={e => setClientForm(p => ({...p, email: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                    <input required type="text" placeholder="Heslo do Garáže" value={clientForm.password} onChange={e => setClientForm(p => ({...p, password: e.target.value}))} className="w-full bg-black border border-red-600/30 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                    <p className="text-[9px] text-zinc-600 uppercase ml-1">Zákazník dostane e-mail s prihlasovacími údajmi</p>

                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pt-2">Kontaktné údaje</p>
                    <input required type="text" placeholder={clientForm.clientType === 'Firma' ? 'Kontaktná osoba' : 'Meno a priezvisko'} value={clientForm.full_name} onChange={e => setClientForm(p => ({...p, full_name: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                    <input required type="tel" placeholder="Telefónne číslo" value={clientForm.phone} onChange={e => setClientForm(p => ({...p, phone: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />

                    {clientForm.clientType === 'Firma' && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Fakturačné údaje</p>
                        <input type="text" placeholder="Obchodné meno" value={clientForm.company_name} onChange={e => setClientForm(p => ({...p, company_name: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-blue-500 font-bold" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" placeholder="IČO" value={clientForm.ico} onChange={e => setClientForm(p => ({...p, ico: e.target.value}))} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs outline-none focus:border-blue-500 font-bold" />
                          <input type="text" placeholder="DIČ" value={clientForm.dic} onChange={e => setClientForm(p => ({...p, dic: e.target.value}))} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs outline-none focus:border-blue-500 font-bold" />
                          <input type="text" placeholder="IČ DPH" value={clientForm.ic_dph} onChange={e => setClientForm(p => ({...p, ic_dph: e.target.value}))} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs outline-none focus:border-blue-500 font-bold" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Adresa</p>
                    <input type="text" placeholder="Ulica a súpisné číslo" value={clientForm.address} onChange={e => setClientForm(p => ({...p, address: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="Mesto" value={clientForm.city} onChange={e => setClientForm(p => ({...p, city: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                      <input type="text" placeholder="PSČ" value={clientForm.zip} onChange={e => setClientForm(p => ({...p, zip: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                    </div>
                    <input type="text" placeholder="Krajina" value={clientForm.country} onChange={e => setClientForm(p => ({...p, country: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold" />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => { setShowClientModal(false); setClientModalStep(1); }} className="flex-1 text-zinc-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all">Zrušiť</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!clientForm.email || !clientForm.password || !clientForm.full_name || !clientForm.phone) { alert('Vyplňte všetky povinné polia.'); return; }
                      setClientModalStep(2);
                      setVehicleForm({ brand: '', model: '', vin: '', year: '', engine_volume: '', engine_power: '', fuel_type: 'Diesel', mileage: '' });
                      lookupVehicleForClient(plate);
                    }}
                    className="flex-[3] bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] transition-all shadow-xl"
                  >
                    Pokračovať → Vozidlo
                  </button>
                </div>
              </div>
            )}

            {/* ── KROK 2: VOZIDLO ── */}
            {clientModalStep === 2 && (
              <form onSubmit={handleCreateClientFull} className="space-y-6">
                {/* ŠPZ veľká ako v klienti */}
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 ml-2 block tracking-widest">ŠPZ Vozidla</label>
                  <div className="flex gap-3">
                    <div className="flex-grow bg-white text-black font-black text-4xl tracking-widest px-6 py-4 rounded-3xl uppercase shadow-2xl">
                      {plate || '---'}
                    </div>
                    <button type="button" onClick={() => lookupVehicleForClient(plate)} disabled={vehicleLookupLoading} className="px-6 bg-red-600/10 border border-red-600 text-red-500 rounded-3xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all disabled:opacity-40">
                      {vehicleLookupLoading ? '...' : 'Načítať ⚡'}
                    </button>
                  </div>
                  {vehicleLookupLoading && <p className="text-[9px] text-zinc-500 uppercase mt-2 ml-2 animate-pulse">Načítavam údaje z evidencie...</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Značka</label><input required type="text" value={vehicleForm.brand} onChange={e => setVehicleForm(p => ({...p, brand: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" /></div>
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Model</label><input required type="text" value={vehicleForm.model} onChange={e => setVehicleForm(p => ({...p, model: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" /></div>
                </div>

                <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">VIN číslo</label><input type="text" maxLength={17} value={vehicleForm.vin} onChange={e => setVehicleForm(p => ({...p, vin: e.target.value.toUpperCase()}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-mono outline-none focus:border-red-600 font-bold uppercase tracking-widest" /></div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-blue-400 uppercase mb-2 ml-1 block tracking-widest italic">Stav tachometra (km)</label><input type="number" value={vehicleForm.mileage} onChange={e => setVehicleForm(p => ({...p, mileage: e.target.value}))} className="w-full bg-black border border-blue-600/30 p-4 rounded-2xl text-white font-black text-xl outline-none focus:border-blue-500" /></div>
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Rok výroby</label><input type="number" value={vehicleForm.year} onChange={e => setVehicleForm(p => ({...p, year: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" /></div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Objem (cm³)</label><input type="text" value={vehicleForm.engine_volume} onChange={e => setVehicleForm(p => ({...p, engine_volume: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" /></div>
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Výkon (kW)</label><input type="text" value={vehicleForm.engine_power} onChange={e => setVehicleForm(p => ({...p, engine_power: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold" /></div>
                  <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-1 block tracking-widest">Palivo</label><select value={vehicleForm.fuel_type} onChange={e => setVehicleForm(p => ({...p, fuel_type: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold appearance-none"><option>Diesel</option><option>Benzín</option><option>Hybrid</option><option>Elektro</option><option>LPG/CNG</option></select></div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setClientModalStep(1)} className="flex-1 text-zinc-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all">← Späť</button>
                  <button type="submit" disabled={clientModalLoading} className="flex-[3] bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] transition-all disabled:opacity-40 shadow-xl">
                    {clientModalLoading ? 'Registrujem...' : '✅ Registrovať zákazníka + Pridať vozidlo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Floating dialog — odoslať potvrdzujúci email zákazníkovi */}
      {pendingEmailConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4">
          <p className="text-sm font-black uppercase tracking-wider text-white mb-1">Odoslať potvrdzujúci e-mail?</p>
          <p className="text-xs text-zinc-400 mb-4 truncate">{pendingEmailConfirm.email}</p>
          <div className="flex gap-2">
            <button
              onClick={sendPendingEmail}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all"
            >
              Áno, odoslať
            </button>
            <button
              onClick={() => setPendingEmailConfirm(null)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all"
            >
              Nie
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}