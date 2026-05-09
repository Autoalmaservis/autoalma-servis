'use client';
import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../../lib/supabase';

export default function VerejnaObjednavkaPage() {
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    plate: '',
    phone: '',
    email: '',
    description: '',
    date: '',
    start: '',
    end: ''
  });

  useEffect(() => {
    fetchOccupiedSlots();
  }, []);

  const fetchOccupiedSlots = async () => {
    // Načítame všetky udalosti, aby sme v kalendári zobrazili "Obsadené" (tmavé bloky)
    const { data } = await supabase.from('calendar_events').select('start_datetime, end_datetime');
    if (data) {
      const formatted = data.map(ev => ({
        start: ev.start_datetime,
        end: ev.end_datetime,
        display: 'background', 
        backgroundColor: '#1f1f23', 
      }));
      setEvents(formatted);
    }
    setLoading(false);
  };

  const handleDateSelect = (selectInfo) => {
    setFormData({
      ...formData,
      date: selectInfo.startStr.split('T')[0],
      start: selectInfo.startStr.split('T')[1].substring(0, 5),
      end: selectInfo.endStr.split('T')[1].substring(0, 5)
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // POKUS O AUTOMATICKÉ SPÁROVANIE SO ZÁKAZNÍKOM
    let foundUserId = null;
    try {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('license_plate', formData.plate.toUpperCase())
        .maybeSingle();
      
      if (vehicleData?.owner_id) {
        foundUserId = vehicleData.owner_id;
      }
    } catch (err) {
      console.log("Nepodarilo sa spáriť vozidlo so zákazníkom, ukladám ako novú požiadavku.");
    }

    const { error } = await supabase.from('calendar_events').insert([{
      title: `ONLINE: ${formData.plate}`,
      start_datetime: `${formData.date}T${formData.start}:00`,
      end_datetime: `${formData.date}T${formData.end}:00`,
      plate_number: formData.plate.toUpperCase(),
      issue_description: formData.description,
      customer_phone: formData.phone,
      customer_email: formData.email,
      is_confirmed: false,
      status: 'Čaká na schválenie', // Zmenené na status, ktorý signalizuje novú žiadosť
      user_id: foundUserId // Ak sme našli v DB majiteľa tejto ŠPZ, priradíme ho
    }]);

    if (!error) {
      fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: formData.plate.toUpperCase(),
          date: formData.date,
          time: formData.start,
          services: formData.description,
          phone: formData.phone,
          email: formData.email,
          source: 'Online objednávka',
        }),
      }).catch(() => {});

      alert("Vaša žiadosť o termín bola úspešne odoslaná. Budeme Vás kontaktovať pre potvrdenie termínu.");
      setIsModalOpen(false);
      fetchOccupiedSlots();
    } else {
      alert("Chyba pri odosielaní: " + error.message);
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-red-600 font-black italic animate-pulse tracking-widest uppercase">Načítavam voľné kapacity...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">
      
      <header className="w-full max-w-[1400px] mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-8 gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
            AutoAlma <span className="text-red-600 font-black">Booking</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">
            Vyberte si termín kliknutím alebo potiahnutím v kalendári
          </p>
        </div>
        <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
          Systém kontroly voľných kapacít v reálnom čase
        </div>
      </header>

      <div className="w-full max-w-[1400px] bg-zinc-950 border border-zinc-800 p-2 md:p-6 rounded-[3rem] shadow-[0_0_80px_rgba(220,38,38,0.05)] overflow-hidden">
        <style>{`
          .fc { --fc-border-color: #18181b; color: white; }
          .fc-header-toolbar { margin-bottom: 2rem !important; }
          .fc-button-primary { background: #09090b !important; border: 1px solid #27272a !important; text-transform: uppercase; font-size: 0.7rem !important; font-weight: bold !important; border-radius: 12px !important; }
          .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
          .fc-timegrid-slot { height: 4em !important; }
          .fc-col-header-cell { padding: 1rem 0 !important; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.1em; color: #52525b; }
          .fc-v-event { border: none !important; }
        `}</style>
        
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="sk"
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="18:00:00"
          events={events}
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek' }}
          height="75vh"
          expandRows={true}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-auto relative">
            <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-all text-xl"
            >✕</button>

            <div className="text-center mb-10">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Požiadavka na <span className="text-red-600">Servis</span></h2>
                <div className="inline-block mt-4 bg-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {formData.date} | {formData.start} - {formData.end}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 tracking-widest">ŠPZ Vozidla</label>
                <div className="flex gap-2">
                    <input required type="text" value={formData.plate} onChange={(e)=>setFormData({...formData, plate: e.target.value.toUpperCase()})} className="flex-grow bg-black border border-zinc-800 p-6 rounded-3xl text-white font-black text-4xl tracking-widest focus:border-red-600 outline-none uppercase shadow-inner text-center font-bold" placeholder="ŠPZ"/>
                </div>
                <p className="text-[8px] text-zinc-700 font-black uppercase text-center mt-2 tracking-widest italic">Vaša požiadavka bude spracovaná naším technikom</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Váš Telefón</label>
                  <input required type="tel" value={formData.phone} onChange={(e)=>setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner" placeholder="+421 ..."/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Váš E-mail</label>
                  <input required type="email" value={formData.email} onChange={(e)=>setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner" placeholder="meno@domena.sk"/>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Popis problému / Požiadavka</label>
                <textarea required value={formData.description} onChange={(e)=>setFormData({...formData, description: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white text-sm outline-none focus:border-red-600 h-32 resize-none shadow-inner font-bold" placeholder="Napr.: Výmena oleja, kontrola bŕzd..."/>
              </div>

              <button type="submit" className="w-full bg-red-600 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-[0_15px_30px_rgba(220,38,38,0.2)] hover:bg-red-500 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 font-bold">
                Odoslať žiadosť o termín
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}