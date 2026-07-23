'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { trackBookingSubmit } from '@/app/lib/analytics';

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
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderStep, setOrderStep] = useState(1);

  // --- NOVÉ STAVY PRE DYNAMICKÝ VÝBER PRÁC ---
  const [categories, setCategories] = useState([]);
  const [norms, setNorms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedNorms, setSelectedNorms] = useState([]); // "Košík" vybratých prác
  const [customItems, setCustomItems] = useState([]); // Vlastné úkony zákazníka
  const [currentCustomIssue, setCurrentCustomIssue] = useState('');
  const [currentItemDuration, setCurrentItemDuration] = useState('technik');
  const [normSearchOrder, setNormSearchOrder] = useState('');

  // POMOCNÉ STAVY PRE NOVÝ VÝBER TERMÍNU
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [letTechDecideTime, setLetTechDecideTime] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
  ];

  // STAVY PRE KALENDÁR OBSADENOSTI
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [roleCapacity, setRoleCapacity] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dayEvents, setDayEvents] = useState([]);
  const [workHours, setWorkHours] = useState({ start: '07', end: '17' });

  const [editingMileageVehicleId, setEditingMileageVehicleId] = useState(null);
  const [mileageQuickInput, setMileageQuickInput] = useState('');

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

  const [vehicleForms, setVehicleForms] = useState([]);
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  // --- STAVY PRE EDITÁCIU PROFILU (ZACHOVANÉ) ---
  const [reviewOpen, setReviewOpen] = useState(false);
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
        
        // 2. Načítanie dát pre servisné práce
        fetchServiceData();

        // 3. Real-time odber nových správ
        channel = supabase
          .channel(`room-${Math.random()}`) 
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

          if (vehicleData?.length) {
            const plates = vehicleData.map(v => v.license_plate).filter(Boolean);
            const { data: jobRows } = await supabase.from('job_tickets').select('id, plate_number').in('plate_number', plates);
            if (jobRows?.length) {
              const { data: forms } = await supabase.from('job_forms').select('*, job_tickets(plate_number)').in('job_id', jobRows.map(j => j.id)).order('created_at', { ascending: false });
              setVehicleForms(forms || []);
            }
          }
        }
        const { data: logoSetting } = await supabase.from('business_settings').select('value').eq('id', 'company_logo').maybeSingle();
        if (logoSetting?.value) setCompanyLogoUrl(logoSetting.value);
      } catch (err) {
        console.error("Chyba pri načítaní:", err);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndData();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const fetchServiceData = async () => {
    const { data: cats } = await supabase.from('service_categories').select('*').order('name', { ascending: true });
    const { data: nrms } = await supabase.from('service_norms').select('*').order('service_name', { ascending: true });
    if (cats) setCategories(cats);
    if (nrms) setNorms(nrms);
  };

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
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .ilike('car_details->>plate', plate)
        .eq('is_official', true)
        .order('created_at', { ascending: false });

      if (error || (data && data.length === 0)) {
         const { data: fallbackData } = await supabase
          .from('invoices')
          .select('*')
          .eq('plate_number', plate)
          .eq('is_official', true)
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
  const fetchAvailability = async () => {
    const res = await fetch('/api/availability');
    if (!res.ok) return;
    const { availability, roleCapacity } = await res.json();
    setAvailabilityMap(availability);
    setRoleCapacity(roleCapacity);
  };

  const fetchDayEvents = async (dateStr) => {
    const [{ data: settings }, { data: evts }] = await Promise.all([
      supabase.from('business_settings').select('*').in('id', ['work_start', 'work_end']),
      supabase.from('calendar_events')
        .select('start_datetime, end_datetime, employee_id')
        .gte('start_datetime', `${dateStr}T00:00:00`)
        .lte('start_datetime', `${dateStr}T23:59:59`)
    ]);
    const start = settings?.find(s => s.id === 'work_start')?.value?.split(':')[0] || '07';
    const end = settings?.find(s => s.id === 'work_end')?.value?.split(':')[0] || '17';
    setWorkHours({ start, end });
    setDayEvents(evts || []);
  };

  const openOrderModal = (vehicle) => {
    setOrderingVehicle(vehicle);
    setCustomItems([]);
    setCurrentCustomIssue('');
    setCurrentItemDuration('technik');
    setSelectedDay('');
    setSelectedSlot('');
    setLetTechDecideTime(false);
    setCustomerNote('');
    setSelectedNorms([]);
    setSelectedCategory('');
    setNormSearchOrder('');
    setDayEvents([]);
    setCalendarMonth(new Date());
    setOrderStep(1);
    setIsOrderModalOpen(true);
    fetchAvailability();
  };

  const confirmOrderStep1 = () => {
    if (selectedNorms.length === 0 && customItems.length === 0) {
      const ok = window.confirm('Nevybrali ste žiadny servisný úkon ani vlastný popis závady.\n\nChcete pokračovať bez opisu problému?');
      if (!ok) return;
    }
    setOrderStep(2);
  };

  const addNormToSelection = (norm) => {
    if (selectedNorms.find(n => n.id === norm.id)) return;
    setSelectedNorms([...selectedNorms, norm]);
  };

  const removeNormFromSelection = (id) => {
    setSelectedNorms(selectedNorms.filter(n => n.id !== id));
  };

  const addCustomItem = () => {
    if (!currentCustomIssue.trim()) return;
    setCustomItems([...customItems, {
      id: Date.now(),
      description: currentCustomIssue.trim(),
      duration: currentItemDuration
    }]);
    setCurrentCustomIssue('');
    setCurrentItemDuration('technik');
  };

  const handleFinalizeOrder = async () => {
    if (!selectedDay) {
      alert("Prosím vyberte si deň príchodu.");
      return;
    }
    if (!selectedSlot && !letTechDecideTime) {
      alert("Prosím vyberte si čas príchodu alebo zvoľte 'Čas určí technik'.");
      return;
    }

    setOrderLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const normMinutes = selectedNorms.reduce((acc, curr) => acc + curr.duration_minutes, 0);
      const customKnownMinutes = customItems
        .filter(i => i.duration !== 'technik')
        .reduce((acc, i) => acc + i.duration, 0);
      const estimatedMinutes = normMinutes + customKnownMinutes || 60;

      const normsList = selectedNorms.length > 0
        ? `SERVISNÉ ÚKONY:\n${selectedNorms.map((p, idx) => `${idx + 1}. ${p.service_name} (~${p.duration_minutes} min)`).join('\n')}`
        : '';
      const customList = customItems.length > 0
        ? `VLASTNÉ ÚKONY:\n${customItems.map((item, idx) => {
            const dur = item.duration === 'technik' ? 'čas na technikovi' : item.duration >= 60 ? `~${item.duration / 60} hod` : `~${item.duration} min`;
            return `${idx + 1}. ${item.description} (${dur})`;
          }).join('\n')}`
        : '';
      const finalDescription = [normsList, customList].filter(Boolean).join('\n\n');

      const timeForEvent = letTechDecideTime ? '08:00' : selectedSlot;
      const finalDateTime = `${selectedDay}T${timeForEvent}:00`;
      const startTime = new Date(finalDateTime);
      const endTime = new Date(startTime.getTime() + estimatedMinutes * 60000);
      const endTimeStr = `${selectedDay}T${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}:00`;

      const { error } = await supabase
        .from('calendar_events')
        .insert([{
          title: `OBJEDNÁVKA: ${orderingVehicle.license_plate}`,
          description: `Objednávka z klientskej zóny.`,
          issue_description: finalDescription,
          planned_work: "Bude určené technikom",
          customer_note: [
            `Odhadované trvanie: ${estimatedMinutes} min.`,
            letTechDecideTime ? '⏰ Čas príchodu: určí prijímací technik' : null,
            customerNote ? `Poznámka zákazníka: ${customerNote}` : null,
          ].filter(Boolean).join(' | '),
          start_datetime: finalDateTime,
          end_datetime: endTimeStr,
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

      // Notifikačný email na autoalma@autoalma.sk
      fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: userProfile?.full_name || 'Zákazník z garáže',
          plateNumber: orderingVehicle.license_plate,
          carModel: orderingVehicle.brand_model || '',
          date: selectedDay,
          time: letTechDecideTime ? 'Čas určí technik' : selectedSlot,
          services: finalDescription,
          customerNote: customerNote || null,
          phone: userProfile?.phone || null,
          email: userProfile?.email || user.email,
          source: 'Klientska garáž',
        }),
      }).catch(() => {});

      // Potvrdenie zákazníkovi — žiadosť prijatá, čaká na potvrdenie
      const customerEmail = userProfile?.email || user.email;
      if (customerEmail) {
        fetch('/api/send-reservation-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: customerEmail,
            customerName: userProfile?.full_name || '',
            plateNumber: orderingVehicle.license_plate,
            date: selectedDay,
            startTime: letTechDecideTime ? 'Čas určí technik' : selectedSlot,
            issueDescription: finalDescription,
            customerNote: customerNote || null,
            type: 'received',
          }),
        }).catch(() => {});
      }

      await supabase.from('notifications').insert([{
        user_id: user.id,
        title: '📅 Žiadosť o termín odoslaná',
        content: `Vaša žiadosť o servisný termín pre vozidlo ${orderingVehicle.license_plate} na ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('sk-SK')} o ${selectedSlot} bola úspešne odoslaná. Čakáme na potvrdenie zo strany servisu.`,
        type: 'info'
      }]);

      trackBookingSubmit(orderingVehicle?.license_plate, selectedNorms.length + customItems.length);
      alert(`Vaša požiadavka bola úspešne odoslaná!`);
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

  const quickUpdateMileage = async (vehicleId) => {
    const val = mileageQuickInput === '' ? null : parseInt(mileageQuickInput);
    const { error } = await supabase.from('vehicles').update({ mileage: val }).eq('id', vehicleId);
    if (!error) {
      setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, mileage: val } : v));
      setEditingMileageVehicleId(null);
    } else { alert('Chyba pri ukladaní: ' + error.message); }
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

  const printSavedForm = (f) => {
    const d = f.filled_data || {};
    const title = f.template_name || 'PROTOKOL';
    const dateRec = d.date_received ? new Date(d.date_received + 'T12:00:00').toLocaleDateString('sk-SK') : '';
    const dateRet = d.date_returned ? new Date(d.date_returned + 'T12:00:00').toLocaleDateString('sk-SK') : '';
    const meas = (d.measurements || []).filter(m => m.label);
    const logo = companyLogoUrl;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Arial',sans-serif;background:#fff;color:#1a1a1a;font-size:9.5pt;padding:12mm 14mm 10mm}
      .header{display:flex;align-items:stretch;border:2.5px solid #cc0000;border-radius:3px;margin-bottom:6mm;overflow:hidden}
      .h-logo{background:#cc0000;padding:5mm 6mm;display:flex;align-items:center;justify-content:center;min-width:44mm}
      .h-logo img{max-height:18mm;max-width:40mm;object-fit:contain;filter:brightness(0)invert(1)}
      .h-logo-text{color:#fff;font-size:16pt;font-weight:900;text-transform:uppercase;letter-spacing:-.03em}
      .h-title{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4mm 6mm;border-left:2px solid #cc0000;border-right:2px solid #cc0000}
      .h-title .doc-name{font-size:14pt;font-weight:900;text-transform:uppercase;color:#cc0000;line-height:1.15;text-align:center}
      .h-title .doc-sub{font-size:7.5pt;color:#888;text-transform:uppercase;letter-spacing:.12em;margin-top:1.5mm;text-align:center}
      .h-info{padding:4mm 5mm;font-size:8pt;line-height:1.75;text-align:right;display:flex;flex-direction:column;justify-content:center;min-width:52mm}
      .h-info b{font-size:9pt;display:block;margin-bottom:1mm}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-bottom:4mm}
      .sec{margin-bottom:4mm}
      .sec-head{background:#cc0000;color:#fff;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.18em;padding:1.8mm 4mm}
      .sec-head.dark{background:#1a1a1a}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #d0d0d0;padding:2mm 3.5mm;font-size:9pt;vertical-align:middle}
      th{background:#fafafa;font-weight:700;color:#444;font-size:7.8pt;text-transform:uppercase;letter-spacing:.04em;width:36%;white-space:nowrap}
      td{color:#111} td.w18{width:18%} td.w22{width:22%}
      .plate-cell{font-size:13pt;font-weight:900;letter-spacing:.12em;color:#cc0000;text-transform:uppercase}
      .meas th{background:#fff5f5;color:#cc0000;font-size:8pt;width:65%}
      .meas td{font-size:10.5pt;font-weight:700;text-align:center;background:#fffafa}
      .meas tr:nth-child(odd) th{background:#ffecec}
      .meas tr:nth-child(odd) td{background:#fff5f5}
      .signs{display:grid;grid-template-columns:1fr 1fr;gap:24mm;margin-top:14mm}
      .sign{text-align:center}
      .sign-line{border-top:1.5px solid #333;padding-top:2mm;font-size:7.5pt;color:#666;text-transform:uppercase;letter-spacing:.1em}
      .footer{margin-top:6mm;border-top:1px solid #e0e0e0;padding-top:2.5mm;display:flex;justify-content:space-between;font-size:7pt;color:#aaa}
      @media print{body{padding:8mm 10mm 6mm}@page{size:A4;margin:0}}
    </style></head><body>
    <div class="header">
      <div class="h-logo">${logo ? `<img src="${logo}" alt="Logo"/>` : '<div class="h-logo-text">AutoAlma</div>'}</div>
      <div class="h-title"><div class="doc-name">${title}</div><div class="doc-sub">Servisný protokol • AutoAlma</div></div>
      <div class="h-info"><b>AutoAlma Servis s.r.o.</b>ul. Svornosti 119, 821 06 Bratislava<br/>Tel: 0940 449 449 / 0908 647 227<br/>IČO: 46044876&nbsp;&nbsp;DIČ: 2023194316</div>
    </div>
    <div class="two-col">
      <div class="sec"><div class="sec-head">Odovzdávajúci (zákazník)</div><table>
        <tr><th>Meno / Firma</th><td colspan="3"><b>${d.customer_name||''}</b></td></tr>
        <tr><th>Adresa</th><td colspan="3">${d.customer_address||''}</td></tr>
        <tr><th>Telefón</th><td>${d.customer_phone||''}</td></tr>
        <tr><th>IČO</th><td>${d.customer_ico||''}</td></tr>
      </table></div>
      <div class="sec"><div class="sec-head dark">Dátumy servisu</div><table>
        <tr><th>Prevzaté dňa</th><td><b>${dateRec||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</b></td></tr>
        <tr><th>Odovzdané dňa</th><td><b>${dateRet||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</b></td></tr>
      </table></div>
    </div>
    <div class="sec"><div class="sec-head dark">Údaje o vozidle</div><table>
      <tr><th>EČV</th><td class="plate-cell w22">${d.plate||''}</td><th>Značka / Model</th><td>${(d.brand||'')+' '+(d.model||'')}</td><th>Rok výroby</th><td class="w18">${d.year||''}</td></tr>
      <tr><th>Palivo</th><td class="w22">${d.fuel||''}</td><th>Stav KM pri prevzatí</th><td><b>${d.mileage ? d.mileage+' km' : ''}</b></td><th>Výkon / Objem</th><td class="w18">${d.engine_power ? d.engine_power+' kW' : ''} ${d.engine_volume ? '/ '+d.engine_volume : ''}</td></tr>
      ${d.note ? `<tr><th>Poznámka</th><td colspan="5">${d.note}</td></tr>` : ''}
    </table></div>
    ${meas.length ? `<div class="sec"><div class="sec-head">Merania a namerané hodnoty</div><table class="meas">
      <tr><th style="background:#f0f0f0;color:#333">Meranie / Parameter</th><td style="background:#f0f0f0;text-align:center;font-weight:700;font-size:9pt;color:#333">Nameraná hodnota</td></tr>
      ${meas.map(m=>`<tr><th>${m.label}</th><td>${m.value||''}</td></tr>`).join('')}
    </table></div>` : ''}
    <div class="signs">
      <div class="sign"><div style="height:16mm;border-bottom:1px dashed #ccc;margin-bottom:2mm"></div><div class="sign-line">Podpis zákazníka — odovzdávajúci</div></div>
      <div class="sign"><div style="height:16mm;border-bottom:1px dashed #ccc;margin-bottom:2mm"></div><div class="sign-line">Podpis technika — preberajúci</div></div>
    </div>
    <div class="footer"><span>AutoAlma Servis s.r.o. • ul. Svornosti 119, 821 06 Bratislava • IČ DPH: SK2023194316</span><span>Vytlačené: ${new Date().toLocaleDateString('sk-SK')}</span></div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
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
              <h1 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter leading-none font-bold break-words">
                <span className="break-words">{userProfile?.full_name || 'Môj Profil'}</span>
                <button onClick={() => setIsProfileModalOpen(true)} className="ml-3 text-[10px] bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl hover:bg-white hover:text-black transition-all not-italic tracking-normal font-black uppercase font-bold align-middle">
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
            <div key={vehicle.id} className="bg-zinc-900/50 border border-zinc-800 p-5 md:p-12 rounded-[3.5rem] relative group hover:border-zinc-700 transition-all shadow-xl font-bold w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 font-bold">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="bg-white text-black px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-xl md:text-3xl tracking-tighter shadow-xl font-bold shrink-0">{vehicle.license_plate}</div>
                  <div className="min-w-0 w-full">
                    <h2 className="text-xl md:text-4xl font-black uppercase italic tracking-tight mb-1 font-bold break-words leading-tight">{vehicle.brand_model}</h2>
                    <p className="text-zinc-500 text-[11px] font-black uppercase tracking-wider font-bold break-all">VIN: {vehicle.vin_number || 'Neuvedené'}</p>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => openEditModal(vehicle)} className="p-3 md:p-4 bg-zinc-800 rounded-2xl hover:bg-white hover:text-black transition-all text-sm font-bold whitespace-nowrap">Upraviť ✏️</button>
                  <button onClick={() => handleDelete(vehicle.id, vehicle.license_plate)} className="p-3 md:p-4 bg-zinc-800 rounded-2xl hover:bg-red-600 transition-all text-sm font-bold whitespace-nowrap">Vymazať 🗑️</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-t border-zinc-800/50 pt-8">
                  <div className="bg-black/20 p-4 rounded-3xl">
                    <p className="text-zinc-600 text-[9px] uppercase font-black mb-1">Motorizácia</p>
                    <p className="text-sm font-black break-words">{vehicle.engine_volume || '---'} ccm / {vehicle.engine_power || '---'} kW</p>
                  </div>
                  <div className="bg-black/20 p-4 rounded-3xl">
                    <p className="text-zinc-600 text-[9px] uppercase font-black mb-1">Palivo & Rok</p>
                    <p className="text-sm font-black break-words">{vehicle.fuel_type} • {vehicle.year_produced || '---'}</p>
                  </div>
                  <div className="bg-blue-600/5 p-4 rounded-3xl border border-blue-600/10">
                    <p className="text-blue-500/60 text-[9px] uppercase font-black mb-1">Stav Tachometra</p>
                    {editingMileageVehicleId === vehicle.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number" min="0" autoFocus
                          className="w-full bg-black border border-blue-500 rounded-lg px-2 py-1 text-white font-bold text-sm outline-none"
                          value={mileageQuickInput}
                          onChange={e => setMileageQuickInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') quickUpdateMileage(vehicle.id); if (e.key === 'Escape') setEditingMileageVehicleId(null); }}
                          placeholder="Zadajte KM"
                        />
                        <button onClick={() => quickUpdateMileage(vehicle.id)} className="text-green-400 font-black text-sm px-1">✓</button>
                        <button onClick={() => setEditingMileageVehicleId(null)} className="text-zinc-500 font-black text-sm px-1">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-2">
                        <p className="text-xl font-black text-blue-400">{vehicle.mileage != null ? Number(vehicle.mileage).toLocaleString('sk-SK') : '---'} KM</p>
                        <button onClick={() => { setMileageQuickInput(vehicle.mileage ?? ''); setEditingMileageVehicleId(vehicle.id); }} className="text-blue-600 text-[10px] font-black mb-1 hover:text-blue-400 transition-colors">✎</button>
                      </div>
                    )}
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

              {(() => {
                const plateForms = vehicleForms.filter(f => f.job_tickets?.plate_number === vehicle.license_plate);
                if (!plateForms.length) return null;
                return (
                  <div className="mt-4 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-1">Protokoly a dokumenty</p>
                    {plateForms.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-black/40 border border-zinc-800 px-5 py-3 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <span>📋</span>
                          <div>
                            <p className="font-black uppercase text-xs text-white">{f.template_name}</p>
                            <p className="text-[9px] text-zinc-600 uppercase">{new Date(f.created_at).toLocaleDateString('sk-SK')}</p>
                          </div>
                        </div>
                        <button onClick={() => printSavedForm(f)} className="text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500">
                          🖨️ Vytlačiť
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}

          <button onClick={() => router.push('/garaz/pridat')} className="border-2 border-dashed border-zinc-800 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-4 hover:border-red-600/50 transition-all group min-h-[150px] font-bold">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-3xl group-hover:bg-red-600 transition-all font-bold">+</div>
            <span className="text-[13px] font-black uppercase tracking-[0.3em] text-zinc-600 group-hover:text-white font-bold">Pradať ďalšie vozidlo do mojej garáže</span>
          </button>
        </div>
      </div>

      {/* --- SPÄTNÁ VÄZBA — FLOATING IKONY --- */}
      <div className="fixed bottom-6 right-5 z-[90] flex flex-col items-end gap-2">

        {/* ROZBALENÝ PANEL */}
        {reviewOpen && (
          <div className="w-64 bg-zinc-950 border border-zinc-800 rounded-[1.75rem] shadow-2xl shadow-black/60 overflow-hidden mb-1">
            <div className="h-[2px] bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />
            <div className="p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600 mb-1">Ste spokojní?</p>
              <p className="text-white font-black uppercase italic tracking-tight text-base leading-tight mb-1">Budeme radi za vašu recenziu</p>
              <p className="text-zinc-400 text-[10px] font-bold leading-snug mb-4">Pomôžete nám aj ďalším zákazníkom, ktorí nás ešte nepoznajú.</p>
              <div className="flex flex-col gap-2">
                <a href="https://www.facebook.com/AutoalmaAutoservis/reviews" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-blue-600/10 border border-blue-600/25 hover:border-blue-500/60 hover:bg-blue-600/20 px-4 py-3 rounded-xl transition-all group">
                  <svg className="w-4 h-4 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  <span className="text-blue-300 font-black uppercase text-[10px] tracking-widest group-hover:text-white transition-colors">Facebook</span>
                </a>
                <a href="https://www.google.com/maps?cid=15276782726525162" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 px-4 py-3 rounded-xl transition-all group">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-zinc-300 font-black uppercase text-[10px] tracking-widest group-hover:text-white transition-colors">Google</span>
                </a>
                <a href={`mailto:autoalma@autoalma.sk?subject=Spätná väzba od zákazníka&body=Dobrý deň,%0A%0ATu je moja spätná väzba:%0A%0A`}
                  className="flex items-center gap-3 bg-red-600/10 border border-red-600/20 hover:border-red-500/50 hover:bg-red-600/15 px-4 py-3 rounded-xl transition-all group">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-red-300 font-black uppercase text-[10px] tracking-widest group-hover:text-white transition-colors">E-mail</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING TLAČIDLO — HVIEZDA */}
        <button
          onClick={() => setReviewOpen(p => !p)}
          className="w-14 h-14 bg-zinc-900 border border-zinc-700 hover:border-red-600/60 hover:bg-zinc-800 rounded-full flex items-center justify-center shadow-xl transition-all"
          title="Zanechať recenziu"
        >
          {reviewOpen
            ? <span className="text-white text-lg font-black">✕</span>
            : <span className="text-xl">⭐</span>
          }
        </button>
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
               <div className="space-y-3">
                 {vehicleInvoices.map(inv => (
                   <div key={inv.id} className="bg-black/40 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center group hover:border-red-600/30 transition-all font-bold italic">
                     <div>
                       <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Číslo faktúry</p>
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

      {/* OBJEDNÁVKA — KROK 1: VÝBER ÚKONOV */}
      {isOrderModalOpen && orderStep === 1 && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[200] overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-start p-4 py-10">
            <div className="w-full max-w-2xl">

              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setIsOrderModalOpen(false)} className="text-zinc-500 hover:text-white text-sm font-black uppercase tracking-widest transition-colors">✕ Zavrieť</button>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-1.5 rounded-full bg-red-600" />
                  <span className="w-7 h-1.5 rounded-full bg-zinc-700" />
                </div>
              </div>

              <div className="mb-8">
                <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Krok 1 z 2</p>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-tight">
                  Čo potrebujete <span className="text-red-600">opraviť?</span>
                </h2>
                <p className="text-zinc-500 text-xs font-bold mt-1">
                  {orderingVehicle?.license_plate} · {orderingVehicle?.brand_model}
                </p>
              </div>

              <div className="space-y-6 font-bold italic">

                <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl space-y-4">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1 not-italic">1. Výber servisných úkonov</p>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedCategory('')}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border not-italic ${selectedCategory === '' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                      Všetky
                    </button>
                    {categories.map(cat => (
                      <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border not-italic ${selectedCategory === cat.id ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input type="text" placeholder="Hľadať úkon... (napr. brzdy, olej, klima)"
                      value={normSearchOrder} onChange={e => setNormSearchOrder(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 p-4 pl-5 pr-10 rounded-2xl text-white text-xs font-black outline-none transition-all not-italic normal-case placeholder:font-bold placeholder:normal-case placeholder:not-italic placeholder:text-zinc-600"
                    />
                    {normSearchOrder
                      ? <button type="button" onClick={() => setNormSearchOrder('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-sm">✕</button>
                      : <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>}
                  </div>

                  {(selectedCategory || normSearchOrder.trim().length >= 2) && (() => {
                    const nd = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
                    const hits = norms.filter(n =>
                      (!selectedCategory || n.category_id === selectedCategory) &&
                      (!normSearchOrder.trim() || nd(n.service_name).includes(nd(normSearchOrder))) &&
                      !selectedNorms.find(s => s.id === n.id)
                    ).slice(0, 15);
                    return hits.length === 0
                      ? <p className="text-center text-zinc-700 text-[10px] italic py-3">Žiadny úkon nenájdený</p>
                      : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                          {hits.map(norm => (
                            <button key={norm.id} type="button"
                              onClick={() => { addNormToSelection(norm); setNormSearchOrder(''); }}
                              className="w-full flex items-center justify-between gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-600/40 px-4 py-3 rounded-xl transition-all text-left">
                              <div className="flex items-center gap-3 min-w-0">
                                {!selectedCategory && (
                                  <span className="text-[8px] font-black uppercase text-white bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shrink-0 not-italic">{catMap[norm.category_id] || ''}</span>
                                )}
                                <span className="text-xs font-black uppercase italic text-white break-words min-w-0">{norm.service_name}</span>
                              </div>
                              <span className="text-[10px] text-white shrink-0 not-italic font-bold">~{norm.duration_minutes} min</span>
                            </button>
                          ))}
                        </div>
                      );
                  })()}

                  <div className="space-y-2">
                    <p className="text-[9px] text-white uppercase font-black ml-1 not-italic">Vybrané úkony:</p>
                    {selectedNorms.length === 0 ? (
                      <div className="py-5 text-center text-zinc-700 uppercase italic text-[10px] border border-dashed border-zinc-800 rounded-2xl">Zoznam je prázdny</div>
                    ) : selectedNorms.map(sn => (
                      <div key={sn.id} className="flex justify-between items-center bg-blue-600/10 border border-blue-600/30 p-3 rounded-xl">
                        <span className="text-xs font-black uppercase italic text-white break-words min-w-0 mr-3">{sn.service_name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-black text-white not-italic">~{sn.duration_minutes} min</span>
                          <button type="button" onClick={() => removeNormFromSelection(sn.id)} className="text-red-500 hover:text-white font-bold not-italic">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl space-y-4">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest ml-1 not-italic">2. Vlastné úkony / Iné závady</p>

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
                          <button type="button" onClick={() => setCustomItems(customItems.filter(i => i.id !== item.id))} className="text-red-500 hover:text-white font-bold ml-3 not-italic">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input type="text" placeholder="Popíšte závadu alebo úkon..."
                      value={currentCustomIssue}
                      onChange={e => setCurrentCustomIssue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
                      className={`w-full bg-zinc-900 p-4 rounded-2xl text-white text-xs outline-none uppercase italic placeholder:normal-case placeholder:not-italic transition-all ${currentCustomIssue.trim() ? 'border-2 border-red-500 pr-24' : 'border border-zinc-800 focus:border-zinc-600'}`}
                    />
                    {currentCustomIssue.trim() && (
                      <button type="button" onClick={addCustomItem}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all not-italic whitespace-nowrap">
                        + Pridať
                      </button>
                    )}
                  </div>
                  {currentCustomIssue.trim() && (
                    <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest not-italic animate-pulse">
                      ↵ Enter alebo kliknite „+ Pridať" — úkon sa ešte nepridá automaticky
                    </p>
                  )}

                  <div>
                    <p className="text-[8px] font-black text-white uppercase tracking-widest mb-2 ml-1 not-italic">Odhadovaný čas</p>
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
                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all not-italic ${currentCustomIssue.trim() ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20' : 'border border-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                    + Pridať úkon
                  </button>
                </div>
              </div>

              <button type="button" onClick={confirmOrderStep1}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl transition-all mt-6 shadow-[0_10px_30px_rgba(220,38,38,0.2)]">
                Pokračovať k výberu termínu →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OBJEDNÁVKA — KROK 2: VÝBER TERMÍNU + POZNÁMKA */}
      {isOrderModalOpen && orderStep === 2 && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[200] overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-start p-4 py-10">
            <div className="w-full max-w-xl">

              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setOrderStep(1)} className="text-zinc-500 hover:text-white text-sm font-black uppercase tracking-widest transition-colors">← Späť</button>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-1.5 rounded-full bg-red-600" />
                  <span className="w-7 h-1.5 rounded-full bg-red-600" />
                </div>
              </div>

              <div className="mb-6">
                <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Krok 2 z 2</p>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Vyber <span className="text-red-600">termín</span></h2>
                <p className="text-zinc-500 text-xs font-bold mt-1">
                  {orderingVehicle?.license_plate} · {orderingVehicle?.brand_model}
                </p>
              </div>

              {(selectedNorms.length > 0 || customItems.length > 0) && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-6">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Vybrané úkony</p>
                  <div className="space-y-1">
                    {selectedNorms.map(sn => (
                      <div key={sn.id} className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white">{sn.service_name}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">~{sn.duration_minutes} min</span>
                      </div>
                    ))}
                    {customItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-300">{item.description}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                          {item.duration === 'technik' ? 'na technikovi' : item.duration >= 60 ? `~${item.duration / 60} hod` : `~${item.duration} min`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6 bg-black/20 p-6 rounded-[2.5rem] border border-zinc-800/50 font-bold italic uppercase">

                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-green-600/40 border border-green-600/50 inline-block"/> Voľné</span>
                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600/40 border border-amber-600/50 inline-block"/> Čiastočne</span>
                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-red-600/40 border border-red-600/50 inline-block"/> Takmer plné</span>
                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-white"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 border border-zinc-700 inline-block"/> Plné / Víkend</span>
                </div>

                <p className="text-[9px] text-red-600 uppercase ml-1 font-black tracking-widest">Vyber deň príchodu</p>

                <div className="flex justify-between items-center">
                  <button type="button" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-700 transition-all">←</button>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white">
                    {calendarMonth.toLocaleString('sk-SK', { month: 'long', year: 'numeric' }).toUpperCase()}
                  </span>
                  <button type="button" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-700 transition-all">→</button>
                </div>

                <div className="grid grid-cols-7 gap-1 -mb-2">
                  {['Po','Ut','St','Št','Pi','So','Ne'].map(d => (
                    <div key={d} className="text-center text-[8px] text-white font-black">{d}</div>
                  ))}
                </div>

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
                        if (isFull)          cls = 'bg-zinc-900 border border-zinc-800 text-zinc-700 opacity-40 cursor-not-allowed';
                        else if (pct >= 0.8) cls = 'bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 cursor-pointer';
                        else if (pct >= 0.4) cls = 'bg-amber-600/20 border border-amber-600/40 text-amber-400 hover:bg-amber-600/40 cursor-pointer';
                        else                 cls = 'bg-green-600/20 border border-green-600/40 text-green-400 hover:bg-green-600/40 cursor-pointer';
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

                {selectedDay && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-[9px] text-white uppercase ml-1 font-black tracking-widest">
                      {new Date(selectedDay + 'T12:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                    </p>

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
              </div>

              <button type="button" onClick={handleFinalizeOrder}
                disabled={orderLoading || !selectedDay || (!selectedSlot && !letTechDecideTime)}
                className="mt-6 w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl transition-all disabled:opacity-30 shadow-[0_10px_30px_rgba(220,38,38,0.2)]">
                {orderLoading ? 'Odosielam...' : '✓ Odoslať požiadavku'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROFILU (ZACHOVANÉ) */}
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