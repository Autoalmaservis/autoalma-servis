'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GarazPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const router = useRouter();

  // --- STAVY PRE NOTIFIKÁCIE (NOVÉ) ---
  const [notifications, setNotifications] = useState([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // --- STAVY PRE OBJEDNÁVKU SERVISU ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderingVehicle, setOrderingVehicle] = useState(null);
  const [issues, setIssues] = useState(['']); // Pole pre viacero závad
  const [preferredDate, setPreferredDate] = useState(''); // Preferovaný termín zákazníka
  const [orderLoading, setOrderLoading] = useState(false);

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

  useEffect(() => {
    checkUserAndData();
  }, []);

  const checkUserAndData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Načítanie notifikácií
      fetchNotifications(user.id);
      
      // Real-time odber nových správ
      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        }, () => fetchNotifications(user.id))
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
      return () => supabase.removeChannel(channel);
    } catch (err) {
      console.error("Chyba pri načítaní:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIKA NOTIFIKÁCIÍ (NOVÉ) ---
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

  // --- LOGIKA OBJEDNÁVKY SERVISU ---
  const openOrderModal = (vehicle) => {
    setOrderingVehicle(vehicle);
    setIssues(['']); 
    setPreferredDate('');
    setSelectedDay('');
    setSelectedSlot('');
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
    
    if (!selectedDay || !selectedSlot) {
      alert("Prosím vyberte si deň aj čas príchodu.");
      return;
    }

    setOrderLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fullDescription = filteredIssues.map((text, idx) => `${idx + 1}. ${text}`).join('\n');
      let estimatedMinutes = 60; 

      const finalDateTime = `${selectedDay}T${selectedSlot}:00`;
      const startTime = new Date(finalDateTime);
      const endTime = new Date(startTime.getTime() + estimatedMinutes * 60000);

      const { error } = await supabase
        .from('calendar_events')
        .insert([{
          title: `OBJEDNÁVKA: ${orderingVehicle.brand_model}`,
          description: `Zákazník žiada o termín cez Klientsku zónu.`,
          issue_description: fullDescription,
          planned_work: "Bude určené technikom",
          customer_note: `Zákazník preferuje termín: ${startTime.toLocaleString('sk-SK')}`,
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
      checkUserAndData();
    } catch (err) { alert("Chyba: " + err.message); }
  };

  // --- LOGIKA VOZIDIEL (ZACHOVANÉ) ---
  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
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
      checkUserAndData();
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
      
      {/* TENTO STÝL ZABEZPEČÍ BIELU IKONU KALENDÁRA A SCROLLBAR */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>

      <div className="max-w-5xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-zinc-800 pb-8 gap-4 font-bold relative">
          <div className="flex items-center gap-6">
            {/* ZVONČEK - NOTIFIKÁCIE */}
            <div className="relative">
              <button 
                onClick={() => { setIsInboxOpen(!isInboxOpen); markAsRead(); }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${unreadCount > 0 ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'}`}
              >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-red-600 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN NOTIFIKÁCIÍ */}
              {isInboxOpen && (
                <div className="absolute top-16 left-0 w-80 bg-zinc-950 border border-zinc-800 rounded-[2rem] shadow-2xl z-[300] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-5 border-b border-zinc-900 bg-black flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Správy zo servisu</span>
                    <button onClick={() => setIsInboxOpen(false)} className="text-zinc-600 hover:text-white">✕</button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-[10px] uppercase text-zinc-700 italic">Žiadne správy</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-4 rounded-2xl border transition-all ${n.is_read ? 'bg-zinc-900/30 border-zinc-900' : 'bg-zinc-900 border-zinc-800 shadow-lg'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-[11px] font-black uppercase text-red-500 italic">{n.title}</h4>
                            <span className="text-[8px] text-zinc-600 font-bold uppercase">{new Date(n.created_at).toLocaleDateString('sk-SK')}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] relative group hover:border-zinc-700 transition-all shadow-xl font-bold">
              <div className="flex justify-between items-start mb-6 font-bold">
                <div className="bg-white text-black px-4 py-1.5 rounded-lg font-black text-xl tracking-tighter shadow-lg font-bold">{vehicle.license_plate}</div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(vehicle)} className="p-3 bg-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(vehicle.id, vehicle.license_plate)} className="p-3 bg-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs font-bold font-bold">🗑️</button>
                </div>
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tight mb-1 font-bold">{vehicle.brand_model}</h2>
              <div className="space-y-1 mb-8">
                  <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest font-bold">VIN: {vehicle.vin_number || 'Neuvedené'}</p>
                  <p className="text-zinc-600 text-[10px] font-bold uppercase italic">
                    {vehicle.engine_volume || '---'} ccm • {vehicle.engine_power || '---'} kW • {vehicle.year_produced || '---'}
                  </p>
                  <p className="text-blue-500 text-[10px] font-black uppercase mt-2">Posledný stav: {vehicle.mileage || 0} KM</p>
              </div>
              <div className="grid grid-cols-2 gap-4 font-bold font-bold">
                <button onClick={() => router.push(`/garaz/historia/${vehicle.license_plate}`)} className="bg-zinc-800 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all font-bold">História</button>
                <button onClick={() => openOrderModal(vehicle)} className="bg-red-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-lg font-bold">
                  Objednať servis
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => router.push('/garaz/pridat')} className="border-2 border-dashed border-zinc-800 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-red-600/50 transition-all group min-h-[300px] font-bold">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-3xl group-hover:bg-red-600 transition-all font-bold">+</div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 group-hover:text-white font-bold">Pridat nové vozidlo</span>
          </button>
        </div>
      </div>

      {/* --- MODAL OBJEDNÁVKY --- */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl font-black uppercase italic mb-2 tracking-tighter">Nová <span className="text-red-600">Objednávka</span></h2>
            
            <div className="grid grid-cols-2 gap-4 bg-black/40 p-6 rounded-3xl border border-zinc-800 mb-8 mt-6 italic">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Zákazník</p>
                <p className="text-xs font-black uppercase">{userProfile?.full_name}</p>
                <p className="text-[10px] text-zinc-400">{userProfile?.phone}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Vozidlo</p>
                <p className="text-xs font-black uppercase text-red-600">{orderingVehicle?.brand_model}</p>
                <p className="text-[10px] font-black uppercase">{orderingVehicle?.license_plate}</p>
              </div>
            </div>
            
            <form onSubmit={handleFinalizeOrder} className="space-y-6 italic font-bold">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 block tracking-widest uppercase">Zoznam závad / Potrebné úkony</label>
                {issues.map((issue, index) => (
                  <div key={index} className="flex gap-2">
                    <input required className="flex-grow bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold text-xs"
                      placeholder={`Závada č. ${index + 1}...`} value={issue} onChange={(e) => updateIssue(index, e.target.value)} />
                    {issues.length > 1 && (
                      <button type="button" onClick={() => removeIssue(index)} className="px-4 bg-zinc-800 rounded-2xl text-zinc-500 hover:text-red-600 transition-all font-bold">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addIssueField} className="w-full py-3 border-2 border-dashed border-zinc-800 rounded-2xl text-[10px] font-black uppercase text-zinc-500 hover:border-blue-600 hover:text-blue-500 transition-all font-bold tracking-widest font-bold">+ Pridať ďalšiu závadu</button>
              </div>

              <div className="space-y-6 border-t border-zinc-800 pt-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-blue-500 ml-2 block tracking-widest italic font-bold">Kedy by vám vyhovoval termín?</label>
                  <button type="button" onClick={() => window.open('/kalendar-verejny', '_blank')} className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-600/40 px-3 py-1 rounded-lg uppercase font-black hover:bg-blue-600 transition-all font-bold">📅 Obsadenosť</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-bold">
                  <div className="space-y-2 font-bold">
                    <p className="text-[9px] text-zinc-500 uppercase ml-2 font-black tracking-widest font-bold">1. Vyberte deň</p>
                    <input 
                      required 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]} 
                      className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-600 font-bold text-xs text-white uppercase"
                      value={selectedDay} 
                      onChange={(e) => setSelectedDay(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-2 font-bold">
                    <p className="text-[9px] text-zinc-500 uppercase ml-2 font-black tracking-widest font-bold">2. Vyberte čas</p>
                    <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto p-2 bg-black/30 rounded-2xl border border-zinc-800 scrollbar-hide font-bold custom-scrollbar">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                            selectedSlot === slot 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedDay && selectedSlot && (
                  <div className="bg-blue-600/10 border border-blue-600/20 p-4 rounded-2xl text-center animate-pulse font-bold">
                    <p className="text-[9px] text-blue-400 uppercase font-black font-bold">Vybraný príchod</p>
                    <p className="text-sm font-black text-white italic font-bold">
                      {new Date(selectedDay).toLocaleDateString('sk-SK')} o {selectedSlot} hod.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4 font-bold">
                <button type="button" onClick={() => setIsOrderModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs font-bold tracking-widest font-bold">Zrušiť</button>
                <button type="submit" disabled={orderLoading} className="flex-[2] bg-red-600 py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-700 shadow-xl transition-all tracking-[0.2em] font-bold">
                  {orderLoading ? 'Odosielam...' : 'Odoslať požiadavku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROFILU (ZACHOVANÉ) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-3xl shadow-2xl my-auto font-bold">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600 font-bold">Moje klientske údaje</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6 font-bold italic">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold">
                <div className="space-y-4 font-bold">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 font-bold font-bold font-bold">Meno a kontakt</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} placeholder="Meno a Priezvisko" />
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} placeholder="Telefón" />
                  <input disabled className="w-full bg-zinc-800/30 border border-zinc-800 p-4 rounded-2xl font-bold text-zinc-500 outline-none" value={profileForm.email} placeholder="Email (nemožno meniť)" />
                </div>
                <div className="space-y-4 font-bold">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 font-bold font-bold font-bold font-bold">Adresa trvalého bydliska</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} placeholder="Ulica a č." />
                  <div className="grid grid-cols-2 gap-2 font-bold">
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.city} onChange={(e) => setProfileForm({...profileForm, city: e.target.value})} placeholder="Mesto" />
                    <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600" value={profileForm.zip} onChange={(e) => setProfileForm({...profileForm, zip: e.target.value})} placeholder="PSČ" />
                  </div>
                </div>
              </div>
              
              <div className="border-t border-zinc-800 pt-8 space-y-4 font-bold">
                <label className="text-[10px] font-black text-blue-500 uppercase ml-2 tracking-widest font-bold font-bold font-bold">Fakturačné údaje firmy</label>
                <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold" value={profileForm.company_name} onChange={(e) => setProfileForm({...profileForm, company_name: e.target.value})} placeholder="Obchodné meno spoločnosti" />
                <div className="grid grid-cols-3 gap-2 font-bold">
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold" value={profileForm.ico} onChange={(e) => setProfileForm({...profileForm, ico: e.target.value})} placeholder="IČO" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold" value={profileForm.dic} onChange={(e) => setProfileForm({...profileForm, dic: e.target.value})} placeholder="DIČ" />
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 font-bold" value={profileForm.ic_dph} onChange={(e) => setProfileForm({...profileForm, ic_dph: e.target.value})} placeholder="IČ DPH" />
                </div>
              </div>

              <div className="flex gap-6 pt-6 font-bold">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs font-bold font-bold">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-white text-black py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all shadow-xl font-bold font-bold font-bold font-bold">Uložiť klientske dáta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOZIDLA (ZACHOVANÉ) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-auto font-bold">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-center text-red-600 font-bold font-bold">Úprava technických údajov</h2>
            <form onSubmit={handleUpdateVehicle} className="space-y-6 font-bold italic">
              <div className="font-bold">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold">Značka a Model</label>
                <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold" value={editForm.brand_model} onChange={(e) => setEditForm({...editForm, brand_model: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4 font-bold">
                <div className="font-bold">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold uppercase font-bold">ŠPZ</label>
                  <input required className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold uppercase tracking-widest" value={editForm.license_plate} onChange={(e) => setEditForm({...editForm, license_plate: e.target.value})} />
                </div>
                <div className="font-bold">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold font-bold">Rok výroby</label>
                  <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-bold" value={editForm.year_produced} onChange={(e) => setEditForm({...editForm, year_produced: e.target.value})} />
                </div>
              </div>
              <div className="font-bold font-bold">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold font-bold">VIN číslo</label>
                <input required maxLength={17} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-red-600 font-mono text-sm uppercase font-bold font-bold" value={editForm.vin_number} onChange={(e) => setEditForm({...editForm, vin_number: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4 font-bold">
                <div className="font-bold">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold">Objem (cm³)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold" value={editForm.engine_volume} onChange={(e) => setEditForm({...editForm, engine_volume: e.target.value})} />
                </div>
                <div className="font-bold">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold">Výkon (kW)</label>
                  <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold" value={editForm.engine_power} onChange={(e) => setEditForm({...editForm, engine_power: e.target.value})} />
                </div>
                <div className="font-bold font-bold">
                  <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold">Palivo</label>
                  <select className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 appearance-none font-bold font-bold font-bold" value={editForm.fuel_type} onChange={(e) => setEditForm({...editForm, fuel_type: e.target.value})}>
                    <option value="Diesel">Diesel</option><option value="Benzín">Benzín</option><option value="Hybrid">Hybrid</option><option value="Elektro">Elektro</option><option value="LPG/CNG">LPG/CNG</option>
                  </select>
                </div>
              </div>
              <div className="font-bold font-bold">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-1 block tracking-widest font-bold font-bold font-bold uppercase font-bold">Stav tachometra (km)</label>
                <input type="number" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold outline-none focus:border-red-600 font-bold font-bold" value={editForm.mileage} onChange={(e) => setEditForm({...editForm, mileage: e.target.value})} />
              </div>
              <div className="flex gap-6 pt-6 font-bold">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs font-bold tracking-widest font-bold">Zrušiť</button>
                <button type="submit" className="flex-[2] bg-red-600 py-6 rounded-3xl font-black uppercase text-xs hover:bg-red-700 shadow-xl tracking-widest font-bold font-bold">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}