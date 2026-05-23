'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function ImportExportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  // Import CSV state
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
  const [retryForm, setRetryForm] = useState({ full_name: '', company_name: '', phone: '', email: '', address: '', city: '', zip: '', ico: '', dic: '', ic_dph: '', client_type: 'Osoba', _vehicles: [], _displayName: '' });
  const [retrySaving, setRetrySaving] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importDateFrom, setImportDateFrom] = useState('');
  const [importHistory, setImportHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('importHistory') || '[]'); } catch { return []; } });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(null);
  const klientyFileRef = useRef(null);
  const vozidlaFileRef = useRef(null);

  // --- EXPORT TABUĽKY (DataCard) ---
  const exportTable = async (tableName, fileName) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableName);
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setStatus({ type: 'success', msg: `Export ${tableName} prebehol úspešne.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- IMPORT TABUĽKY (DataCard) ---
  const handleImport = async (e, tableName, onConflictField) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const { error } = await supabase.from(tableName).upsert(data, { onConflict: onConflictField });
        if (error) throw error;
        setStatus({ type: 'success', msg: `Úspešne naimportovaných ${data.length} záznamov do ${tableName}.` });
      } catch (err) {
        setStatus({ type: 'error', msg: `Chyba pri importe: ${err.message}` });
      } finally {
        setLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- EXPORT PARTNERI (.xlsx) ---
  const exportPartneri = async () => {
    setLoading(true);
    try {
      const [{ data: customersData }, { data: vehiclesData }] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('vehicles').select('license_plate, owner_email, owner_name'),
      ]);
      const platesByEmail = {};
      const platesByName = {};
      (vehiclesData || []).forEach(v => {
        if (v.owner_email) {
          if (!platesByEmail[v.owner_email]) platesByEmail[v.owner_email] = [];
          platesByEmail[v.owner_email].push(v.license_plate);
        }
        if (v.owner_name) {
          if (!platesByName[v.owner_name]) platesByName[v.owner_name] = [];
          platesByName[v.owner_name].push(v.license_plate);
        }
      });
      const dataToExport = (customersData || []).map(c => {
        const name = c.company_name || c.full_name || '';
        const plates = platesByEmail[c.email] || platesByName[name] || [];
        return {
          Meno: name,
          Typ: c.client_type || 'Osoba',
          Firma: c.company_name || '',
          ICO: c.ico || '',
          DIC: c.dic || '',
          IC_DPH: c.ic_dph || '',
          Telefon: c.phone || '',
          Email: c.email || '',
          Ulica: c.address || '',
          Mesto: c.city || '',
          PSC: c.zip || '',
          Vozidla: [...new Set(plates)].join(', '),
        };
      });
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Klienti');
      XLSX.writeFile(wb, 'Partneri_Dielne.xlsx');
      setStatus({ type: 'success', msg: 'Export Partneri prebehol úspešne.' });
    } catch (err) {
      setStatus({ type: 'error', msg: 'Chyba pri exporte: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- EXPORT MIGRÁCIA (všetky tabuľky) ---
  const exportMigracia = async () => {
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
        _id: c.id, Meno: c.full_name || '', Firma: c.company_name || '', Typ: c.client_type || 'Osoba',
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
      setStatus({ type: 'success', msg: 'Export migrácie prebehol úspešne.' });
    } catch (err) {
      setStatus({ type: 'error', msg: 'Chyba pri exporte: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- IMPORT CSV (AZSoft) ---
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
        resolve(Papa.parse(text, { header: true, delimiter: ';', skipEmptyLines: true }).data);
      };
      reader.readAsArrayBuffer(file);
    });

    const [klientyRows, vozidlaRows, [{ data: customersData }, { data: webProfiles }, { data: vehiclesData }]] = await Promise.all([
      parseFile(klientyFile),
      vozidlaFile ? parseFile(vozidlaFile) : Promise.resolve([]),
      Promise.all([
        supabase.from('customers').select('full_name, company_name, phone, email'),
        supabase.from('user_profiles').select('full_name, company_name, email, phone').or('role.eq.zakaznik,role.eq.klient'),
        supabase.from('vehicles').select('license_plate'),
      ]),
    ]);

    if (!klientyRows.length) { alert('Súbor Klienty je prázdny alebo sa nepodarilo načítať.'); return; }
    const missingCols = ['ID', 'MENO1', 'ULICA', 'MESTO'].filter(c => !(c in klientyRows[0]));
    if (missingCols.length > 0) {
      alert(`Súbor Klienty nemá správnu štruktúru.\nChýbajú stĺpce: ${missingCols.join(', ')}\nSkontrolujte, či je nastavený oddeľovač ";" (bodkočiarka) pri exporte z AZSoft.`);
      return;
    }

    const existingEmails = new Set([
      ...(customersData || []).map(c => c.email).filter(Boolean).map(e => e.toLowerCase()),
      ...(webProfiles || []).map(p => p.email).filter(Boolean).map(e => e.toLowerCase()),
    ]);
    const existingPhones = new Set([
      ...(customersData || []).map(c => c.phone).filter(Boolean),
      ...(webProfiles || []).map(p => p.phone).filter(Boolean),
    ]);
    const existingNames = new Set([
      ...(customersData || []).flatMap(c => [c.full_name, c.company_name].filter(Boolean).map(n => n.toLowerCase())),
      ...(webProfiles || []).flatMap(p => [p.full_name, p.company_name].filter(Boolean).map(n => n.toLowerCase())),
    ]);
    const existingPlates = new Set((vehiclesData || []).map(v => v.license_plate).filter(Boolean));

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
        phone, email,
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
      const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      return null;
    };

    (vozidlaRows || []).forEach(row => {
      const owner = clientMap[row.ID_ODBER];
      if (!owner) return;
      const spz = row.SPZ?.trim().toUpperCase().replace(/\s/g, '');
      if (!spz) return;
      const casOprava = parseAzsoftDate(row.CAS_OPRAVA);
      if (casOprava && (!owner.lastActivity || casOprava > owner.lastActivity)) owner.lastActivity = casOprava;
      owner.vehicles.push({ license_plate: spz, _isDupPlate: existingPlates.has(spz) });
    });

    const preview = Object.values(clientMap).filter(p => p.client.full_name || p.client.company_name);
    setImportPreview(preview);
    setImportSelected(new Set(preview.map((_, i) => i).filter(i => !preview[i].isDuplicate)));
    setImportStep(3);
  };

  const toggleAll = (checked) => {
    if (checked) setImportSelected(new Set(importPreview.map((_, i) => i)));
    else setImportSelected(new Set());
  };

  const toggleOne = (i) => {
    setImportSelected(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
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
    const { data: customerData, error: customerError } = await supabase.from('customers').insert([customerPayload]).select('id').single();
    if (customerError) throw customerError;

    let vehicleCount = 0;
    const vehicleErrors = [];
    for (const v of item.vehicles) {
      let brand_model = '', vin_number = '';
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
    const errors = [], failedItems = [], batchCustomerIds = [];

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
      const { error } = await supabase.from('customers').insert([customerPayload]);
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

  return (
    <div className="p-8 md:p-12 min-h-screen bg-black text-white font-bold">
      <div className="max-w-5xl mx-auto">

        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Dátové <span className="text-red-600">Centrum</span></h1>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-2 italic">Hromadný Import / Export systému AutoAlma</p>
          </div>
          <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black">← Späť</button>
        </header>

        {status.msg && (
          <div className={`mb-8 p-5 rounded-2xl border font-black uppercase text-[10px] tracking-widest ${status.type === 'success' ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-red-600/10 border-red-600 text-red-500'}`}>
            {status.type === 'success' ? '✅' : '❌'} {status.msg}
          </div>
        )}

        {/* SEKCIA 1: Systémový Export / Import */}
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-6">Systémový Export / Import</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DataCard
              title="Partneri / Klienti"
              desc="Profily a adresy (user_profiles)."
              onExport={() => exportTable('user_profiles', 'Export_Partneri')}
              onImport={(e) => handleImport(e, 'user_profiles', 'email')}
              loading={loading}
            />
            <DataCard
              title="Vozidlá"
              desc="Technické údaje a priradenia k majiteľom."
              onExport={() => exportTable('vehicles', 'Export_Vozidla')}
              onImport={(e) => handleImport(e, 'vehicles', 'license_plate')}
              loading={loading}
            />
            <DataCard
              title="Faktúry"
              desc="Archív vystavených dokladov (iba export)."
              onExport={() => exportTable('invoices', 'Export_Faktury')}
              onImport={null}
              loading={loading}
            />
          </div>
        </div>

        {/* SEKCIA 2: Partneri — Pokročilý Import / Export */}
        <div className="mt-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-6">Partneri — Pokročilý Import / Export</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={exportPartneri}
              disabled={loading}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 py-6 px-5 rounded-[2rem] text-left transition-all group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 group-hover:text-zinc-300">Export</p>
              <p className="text-sm font-black uppercase italic text-white">Partneri (.xlsx)</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">Klienti + vozidlá</p>
            </button>
            <button
              onClick={exportMigracia}
              disabled={loading}
              className="bg-zinc-900 border border-amber-800/40 hover:border-amber-600/60 py-6 px-5 rounded-[2rem] text-left transition-all group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2 group-hover:text-amber-500">Export</p>
              <p className="text-sm font-black uppercase italic text-amber-400">Migrácia</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">6 tabuliek (záloha)</p>
            </button>
            <button
              onClick={openImport}
              disabled={loading}
              className="bg-zinc-900 border border-red-800/40 hover:border-red-600/60 py-6 px-5 rounded-[2rem] text-left transition-all group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2 group-hover:text-red-500">Import</p>
              <p className="text-sm font-black uppercase italic text-white">CSV (AZSoft)</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">Klienti + vozidlá</p>
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              disabled={importHistory.length === 0}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 disabled:opacity-30 py-6 px-5 rounded-[2rem] text-left transition-all group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 group-hover:text-zinc-300">História</p>
              <p className="text-sm font-black uppercase italic text-white">Importy</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">{importHistory.length} záznamov</p>
            </button>
          </div>
        </div>

        <div className="mt-12 bg-zinc-900/30 border border-zinc-800 p-8 rounded-[3rem] italic">
          <h3 className="text-red-600 font-black uppercase text-[10px] tracking-widest mb-4">⚠️ Dôležité inštrukcie</h3>
          <ul className="text-[11px] text-zinc-500 space-y-2 uppercase font-black leading-relaxed">
            <li>• Pri systémovom importe musí byť v Exceli prvý riadok s presnými názvami stĺpcov ako v DB.</li>
            <li>• Import klientov prebieha podľa emailu (ak email existuje, údaje sa aktualizujú).</li>
            <li>• Import vozidiel prebieha podľa ŠPZ.</li>
            <li>• CSV import (AZSoft) — formát Klienty.csv + Vozidla.csv s oddeľovačom bodkočiarka (;).</li>
            <li>• Pred hromadným importom odporúčame spraviť Export migrácia (zálohu) aktuálneho stavu.</li>
          </ul>
        </div>
      </div>

      {/* MODAL IMPORT CSV */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-y-auto font-bold">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] w-full max-w-4xl shadow-2xl my-auto overflow-hidden">
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Import klientov</h2>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`h-1 w-8 rounded-full transition-all ${importStep >= s ? 'bg-red-600' : 'bg-zinc-800'}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white font-black transition-all">✕</button>
            </div>

            <div className="p-8">
              {importStep === 1 && (
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">Z akého systému importujete?</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => { setImportSystem('azsoft'); setImportStep(2); }} className="text-left p-6 bg-zinc-900 border-2 border-zinc-800 hover:border-red-600 rounded-2xl transition-all group">
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

              {importStep === 2 && importSystem === 'azsoft' && (
                <div className="space-y-6">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Nahrajte exportované súbory z AZSoft</p>
                  <div className="space-y-4">
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <label className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3 block">Klienty / Odberatelia <span className="text-zinc-600">(povinné)</span></label>
                      <p className="text-[10px] text-zinc-600 font-bold mb-3 normal-case">V AZSoft: Číselníky → Odberatelia → Export → CSV (oddeľovač ;)</p>
                      <input ref={klientyFileRef} type="file" accept=".csv,.txt" className="w-full text-zinc-400 text-[11px] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-red-600 file:text-white file:font-black file:text-[10px] file:uppercase hover:file:bg-red-500 transition-all" />
                    </div>
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 block">Vozidlá <span className="text-zinc-600">(voliteľné)</span></label>
                      <p className="text-[10px] text-zinc-600 font-bold mb-3 normal-case">V AZSoft: Zákazky → Vozidlá → Export → CSV (oddeľovač ;)</p>
                      <input ref={vozidlaFileRef} type="file" accept=".csv,.txt" className="w-full text-zinc-400 text-[11px] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-zinc-700 file:text-white file:font-black file:text-[10px] file:uppercase hover:file:bg-zinc-600 transition-all" />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button onClick={() => setImportStep(1)} className="flex-1 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">← Späť</button>
                    <button onClick={parseAzsoftCSV} className="flex-[2] bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg">Načítať a zobraziť náhľad →</button>
                  </div>
                </div>
              )}

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
                      <input type="text" placeholder="Hľadať meno, telefón, email..." value={importSearch} onChange={e => setImportSearch(e.target.value)} className="flex-1 bg-black border border-zinc-800 px-4 py-2.5 rounded-2xl text-white text-[11px] font-bold outline-none focus:border-red-600" />
                      <div className="flex items-center gap-2 bg-black border border-zinc-800 px-3 rounded-2xl">
                        <span className="text-[9px] text-zinc-500 font-black uppercase whitespace-nowrap">Aktivita od</span>
                        <input type="date" value={importDateFrom} onChange={e => setImportDateFrom(e.target.value)} className="bg-transparent text-white text-[11px] font-bold outline-none py-2" />
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

      {/* RETRY MODAL */}
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
              <input type="text" placeholder="Celé meno / Firma" value={retryForm.full_name} onChange={e => setRetryForm(p => ({ ...p, full_name: e.target.value }))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500" />
              <input type="tel" placeholder="Telefón" value={retryForm.phone} onChange={e => setRetryForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500" />
              <input type="email" placeholder="Email" value={retryForm.email} onChange={e => setRetryForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500" />
              <input type="text" placeholder="Adresa" value={retryForm.address} onChange={e => setRetryForm(p => ({ ...p, address: e.target.value }))} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-yellow-500" />
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
            {importHistory.length === 0 ? (
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest text-center py-8">Žiadne importy</p>
            ) : (
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
            )}
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-4 text-center">Vymazaním sa odstránia klienti a ich vozidlá z tohto importu</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DataCard({ title, desc, onExport, onImport, loading }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-white">{title}</h3>
        <p className="text-[10px] text-zinc-600 uppercase font-black leading-tight mb-8 tracking-widest">{desc}</p>
      </div>
      <div className="space-y-3">
        <button onClick={onExport} disabled={loading} className="w-full bg-zinc-800 hover:bg-white hover:text-black py-4 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest">
          Exportovať (.xlsx)
        </button>
        {onImport && (
          <label className="block">
            <input type="file" className="hidden" accept=".xlsx" onChange={onImport} disabled={loading} />
            <div className="w-full bg-red-600 hover:bg-red-500 text-center py-4 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest cursor-pointer shadow-lg shadow-red-900/20">
              Importovať (.xlsx)
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
