'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GarazPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const router = useRouter();

  // --- STAVY PRE NOTIFIKÁCIE (NOVÉ EXTRA OKNO) ---
  const [notifications, setNotifications] = useState([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // --- STAVY PRE FAKTÚRY (DOPLNENÉ) ---
  const [vehicleInvoices, setVehicleInvoices] = useState([]);
  const [isInvoiceListOpen, setIsInvoiceListOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [activePlate, setActivePlate] = useState('');

  // --- STAVY PRE OBJEDNÁVKU SERVISU ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderingVehicle, setOrderingVehicle] = useState(null);
  const [issues, setIssues] = useState(['']); // Pole pre viacero závad
  const [preferredDate, setPreferredDate] = useState(''); // Preferovaný termín zákazníka
  const [orderLoading, setOrderLoading] = useState(false);
  const [bookingType, setBookingType] = useState('manual'); // NOVÉ: 'manual' alebo 'auto'

  // POMOCNÉ STAVY PRE NOVÝ VÝBER TERMÍNU
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
  ];

  // --- STAVY PRE EDITÁCIU VOZIDLA (ZACHOVANÉ) ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editForm, setEditForm] = useState({
    brand_model: '',
    license_plate: '',
    vin_number: '',
    year_produced: '',
    engine_volume: '',
    engine_power: '',
    fuel_type: 'Diesel',
    mileage: ''
  });

  // --- STAVY PRE EDITÁCIU PROFILU (ZACHOVANÉ) ---
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    email: '', 
    address: '',
    city: '',
    zip: '',
    company_name: '',
    ico: '',
    dic: '',
    ic_dph: '',
    country: 'Slovensko'
  });

  // POMOCNÁ FUNKCIA: Získa zajtrajší dátum vo formáte YYYY-MM-DD
  const getTomorrowDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  useEffect(() => {
    let channel;

    const checkUserAndData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        // 1. Načítanie notifikácií
        fetchNotifications(user.id);
        
        // 2. Real-time odber nových správ - OPRAVENÉ NA UNIVERZÁLNY KANÁL
        channel = supabase
          .channel(`room-${Math.random()}`) // Unikátny názov pre každý render zabráni chybe
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${user.id}` 
          }, () => {
            fetchNotifications(user.id);
          })
          .subscribe();

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
          setProfileForm({
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            email: profile.email || user.email || '',
            address: profile.address || '',
            city: profile.city || '',
            zip: profile.zip || '',
            company_name: profile.company_name || '',
            ico: profile.ico || '',
            dic: profile.dic || '',
            ic_dph: profile.ic_dph || '',
            country: profile.country || 'Slovensko'
          });

          const { data: vehicleData, error: vehError } = await supabase
            .from('vehicles')
            .select('*')
            .or(`owner_id.eq.${user.id},owner_email.eq.${user.email}`);
          
          if (vehError) throw vehError;
          setVehicles(vehicleData || []);
        }
      } catch (err) {
        console.error("Chyba pri načítaní:", err);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndData();

    // CLEANUP
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // --- LOGIKA NOTIFIKÁCIÍ (EXTRA MODAL) ---
  const fetchNotifications = async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const markAsRead = async () => {
    if (unreadCount === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    fetchNotifications(user.id);
  };

  const handleNotificationClick = (n) => {
    if (n.link) {
      router.push(n.link);
      setIsInboxOpen(false);
    }
  };

  // --- LOGIKA FAKTÚR (DOPLNENÉ) ---
  const openInvoiceModal = async (plate) => {
    setActivePlate(plate);
    setIsInvoiceListOpen(true);
    setInvoiceLoading(true);
    try {
      // Hľadáme faktúry podľa plate_number v tabuľke invoices
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .ilike('car_details->>plate', plate) // Ak je plate v JSONB stĺpci car_details
        .order('created_at', { ascending: false });
      
      // Fallback ak nemáš plate v JSON ale ako samostatný stĺpec
      if (error || (data && data.length === 0)) {
         const { data: fallbackData } = await supabase
          .from('invoices')
          .select('*')
          .eq('plate_number', plate)
          .order('created_at', { ascending: false });
          setVehicleInvoices(fallbackData || []);
      } else {
        setVehicleInvoices(data || []);
      }
    } catch (err) {
      console.error("Chyba faktúr:", err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // --- LOGIKA OBJEDNÁVKY SERVISU ---
  const openOrderModal = (vehicle) => {
    setOrderingVehicle(vehicle);
    setIssues(['']); 
    setPreferredDate('');
    setSelectedDay('');
    setSelectedSlot('');
    setBookingType('manual');
    setIsOrderModalOpen(true);
  };

  const addIssueField = () => setIssues([...issues, '']);
  const updateIssue = (index, value) => {
    const newIssues = [...issues];
    newIssues[index] = value;
    setIssues(newIssues);
  };
  const removeIssue = (index) => setIssues(issues.filter((_, i) => i !== index));

  const handleFinalizeOrder = async (e) => {
    e.preventDefault();
    const filteredIssues = issues.filter(i => i.trim() !== '');
    if (filteredIssues.length === 0) {
      alert("Napíšte prosím aspoň jednu závadu.");
      return;
    }
    
    // Kontrola: Ak je manuálne, musí byť čas. Deň musí byť vždy.
    if (!selectedDay) {
      alert("Prosím vyberte si deň príchodu.");
      return;
    }
    if (bookingType === 'manual' && !selectedSlot) {
      alert("Prosím vyberte si konkrétny čas príchodu.");
      return;
    }

    setOrderLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fullDescription = filteredIssues.map((text, idx) => `${idx + 1}. ${text}`).join('\n');
      
      // Ak je 'auto', nastavíme čas na 07:00 ráno
      const finalDateTime = bookingType === 'manual' 
        ? `${selectedDay}T${selectedSlot}:00` 
        : `${selectedDay}T07:00:00`;

      const startTime = new Date(finalDateTime);
      const endTime = new Date(startTime.getTime() + 60 * 60000); 

      const { error } = await supabase
        .from('calendar_events')
        .insert([{
          title: bookingType === 'manual' ? `OBJEDNÁVKA: ${orderingVehicle.license_plate}` : `FLEXI: ${orderingVehicle.license_plate}`,
          description: `Zákazník žiada o termín cez Klientsku zónu.`,
          issue_description: fullDescription,
          planned_work: "Bude určené technikom",
          customer_note: bookingType === 'auto' 
            ? `[FLEXIBILNÝ TERMÍN] Zákazník si vybral deň ${new Date(selectedDay).toLocaleDateString('sk-SK')}, ale čas príchodu necháva na Vás.`
            : `Zákazník si vybral presný čas: ${startTime.toLocaleString('sk-SK')}`,
          start_datetime: startTime.toISOString(), 
          end_datetime: endTime.toISOString(),
          plate_number: orderingVehicle.license_plate,
          customer_name: userProfile?.full_name || 'Zákazník z garáže',
          customer_phone: userProfile?.phone || null,
          customer_email: userProfile?.email || user.email,
          is_confirmed: false,
          status: 'Čaká na schválenie',
          user_id: user.id,
          vehicle_id: orderingVehicle.id
        }]);

      if (error) throw error;
      alert(`Vaša požiadavka bola úspešne odoslaná! Prijímací technik vás bude kontaktovať.`);
      setIsOrderModalOpen(false);
    } catch (err) {
      alert("Chyba pri odosielaní: " + err.message);
    } finally {
      setOrderLoading(false);
    }
  };

  // --- LOGIKA PROFILU (ZACHOVANÉ) ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('user_profiles').update(profileForm).eq('id', userProfile.id);
      if (error) throw error;
      setIsProfileModalOpen(false);
    } catch (err) { alert("Chyba: " + err.message); }
  };

  // --- LOGIKA VOZIDIEL (ZACHOVANÉ) ---
  const openEditModal = (vehicle) => {
    setOrderingVehicle(vehicle);
    setEditForm({
      brand_model: vehicle.brand_model || '', license_plate: vehicle.license_plate || '',
      vin_number: vehicle.vin_number || '', year_produced: vehicle.year_produced || '',
      engine_volume: vehicle.engine_volume || '', engine_power: vehicle.engine_power || '',
      fuel_type: vehicle.fuel_type || 'Diesel', mileage: vehicle.mileage || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('vehicles').update({
          brand_model: editForm.brand_model, license_plate: editForm.license_plate.toUpperCase().trim(),
          vin_number: editForm.vin_number.toUpperCase().trim(), year_produced: editForm.year_produced,
          engine_volume: editForm.engine_volume, engine_power: editForm.engine_power,
          fuel_type: editForm.fuel_type, mileage: editForm.mileage
      }).eq('id', editingVehicle.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      window.location.reload(); 
    } catch (err) { alert("Chyba pri aktualizácii vozidla: " + err.message); }
  };

  const handleDelete = async (id, plate) => {
    if (confirm(`Naozaj chcete odstrániť vozidlo ${plate} zo svojej garáže?`)) {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (!error) setVehicles(vehicles.filter(v => v.id !== id));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-bold">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-zinc-500 uppercase font-black text-[10px] tracking-widest italic">Otváram vašu garáž...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans font-bold relative overflow-x-hidden">
      
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>

      <div className="max-w-5xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-zinc-800 pb-8 gap-4 font-bold relative">
          <div className="flex items-center gap-6">
            <div className="relative">
              <button 
                onClick={() => { setIsInboxOpen(true); markAsRead(); }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${unreadCount > 0 ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'}`}
              >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-red-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-black">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div>
              <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] mb-2 font-bold italic">Moja Klientska Zóna</p>
              <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none flex items-center gap-4 font-bold">
                {userProfile?.full_name || 'Môj Profil'}
                <button onClick={() => setIsProfileModalOpen(true)} className="text-[10px] bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl hover:bg-white hover:text-black transition-all not-italic tracking-normal font-black uppercase font-bold">
                  ⚙️ Upraviť údaje
                </button>
              </h1>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all font-bold">
            Odhlásiť sa
          </button>
        </header>

        {/* --- ZOZNAM VOZIDIEL --- */}
        <div className="flex flex-col gap-8 font-bold">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] relative group hover:border-zinc-700 transition-all shadow-xl font-bold w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 font-bold">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="bg-white text-black px-6 py-3 rounded-2xl font-black text-3xl tracking-tighter shadow-xl font-bold">{vehicle.license_plate}</div>
                  <div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tight mb-1 font-bold">{vehicle.brand_model}</h2>
                    <p className="text-zinc-500 text-[12px] font-black uppercase tracking-widest font-bold">VIN: {vehicle.vin_number || 'Neuvedené'}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEditModal(vehicle)} className="p-4 bg-zinc-800 rounded-2xl hover:bg-white hover:text-black transition-all text-sm font-bold">Upraviť ✏️</button>
                  <button onClick={() => handleDelete(vehicle.id, vehicle.license_plate)} className="p-4 bg-zinc-800 rounded-2xl hover:bg-red-600 transition-all text-sm font-bold font-bold">Vymazať 🗑️</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-t border-zinc-800/50 pt-8">
                  <div className="bg-black/20 p-4 rounded-3xl">
                    <p className="text-zinc-600 text-[9px] uppercase font-black mb-1">Motorizácia</p>
                    <p className="text-sm font-black">{vehicle.engine_volume || '---'} ccm / {vehicle.engine_power || '---'} kW</p>
                  </div>
                  <div className="bg-black/20 p-4 rounded-3xl">
                    <p className="text-zinc-600 text-[9px] uppercase font-black mb-1">Palivo & Rok</p>
                    <p className="text-sm font-black">{vehicle.fuel_type} • {vehicle.year_produced || '---'}</p>
                  </div>
                  <div className="bg-blue-600/5 p-4 rounded-3xl border border-blue-600/10">
                    <p className="text-blue-500/60 text-[9px] uppercase font-black mb-1">Stav Tachometra</p>
                    <p className="text-xl font-black text-blue-400">{vehicle.mileage || 0} KM</p>
                  </div>
                  <div className="bg-zinc-800/30 p-4 rounded-3xl flex flex-col justify-center items-center">
                    <button onClick={() => openInvoiceModal(vehicle.license_plate)} className="text-red-600 hover:text-red-500 transition-all">
                      <p className="text-[14px] font-black uppercase italic tracking-tighter">Moje Faktúry 💰</p>
                    </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold font-bold">
                <button onClick={() => router.push(`/garaz/historia/${vehicle.license_plate}`)} className="bg-zinc-800 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all font-bold">📜 Zobraziť kompletnú históriu</button>
                <button onClick={() => openOrderModal(vehicle)} className="bg-red-600 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl font-bold">
                  🔧 Objednať sa na servis
                </button>
              </div>
            </div>
          ))}

          <button onClick={() => router.push('/garaz/pridat')} className="border-2 border-dashed border-zinc-800 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-4 hover:border-red-600/50 transition-all group min-h-[150px] font-bold">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-3xl group-hover:bg-red-600 transition-all font-bold">+</div>
            <span className="text-[13px] font-black uppercase tracking-[0.3em] text-zinc-600 group-hover:text-white font-bold">Pradať ďalšie vozidlo do mojej garáže</span>
          </button>
        </div>
      </div>

      {/* --- EXTRA OKNO PRE NOTIFIKÁCIE (ZVONČEK MODAL) --- */}
      {isInboxOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-black/20">
              <div>
                <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">Centrum <span className="text-red-600">Upozornení</span></h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Správy a dôležité informácie zo servisu</p>
              </div>
              <button onClick={() => setIsInboxOpen(false)} className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all font-bold">✕</button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/10">
              {notifications.length === 0 ? (
                <div className="py-20 text-center text-[11px] uppercase text-zinc-700 italic tracking-widest">Zatiaľ nemáte žiadne nové správy</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer group ${n.is_read ? 'bg-zinc-900/20 border-zinc-900 opacity-60' : 'bg-zinc-900 border-zinc-800 shadow-xl hover:border-blue-600'}`}
                  >
                    <div className="flex justify-between items-start mb-2 font-bold">
                      <h4 className={`text-sm font-black uppercase italic ${n.link ? 'text-blue-500' : 'text-red-500'}`}>
                        {n.title} {!n.is_read && "•"}
                      </h4>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">{new Date(n.created_at).toLocaleDateString('sk-SK')}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-bold uppercase">{n.content}</p>
                    {/* ODSTRÁNENÉ BLIKAJÚCE "Zobraziť podrobnosti" */}
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-zinc-800 text-center">
                <button onClick={() => setIsInboxOpen(false)} className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-widest italic">Zatvoriť okno</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZOZNAMU FAKTÚR */}
      {isInvoiceListOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-4 font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-8 font-bold">
               <h2 className="text-3xl font-black uppercase italic tracking-tighter">Faktúry k vozidlu <span className="text-red-600">{activePlate}</span></h2>
               <button onClick={() => setIsInvoiceListOpen(false)} className="text-zinc-500 hover:text-white text-2xl font-bold">✕</button>
            </div>
            {invoiceLoading ? (
               <div className="py-20 text-center animate-pulse text-zinc-500 uppercase tracking-widest text-xs font-bold italic">Sťahujem dáta faktúr...</div>
            ) : vehicleInvoices.length === 0 ? (
               <div className="py-20 text-center text-zinc-600 uppercase text-xs italic border-2 border-dashed border-zinc-800 rounded-[2rem]">Zatiaľ neboli k tomuto vozidlu vystavené žiadne faktúry.</div>
            ) : (
               <div className="space-y-4 font-bold uppercase">
                  {vehicleInvoices.map(inv => (
                    <div key={inv.id} className="bg-black/40 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center group hover:border-red-600/30 transition-all font-bold italic">
                       <div>
                         <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Číslo dokladu</p>
                         <p className="text-lg font-black uppercase tracking-tight font-bold italic">{inv.invoice_number}</p>
                         <p className="text-[10px] text-zinc-600 mt-1 font-bold italic">{new Date(inv.created_at).toLocaleDateString('sk-SK')}</p>
                       </div>
                       <div className="text-right flex items-center gap-6 font-bold italic">
                         <div>
                           <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 font-bold italic">Suma s DPH</p>
                           <p className="text-2xl font-black text-white italic font-bold">{inv.total_amount?.toFixed(2)} €</p>
                         </div>
                         <button onClick={() => router.push(`/garaz/faktura/${inv.id}`)} className="bg-white text-black p-4 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-lg font-bold italic">👁️</button>
                       </div>
                    </div>
                  ))}
               </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL OBJEDNÁVKY SERVISU */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-10 rounded-[3rem] w-full max-w-6xl shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white font-bold">Nová <span className="text-red-600">Objednávka</span></h2>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-zinc-500 hover:text-white text-2xl font-bold">✕</button>
            </div>
            <form onSubmit={handleFinalizeOrder} className="font-bold italic">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 bg-black/40 p-5 rounded-2xl border border-zinc-800 font-bold uppercase italic">
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">Zákazník</p>
                      <p className="text-xs font-black uppercase font-bold">{userProfile?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 font-bold italic">Vozidlo</p>
                      <p className="text-xs font-black uppercase text-red-600 font-bold italic">{orderingVehicle?.brand_model}</p>
                      <p className="text-[10px] font-black uppercase font-bold italic">{orderingVehicle?.license_plate}</p>
                    </div>
                  </div>
                  <div className="space-y-4 font-bold uppercase italic">
                    <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 block tracking-widest font-bold italic">Zoznam závad / Potrebné úkony</label>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar font-bold italic">
                      {issues.map((issue, index) => (
                        <div key={index} className="flex gap-2">
                          <input required className="flex-grow bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 font-bold text-xs font-bold italic uppercase" 
                            placeholder={`Závada č. ${index + 1}...`} value={issue} onChange={(e) => updateIssue(index, e.target.value)} />
                          {issues.length > 1 && (<button type="button" onClick={() => removeIssue(index)} className="px-4 bg-zinc-800 rounded-xl text-zinc-500 hover:text-red-600 transition-all font-bold italic font-bold">✕</button>)}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addIssueField} className="w-full py-3 border-2 border-dashed border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:border-blue-600 hover:text-blue-500 transition-all font-bold tracking-widest font-bold italic">+ Pridať ďalšiu závadu</button>
                  </div>
                </div>
                <div className="space-y-6 bg-black/20 p-6 rounded-[2.5rem] border border-zinc-800/50 flex flex-col justify-between font-bold italic uppercase">
                  <div className="space-y-6 font-bold italic uppercase">
                    <div className="flex bg-black p-1 rounded-2xl border border-zinc-800 font-bold italic uppercase">
                      <button type="button" onClick={() => setBookingType('manual')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'manual' ? 'bg-blue-600 text-white shadow-lg font-bold italic uppercase' : 'text-zinc-500 hover:text-white font-bold italic uppercase'}`}>Presný čas</button>
                      <button type="button" onClick={() => setBookingType('auto')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'auto' ? 'bg-zinc-800 text-white shadow-lg font-bold italic uppercase' : 'text-zinc-500 hover:text-white font-bold italic uppercase'}`}>Navrhnite mi termín</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold italic uppercase">
                      <div className="space-y-2 font-bold italic uppercase">
                        <p className="text-[9px] text-zinc-500 uppercase ml-2 font-black tracking-widest font-bold italic uppercase">1. Deň</p>
                        <input required type="date" min={getTomorrowDate()} className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 font-bold text-xs text-white uppercase font-bold italic uppercase" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
                      </div>
                      <div className={`space-y-2 transition-all ${bookingType === 'auto' ? 'opacity-30 pointer-events-none' : ''}`}>
                        <p className="text-[9px] text-zinc-500 uppercase ml-2 font-black tracking-widest font-bold italic uppercase">2. Čas príchodu</p>
                        <div className="grid grid-cols-3 gap-2 p-2 bg-black/30 rounded-xl border border-zinc-800 max-h-[120px] overflow-y-auto custom-scrollbar font-bold italic uppercase">
                          {timeSlots.map((slot) => (
                            <button key={slot} type="button" onClick={() => setSelectedSlot(slot)} className={`py-2 rounded-lg text-[9px] font-black transition-all border ${selectedSlot === slot ? 'bg-blue-600 border-blue-600 text-white font-bold italic uppercase' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 font-bold italic uppercase'}`}>{slot}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={orderLoading} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase text-xs hover:bg-red-700 shadow-[0_10px_20px_rgba(220,38,38,0.3)] transition-all tracking-[0.2em] font-bold italic uppercase">
                    {orderLoading ? 'Odosielam...' : 'Odoslať požiadavku'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROFILU */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold uppercase italic">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-3xl shadow-2xl my-auto font-bold uppercase italic">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600 font-bold uppercase italic">Moje klientske údaje</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6 font-bold italic uppercase italic">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold uppercase italic">
                <div className="space-y-4 font-bold uppercase italic">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 font-bold uppercase italic tracking-widest">Meno a kontakt</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} placeholder="Meno a Priezvisko" />
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} placeholder="Telefón" />
                  <input disabled className="w-full bg-zinc-800/30 border border-zinc-800 p-4 rounded-2xl font-bold text-zinc-500 outline-none uppercase italic" value={profileForm.email} placeholder="Email" />
                </div>
                <div className="space-y-4 font-bold uppercase italic">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 font-bold uppercase italic tracking-widest">Adresa</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} placeholder="Ulica a č." />
                  <div className="grid grid-cols-2 gap-2 font-bold uppercase italic">
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={profileForm.city} onChange={(e) => setProfileForm({...profileForm, city: e.target.value})} placeholder="Mesto" />
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={profileForm.zip} onChange={(e) => setProfileForm({...profileForm, zip: e.target.value})} placeholder="PSČ" />
                  </div>
                </div>
              </div>
              <div className="border-t border-zinc-800 pt-8 space-y-4 font-bold uppercase italic tracking-widest">
                <label className="text-[10px] font-black text-blue-500 uppercase ml-2 font-bold uppercase italic">Fakturačné údaje firmy</label>
                <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold uppercase italic" value={profileForm.company_name} onChange={(e) => setProfileForm({...profileForm, company_name: e.target.value})} placeholder="Obchodné meno spoločnosti" />
                <div className="grid grid-cols-3 gap-2 font-bold uppercase italic">
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold uppercase italic" value={profileForm.ico} onChange={(e) => setProfileForm({...profileForm, ico: e.target.value})} placeholder="IČO" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold uppercase italic" value={profileForm.dic} onChange={(e) => setProfileForm({...profileForm, dic: e.target.value})} placeholder="DIČ" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold uppercase italic" value={profileForm.ic_dph} onChange={(e) => setProfileForm({...profileForm, ic_dph: e.target.value})} placeholder="IČ DPH" />
                </div>
              </div>
              <div className="flex gap-6 pt-6 font-bold uppercase italic">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs font-bold uppercase italic tracking-widest">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all shadow-xl font-bold uppercase italic tracking-widest">Uložiť</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOZIDLA (ZACHOVANÉ) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold uppercase italic">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-auto font-bold uppercase italic">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600 font-bold uppercase italic">Úprava údajov vozidla</h2>
            <form onSubmit={handleUpdateVehicle} className="space-y-6 font-bold italic uppercase italic">
              <div className="font-bold uppercase italic">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Značka a Model</label>
                <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold uppercase italic" value={editForm.brand_model} onChange={(e) => setEditForm({...editForm, brand_model: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4 font-bold uppercase italic">
                <div className="font-bold uppercase italic">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">ŠPZ</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold uppercase tracking-widest font-bold uppercase italic" value={editForm.license_plate} onChange={(e) => setEditForm({...editForm, license_plate: e.target.value})} />
                </div>
                <div className="font-bold uppercase italic">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Rok výroby</label>
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold uppercase italic" value={editForm.year_produced} onChange={(e) => setEditForm({...editForm, year_produced: e.target.value})} />
                </div>
              </div>
              <div className="font-bold uppercase italic">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">VIN číslo</label>
                <input required maxLength={17} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-mono text-sm uppercase font-bold uppercase italic" value={editForm.vin_number} onChange={(e) => setEditForm({...editForm, vin_number: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4 font-bold uppercase italic">
                <div className="font-bold uppercase italic">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Objem (cm³)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={editForm.engine_volume} onChange={(e) => setEditForm({...editForm, engine_volume: e.target.value})} />
                </div>
                <div className="font-bold uppercase italic">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Výkon (kW)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={editForm.engine_power} onChange={(e) => setEditForm({...editForm, engine_power: e.target.value})} />
                </div>
                <div className="font-bold uppercase italic">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Palivo</label>
                  <select className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 appearance-none font-bold uppercase italic" value={editForm.fuel_type} onChange={(e) => setEditForm({...editForm, fuel_type: e.target.value})}>
                    <option value="Diesel">Diesel</option><option value="Benzín">Benzín</option><option value="Hybrid">Hybrid</option><option value="Elektro">Elektro</option><option value="LPG/CNG">LPG/CNG</option>
                  </select>
                </div>
              </div>
              <div className="font-bold uppercase italic">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase italic">Tachometer (km)</label>
                <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold uppercase italic" value={editForm.mileage} onChange={(e) => setEditForm({...editForm, mileage: e.target.value})} />
              </div>
              <div className="flex gap-6 pt-6 font-bold uppercase italic">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs font-bold uppercase italic tracking-widest">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-700 shadow-xl font-bold uppercase italic tracking-widest">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}