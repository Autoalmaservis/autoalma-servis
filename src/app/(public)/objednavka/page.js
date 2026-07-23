'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trackObjednavkaSubmit } from '@/app/lib/analytics';
import { supabase } from '../../lib/supabase';

const nd = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function VerejnaObjednavkaPage() {
  const router = useRouter();
  // Kroky: 1 = základné info, 2 = booking modal
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Krok 1 — základné info zákazníka
  const [customerData, setCustomerData] = useState({ name: '', phone: '', email: '', plate: '' });

  // Normy & kategórie
  const [categories, setCategories] = useState([]);
  const [norms, setNorms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedNorms, setSelectedNorms] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [currentCustomIssue, setCurrentCustomIssue] = useState('');
  const [currentItemDuration, setCurrentItemDuration] = useState('technik');
  const [normSearch, setNormSearch] = useState('');

  // Kalendár
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [roleCapacity, setRoleCapacity] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [letTechDecideTime, setLetTechDecideTime] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [dayEvents, setDayEvents] = useState([]);
  const [workHours, setWorkHours] = useState({ start: '07', end: '17' });

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
  ];

  const fetchServiceData = async () => {
    const [{ data: cats }, { data: nrms }] = await Promise.all([
      supabase.from('service_categories').select('*').order('name'),
      supabase.from('service_norms').select('*').order('service_name'),
    ]);
    if (cats) setCategories(cats);
    if (nrms) setNorms(nrms);
  };

  const fetchAvailability = async () => {
    const res = await fetch('/api/availability');
    if (!res.ok) return;
    const { availability, roleCapacity: rc } = await res.json();
    setAvailabilityMap(availability);
    setRoleCapacity(rc);
  };

  const fetchDayEvents = async (dateStr) => {
    const [{ data: settings }, { data: evts }] = await Promise.all([
      supabase.from('business_settings').select('*').in('id', ['work_start', 'work_end']),
      supabase.from('calendar_events')
        .select('start_datetime, end_datetime, employee_id')
        .gte('start_datetime', `${dateStr}T00:00:00`)
        .lte('start_datetime', `${dateStr}T23:59:59`),
    ]);
    setWorkHours({
      start: settings?.find(s => s.id === 'work_start')?.value?.split(':')[0] || '07',
      end: settings?.find(s => s.id === 'work_end')?.value?.split(':')[0] || '17',
    });
    setDayEvents(evts || []);
  };

  const addNorm = (norm) => {
    if (selectedNorms.find(n => n.id === norm.id)) return;
    setSelectedNorms(prev => [...prev, norm]);
    setNormSearch('');
  };

  const addCustomItem = () => {
    if (!currentCustomIssue.trim()) return;
    setCustomItems(prev => [...prev, { id: Date.now(), description: currentCustomIssue.trim(), duration: currentItemDuration }]);
    setCurrentCustomIssue('');
    setCurrentItemDuration('technik');
  };

  const confirmStep1 = (e) => {
    e.preventDefault();
    // Načítaj dáta pre booking modal
    fetchServiceData();
    fetchAvailability();
    setSelectedNorms([]);
    setCustomItems([]);
    setSelectedDay('');
    setSelectedSlot('');
    setLetTechDecideTime(false);
    setCustomerNote('');
    setCalendarMonth(new Date());
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedNorms.length === 0 && customItems.length === 0) {
      const ok = window.confirm('Nevybrali ste žiadny servisný úkon ani vlastný popis závady.\n\nChcete odoslať žiadosť bez opisu problému?');
      if (!ok) return;
    }
    if (!selectedDay || (!selectedSlot && !letTechDecideTime)) {
      alert('Prosím vyberte deň príchodu a čas, alebo zvoľte „Čas určí technik".');
      return;
    }
    setSubmitting(true);

    try {
      // Zostaviť popis požiadavky
      const normsList = selectedNorms.length > 0
        ? `SERVISNÉ ÚKONY:\n${selectedNorms.map((p, i) => `${i + 1}. ${p.service_name} (~${p.duration_minutes} min)`).join('\n')}`
        : '';
      const customList = customItems.length > 0
        ? `VLASTNÉ ÚKONY:\n${customItems.map((item, i) => {
            const dur = item.duration === 'technik' ? 'čas na technikovi'
              : item.duration >= 60 ? `~${item.duration / 60} hod` : `~${item.duration} min`;
            return `${i + 1}. ${item.description} (${dur})`;
          }).join('\n')}`
        : '';
      const issueDescription = [normsList, customList].filter(Boolean).join('\n\n');

      // Čas konca — odhadovaný súčet noriem + 60 min fallback
      const normMinutes = selectedNorms.reduce((a, n) => a + n.duration_minutes, 0);
      const customMinutes = customItems.filter(i => i.duration !== 'technik').reduce((a, i) => a + i.duration, 0);
      const estimatedMinutes = normMinutes + customMinutes || 60;
      const timeForEvent = letTechDecideTime ? '08:00' : selectedSlot;
      const endDate = new Date(`${selectedDay}T${timeForEvent}:00`);
      endDate.setMinutes(endDate.getMinutes() + estimatedMinutes);
      const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      const plateFinal = customerData.plate.trim().toUpperCase();

      // --- Uloženie/nájdenie zákazníka ---
      let customerId = null;
      if (customerData.email) {
        const { data: byEmail } = await supabase.from('customers').select('id').eq('email', customerData.email).maybeSingle();
        if (byEmail) customerId = byEmail.id;
      }
      if (!customerId && customerData.phone) {
        const { data: byPhone } = await supabase.from('customers').select('id').eq('phone', customerData.phone).maybeSingle();
        if (byPhone) customerId = byPhone.id;
      }
      if (!customerId) {
        const { data: newCust } = await supabase.from('customers').insert([{
          name: customerData.name.trim(),
          phone: customerData.phone.trim() || null,
          email: customerData.email.trim() || null,
          client_type: 'Osoba',
        }]).select().single();
        customerId = newCust?.id || null;
      }

      // --- Uloženie/nájdenie vozidla ---
      let vehicleId = null;
      if (plateFinal) {
        const { data: existingVehicle } = await supabase.from('vehicles').select('id').eq('license_plate', plateFinal).maybeSingle();
        if (existingVehicle) {
          vehicleId = existingVehicle.id;
        } else if (customerId) {
          const { data: newVehicle } = await supabase.from('vehicles').insert([{
            owner_id: customerId,
            license_plate: plateFinal,
            brand_model: 'Neznáme',
          }]).select().single();
          vehicleId = newVehicle?.id || null;
        }
      }

      // --- Uloženie calendar_event ---
      const { error } = await supabase.from('calendar_events').insert([{
        title: `ONLINE: ${plateFinal || customerData.name}`,
        start_datetime: `${selectedDay}T${timeForEvent}:00`,
        end_datetime: `${selectedDay}T${endStr}:00`,
        customer_note: [
          letTechDecideTime ? '⏰ Čas príchodu: určí prijímací technik' : null,
          customerNote ? `Poznámka: ${customerNote}` : null,
        ].filter(Boolean).join(' | ') || null,
        plate_number: plateFinal || null,
        issue_description: issueDescription,
        customer_name: customerData.name.trim(),
        customer_phone: customerData.phone.trim() || null,
        customer_email: customerData.email.trim() || null,
        is_confirmed: false,
        status: 'Čaká na schválenie',
        user_id: customerId,
        vehicle_id: vehicleId,
      }]);

      if (error) throw error;

      // Notifikácia servisu
      fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerData.name.trim(),
          plateNumber: plateFinal,
          date: selectedDay,
          time: letTechDecideTime ? 'Čas určí technik' : selectedSlot,
          services: issueDescription,
          customerNote: customerNote || null,
          phone: customerData.phone,
          email: customerData.email,
          source: 'Online objednávka',
        }),
      }).catch(() => {});

      // Potvrdenie zákazníkovi
      if (customerData.email) {
        fetch('/api/send-reservation-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: customerData.email,
            customerName: customerData.name,
            plateNumber: plateFinal,
            date: selectedDay,
            startTime: letTechDecideTime ? 'Čas určí technik' : selectedSlot,
            issueDescription,
            customerNote: customerNote || null,
            type: 'received',
          }),
        }).catch(() => {});
      }

      trackObjednavkaSubmit();
      alert('Vaša žiadosť o termín bola úspešne odoslaná. Budeme Vás kontaktovať pre potvrdenie termínu.');
      router.push('/');
    } catch (err) {
      alert('Chyba pri odosielaní: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-bold">

      {/* KROK 1 — ZÁKLADNÉ ÚDAJE (zobrazí sa ihneď) */}
      {step === 1 && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl">

            {/* Hlavička */}
            <div className="mb-8">
              <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">AutoAlma Servis</p>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-tight">
                Objednajte sa<br /><span className="text-red-600">Online</span>
              </h2>
            </div>

            <form onSubmit={confirmStep1} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block mb-1.5">Meno a priezvisko *</label>
                <input
                  required autoFocus
                  type="text"
                  value={customerData.name}
                  onChange={e => setCustomerData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ján Novák"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-5 py-4 text-white font-bold outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block mb-1.5">Telefón *</label>
                <input
                  required
                  type="tel"
                  value={customerData.phone}
                  onChange={e => setCustomerData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+421 9XX XXX XXX"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-5 py-4 text-white font-bold outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={customerData.email}
                  onChange={e => setCustomerData(p => ({ ...p, email: e.target.value }))}
                  placeholder="meno@domena.sk"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-5 py-4 text-white font-bold outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block mb-1.5">ŠPZ vozidla</label>
                <input
                  type="text"
                  value={customerData.plate}
                  onChange={e => setCustomerData(p => ({ ...p, plate: e.target.value.toUpperCase() }))}
                  placeholder="BA123AB"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 rounded-2xl px-5 py-4 text-white font-black uppercase tracking-widest outline-none transition-all text-center text-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl transition-all mt-2"
              >
                Pokračovať k výberu termínu →
              </button>
            </form>

            {/* Kontaktné info */}
            <div className="mt-8 pt-6 border-t border-zinc-800 flex flex-wrap justify-center gap-4 text-[9px] text-zinc-600 font-black uppercase tracking-widest">
              <span>📞 0940 449 449</span>
              <span>📍 Svornosti 119, Bratislava</span>
              <span>⏰ Po–Pi 7:00–17:00</span>
            </div>
          </div>
        </div>
      )}

      {/* KROK 2 — BOOKING MODAL (AKO V GARÁŽI) */}
      {step === 2 && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-6xl shadow-2xl overflow-y-auto max-h-[95vh] p-6 md:p-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                  Nová <span className="text-red-600">Objednávka</span>
                </h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mt-1">
                  {customerData.name}{customerData.plate ? ` · ${customerData.plate}` : ''}
                </p>
              </div>
              <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white text-xl font-bold">← Späť</button>
            </div>

            <form onSubmit={handleSubmit} className="font-bold italic">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* ĽAVÁ STRANA — VÝBER ÚKONOV */}
                <div className="space-y-6">

                  {/* 1. SERVISNÉ ÚKONY */}
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1">1. Výber servisných úkonov</p>

                    {/* Kategórie */}
                    <div className="flex flex-wrap gap-2">
                      <button type="button"
                        onClick={() => setSelectedCategory('')}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border not-italic ${selectedCategory === '' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                        Všetky
                      </button>
                      {categories.map(cat => (
                        <button key={cat.id} type="button"
                          onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border not-italic ${selectedCategory === cat.id ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    {/* Vyhľadávanie */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Hľadať úkon... (napr. brzdy, olej, klima)"
                        value={normSearch}
                        onChange={e => setNormSearch(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 p-4 pl-5 pr-10 rounded-2xl text-white text-xs font-black outline-none transition-all not-italic normal-case placeholder:font-bold placeholder:normal-case placeholder:not-italic placeholder:text-zinc-600"
                      />
                      {normSearch
                        ? <button type="button" onClick={() => setNormSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-sm">✕</button>
                        : <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 text-sm">🔍</span>}
                    </div>

                    {/* Výsledky hľadania */}
                    {(selectedCategory || normSearch.trim().length >= 2) && (() => {
                      const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
                      const hits = norms.filter(n =>
                        (!selectedCategory || n.category_id === selectedCategory) &&
                        (!normSearch.trim() || nd(n.service_name).includes(nd(normSearch))) &&
                        !selectedNorms.find(s => s.id === n.id)
                      ).slice(0, 15);
                      return hits.length === 0
                        ? <p className="text-center text-zinc-700 text-[10px] italic py-3">Žiadny úkon nenájdený</p>
                        : (
                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {hits.map(norm => (
                              <button key={norm.id} type="button" onClick={() => addNorm(norm)}
                                className="w-full flex items-center justify-between gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-600/40 px-4 py-3 rounded-xl transition-all text-left">
                                <div className="flex items-center gap-3 min-w-0">
                                  {!selectedCategory && (
                                    <span className="text-[8px] font-black uppercase text-white bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shrink-0 not-italic">
                                      {catMap[norm.category_id] || ''}
                                    </span>
                                  )}
                                  <span className="text-xs font-black uppercase italic text-white break-words min-w-0">{norm.service_name}</span>
                                </div>
                                <span className="text-[10px] text-white shrink-0 not-italic font-bold">~{norm.duration_minutes} min</span>
                              </button>
                            ))}
                          </div>
                        );
                    })()}

                    {/* Košík vybratých úkonov */}
                    <div className="space-y-2">
                      <p className="text-[9px] text-white uppercase font-black ml-1">Vybrané úkony:</p>
                      {selectedNorms.length === 0 ? (
                        <div className="py-5 text-center text-zinc-700 uppercase italic text-[10px] border border-dashed border-zinc-800 rounded-2xl">Zoznam je prázdny</div>
                      ) : selectedNorms.map(sn => (
                        <div key={sn.id} className="flex justify-between items-center bg-blue-600/10 border border-blue-600/30 p-3 rounded-xl">
                          <span className="text-xs font-black uppercase italic text-white break-words min-w-0 mr-3">{sn.service_name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-black text-white not-italic">~{sn.duration_minutes} min</span>
                            <button type="button" onClick={() => setSelectedNorms(p => p.filter(n => n.id !== sn.id))} className="text-red-500 hover:text-white font-bold not-italic">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. VLASTNÉ ÚKONY */}
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest ml-1">2. Vlastné úkony / Iné závady</p>

                    {customItems.length > 0 && (
                      <div className="space-y-2">
                        {customItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-zinc-800/60 border border-zinc-700 p-3 rounded-xl">
                            <div>
                              <span className="text-xs font-black uppercase italic text-white">{item.description}</span>
                              <span className="text-[9px] text-white ml-2 not-italic font-bold">
                                {item.duration === 'technik' ? '— čas na technikovi' : item.duration >= 60 ? `~${item.duration / 60} hod` : `~${item.duration} min`}
                              </span>
                            </div>
                            <button type="button" onClick={() => setCustomItems(p => p.filter(i => i.id !== item.id))} className="text-red-500 hover:text-white font-bold ml-3 not-italic">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Popíšte závadu alebo úkon..."
                      value={currentCustomIssue}
                      onChange={e => setCurrentCustomIssue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white text-xs outline-none focus:border-red-600 uppercase italic placeholder:normal-case placeholder:not-italic"
                    />

                    <div>
                      <p className="text-[8px] font-black text-white uppercase tracking-widest mb-2 ml-1">Odhadovaný čas</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Na technika', value: 'technik' },
                          { label: '30 min', value: 30 },
                          { label: '1 hod', value: 60 },
                          { label: '2 hod', value: 120 },
                          { label: '3 hod', value: 180 },
                          { label: '4+ hod', value: 240 },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setCurrentItemDuration(opt.value)}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border not-italic ${currentItemDuration === opt.value ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="button" onClick={addCustomItem} disabled={!currentCustomIssue.trim()}
                      className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-700 text-white hover:border-red-600 transition-all disabled:opacity-30 not-italic">
                      + Pridať úkon
                    </button>
                  </div>
                </div>

                {/* PRAVÁ STRANA — KALENDÁR + ČAS */}
                <div className="space-y-6 bg-black/20 p-6 rounded-[2.5rem] border border-zinc-800/50 flex flex-col font-bold italic uppercase">

                  {/* Legenda */}
                  <div className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-green-600/40 border border-green-600/50 inline-block"/> Voľné</span>
                    <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600/40 border border-amber-600/50 inline-block"/> Čiastočne</span>
                    <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-red-600/40 border border-red-600/50 inline-block"/> Takmer plné</span>
                    <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 border border-zinc-700 inline-block"/> Plné / Víkend</span>
                  </div>

                  <p className="text-[9px] text-red-600 uppercase ml-1 font-black tracking-widest">Vyber deň príchodu</p>

                  {/* Navigácia mesiaca */}
                  <div className="flex justify-between items-center">
                    <button type="button" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-700 transition-all">←</button>
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">
                      {calendarMonth.toLocaleString('sk-SK', { month: 'long', year: 'numeric' }).toUpperCase()}
                    </span>
                    <button type="button" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-700 transition-all">→</button>
                  </div>

                  {/* Hlavičky dní */}
                  <div className="grid grid-cols-7 gap-1 -mb-2">
                    {['Po','Ut','St','Št','Pi','So','Ne'].map(d => (
                      <div key={d} className="text-center text-[8px] text-white font-black">{d}</div>
                    ))}
                  </div>

                  {/* Dni mesiaca */}
                  <div className="grid grid-cols-7 gap-1">
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
                          <button key={d} type="button" disabled={isDisabled}
                            onClick={() => { setSelectedDay(dateStr); setSelectedSlot(''); fetchDayEvents(dateStr); }}
                            className={`rounded-lg flex flex-col items-center justify-center py-1.5 transition-all ${cls}`}>
                            <span className="text-[10px] font-black">{d}</span>
                            {avail && !isPast && !isWeekend && avail.total > 0 && (
                              <span className="text-[7px] opacity-60 font-bold not-italic normal-case">{avail.free}/{avail.total}</span>
                            )}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Po výbere dňa — hodinový prehľad + výber času */}
                  {selectedDay && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <p className="text-[9px] text-white uppercase ml-1 font-black tracking-widest">
                        {new Date(selectedDay + 'T12:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                      </p>

                      {/* Hodinový prehľad */}
                      <div className="bg-black/40 rounded-2xl border border-zinc-800 p-4 space-y-1.5">
                        <p className="text-[8px] font-black text-white uppercase tracking-widest mb-3">Obsadenosť počas dňa</p>
                        {(() => {
                          const startH = parseInt(workHours.start);
                          const endH = parseInt(workHours.end);
                          const total = Object.values(roleCapacity).reduce((a, b) => a + b, 0) || 1;
                          return Array.from({ length: endH - startH }, (_, i) => {
                            const hh = startH + i;
                            const slotStart = new Date(`${selectedDay}T${String(hh).padStart(2,'0')}:00:00`);
                            const slotEnd = new Date(`${selectedDay}T${String(hh+1).padStart(2,'0')}:00:00`);
                            const busy = new Set();
                            dayEvents.forEach(ev => {
                              const s = new Date(ev.start_datetime), e = new Date(ev.end_datetime);
                              if (ev.employee_id && s < slotEnd && e > slotStart) busy.add(ev.employee_id);
                            });
                            const pct = total > 0 ? busy.size / total : 0;
                            const free = total - busy.size;
                            const barColor = pct === 0 ? 'bg-green-600/50' : pct < 0.5 ? 'bg-green-600/30' : pct < 1 ? 'bg-amber-500/50' : 'bg-red-600/40';
                            return (
                              <div key={hh} className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-white w-9 shrink-0 not-italic">{String(hh).padStart(2,'0')}:00</span>
                                <div className="flex-grow h-3 bg-zinc-900 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(5, pct * 100)}%` }} />
                                </div>
                                <span className={`text-[8px] font-black w-10 text-right shrink-0 not-italic ${pct === 1 ? 'text-red-500' : 'text-white'}`}>
                                  {pct === 1 ? 'PLNÉ' : `${free}/${total}`}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Výber času */}
                      <div>
                        <p className="text-[9px] text-white uppercase ml-1 font-black tracking-widest mb-2">Čas príchodu</p>
                        <div className="grid grid-cols-4 gap-2">
                          {timeSlots.map(slot => (
                            <button key={slot} type="button" onClick={() => { setSelectedSlot(slot); setLetTechDecideTime(false); }}
                              className={`py-2.5 rounded-xl text-[10px] font-black transition-all border ${selectedSlot === slot && !letTechDecideTime ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => { setLetTechDecideTime(true); setSelectedSlot(''); }}
                          className={`w-full mt-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all not-italic ${letTechDecideTime ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900/60 border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}>
                          🔧 {letTechDecideTime ? '✓ Čas určí prijímací technik' : 'Čas nech určí prijímací technik'}
                        </button>
                        {letTechDecideTime && (
                          <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest text-center mt-1.5 not-italic">Zavoláme vám a dohodneme presný čas</p>
                        )}
                      </div>

                      {/* Poznámka */}
                      <div>
                        <p className="text-[9px] text-white uppercase ml-1 font-black tracking-widest mb-2">Poznámka (nepovinné)</p>
                        <textarea
                          value={customerNote}
                          onChange={e => setCustomerNote(e.target.value)}
                          placeholder="Napr. preferovaný čas, špeciálne požiadavky..."
                          rows={3}
                          className="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-500 rounded-2xl px-4 py-3 text-white text-xs font-bold outline-none resize-none not-italic normal-case placeholder:text-zinc-600 placeholder:font-bold placeholder:normal-case placeholder:not-italic"
                        />
                      </div>
                    </div>
                  )}

                  {/* Odoslať */}
                  <button
                    type="submit"
                    disabled={submitting || !selectedDay || (!selectedSlot && !letTechDecideTime)}
                    className="mt-auto w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl transition-all disabled:opacity-30 not-italic shadow-[0_10px_30px_rgba(220,38,38,0.2)]"
                  >
                    {submitting ? 'Odosielam...' : '✓ Odoslať žiadosť o termín'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
