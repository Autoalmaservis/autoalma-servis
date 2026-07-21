'use client';
import { useState, useEffect } from 'react';
import { trackObjednavkaSubmit } from '@/app/lib/analytics';
import { supabase } from '../../lib/supabase';

export default function VerejnaObjednavkaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    plate: '', phone: '', email: '', description: '',
  });

  const [availabilityMap, setAvailabilityMap] = useState({});
  const [roleCapacity, setRoleCapacity] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [dayEvents, setDayEvents] = useState([]);
  const [workHours, setWorkHours] = useState({ start: '07', end: '17' });

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
  ];

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    const res = await fetch('/api/availability');
    if (!res.ok) { setLoading(false); return; }
    const { availability, roleCapacity: rc } = await res.json();
    setAvailabilityMap(availability);
    setRoleCapacity(rc);
    setLoading(false);
  };

  const fetchDayEvents = async (dateStr) => {
    const [{ data: settings }, { data: evts }] = await Promise.all([
      supabase.from('business_settings').select('*').in('id', ['work_start', 'work_end']),
      supabase.from('calendar_events')
        .select('start_datetime, end_datetime, employee_id')
        .gte('start_datetime', `${dateStr}T00:00:00`)
        .lte('start_datetime', `${dateStr}T23:59:59`),
    ]);
    const start = settings?.find(s => s.id === 'work_start')?.value?.split(':')[0] || '07';
    const end = settings?.find(s => s.id === 'work_end')?.value?.split(':')[0] || '17';
    setWorkHours({ start, end });
    setDayEvents(evts || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDay || !selectedSlot) {
      alert('Prosím vyberte deň a čas príchodu.');
      return;
    }
    setSubmitting(true);

    const [h, m] = selectedSlot.split(':').map(Number);
    const endH = h + 1;
    const endStr = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    let foundUserId = null;
    try {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('license_plate', formData.plate.toUpperCase())
        .maybeSingle();
      if (vehicleData?.owner_id) foundUserId = vehicleData.owner_id;
    } catch (_) {}

    const { error } = await supabase.from('calendar_events').insert([{
      title: `ONLINE: ${formData.plate}`,
      start_datetime: `${selectedDay}T${selectedSlot}:00`,
      end_datetime: `${selectedDay}T${endStr}:00`,
      plate_number: formData.plate.toUpperCase(),
      issue_description: formData.description,
      customer_phone: formData.phone,
      customer_email: formData.email,
      is_confirmed: false,
      status: 'Čaká na schválenie',
      user_id: foundUserId,
    }]);

    if (!error) {
      fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: formData.plate.toUpperCase(),
          date: selectedDay,
          time: selectedSlot,
          services: formData.description,
          phone: formData.phone,
          email: formData.email,
          source: 'Online objednávka',
        }),
      }).catch(() => {});

      if (formData.email) {
        fetch('/api/send-reservation-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            customerName: '',
            plateNumber: formData.plate.toUpperCase(),
            date: selectedDay,
            startTime: selectedSlot,
            issueDescription: formData.description,
            type: 'received',
          }),
        }).catch(() => {});
      }

      trackObjednavkaSubmit();
      alert('Vaša žiadosť o termín bola úspešne odoslaná. Budeme Vás kontaktovať pre potvrdenie termínu.');
      setIsModalOpen(false);
      setSelectedDay('');
      setSelectedSlot('');
      setFormData({ plate: '', phone: '', email: '', description: '' });
      fetchAvailability();
    } else {
      alert('Chyba pri odosielaní: ' + error.message);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <div className="text-red-600 font-black italic animate-pulse tracking-widest uppercase">Načítavam voľné kapacity...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">

      <header className="w-full max-w-3xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-8 gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
            AutoAlma <span className="text-red-600">Booking</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">
            Vyberte si voľný termín a odošlite žiadosť
          </p>
        </div>
        <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
          Kontrola kapacít v reálnom čase
        </div>
      </header>

      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-[3rem] p-6 md:p-10 shadow-[0_0_80px_rgba(220,38,38,0.05)]">

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-600/40 border border-green-600/50 inline-block" /> Voľné
          </span>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600/40 border border-amber-600/50 inline-block" /> Čiastočne obsadené
          </span>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600/40 border border-red-600/50 inline-block" /> Takmer plné
          </span>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white">
            <span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 border border-zinc-700 inline-block" /> Plné / Víkend
          </span>
        </div>

        {/* Navigácia mesiaca */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl text-sm hover:bg-zinc-700 transition-all"
          >←</button>
          <span className="text-sm font-black uppercase tracking-widest">
            {calendarMonth.toLocaleString('sk-SK', { month: 'long', year: 'numeric' }).toUpperCase()}
          </span>
          <button
            onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl text-sm hover:bg-zinc-700 transition-all"
          >→</button>
        </div>

        {/* Hlavičky dní */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(d => (
            <div key={d} className="text-center text-[9px] text-zinc-500 font-black">{d}</div>
          ))}
        </div>

        {/* Dni mesiaca */}
        <div className="grid grid-cols-7 gap-1.5 mb-8">
          {(() => {
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
            const todayStr = new Date().toISOString().split('T')[0];
            const cells = [];

            for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);

            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayOfWeek = (firstDay + d - 1) % 7;
              const isWeekend = dayOfWeek >= 5;
              const isPast = dateStr <= todayStr;
              const avail = availabilityMap[dateStr];
              const isSelected = selectedDay === dateStr;
              const isFull = avail && avail.free === 0;
              const isDisabled = isPast || isWeekend || isFull;

              let cls = 'bg-zinc-900 border border-zinc-800 text-zinc-700 cursor-not-allowed';
              if (!isPast && !isWeekend && avail) {
                const pct = avail.total > 0 ? avail.booked / avail.total : 0;
                if (isFull)        cls = 'bg-zinc-900 border border-zinc-800 text-zinc-700 opacity-40 cursor-not-allowed';
                else if (pct >= 0.8) cls = 'bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 cursor-pointer';
                else if (pct >= 0.4) cls = 'bg-amber-600/20 border border-amber-600/40 text-amber-400 hover:bg-amber-600/40 cursor-pointer';
                else               cls = 'bg-green-600/20 border border-green-600/40 text-green-400 hover:bg-green-600/40 cursor-pointer';
              }
              if (isSelected) cls = 'bg-red-600 border border-red-500 text-white cursor-pointer shadow-lg shadow-red-600/30';

              cells.push(
                <button
                  key={d}
                  disabled={isDisabled}
                  onClick={() => { setSelectedDay(dateStr); setSelectedSlot(''); fetchDayEvents(dateStr); }}
                  className={`rounded-xl flex flex-col items-center justify-center py-2 transition-all ${cls}`}
                >
                  <span className="text-[11px] font-black">{d}</span>
                  {avail && !isPast && !isWeekend && avail.total > 0 && (
                    <span className="text-[7px] opacity-60 font-bold">{avail.free}/{avail.total}</span>
                  )}
                </button>
              );
            }
            return cells;
          })()}
        </div>

        {/* Po výbere dňa — hodinový prehľad + výber času */}
        {selectedDay && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border-t border-zinc-800 pt-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-4">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
              </p>

              {/* Hodinový prehľad obsadenosti */}
              <div className="bg-black/40 rounded-2xl border border-zinc-800 p-4 space-y-1.5 mb-6">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-3">Obsadenosť počas dňa</p>
                {(() => {
                  const startH = parseInt(workHours.start);
                  const endH = parseInt(workHours.end);
                  const total = Object.values(roleCapacity).reduce((a, b) => a + b, 0) || 1;
                  return Array.from({ length: endH - startH }, (_, i) => {
                    const h = startH + i;
                    const slotStart = new Date(`${selectedDay}T${String(h).padStart(2, '0')}:00:00`);
                    const slotEnd = new Date(`${selectedDay}T${String(h + 1).padStart(2, '0')}:00:00`);
                    const busy = new Set();
                    dayEvents.forEach(ev => {
                      const s = new Date(ev.start_datetime);
                      const e = new Date(ev.end_datetime);
                      if (ev.employee_id && s < slotEnd && e > slotStart) busy.add(ev.employee_id);
                    });
                    const busyCount = busy.size;
                    const pct = total > 0 ? busyCount / total : 0;
                    const free = total - busyCount;
                    const barColor = pct === 0 ? 'bg-green-600/50' : pct < 0.5 ? 'bg-green-600/30' : pct < 1 ? 'bg-amber-500/50' : 'bg-red-600/40';
                    return (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-white w-9 shrink-0">{String(h).padStart(2, '0')}:00</span>
                        <div className="flex-grow h-3 bg-zinc-900 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(5, pct * 100)}%` }} />
                        </div>
                        <span className={`text-[8px] font-black w-10 text-right shrink-0 ${pct === 1 ? 'text-red-500' : 'text-white'}`}>
                          {pct === 1 ? 'PLNÉ' : `${free}/${total}`}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Výber času */}
              <p className="text-[9px] font-black uppercase tracking-widest text-white mb-3">Vyberte čas príchodu</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {timeSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => { setSelectedSlot(slot); setIsModalOpen(true); }}
                    className={`py-3 rounded-xl text-[11px] font-black transition-all border ${
                      selectedSlot === slot
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                        : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!selectedDay && (
          <p className="text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest py-4">
            ↑ Vyberte si deň v kalendári
          </p>
        )}
      </div>

      {/* Formulárový modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-auto relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-all text-xl">✕</button>

            <div className="text-center mb-10">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                Požiadavka na <span className="text-red-600">Servis</span>
              </h2>
              <div className="inline-block mt-4 bg-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {selectedDay && new Date(selectedDay + 'T12:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' })} | {selectedSlot}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 tracking-widest">ŠPZ Vozidla</label>
                <input
                  required type="text"
                  value={formData.plate}
                  onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                  className="bg-black border border-zinc-800 p-6 rounded-3xl text-white font-black text-4xl tracking-widest focus:border-red-600 outline-none uppercase shadow-inner text-center"
                  placeholder="ŠPZ"
                />
                <p className="text-[8px] text-zinc-700 font-black uppercase text-center mt-2 tracking-widest italic">Vaša požiadavka bude spracovaná naším technikom</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Váš Telefón</label>
                  <input
                    required type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner"
                    placeholder="+421 ..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Váš E-mail</label>
                  <input
                    required type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 shadow-inner"
                    placeholder="meno@domena.sk"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 mb-2 block tracking-widest">Popis problému / Požiadavka</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white text-sm outline-none focus:border-red-600 h-32 resize-none shadow-inner font-bold"
                  placeholder="Napr.: Výmena oleja, kontrola bŕzd..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-[0_15px_30px_rgba(220,38,38,0.2)] hover:bg-red-500 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 disabled:opacity-50"
              >
                {submitting ? 'Odosielam...' : 'Odoslať žiadosť o termín'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
