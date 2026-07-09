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

  // Stav importu CSV
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
  const kontaktyFileRef = useRef(null);

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

    const [klientyRows, vozidlaRows, [{ data: customersData }, { data: vehiclesData }]] = await Promise.all([
      parseFile(klientyFile),
      vozidlaFile ? parseFile(vozidlaFile) : Promise.resolve([]),
      Promise.all([
        supabase.from('customers').select('full_name, company_name, phone, email'),
        supabase.from('vehicles').select('license_plate'),
      ]),
    ]);
    const webProfiles = [];

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
      const spzRaw = row.SPZ_P?.trim() || row.SPZ?.trim() || '';
      const spz = spzRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
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
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/vehicle-lookup?ecv=${encodeURIComponent(v.license_plate)}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
        });
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
        owner_id: customerData.id,
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

  const [cleanupDate, setCleanupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const deleteByDate = async () => {
    if (!cleanupDate) return;
    const confirmed = window.confirm(`Naozaj vymazať VŠETKÝCH zákazníkov a ich vozidlá vytvorené od ${cleanupDate}?\n\nTáto akcia je nevratná.`);
    if (!confirmed) return;
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const fromTs = new Date(cleanupDate).toISOString();
      // Načítaj zákazníkov vytvorených od dátumu
      const { data: custsToDelete, error: fetchErr } = await supabase
        .from('customers')
        .select('id, email, full_name')
        .gte('created_at', fromTs);
      if (fetchErr) throw fetchErr;
      const ids = (custsToDelete || []).map(c => c.id);
      let deletedVCount = 0;
      if (ids.length > 0) {
        // Zmaž vozidlá cez owner_id (FK)
        const { data: dV1 } = await supabase.from('vehicles').delete().in('owner_id', ids).select('id');
        deletedVCount += dV1?.length ?? 0;
        // Zmaž aj osirotené vozidlá cez email/meno (import bez owner_id)
        const emails = (custsToDelete || []).map(c => c.email).filter(Boolean);
        const names = (custsToDelete || []).map(c => c.full_name).filter(Boolean);
        if (emails.length) {
          const { data: dV2 } = await supabase.from('vehicles').delete().in('owner_email', emails).select('id');
          deletedVCount += dV2?.length ?? 0;
        }
        if (names.length) {
          const { data: dV3 } = await supabase.from('vehicles').delete().in('owner_name', names).select('id');
          deletedVCount += dV3?.length ?? 0;
        }
        const { error: delErr } = await supabase.from('customers').delete().in('id', ids);
        if (delErr) throw delErr;
      }
      setCleanupResult({ deleted: ids.length, vehicles: deletedVCount });
    } catch (err) {
      setCleanupResult({ error: err.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  const deleteImportBatch = async (batch) => {
    setDeletingBatch(batch.id);
    try {
      for (const cid of batch.customerIds) {
        // Zmaž vozidlá cez owner_id (FK) — najspoľahlivejšie
        await supabase.from('vehicles').delete().eq('owner_id', cid);
        // Fallback: zmaž osirotené vozidlá cez email/meno
        const { data: cust } = await supabase.from('customers').select('full_name, email').eq('id', cid).single();
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
      const { data: newCustomer, error } = await supabase.from('customers').insert([customerPayload]).select('id').single();
      if (error) throw error;

      const ownerName = retryForm.company_name || retryForm.full_name || retryForm._displayName;
      for (const v of (retryForm._vehicles || [])) {
        await supabase.from('vehicles').insert([{
          license_plate: v.license_plate,
          owner_id: newCustomer.id,
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

  const downloadKontaktyTemplate = () => {
    const template = [
      { Meno: 'Ján Novák', Firma: '', Telefon: '0900 000 000', Email: 'jan.novak@email.sk', Adresa: 'Hlavná 1', Mesto: 'Bratislava', PSC: '811 01', ICO: '', DIC: '', IC_DPH: '', Typ: 'Osoba', SPZ: 'BA123AB', Znacka_model: 'Škoda Octavia 2.0 TDI', VIN: '', Rok: 2018, Palivo: 'Diesel', KM: 87000 },
      { Meno: 'Ján Novák', Firma: '', Telefon: '0900 000 000', Email: 'jan.novak@email.sk', Adresa: 'Hlavná 1', Mesto: 'Bratislava', PSC: '811 01', ICO: '', DIC: '', IC_DPH: '', Typ: 'Osoba', SPZ: 'BA456CD', Znacka_model: 'VW Golf 1.6 TDI', VIN: '', Rok: 2020, Palivo: 'Diesel', KM: 45000 },
      { Meno: '', Firma: 'ABC servis s.r.o.', Telefon: '0911 111 111', Email: 'info@abcservis.sk', Adresa: 'Priemyselná 5', Mesto: 'Košice', PSC: '040 01', ICO: '12345678', DIC: '2012345678', IC_DPH: 'SK2012345678', Typ: 'Firma', SPZ: 'KE789EF', Znacka_model: 'BMW 320d', VIN: 'WBA12345678901234', Rok: 2022, Palivo: 'Diesel', KM: 25000 },
      { Meno: 'Peter Horváth', Firma: '', Telefon: '0902 222 333', Email: 'peter@email.sk', Adresa: '', Mesto: 'Žilina', PSC: '010 01', ICO: '', DIC: '', IC_DPH: '', Typ: 'Osoba', SPZ: '', Znacka_model: '', VIN: '', Rok: '', Palivo: '', KM: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kontakty');
    XLSX.writeFile(wb, 'Vzor_import_kontaktov.xlsx');
  };

  const importKontakty = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = null;
    setLoading(true);
    setStatus({ type: '', msg: '' });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!data.length) throw new Error('Súbor je prázdny');

      // Načítaj existujúce záznamy z DB pre deduplikáciu
      const [{ data: existingCustomers }, { data: existingVehicles }] = await Promise.all([
        supabase.from('customers').select('email, phone, full_name, company_name'),
        supabase.from('vehicles').select('license_plate'),
      ]);
      const existingEmails = new Set((existingCustomers || []).map(c => c.email).filter(Boolean).map(e => e.toLowerCase()));
      const existingPhones = new Set((existingCustomers || []).map(c => c.phone).filter(Boolean).map(p => p.replace(/\s/g, '')));
      const existingNames = new Set((existingCustomers || []).flatMap(c => [c.full_name, c.company_name].filter(Boolean).map(n => n.toLowerCase())));
      const existingPlates = new Set((existingVehicles || []).map(v => v.license_plate).filter(Boolean));

      const custMap = {};
      data.forEach(r => {
        const email = (r.Email || r.email || '').toString().toLowerCase().trim();
        const phone = (r.Telefon || r.telefon || '').toString().replace(/\s/g, '');
        const name  = (r.Meno || r.meno || r.Firma || r.firma || '').toString().trim();
        const key   = email || phone || name || `_${Math.random()}`;
        if (!custMap[key]) {
          const isDuplicate = (email && existingEmails.has(email)) || (phone && existingPhones.has(phone)) || (name && existingNames.has(name.toLowerCase()));
          custMap[key] = {
            payload: {
              full_name: r.Meno || r.meno || null,
              company_name: r.Firma || r.firma || null,
              phone: phone || null,
              email: email || null,
              address: r.Adresa || r.adresa || null,
              city: r.Mesto || r.mesto || null,
              zip: r.PSC ? String(r.PSC) : null,
              ico: r.ICO ? String(r.ICO) : null,
              dic: r.DIC ? String(r.DIC) : null,
              ic_dph: r.IC_DPH ? String(r.IC_DPH) : null,
              client_type: (r.Typ || r.typ || '').toString().toLowerCase().includes('firm') ? 'Firma' : 'Osoba',
            },
            vehicles: [],
            displayName: name || email,
            email, phone,
            isDuplicate,
          };
        }
        const spz = (r.SPZ || r.spz || '').toString().trim().toUpperCase().replace(/\s/g, '');
        if (spz) {
          custMap[key].vehicles.push({
            license_plate: spz,
            brand_model: r.Znacka_model || r.znacka_model || null,
            vin_number: r.VIN || r.vin || null,
            year_produced: r.Rok ? parseInt(r.Rok) || null : null,
            fuel_type: r.Palivo || r.palivo || null,
            mileage: r.KM ? parseInt(r.KM) || null : null,
            _isDupPlate: existingPlates.has(spz),
          });
        }
      });

      const entries = Object.values(custMap).filter(c => c.payload.full_name || c.payload.company_name || c.payload.phone || c.payload.email);
      if (!entries.length) throw new Error('Žiadne platné záznamy — skontrolujte hlavičky stĺpcov');

      let custCount = 0, vehCount = 0, skipCust = 0, skipVeh = 0;
      for (const { payload, vehicles, displayName, email, isDuplicate } of entries) {
        if (isDuplicate) { skipCust++; continue; }
        const { data: newCust, error: cErr } = await supabase.from('customers').insert([payload]).select('id').single();
        if (cErr) throw new Error('Klienti: ' + cErr.message);
        custCount++;
        for (const v of vehicles) {
          if (v._isDupPlate) { skipVeh++; continue; }
          const { _isDupPlate, ...vData } = v;
          await supabase.from('vehicles').insert([{
            ...vData,
            owner_id: newCust.id,
            owner_name: displayName || null,
            owner_email: email || null,
          }]);
          vehCount++;
          existingPlates.add(v.license_plate);
        }
      }
      const skipMsg = (skipCust > 0 || skipVeh > 0) ? ` (preskočených: ${skipCust} klientov, ${skipVeh} vozidiel — duplikáty)` : '';
      setStatus({ type: 'success', msg: `Importovaných ${custCount} kontaktov${vehCount > 0 ? ` a ${vehCount} vozidiel` : ''}${skipMsg}.` });
    } catch (err) {
      setStatus({ type: 'error', msg: 'Chyba pri importe: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 md:p-12 min-h-screen bg-black text-white font-bold">
      <div className="max-w-5xl mx-auto">

        <header className="mb-12 flex justify-between items-center gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Dátové <span className="text-red-600">Centrum</span></h1>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-2 italic">Hromadný Import / Export systému AutoAlma</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsHistoryOpen(true)}
              disabled={importHistory.length === 0}
              className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 disabled:opacity-30 px-5 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black flex items-center gap-2"
            >
              📋 História importov
              {importHistory.length > 0 && <span className="bg-zinc-700 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded-lg font-black">{importHistory.length}</span>}
            </button>
            <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black">← Späť</button>
          </div>
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

        {/* SEKCIA 2: AutoAlma Export / záloha */}
        <div className="mt-10 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-1">AutoAlma</p>
              <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">Export zálohy systému</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wide mt-1">Kompletná záloha všetkých dát (6 tabuliek)</p>
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              disabled={importHistory.length === 0}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
            >
              História ({importHistory.length})
            </button>
          </div>
          <button
            onClick={exportMigracia}
            disabled={loading}
            className="bg-black/40 border border-amber-800/40 hover:border-amber-600/60 py-6 px-6 rounded-[1.5rem] text-left transition-all group w-full md:w-auto"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2 group-hover:text-amber-500">Export</p>
            <p className="text-base font-black uppercase italic text-amber-400">Záloha systému (.xlsx)</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">Klienti · Vozidlá · Zákazky · Položky · Úkony · Faktúry</p>
          </button>
        </div>

        {/* SEKCIA 3: Import z AZSoft */}
        <div className="mt-6 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-1">Import z iného systému</p>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">AZSoft</h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wide mt-1">Import klientov a vozidiel z AZSoft autoservisného systému</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <button
              onClick={openImport}
              disabled={loading}
              className="bg-black/40 border border-red-800/40 hover:border-red-600/60 py-6 px-6 rounded-[1.5rem] text-left transition-all group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2 group-hover:text-red-500">Import</p>
              <p className="text-base font-black uppercase italic text-white">CSV (AZSoft)</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">Odberatelia.csv + Vozidla.csv</p>
            </button>
            <div className="text-[10px] text-zinc-600 font-bold space-y-1.5">
              <p className="text-zinc-400 font-black uppercase tracking-widest text-[9px] mb-2">Postup exportu z AZSoft:</p>
              <p>1. Číselníky → Odberatelia → Export → CSV (oddeľovač <span className="text-white font-mono">;</span>)</p>
              <p>2. Zákazky → Vozidlá → Export → CSV (oddeľovač <span className="text-white font-mono">;</span>)</p>
              <p>3. Nahraj oba súbory naraz v importnom dialógu</p>
            </div>
          </div>
        </div>

        {/* SEKCIA 4: Import kontaktov z tabuľky */}
        <div className="mt-6 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Hromadný import</p>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">Import kontaktov z tabuľky</h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wide mt-1">Nahraj Excel súbor s kontaktmi — stĺpce musia mať presné názvy</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <label className={`flex items-center gap-4 bg-black/40 border border-blue-800/40 hover:border-blue-600/60 py-5 px-6 rounded-[1.5rem] transition-all group cursor-pointer ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-1 group-hover:text-blue-500">Import</p>
                  <p className="text-base font-black uppercase italic text-white">Kontakty (.xlsx / .csv)</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">Excel alebo CSV s kontaktmi</p>
                </div>
                <input ref={kontaktyFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={importKontakty} disabled={loading} />
              </label>
              <button
                onClick={downloadKontaktyTemplate}
                className="w-full py-3 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
              >
                ⬇ Stiahnuť vzor tabuľky (.xlsx)
              </button>
            </div>
            <div className="overflow-x-auto">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Príklad štruktúry súboru:</p>
              <p className="text-[9px] text-zinc-600 font-bold mb-3">Zákazník s viac vozidlami = viac riadkov s rovnakým emailom/telefónom</p>
              <table className="text-[8px] font-mono border-collapse">
                <thead>
                  <tr className="bg-zinc-800">
                    {['Meno','Firma','Telefon','Email','Mesto','Typ','SPZ','Znacka_model','VIN','Rok','Palivo','KM'].map(h => (
                      <th key={h} className={`px-2 py-1.5 text-left font-black border border-zinc-700 whitespace-nowrap ${['SPZ','Znacka_model','VIN','Rok','Palivo','KM'].includes(h) ? 'text-amber-500' : 'text-zinc-300'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-zinc-900/50">
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">Ján Novák</td>
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800"></td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">0900000000</td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">jan@email.sk</td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">Bratislava</td>
                    <td className="px-2 py-1 text-blue-400 border border-zinc-800">Osoba</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">BA123AB</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">Škoda Octavia</td>
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800"></td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">2018</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">Diesel</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">87000</td>
                  </tr>
                  <tr className="bg-zinc-900/30">
                    <td className="px-2 py-1 text-zinc-400 border border-zinc-800">Ján Novák</td>
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800"></td>
                    <td className="px-2 py-1 text-zinc-400 border border-zinc-800">0900000000</td>
                    <td className="px-2 py-1 text-zinc-400 border border-zinc-800">jan@email.sk</td>
                    <td className="px-2 py-1 text-zinc-400 border border-zinc-800">Bratislava</td>
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800">Osoba</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">BA456CD</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">VW Golf</td>
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800"></td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">2020</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">Diesel</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">45000</td>
                  </tr>
                  <tr className="bg-zinc-900/50">
                    <td className="px-2 py-1 text-zinc-600 border border-zinc-800"></td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">ABC s.r.o.</td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">0911111111</td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">info@abc.sk</td>
                    <td className="px-2 py-1 text-zinc-300 border border-zinc-800">Košice</td>
                    <td className="px-2 py-1 text-blue-400 border border-zinc-800">Firma</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">KE789EF</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">BMW 320d</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">WBA123...</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">2022</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">Diesel</td>
                    <td className="px-2 py-1 text-amber-300 border border-zinc-800">25000</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex gap-4 mt-3 text-[9px] font-bold">
                <span className="text-zinc-300">⬜ Kontaktné údaje</span>
                <span className="text-amber-400">🟨 Vozidlo (nepovinné)</span>
                <span className="text-zinc-500 italic">Prázdna SPZ = kontakt bez vozidla</span>
              </div>
            </div>
          </div>
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

      {/* CLEANUP PODĽA DÁTUMU */}
      <div className="bg-zinc-900/50 border border-red-900/40 p-6 rounded-[2rem] mt-4">
        <h3 className="text-sm font-black uppercase italic tracking-tighter text-red-500 mb-1">Vymazať importované záznamy</h3>
        <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mb-4">Zmaže všetkých zákazníkov a ich vozidlá vytvorené od zadaného dátumu</p>
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="date"
            value={cleanupDate}
            onChange={e => setCleanupDate(e.target.value)}
            className="bg-black border border-zinc-700 text-white text-xs font-black px-4 py-3 rounded-xl focus:outline-none focus:border-red-600"
          />
          <button
            onClick={deleteByDate}
            disabled={cleanupLoading}
            className="bg-red-600/10 border border-red-600/40 text-red-500 font-black px-5 py-3 rounded-xl text-[10px] uppercase hover:bg-red-600/20 transition-all disabled:opacity-40"
          >
            {cleanupLoading ? 'Mažem...' : 'Vymazať od tohto dátumu'}
          </button>
          {cleanupResult && !cleanupResult.error && cleanupResult.deleted > 0 && (
            <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">
              ✓ Vymazaných {cleanupResult.deleted} zákazníkov, {cleanupResult.vehicles} vozidiel
            </span>
          )}
          {cleanupResult && !cleanupResult.error && cleanupResult.deleted === 0 && (
            <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">
              ⚠ Nič sa nezmazalo — chýbajú práva alebo záznamy neexistujú
            </span>
          )}
          {cleanupResult?.error && (
            <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Chyba: {cleanupResult.error}</span>
          )}
        </div>
      </div>

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
