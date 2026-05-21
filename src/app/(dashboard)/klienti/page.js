'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function KlientiPage() {
  const [klienti, setKlienti] = useState([]);
  const [selectedKlient, setSelectedKlient] = useState(null); // Obsahuje meno partnera (kľúč)
  const [vozidla, setVozidla] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [originalName, setOriginalName] = useState('');

  const [confirmDeleteName, setConfirmDeleteName] = useState(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [clientForm, setClientForm] = useState({ 
    customer_name: '', customer_phone: '', customer_email: '',
    client_type: 'Osoba', address: '', city: '', zip: '', ico: '', dic: '', ic_dph: '', company_name: '',
    password: '' 
  });

  const [carForm, setCarForm] = useState({
    id: '', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel', mileage: ''
  });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importSystem, setImportSystem] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importSelected, setImportSelected] = useState(new Set());
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importRetryQueue, setImportRetryQueue] = useState([]);
  const [retryIdx, setRetryIdx] = useState(0);
  const [isRetryOpen, setIsRetryOpen] = useState(false);
  const [retryForm, setRetryForm] = useState({ full_name: '', phone: '', email: '', address: '' });
  const [retrySaving, setRetrySaving] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importDateFrom, setImportDateFrom] = useState('');
  const [importHistory, setImportHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('importHistory') || '[]'); } catch { return []; } });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(null);
  const klientyFileRef = useRef(null);
  const vozidlaFileRef = useRef(null);

  useEffect(() => { fetchKlienti(); }, []);

  // --- 1. NAČÍTANIE KLIENTOV ---
  const fetchKlienti = async () => {
    setLoading(true);
    const [{ data: webProfiles }, { data: customersData }, { data: vehiclesData }] = await Promise.all([
      supabase.from('user_profiles').select('*').or('role.eq.zakaznik,role.eq.klient'),
      supabase.from('customers').select('*'),
      supabase.from('vehicles').select('*'),
    ]);

    const mapaKlientov = {};

    webProfiles?.forEach(p => {
      const hlavneZobrazovaneMeno = p.company_name || p.full_name || p.email || "Neznámy partner";
      mapaKlientov[hlavneZobrazovaneMeno] = {
        ...p,
        customer_name: hlavneZobrazovaneMeno,
        db_full_name: p.full_name,
        db_company_name: p.company_name,
        customer_phone: p.phone || '',
        customer_email: p.email || '',
        all_plates: [],
        client_type: (p.ico || p.company_name) ? 'Firma' : 'Osoba'
      };
    });

    // Importovaní klienti z customers tabuľky (preskočiť duplicity)
    customersData?.forEach(c => {
      const meno = c.company_name || c.full_name || c.email || 'Neznámy';
      const emailExists = c.email && Object.values(mapaKlientov).some(k => k.customer_email?.toLowerCase() === c.email.toLowerCase());
      const nameExists = meno !== 'Neznámy' && Object.values(mapaKlientov).some(k => (k.db_full_name || k.db_company_name || k.customer_name)?.toLowerCase() === meno.toLowerCase());
      if (!emailExists && !nameExists) {
        mapaKlientov['__cust__' + c.id] = {
          id: c.id,
          _customerId: c.id,
          customer_name: meno,
          db_full_name: c.full_name,
          db_company_name: c.company_name || null,
          customer_phone: c.phone || '',
          customer_email: c.email || '',
          address: c.address || '',
          city: c.city || '',
          zip: c.zip || '',
          ico: c.ico || '',
          dic: c.dic || '',
          ic_dph: c.ic_dph || '',
          all_plates: [],
          client_type: c.client_type || (c.company_name ? 'Firma' : 'Osoba'),
        };
      }
    });

    vehiclesData?.forEach(v => {
      const majitel = Object.values(mapaKlientov).find(k =>
        (k._customerId && k._customerId === v.owner_id) ||
        (k.id === v.owner_id) ||
        (k.customer_email && v.owner_email && k.customer_email === v.owner_email) ||
        (k.customer_name === v.owner_name)
      );
      if (majitel && v.license_plate) {
        const key = Object.keys(mapaKlientov).find(k => mapaKlientov[k] === majitel);
        if (key && !mapaKlientov[key].all_plates.includes(v.license_plate)) {
          mapaKlientov[key].all_plates.push(v.license_plate);
        }
      }
    });

    setKlienti(Object.values(mapaKlientov).sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '')));
    setLoading(false);
  };

  // --- 2. NAČÍTANIE VOZIDIEL KLIENTA ---
  const nacitajVozidla = async (klientObj) => {
    const meno = klientObj.customer_name;
    const email = klientObj.customer_email;
    const realFullName = klientObj.db_full_name;
    const realCompName = klientObj.db_company_name;
    setSelectedKlient(meno);
    
    const nameFilters = [meno, realFullName, realCompName].filter(Boolean);
    const ticketOrParts = nameFilters.map(n => `customer_name.eq."${n}"`).join(',');
    const vehicleOrParts = [
      ...nameFilters.map(n => `owner_name.eq."${n}"`),
      ...(email ? [`owner_email.eq."${email}"`] : []),
      ...(klientObj._customerId ? [`owner_id.eq.${klientObj._customerId}`] : []),
    ].join(',');
    const { data: ticketCars } = ticketOrParts ? await supabase.from('job_tickets').select('*, job_items(*)').or(ticketOrParts) : { data: [] };
    const { data: webCars } = vehicleOrParts ? await supabase.from('vehicles').select('*').or(vehicleOrParts) : { data: [] };

    let finalVehicles = [];
    if (webCars) {
      finalVehicles = webCars.map(wc => {
        const history = ticketCars?.filter(d => d.plate_number === wc.license_plate).map(h => {
           const subtotal = h.job_items?.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0) || 0;
           return { ...h, total_price: subtotal * 1.23 };
        }) || [];
        return {
          id: wc.id, plate_number: wc.license_plate, car_brand_model: wc.brand_model, vin_number: wc.vin_number,
          engine_volume: wc.engine_volume, engine_power: wc.engine_power, year_produced: wc.year_produced,
          fuel_type: wc.fuel_type, mileage: wc.mileage, owner_email: wc.owner_email, full_history: history
        };
      });
    }
    setVozidla(finalVehicles);
  };

  // --- 3. LOGIKA NACÍTANIA CEZ API (ŠPZ) ---
  const handleCarLookup = async () => {
    if (!carForm.plate_number) { alert("Zadajte ŠPZ!"); return; }
    setApiLoading(true);
    try {
      const res = await fetch(`/api/vehicle-lookup?ecv=${carForm.plate_number.toUpperCase().replace(/\s/g, '')}`);
      const result = await res.json();
      if (result && result.vehicle) {
        const v = result.vehicle;
        const yearOnly = v.dat_prva_evid ? v.dat_prva_evid.split('.').pop() : '';
        setCarForm({
          ...carForm,
          brand: v.znacka || '',
          model: v.obch_nazov || '',
          vin_number: v.vin || '',
          year_produced: yearOnly,
          engine_volume: v.objem || '',
          engine_power: v.vykon || '',
          fuel_type: v.druh_paliva === 'Nafta' ? 'Diesel' : (v.druh_paliva || 'Diesel')
        });
      } else { alert("Vozidlo sa v databáze nenašlo."); }
    } catch (err) { alert("Chyba pri načítaní údajov z API."); }
    finally { setApiLoading(false); }
  };

  // --- 4. AI SKENOVANIE TP ---
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setApiLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/scan-tp', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || 'Chyba AI');
      const carData = json.data;
      setCarForm(prev => ({
        ...prev,
        brand: carData.brand || prev.brand, model: carData.model || prev.model, vin_number: carData.vin || prev.vin_number,
        year_produced: carData.year || prev.year_produced, engine_volume: carData.engine_volume || prev.engine_volume,
        engine_power: carData.engine_power || prev.engine_power, fuel_type: carData.fuel_type || prev.fuel_type,
      }));
    } catch (err) { alert("Chyba pri AI skenovaní: " + err.message); }
    setApiLoading(false);
  };

  // --- 5. UKLADANIE VOZIDLA DO SUPABASE ---
  const handleSaveCar = async (e) => {
    e.preventDefault();
    const klientInfo = klienti.find(k => k.customer_name === selectedKlient);
    const payload = {
      owner_name: selectedKlient,
      owner_email: klientInfo?.customer_email || '',
      owner_id: klientInfo?._customerId ? null : (klientInfo?.id || null),
      license_plate: carForm.plate_number.toUpperCase().replace(/\s/g, ''),
      brand_model: `${carForm.brand} ${carForm.model}`.trim(),
      vin_number: carForm.vin_number.toUpperCase().trim(),
      engine_volume: carForm.engine_volume ? parseInt(carForm.engine_volume) : null,
      engine_power: carForm.engine_power ? parseInt(carForm.engine_power) : null,
      year_produced: carForm.year_produced ? parseInt(carForm.year_produced) : null,
      fuel_type: carForm.fuel_type,
      mileage: carForm.mileage ? parseInt(carForm.mileage) : 0,
      delete_requested: false
    };

    let res;
    if (carForm.id) { res = await supabase.from('vehicles').update(payload).eq('id', carForm.id); }
    else { res = await supabase.from('vehicles').insert([payload]); }

    if (!res.error) {
      setIsCarModalOpen(false);
      fetchKlienti(); 
      if (klientInfo) nacitajVozidla(klientInfo);
    } else { alert("Chyba pri ukladaní: " + res.error.message); }
  };

  // --- 6. OSTATNÉ FUNKCIE (KLIENT, DELETE...) ---
  const handleSaveClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let userId = clientForm.id;
      if (!editMode && clientForm.password) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: clientForm.customer_email, password: clientForm.password,
          options: { data: { full_name: clientForm.customer_name, role: 'zakaznik' } }
        });
        if (authError) throw authError;
        userId = authData.user?.id;
      }
      const profilePayload = {
        id: userId, full_name: clientForm.customer_name, company_name: clientForm.company_name,
        phone: clientForm.customer_phone, email: clientForm.customer_email, address: clientForm.address,
        city: clientForm.city, zip: clientForm.zip, ico: clientForm.ico, dic: clientForm.dic,
        ic_dph: clientForm.ic_dph, role: 'zakaznik'
      };
      let res;
      if (editMode) {
        const { id: _id, ...updatePayload } = profilePayload;
        res = await supabase.from('user_profiles').update(updatePayload).eq('id', clientForm.id);
        if (!res.error && res.count === 0) {
          res = await supabase.from('user_profiles').update(updatePayload).eq('email', clientForm.customer_email);
        }
      } else { res = await supabase.from('user_profiles').insert([profilePayload]); }
      if (res.error) throw res.error;

      if (!editMode && clientForm.customer_email) {
        fetchWithAuth('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: clientForm.customer_email,
            name: clientForm.customer_name,
            password: clientForm.password,
            createdByAdmin: true,
          }),
        }).catch(() => {});
      }

      setIsClientModalOpen(false);
      fetchKlienti();
    } catch (err) { alert("Chyba: " + err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteKlient = async (klient) => {
    if (confirmDeleteName !== klient.customer_name) { setConfirmDeleteName(klient.customer_name); return; }
    if (klient._customerId) {
      await supabase.from('vehicles').delete().eq('owner_id', klient._customerId);
      const { error } = await supabase.from('customers').delete().eq('id', klient._customerId);
      if (!error) { setConfirmDeleteName(null); fetchKlienti(); setSelectedKlient(null); }
    } else {
      const { error } = await supabase.from('user_profiles').delete().eq('email', klient.customer_email);
      if (!error) { setConfirmDeleteName(null); fetchKlienti(); setSelectedKlient(null); }
    }
  };

  const handleDeleteCar = async (v) => {
    if (confirm(`Naozaj vymazať ${v.plate_number}?`)) {
      await supabase.from('vehicles').delete().eq('id', v.id);
      const k = klienti.find(c => c.customer_name === selectedKlient);
      if (k) nacitajVozidla(k);
      fetchKlienti();
    }
  };

  const openEditClientModal = (k) => {
    setEditMode(true); setOriginalName(k.customer_name);
    setClientForm({ ...k, customer_name: k.db_full_name || k.customer_name, password: '' }); 
    setIsClientModalOpen(true);
  };

  const openEditCarModal = (car) => {
    setEditMode(true);
    const brandModel = car.car_brand_model || '';
    const parts = brandModel.split(' ');
    setCarForm({
      id: car.id, plate_number: car.plate_number, brand: parts[0] || '', model: parts.slice(1).join(' ') || '',
      vin_number: car.vin_number, engine_volume: car.engine_volume, engine_power: car.engine_power,
      year_produced: car.year_produced, fuel_type: car.fuel_type, mileage: car.mileage || ''
    });
    setIsCarModalOpen(true);
  };

  // --- IMPORT LOGIKA ---
  const openImport = () => {
    setImportStep(1);
    setImportSystem(null);
    setImportPreview([]);
    setImportSelected(new Set());
    setImportResult(null);
    setIsImportOpen(true);
  };

  const parseAzsoftCSV = async () => {
    const klientyFile = klientyFileRef.current?.files?.[0];
    const vozidlaFile = vozidlaFileRef.current?.files?.[0];
    if (!klientyFile) { alert('Vyberte súbor Klienty!'); return; }

    const parseFile = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const decoder = new TextDecoder('windows-1250');
        const text = decoder.decode(e.target.result);
        const result = Papa.parse(text, { header: true, delimiter: ';', skipEmptyLines: true });
        resolve(result.data);
      };
      reader.readAsArrayBuffer(file);
    });

    const klientyRows = await parseFile(klientyFile);
    const vozidlaRows = vozidlaFile ? await parseFile(vozidlaFile) : [];

    // Validácia štruktúry CSV
    if (!klientyRows.length) { alert('Súbor Klienty je prázdny alebo sa nepodarilo načítať.'); return; }
    const firstRow = klientyRows[0];
    const requiredCols = ['ID', 'MENO1', 'ULICA', 'MESTO'];
    const missingCols = requiredCols.filter(c => !(c in firstRow));
    if (missingCols.length > 0) {
      alert(`Súbor Klienty nemá správnu štruktúru.\nChýbajú stĺpce: ${missingCols.join(', ')}\nSkontrolujte, či je nastavený oddeľovač ";" (bodkočiarka) pri exporte z AZSoft.`);
      return;
    }

    const parseFuel = (s) => {
      if (!s) return 'Iné';
      const p = s.toLowerCase();
      if (p.includes('nafta')) return 'Diesel';
      if (p.includes('ba ') || p.includes('benzin') || p.includes('benzín')) return 'Benzín';
      if (p.includes('elektr')) return 'Elektro';
      if (p.includes('hybrid')) return 'Hybrid';
      return s.trim() || 'Iné';
    };
    const parseYear = (s) => {
      if (!s) return null;
      const y = s.replace(/\s+/g, '').substring(0, 4);
      return y && !isNaN(y) ? parseInt(y) : null;
    };
    const parseNum = (s) => {
      if (!s) return null;
      const n = parseInt(s.toString().replace(/[^\d]/g, ''));
      return isNaN(n) ? null : n;
    };

    const existingEmails = new Set(klienti.map(k => k.customer_email).filter(Boolean).map(e => e.toLowerCase()));
    const existingPhones = new Set(klienti.map(k => k.customer_phone).filter(Boolean));
    const existingNames = new Set(klienti.flatMap(k => [k.db_full_name, k.db_company_name, k.customer_name].filter(Boolean).map(n => n.toLowerCase())));
    const existingPlates = new Set(klienti.flatMap(k => k.all_plates || []));

    const clientMap = {};
    klientyRows.forEach(row => {
      const hasCompany = !!(row.ICO && row.ICO.trim().replace(/\s/g, '').length > 3);
      const meno2 = row.MENO2?.trim() || '';
      const meno3 = row.MENO3?.trim() || '';
      const phone = row.TELEFON?.trim().replace(/\s+/g, '') || null;
      const email = row.EMAIL?.trim().toLowerCase() || null;
      const client = {
        full_name: hasCompany ? ([meno2, meno3].filter(Boolean).join(' ') || null) : (row.MENO1?.trim() || null),
        company_name: hasCompany ? row.MENO1?.trim() : null,
        phone,
        email,
        address: row.ULICA?.trim() || null,
        city: row.MESTO?.trim() || null,
        zip: row.PSC?.trim() || null,
        ico: row.ICO?.trim() || null,
        dic: row.DIC?.trim() || null,
        ic_dph: row.ICDPH?.trim() || null,
        role: 'klient',
      };
      const displayName = client.company_name || client.full_name || `Klient ${row.ID}`;
      const isDuplicate = (email && existingEmails.has(email.toLowerCase())) || (phone && existingPhones.has(phone)) || existingNames.has(displayName.toLowerCase());
      const dupReason = (email && existingEmails.has(email.toLowerCase())) ? 'email' : (phone && existingPhones.has(phone)) ? 'tel' : existingNames.has(displayName.toLowerCase()) ? 'meno' : null;
      clientMap[row.ID] = { client, displayName, isDuplicate, dupReason, vehicles: [] };
    });

    const parseAzsoftDate = (s) => {
      if (!s) return null;
      // Format: DD.MM.YYYY HH:MM or DD.MM.YYYY
      const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      return null;
    };

    vozidlaRows.forEach(row => {
      const owner = clientMap[row.ID_ODBER];
      if (!owner) return;
      const spz = row.SPZ?.trim().toUpperCase().replace(/\s/g, '');
      if (!spz) return;
      const casOprava = parseAzsoftDate(row.CAS_OPRAVA);
      if (casOprava) {
        if (!owner.lastActivity || casOprava > owner.lastActivity) owner.lastActivity = casOprava;
      }
      owner.vehicles.push({
        license_plate: spz,
        _isDupPlate: existingPlates.has(spz),
      });
    });

    const preview = Object.values(clientMap).filter(p => p.client.full_name || p.client.company_name);
    const nonDuplicates = new Set(preview.map((_, i) => i).filter(i => !preview[i].isDuplicate));
    setImportPreview(preview);
    setImportSelected(nonDuplicates);
    setImportStep(3);
  };

  const toggleAll = (checked) => {
    if (checked) setImportSelected(new Set(importPreview.map((_, i) => i)));
    else setImportSelected(new Set());
  };

  const toggleOne = (i) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const insertCustomerAndVehicles = async (item) => {
    const isFirma = !!(item.client.company_name || (item.client.ico && item.client.ico.trim().length > 3));
    const customerPayload = {
      full_name: item.client.full_name || item.client.company_name || null,
      company_name: item.client.company_name || null,
      phone: item.client.phone || null,
      email: item.client.email || null,
      address: item.client.address || null,
      city: item.client.city || null,
      zip: item.client.zip || null,
      ico: item.client.ico || null,
      dic: item.client.dic || null,
      ic_dph: item.client.ic_dph || null,
      client_type: isFirma ? 'Firma' : 'Osoba',
    };

    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert([customerPayload])
      .select('id')
      .single();

    if (customerError) throw customerError;

    let vehicleCount = 0;
    const vehicleErrors = [];
    for (const v of item.vehicles) {
      let brand_model = '';
      let vin_number = '';
      try {
        const res = await fetch(`/api/vehicle-lookup?ecv=${encodeURIComponent(v.license_plate)}`);
        const json = await res.json();
        if (json?.vehicle) {
          brand_model = [json.vehicle.znacka, json.vehicle.obch_nazov].filter(Boolean).join(' ');
          vin_number = json.vehicle.vin || '';
        }
      } catch (_) {}

      const { error: vErr } = await supabase.from('vehicles').insert([{
        license_plate: v.license_plate,
        brand_model: brand_model || null,
        vin_number: vin_number || null,
        owner_name: item.displayName,
        owner_email: item.client.email || null,
        owner_phone: item.client.phone || null,
        delete_requested: false,
      }]);
      if (vErr && vErr.code !== '23505') vehicleErrors.push(`${v.license_plate}: ${vErr.message}`);
      else vehicleCount++;
    }
    if (vehicleErrors.length) throw Object.assign(new Error(vehicleErrors.join('; ')), { _isVehicleError: true, _vehicleErrors: vehicleErrors, _vehicleCount: vehicleCount, _customerId: customerData.id });
    return { vehicleCount, customerId: customerData.id };
  };

  const doImport = async () => {
    setImportLoading(true);
    const toImport = importPreview.filter((_, i) => importSelected.has(i));
    let successCount = 0, vehicleCount = 0, skipCount = 0;
    const errors = [];
    const failedItems = [];
    const batchCustomerIds = [];

    for (const item of toImport) {
      try {
        const { vehicleCount: vCount, customerId } = await insertCustomerAndVehicles(item);
        vehicleCount += vCount;
        successCount++;
        if (customerId) batchCustomerIds.push(customerId);
      } catch (err) {
        if (err._isVehicleError) {
          vehicleCount += err._vehicleCount || 0;
          successCount++;
          if (err._customerId) batchCustomerIds.push(err._customerId);
          err._vehicleErrors.forEach(e => errors.push(`${item.displayName} – vozidlo: ${e}`));
        } else {
          errors.push(`${item.displayName}: ${err.message}`);
          failedItems.push({ item, reason: err.message });
          skipCount++;
        }
      }
    }

    if (batchCustomerIds.length > 0) {
      const batch = { id: crypto.randomUUID(), date: new Date().toISOString(), count: batchCustomerIds.length, customerIds: batchCustomerIds };
      const newHistory = [batch, ...importHistory].slice(0, 10);
      setImportHistory(newHistory);
      localStorage.setItem('importHistory', JSON.stringify(newHistory));
    }

    await fetchKlienti();
    setImportRetryQueue(failedItems);
    setRetryIdx(0);
    setImportResult({ success: successCount, vehicles: vehicleCount, skip: skipCount, errors });
    setImportLoading(false);
    setImportStep(4);
  };

  const deleteImportBatch = async (batch) => {
    setDeletingBatch(batch.id);
    try {
      for (const cid of batch.customerIds) {
        const { data: cust } = await supabase.from('customers').select('full_name, phone, email').eq('id', cid).single();
        if (cust) {
          if (cust.email) await supabase.from('vehicles').delete().eq('owner_email', cust.email);
          if (cust.full_name) await supabase.from('vehicles').delete().eq('owner_name', cust.full_name);
        }
        await supabase.from('customers').delete().eq('id', cid);
      }
      const newHistory = importHistory.filter(b => b.id !== batch.id);
      setImportHistory(newHistory);
      localStorage.setItem('importHistory', JSON.stringify(newHistory));
      await fetchKlienti();
    } finally { setDeletingBatch(null); }
  };

  const openRetryModal = (idx) => {
    const { item } = importRetryQueue[idx];
    setRetryForm({
      full_name: item.client.full_name || '',
      company_name: item.client.company_name || '',
      phone: item.client.phone || '',
      email: item.client.email || '',
      address: item.client.address || '',
      city: item.client.city || '',
      zip: item.client.zip || '',
      ico: item.client.ico || '',
      dic: item.client.dic || '',
      ic_dph: item.client.ic_dph || '',
      client_type: item.client.company_name ? 'Firma' : 'Osoba',
      _vehicles: item.vehicles,
      _displayName: item.displayName,
    });
    setRetryIdx(idx);
    setIsRetryOpen(true);
  };

  const handleRetrySave = async () => {
    setRetrySaving(true);
    try {
      const isFirma = retryForm.client_type === 'Firma' || !!retryForm.company_name;
      const customerPayload = {
        full_name: retryForm.full_name || retryForm.company_name || null,
        company_name: retryForm.company_name || null,
        phone: retryForm.phone || null,
        email: retryForm.email || null,
        address: retryForm.address || null,
        city: retryForm.city || null,
        zip: retryForm.zip || null,
        ico: retryForm.ico || null,
        dic: retryForm.dic || null,
        ic_dph: retryForm.ic_dph || null,
        client_type: isFirma ? 'Firma' : 'Osoba',
      };
      const { data: customerData, error } = await supabase.from('customers').insert([customerPayload]).select('id').single();
      if (error) throw error;

      const ownerName = retryForm.company_name || retryForm.full_name || retryForm._displayName;
      for (const v of (retryForm._vehicles || [])) {
        await supabase.from('vehicles').insert([{
          license_plate: v.license_plate,
          owner_name: ownerName,
          owner_email: retryForm.email || null,
          delete_requested: false,
        }]);
      }

      const newQueue = importRetryQueue.filter((_, i) => i !== retryIdx);
      setImportRetryQueue(newQueue);
      setImportResult(prev => ({ ...prev, success: prev.success + 1, skip: prev.skip - 1 }));
      await fetchKlienti();

      if (newQueue.length > 0) {
        const nextIdx = Math.min(retryIdx, newQueue.length - 1);
        openRetryModal(nextIdx);
      } else {
        setIsRetryOpen(false);
      }
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setRetrySaving(false);
    }
  };

  const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const stripDia = s => s ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  const filteredKlienti = klienti.filter(k => {
    const s = nd(searchTerm);
    return nd(k.customer_name).includes(s) || nd(k.db_full_name).includes(s) || (k.all_plates || []).some(p => nd(p).includes(s));
  });

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white select-none font-bold">
      {/* HEADER */}
      <header className="mb-12 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Garáž <span className="text-red-600 text-4xl">Dielne</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic uppercase">Správa Partnerov</p>
        </div>
        <div className="flex gap-4">
          <button onClick={openImport} className="bg-zinc-900 text-zinc-400 font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase hover:text-white transition-all border border-zinc-800">Import CSV</button>
          {importHistory.length > 0 && <button onClick={() => setIsHistoryOpen(true)} className="bg-zinc-900 text-zinc-600 font-black px-4 py-3.5 rounded-2xl text-[10px] uppercase hover:text-yellow-500 transition-all border border-zinc-800">História ({importHistory.length})</button>}
          <button onClick={() => {
            const dataToExport = klienti.map(k => ({
              Meno: k.customer_name,
              Typ: k.client_type || '',
              Firma: k.company_name || '',
              ICO: k.ico || '',
              DIC: k.dic || '',
              IC_DPH: k.ic_dph || '',
              Telefon: k.customer_phone || '',
              Email: k.customer_email || '',
              Ulica: k.address || '',
              Mesto: k.city || '',
              PSC: k.zip || '',
              Vozidla: (k.all_plates || []).join(', '),
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Klienti");
            XLSX.writeFile(wb, "Partneri_Dielne.xlsx");
          }} className="bg-zinc-900 text-zinc-400 font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase hover:text-white transition-all border border-zinc-800">Export XLSX</button>
          <button onClick={async () => {
            setLoading(true);
            try {
              const [custRes, vehRes, tickRes, itemRes, taskRes, invRes] = await Promise.all([
                supabase.from('customers').select('*'),
                supabase.from('vehicles').select('*'),
                supabase.from('job_tickets').select('*'),
                supabase.from('job_items').select('id, job_id, name, quantity, unit, unit_price, type'),
                supabase.from('job_tasks').select('id, job_id, task_description, is_completed'),
                supabase.from('invoices').select('*'),
              ]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((custRes.data || []).map(c => ({
                _id: c.id, Meno: c.name || '', Firma: c.company_name || '', Typ: c.client_type || 'Osoba',
                Telefon: c.phone || '', Email: c.email || '', Ulica: c.address || '', Mesto: c.city || '',
                PSC: c.zip || '', ICO: c.ico || '', DIC: c.dic || '', IC_DPH: c.ic_dph || '',
              }))), 'Klienti');
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((vehRes.data || []).map(v => ({
                _id: v.id, _owner_id: v.owner_id || '', SPZ: v.license_plate || '', Znacka_model: v.brand_model || '',
                VIN: v.vin_number || '', Objem: v.engine_volume || '', Vykon: v.engine_power || '',
                Rok: v.year_produced || '', Palivo: v.fuel_type || '', Km: v.mileage || '',
                Vlastnik: v.owner_name || '', Email_vlastnika: v.owner_email || '',
              }))), 'Vozidla');
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((tickRes.data || []).map(t => ({
                _id: t.id, _customer_id: t.customer_id || '', Cislo: t.job_number || '',
                Klient: t.customer_name || '', SPZ: t.plate_number || '', Auto: t.car_brand_model || '',
                VIN: t.vin_number || '', Km: t.mileage || '', Palivo: t.fuel_type || '', Status: t.status || '',
                Telefon: t.customer_phone || '', Email: t.customer_email || '', Ulica: t.address || '',
                Mesto: t.city || '', PSC: t.zip || '', Typ_klienta: t.client_type || '',
                Firma: t.company_name || '', ICO: t.ico || '', DIC: t.dic || '', IC_DPH: t.ic_dph || '',
                Objem_motora: t.engine_volume || '', Vykon: t.engine_power || '', Rok: t.year_produced || '',
                Technik: t.technician_name || '', Datum: t.created_at || '',
              }))), 'Zakazky');
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((itemRes.data || []).map(i => ({
                _job_id: i.job_id, Nazov: i.name || '', Mnozstvo: i.quantity || 0,
                Jednotka: i.unit || '', Cena_j: i.unit_price || 0, Typ: i.type || '',
              }))), 'Polozky');
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((taskRes.data || []).map(t => ({
                _job_id: t.job_id, Popis: t.task_description || '', Hotovo: t.is_completed ? 'true' : 'false',
              }))), 'Ukony');
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((invRes.data || []).map(inv => ({
                _id: inv.id, _job_id: inv.job_id || '', Cislo: inv.invoice_number || '',
                Klient: inv.customer_name || '', Email_k: inv.customer_email || '', Tel_k: inv.customer_phone || '',
                Celkom: inv.total_amount || 0, Subtotal: inv.subtotal_amount || 0, Dan: inv.tax_amount || 0,
                Je_oficielna: inv.is_official ? 'true' : 'false', Datum: inv.created_at || '',
                items_json: JSON.stringify(inv.items_json || []),
                supplier_details: JSON.stringify(inv.supplier_details || {}),
                company_details: JSON.stringify(inv.company_details || {}),
                payment_info: JSON.stringify(inv.payment_info || {}),
                car_details: JSON.stringify(inv.car_details || {}),
              }))), 'Faktury');
              XLSX.writeFile(wb, 'Servisco_migracia.xlsx');
            } catch (err) { alert('Chyba pri exporte: ' + err.message); }
            finally { setLoading(false); }
          }} className="bg-zinc-900 text-amber-500 font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase hover:text-white transition-all border border-amber-800">Export migrácia</button>
          <button onClick={() => { setEditMode(false); setClientForm({customer_name:'', customer_phone:'', customer_email:'', client_type:'Osoba', address:'', city:'', zip:'', ico:'', dic:'', ic_dph:'', company_name: '', password: ''}); setIsClientModalOpen(true); }} className="bg-white text-black font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-xl font-bold">+ Nový Partner</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ZOZNAM KLIENTOV */}
        <div className="lg:col-span-1">
          <input type="text" placeholder="Hľadať partnera / ŠPZ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 mb-6 shadow-inner" />
          <div className="space-y-3 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {filteredKlienti.map((k, i) => (
              <div key={i} className="relative group">
                <button onClick={() => nacitajVozidla(k)} className={`w-full text-left p-6 rounded-3xl border transition-all relative font-bold ${selectedKlient === k.customer_name ? 'bg-red-600 border-red-600 shadow-2xl' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'}`}>
                  <p className="text-2xl font-black uppercase tracking-tight italic">{k.customer_name}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {k.all_plates?.length > 0 ? k.all_plates.map(p => (
                        <span key={p} className="text-[10px] bg-black/40 px-2.5 py-1 rounded-lg text-zinc-300 font-mono border border-zinc-800 uppercase tracking-widest">{p}</span>
                    )) : <span className="text-[10px] text-zinc-600 italic uppercase">Bez vozidla</span>}
                  </div>
                </button>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 font-bold">
                  <span onClick={(e) => { e.stopPropagation(); openEditClientModal(k); }} className="bg-black/50 p-3 rounded-xl text-xs hover:bg-white hover:text-black transition-all border border-zinc-800 cursor-pointer">✏️</span>
                  <span onClick={(e) => { e.stopPropagation(); handleDeleteKlient(k); }} className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${confirmDeleteName === k.customer_name ? 'bg-white text-red-600 border-white' : 'bg-black/50 text-zinc-600 border-zinc-800 hover:text-red-500'}`}>{confirmDeleteName === k.customer_name ? 'ZMAZAŤ?' : '🗑️'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KARTA KLIENTA */}
        <div className="lg:col-span-2">
          {selectedKlient ? (
            <div className="space-y-10 animate-in fade-in duration-500 font-bold">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-none font-bold">Karta: <span className="text-red-600">{selectedKlient}</span></h2>
                <button onClick={() => { setEditMode(false); setCarForm({id:'', plate_number: '', brand: '', model: '', vin_number: '', engine_volume: '', engine_power: '', year_produced: '', fuel_type: 'Diesel', mileage: '' }); setIsCarModalOpen(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase border border-zinc-700 shadow-lg">+ Pridať Vozidlo</button>
              </div>
              <div className="space-y-16">
                {vozidla.map((v) => (
                  <div key={v.id} className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[3.5rem] relative shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div>
                          <div className="flex items-center gap-3 mb-6">
                            <span className="bg-white text-black px-5 py-2 rounded-xl font-black text-2xl tracking-widest shadow-2xl uppercase">{v.plate_number}</span>
                            <button onClick={() => openEditCarModal(v)} className="bg-zinc-800 hover:bg-white border border-zinc-700 text-white hover:text-black p-2.5 rounded-xl transition-all text-xs font-bold">✏️</button>
                            <button onClick={() => handleDeleteCar(v)} className="bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white p-2.5 rounded-xl transition-all text-xs font-bold">🗑️</button>
                          </div>
                          <h3 className="text-3xl font-black uppercase italic mb-4">{v.car_brand_model}</h3>
                          <div className="space-y-2 bg-black/40 p-5 rounded-2xl border border-zinc-800 text-[11px] font-black uppercase tracking-widest text-zinc-400 italic">
                             <p className="flex justify-between border-b border-zinc-800 pb-2"><span>VIN:</span> <span className="text-white font-mono">{v.vin_number || '---'}</span></p>
                             <p className="flex justify-between border-b border-zinc-800 py-2"><span>Motor:</span> <span className="text-white">{v.engine_volume} ccm / {v.engine_power} kW</span></p>
                             <p className="flex justify-between pt-2"><span>Km / Rok:</span> <span className="text-white">{v.mileage || 0} KM • {v.year_produced}</span></p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4 flex items-center gap-2 italic"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span> História návštev</h4>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar italic">
                             {v.full_history?.length > 0 ? v.full_history.map((h) => (
                                <Link href={`/zakazky/${h.id}`} key={h.id} className="block group">
                                   <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl hover:border-red-600 transition-all flex justify-between items-center">
                                      <div>
                                          <p className="text-[10px] font-black text-zinc-500 uppercase">{new Date(h.created_at).toLocaleDateString('sk-SK')}</p>
                                          <p className="text-xs font-bold text-white group-hover:text-red-500 transition-colors uppercase italic line-clamp-1">{h.status}</p>
                                      </div>
                                      <p className="text-[10px] font-black text-white">{h.total_price?.toFixed(2)} €</p>
                                   </div>
                                </Link>
                             )) : <p className="text-[10px] uppercase text-zinc-600 font-bold tracking-widest text-center py-4">Žiadna história návštev</p>}
                          </div>
                          <Link href={`/prijem?spz=${v.plate_number}&meno=${encodeURIComponent(selectedKlient)}`} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all shadow-lg mt-4 italic font-bold">📋 Nová zákazka</Link>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-900 opacity-40 uppercase font-black tracking-[0.5em] text-sm text-center px-10 italic">Vyberte partnera v ľavom menu</div>
          )}
        </div>
      </div>

      {/* MODAL VOZIDLA (S API A AI) */}
      {isCarModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] w-full max-w-4xl shadow-2xl my-auto font-bold">
            <h2 className="text-4xl font-black uppercase italic mb-8 text-white text-center tracking-tighter">Technické údaje</h2>
            
            {/* AI SKENER SEKCIA */}
            <div className="mb-8 p-6 border-2 border-dashed border-zinc-800 rounded-3xl text-center bg-black/30">
              <label className="cursor-pointer block">
                <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-red-600 transition-colors">
                  {apiLoading ? 'Spracovávam dokument...' : '📷 Odfotiť alebo nahrať Technický preukaz (AI)'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={apiLoading} />
              </label>
            </div>

            <form onSubmit={handleSaveCar} className="grid grid-cols-1 md:grid-cols-2 gap-6 italic">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest uppercase">ŠPZ Vozidla</label>
                <div className="flex gap-2">
                  <input required type="text" value={carForm.plate_number} onChange={(e) => setCarForm({...carForm, plate_number: e.target.value.toUpperCase()})} className="flex-grow bg-white border-none p-6 rounded-3xl text-black font-black text-4xl tracking-widest focus:ring-4 focus:ring-red-600 outline-none uppercase shadow-2xl" />
                  <button type="button" onClick={handleCarLookup} disabled={apiLoading} className="px-6 bg-red-600/10 border border-red-600 text-red-600 rounded-3xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">
                    {apiLoading ? '...' : 'Načítať ⚡'}
                  </button>
                </div>
              </div>
              
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Značka</label><input required type="text" value={carForm.brand} onChange={(e) => setCarForm({...carForm, brand: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" /></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Model</label><input required type="text" value={carForm.model} onChange={(e) => setCarForm({...carForm, model: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600" /></div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">VIN Číslo</label><input required type="text" maxLength={17} value={carForm.vin_number} onChange={(e) => setCarForm({...carForm, vin_number: e.target.value.toUpperCase()})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-mono font-bold outline-none focus:border-red-600 uppercase tracking-widest" /></div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-blue-500 uppercase mb-3 ml-2 block tracking-widest italic">Aktuálny stav tachometra (KM)</label><input type="number" value={carForm.mileage} onChange={(e) => setCarForm({...carForm, mileage: e.target.value})} className="w-full bg-black border border-blue-600/30 p-5 rounded-2xl text-white font-black text-2xl outline-none focus:border-blue-500" /></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Objem (cm³)</label><input type="text" value={carForm.engine_volume} onChange={(e) => setCarForm({...carForm, engine_volume: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Výkon (kW)</label><input type="text" value={carForm.engine_power} onChange={(e) => setCarForm({...carForm, engine_power: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Rok výroby</label><input type="number" value={carForm.year_produced} onChange={(e) => setCarForm({...carForm, year_produced: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600"/></div>
              <div><label className="text-[10px] font-black text-zinc-600 uppercase mb-3 ml-2 block tracking-widest">Palivo</label><select value={carForm.fuel_type} onChange={(e) => setCarForm({...carForm, fuel_type: e.target.value})} className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none appearance-none focus:border-red-600"><option value="Diesel">Diesel</option><option value="Benzín">Benzín</option><option value="Hybrid">Hybrid</option><option value="Elektro">Elektro</option></select></div>
              <div className="flex gap-5 pt-8 md:col-span-2">
                <button type="button" onClick={() => setIsCarModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">Zrušiť</button>
                <button type="submit" disabled={apiLoading} className="flex-[2] bg-red-600 text-white font-black py-6 rounded-3xl uppercase text-xs tracking-widest hover:bg-red-500 transition-all shadow-xl">Uložiť technické zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] w-full max-w-4xl shadow-2xl my-auto overflow-hidden">

            {/* HEADER */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Import klientov</h2>
                <div className="flex gap-2 mt-2">
                  {[1,2,3,4].map(s => (
                    <div key={s} className={`h-1 w-8 rounded-full transition-all ${importStep >= s ? 'bg-red-600' : 'bg-zinc-800'}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white font-black transition-all">✕</button>
            </div>

            <div className="p-8">

              {/* KROK 1 — Výber systému */}
              {importStep === 1 && (
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">Z akého systému importujete?</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => { setImportSystem('azsoft'); setImportStep(2); }}
                      className="text-left p-6 bg-zinc-900 border-2 border-zinc-800 hover:border-red-600 rounded-2xl transition-all group"
                    >
                      <p className="text-xl font-black uppercase italic text-white group-hover:text-red-500 transition-colors">AZSoft</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Autoservisný systém · 2 CSV súbory</p>
                      <p className="text-[10px] text-zinc-600 mt-3 normal-case font-bold">Odberatelia (Klienty.csv) + Vozidlá (Vozidla.csv)</p>
                    </button>
                    <div className="p-6 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-2xl opacity-40">
                      <p className="text-xl font-black uppercase italic text-zinc-600">Iný systém</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 mt-1">Pripravujeme...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* KROK 2 — Nahrať súbory */}
              {importStep === 2 && importSystem === 'azsoft' && (
                <div className="space-y-6">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Nahrajte exportované súbory z AZSoft</p>

                  <div className="space-y-4">
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <label className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3 block">Klienty / Odberatelia <span className="text-zinc-600">(povinné)</span></label>
                      <p className="text-[10px] text-zinc-600 font-bold mb-3 normal-case">V AZSoft: Číselníky → Odberatelia → Export → CSV (oddeľovač ;)</p>
                      <input
                        ref={klientyFileRef}
                        type="file"
                        accept=".csv,.txt"
                        className="w-full text-zinc-400 text-[11px] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-red-600 file:text-white file:font-black file:text-[10px] file:uppercase hover:file:bg-red-500 transition-all"
                      />
                    </div>

                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 block">Vozidlá <span className="text-zinc-600">(voliteľné)</span></label>
                      <p className="text-[10px] text-zinc-600 font-bold mb-3 normal-case">V AZSoft: Zákazky → Vozidlá → Export → CSV (oddeľovač ;)</p>
                      <input
                        ref={vozidlaFileRef}
                        type="file"
                        accept=".csv,.txt"
                        className="w-full text-zinc-400 text-[11px] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-zinc-700 file:text-white file:font-black file:text-[10px] file:uppercase hover:file:bg-zinc-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button onClick={() => setImportStep(1)} className="flex-1 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">← Späť</button>
                    <button onClick={parseAzsoftCSV} className="flex-[2] bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg">Načítať a zobraziť náhľad →</button>
                  </div>
                </div>
              )}

              {/* KROK 3 — Preview */}
              {importStep === 3 && (() => {
                const ndI = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                const dateFrom = importDateFrom ? new Date(importDateFrom) : null;
                const filtered = importPreview.map((item, i) => ({ item, i })).filter(({ item }) => {
                  const searchOk = !importSearch || ndI(item.displayName).includes(ndI(importSearch)) || ndI(item.client.phone || '').includes(ndI(importSearch)) || ndI(item.client.email || '').includes(ndI(importSearch));
                  const dateOk = !dateFrom || (item.lastActivity && item.lastActivity >= dateFrom);
                  return searchOk && dateOk;
                });
                return (
                <div>
                  <div className="flex gap-3 mb-4">
                    <input type="text" placeholder="Hľadať meno, telefón, email..." value={importSearch} onChange={e => setImportSearch(e.target.value)} className="flex-1 bg-black border border-zinc-800 px-4 py-2.5 rounded-2xl text-white text-[11px] font-bold outline-none focus:border-red-600"/>
                    <div className="flex items-center gap-2 bg-black border border-zinc-800 px-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 font-black uppercase whitespace-nowrap">Aktivita od</span>
                      <input type="date" value={importDateFrom} onChange={e => setImportDateFrom(e.target.value)} className="bg-transparent text-white text-[11px] font-bold outline-none py-2"/>
                      {importDateFrom && <button onClick={() => setImportDateFrom('')} className="text-zinc-600 hover:text-white text-xs ml-1">✕</button>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-white">{filtered.length}</span> / {importPreview.length} klientov
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setImportSelected(new Set(filtered.map(({ i }) => i)))} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">Vybrať zobrazených</button>
                      <span className="text-zinc-700">|</span>
                      <button onClick={() => toggleAll(true)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Všetko</button>
                      <span className="text-zinc-700">|</span>
                      <button onClick={() => toggleAll(false)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Zrušiť</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                    {filtered.map(({ item, i }) => (
                      <div key={i} onClick={() => toggleOne(i)} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${importSelected.has(i) ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-900/30 border-zinc-900 opacity-50'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${importSelected.has(i) ? 'bg-red-600 border-red-600' : 'border-zinc-700'}`}>
                          {importSelected.has(i) && <span className="text-white text-[10px] font-black">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black uppercase italic text-white text-sm truncate">{item.displayName}</p>
                            {item.isDuplicate && <span className="text-[8px] bg-yellow-600/20 border border-yellow-600/40 text-yellow-500 font-black uppercase px-2 py-0.5 rounded-full shrink-0">Existuje ({item.dupReason})</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                            {[item.client.phone, item.client.email, item.client.city].filter(Boolean).join(' · ')}
                            {item.lastActivity && <span className="ml-2 text-zinc-600">· posl. {item.lastActivity.toLocaleDateString('sk-SK')}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {item.vehicles.length > 0 && (
                            <div className="flex gap-1 flex-wrap justify-end">
                              {item.vehicles.map((v, vi) => (
                                <span key={vi} className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg uppercase ${v._isDupPlate ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-600/30' : 'bg-black text-zinc-400 border border-zinc-800'}`}>{v.license_plate}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-zinc-900 mt-4">
                    <button onClick={() => setImportStep(2)} className="flex-1 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">← Späť</button>
                    <button onClick={doImport} disabled={importSelected.size === 0 || importLoading} className="flex-[2] bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg">
                      {importLoading ? 'Importujem...' : `Importovať ${importSelected.size} klientov →`}
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* KROK 4 — Výsledok */}
              {importStep === 4 && importResult && (
                <div className="py-6">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 border-2 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult.success > 0 ? 'bg-red-600/10 border-red-600/30' : 'bg-yellow-600/10 border-yellow-600/30'}`}>
                      <span className="text-2xl">{importResult.success > 0 ? '✓' : '⚠'}</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic text-white">Import dokončený</h3>
                  </div>
                  <div className="flex gap-4 justify-center mb-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 text-center">
                      <p className="text-2xl font-black text-white">{importResult.success}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Klientov</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 text-center">
                      <p className="text-2xl font-black text-white">{importResult.vehicles}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Vozidiel</p>
                    </div>
                    {importResult.skip > 0 && (
                      <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-2xl px-5 py-3 text-center">
                        <p className="text-2xl font-black text-yellow-500">{importResult.skip}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600 mt-1">Chýb</p>
                      </div>
                    )}
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="bg-red-600/5 border border-red-600/20 rounded-2xl p-4 mb-6 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">Chybové hlásenia</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-[11px] text-red-400 font-bold mb-1 break-all">{e}</p>
                      ))}
                    </div>
                  )}
                  {importRetryQueue.length > 0 && (
                    <button onClick={() => openRetryModal(0)} className="w-full mb-3 bg-yellow-600/20 border border-yellow-600/40 text-yellow-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-yellow-600/30 transition-all">
                      Doplniť chýbajúce ({importRetryQueue.length})
                    </button>
                  )}
                  <div className="flex gap-4">
                    <button onClick={() => setImportStep(2)} className="flex-1 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">← Skúsiť znova</button>
                    <button onClick={() => setIsImportOpen(false)} className="flex-[2] bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl">Zavrieť</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* RETRY MODAL — chybní klienti z importu */}
      {isRetryOpen && importRetryQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Doplniť údaje</p>
                <h2 className="text-2xl font-black uppercase italic text-white">{retryForm._displayName}</h2>
              </div>
              <span className="text-[10px] text-zinc-500 font-black">{retryIdx + 1} / {importRetryQueue.length}</span>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Celé meno / Firma" value={retryForm.full_name} onChange={e => setRetryForm(p => ({...p, full_name: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500"/>
              <input type="tel" placeholder="Telefón" value={retryForm.phone} onChange={e => setRetryForm(p => ({...p, phone: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500"/>
              <input type="email" placeholder="Email" value={retryForm.email} onChange={e => setRetryForm(p => ({...p, email: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500"/>
              <input type="text" placeholder="Adresa" value={retryForm.address} onChange={e => setRetryForm(p => ({...p, address: e.target.value}))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500"/>
              {retryForm._vehicles?.length > 0 && (
                <div className="bg-black/40 border border-zinc-800 rounded-2xl p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Vozidlá</p>
                  <div className="flex flex-wrap gap-2">{retryForm._vehicles.map((v, i) => <span key={i} className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded-lg text-white">{v.license_plate}</span>)}</div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => {
                const newQueue = importRetryQueue.filter((_, i) => i !== retryIdx);
                setImportRetryQueue(newQueue);
                if (newQueue.length > 0) openRetryModal(Math.min(retryIdx, newQueue.length - 1));
                else setIsRetryOpen(false);
              }} className="flex-1 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Preskočiť</button>
              <button onClick={handleRetrySave} disabled={retrySaving} className="flex-[2] bg-yellow-600 text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-xl disabled:opacity-50">
                {retrySaving ? 'Ukladám...' : 'Uložiť a pokračovať'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTÓRIA IMPORTOV */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase italic text-white">História importov</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-zinc-500 hover:text-white text-2xl">×</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {importHistory.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between bg-black/40 border border-zinc-800 rounded-2xl p-4">
                  <div>
                    <p className="text-white font-black text-sm">{new Date(batch.date).toLocaleString('sk-SK')}</p>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{batch.count} klientov</p>
                  </div>
                  <button
                    onClick={() => deleteImportBatch(batch)}
                    disabled={deletingBatch === batch.id}
                    className="bg-red-600/10 border border-red-600/30 text-red-500 font-black px-4 py-2 rounded-xl text-[10px] uppercase hover:bg-red-600/20 transition-all disabled:opacity-40"
                  >
                    {deletingBatch === batch.id ? 'Mazám...' : 'Vymazať import'}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-4 text-center">Vymazaním sa odstránia klienti a ich vozidlá z tohto importu</p>
          </div>
        </div>
      )}

      {/* MODAL KLIENT */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-4xl shadow-2xl my-auto">
            <h2 className="text-4xl font-black uppercase italic mb-10 text-white text-center tracking-tighter">{editMode ? 'Úprava Partnera' : 'Nový Partner'}</h2>
            <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold">
              <div className="space-y-6">
                <div className="flex bg-black p-1 rounded-2xl border border-zinc-800 font-bold">
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Osoba'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Osoba' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Osoba</button>
                  <button type="button" onClick={() => setClientForm({...clientForm, client_type: 'Firma'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientForm.client_type === 'Firma' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>Firma</button>
                </div>
                <input required type="text" value={clientForm.customer_name} onChange={(e) => setClientForm({...clientForm, customer_name: e.target.value})} placeholder="Meno partnera" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input type="text" value={clientForm.customer_phone} onChange={(e) => setClientForm({...clientForm, customer_phone: e.target.value})} placeholder="Telefón" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <input required type="email" value={clientForm.customer_email} onChange={(e) => setClientForm({...clientForm, customer_email: e.target.value})} placeholder="E-mail" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                {!editMode && (
                  <div className="bg-red-600/5 p-4 rounded-2xl border border-red-600/20">
                    <label className="text-[10px] font-black text-red-600 uppercase mb-2 ml-2 block tracking-widest italic font-bold">Heslo do Garáže</label>
                    <input required type="text" value={clientForm.password} onChange={(e) => setClientForm({...clientForm, password: e.target.value})} placeholder="Zadajte heslo" className="w-full bg-black border border-red-600/30 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-xl"/>
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <input type="text" value={clientForm.address} onChange={(e) => setClientForm({...clientForm, address: e.target.value})} placeholder="Ulica a č." className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                <div className="grid grid-cols-2 gap-4 font-bold">
                  <input type="text" value={clientForm.zip} onChange={(e) => setClientForm({...clientForm, zip: e.target.value})} placeholder="PSČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                  <input type="text" value={clientForm.city} onChange={(e) => setClientForm({...clientForm, city: e.target.value})} placeholder="Mesto" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                </div>
                {clientForm.client_type === 'Firma' && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-300 font-bold">
                    <input type="text" value={clientForm.company_name} onChange={(e) => setClientForm({...clientForm, company_name: e.target.value})} placeholder="Obchodné meno" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <input type="text" value={clientForm.ico} onChange={(e) => setClientForm({...clientForm, ico: e.target.value})} placeholder="IČO" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    <div className="grid grid-cols-2 gap-4">
                       <input type="text" value={clientForm.dic} onChange={(e) => setClientForm({...clientForm, dic: e.target.value})} placeholder="DIČ" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                       <input type="text" value={clientForm.ic_dph} onChange={(e) => setClientForm({...clientForm, ic_dph: e.target.value})} placeholder="IČ DPH" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 shadow-inner"/>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex gap-5 pt-6">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 text-zinc-600 font-black uppercase text-xs tracking-widest hover:text-white transition-all">Zrušiť</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-white text-black font-black py-6 rounded-3xl uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-2xl"> {loading ? 'Spracovávam...' : (editMode ? 'Uložiť zmeny' : 'Registrovať Partnera')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}