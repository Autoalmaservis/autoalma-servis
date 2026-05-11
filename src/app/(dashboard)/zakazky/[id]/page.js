'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import SmsPanel from '../../prijem/SmsPanel'; // PRIDANÝ IMPORT ZACHOVANÝ

export default function DetailZakazkyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [zakazka, setZakazka] = useState(null);
  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]); 
  const [employees, setEmployees] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // --- NOVÉ STAVY PRE KATALÓG, SADZBY A CENOVÉ PONUKY ZACHOVANÉ ---
  const [catalog, setCatalog] = useState([]);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [warehouseModalSearch, setWarehouseModalSearch] = useState('');
  const dropdownRef = useRef(null);
  const [rateCategories, setRateCategories] = useState([]);
  const [activeOffer, setActiveOffer] = useState(null);
  const [pastOffers, setPastOffers] = useState([]); // HISTÓRIA PONÚK ZACHOVANÁ

  // --- DOPLNENÉ STAVY PRE FOTODOKUMENTÁCIU ZACHOVANÉ ---
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [myCompany, setMyCompany] = useState({ name: 'AutoAlma Servis', address: '', city: '', zip: '', ico: '', dic: '', bank: '', phone: '', email: '', web: '', logo_url: '' });

  // Formuláre
  const [formTemplates, setFormTemplates] = useState([]);
  const [savedForms, setSavedForms] = useState([]);
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [showFormFill, setShowFormFill] = useState(false);
  const [activeFormTemplate, setActiveFormTemplate] = useState(null);
  const [formFillData, setFormFillData] = useState({
    customer_name: '', customer_address: '', customer_phone: '', customer_ico: '',
    brand: '', model: '', plate: '', mileage: '', year: '', fuel: '', engine_volume: '', engine_power: '',
    note: '', date_received: new Date().toISOString().split('T')[0], date_returned: '',
    measurements: [],
  });
  const [savingForm, setSavingForm] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    unit: 'ks',
    unit_price: 0,
    type: 'Materiál',
    rateType: 'M1',
  });

  // --- REAL-TIME ODBERY (Postrážené, aby nič nevypadlo) ---
  useEffect(() => {
    if (id) {
      loadAllData();

      const subscription = supabase
        .channel(`job-detail-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tasks', filter: `job_id=eq.${id}` }, () => { fetchTasks(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_tickets', filter: `id=eq.${id}` }, () => { fetchDetail(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_items', filter: `job_id=eq.${id}` }, () => { fetchItems(); })
        // Sledovanie zmien v ponukách
        .on('postgres_changes', { event: '*', schema: 'public', table: 'price_offers', filter: `job_id=eq.${id}` }, () => { fetchCurrentOffer(); })
        // DOPLNENÉ: Sledovanie zmien vo fotkách
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_photos', filter: `job_id=eq.${id}` }, () => { fetchPhotos(); })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [id]);

  const nd = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ensureAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    // Skúsime refresh
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) return true;
    router.push('/login');
    return false;
  };

  const loadAllData = async () => {
    setLoading(true);
    // Spustíme fetchDetail ako prvý, aby sme získali ŠPZ pre históriu
    const detailData = await fetchDetail(); 
    
    await Promise.all([
      fetchItems(),
      fetchTasks(),
      fetchEmployees(),
      fetchCatalog(),
      fetchWarehouseItems(),
      fetchSettings(),
      fetchCurrentOffer(),
      fetchPhotos(),
      fetchFormTemplates(),
      fetchSavedForms(),
    ]);

    // Ak máme ŠPZ, vyhľadáme históriu ponúk
    if (detailData?.plate_number) {
        fetchPastOffers(detailData.plate_number);
    }
    
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*');
    if (data) {
      setMyCompany({
        name: data.find(s => s.id === 'company_name')?.value || 'AutoAlma Servis',
        address: data.find(s => s.id === 'company_address')?.value || '',
        city: data.find(s => s.id === 'company_city')?.value || '',
        zip: data.find(s => s.id === 'company_zip')?.value || '',
        ico: data.find(s => s.id === 'company_ico')?.value || '',
        dic: data.find(s => s.id === 'company_dic')?.value || '',
        bank: data.find(s => s.id === 'company_bank')?.value || '',
        phone: data.find(s => s.id === 'company_phone')?.value || '',
        email: data.find(s => s.id === 'company_email')?.value || '',
        web: data.find(s => s.id === 'company_web')?.value || '',
        logo_url: data.find(s => s.id === 'company_logo')?.value || '',
      });
      const rateCategoriesRaw = data.find(s => s.id === 'rate_categories')?.value;
      if (rateCategoriesRaw) {
        try { setRateCategories(JSON.parse(rateCategoriesRaw)); } catch {}
      } else {
        setRateCategories([
          { key: 'M1', label: 'Základná mechanická', value: data.find(s => s.id === 'rate_m1')?.value || '0' },
          { key: 'M2', label: 'Prémiová mechanická', value: data.find(s => s.id === 'rate_m2')?.value || '0' },
          { key: 'E1', label: 'Elektrodiagnostika', value: data.find(s => s.id === 'rate_e1')?.value || '0' },
          { key: 'E2', label: 'Špeciálne elektro', value: data.find(s => s.id === 'rate_e2')?.value || '0' },
        ]);
      }
    }
  };

  const getRateValue = (key) => parseFloat(rateCategories.find(c => c.key === key)?.value) || 0;

  const fetchDetail = async () => {
    try {
      const { data, error } = await supabase.from('job_tickets').select('*').eq('id', id).single();
      if (error) throw error;
      
      if (data) {
        let finalCustomerId = data.customer_id;

        if (!finalCustomerId && data.plate_number) {
            const { data: vData } = await supabase
                .from('vehicles')
                .select('owner_id')
                .eq('license_plate', data.plate_number.toUpperCase())
                .maybeSingle();
            if (vData?.owner_id) {
                finalCustomerId = vData.owner_id;
            }
        }

        const enrichedData = { ...data, customer_id: finalCustomerId };
        setZakazka(enrichedData);
        return enrichedData; // Vrátime dáta pre loadAllData
      }
    } catch (err) { console.error("Chyba detailu:", err.message); }
  };

  // --- NOVÁ FUNKCIA: NAČÍTANIE HISTÓRIE PONÚK PODĽA ŠPZ ---
  const fetchPastOffers = async (plate) => {
    try {
        const { data, error } = await supabase
            .from('price_offers')
            .select(`
                id, 
                offer_number, 
                created_at, 
                total_amount,
                items_json,
                job_tickets!inner(plate_number)
            `)
            .eq('job_tickets.plate_number', plate.toUpperCase())
            .order('created_at', { ascending: false });

        if (error) throw error;
        // Odfiltrujeme aktuálnu ponuku ak nejakú má
        const filtered = data?.filter(o => o.job_id !== id) || [];
        setPastOffers(filtered);
    } catch (err) { console.error("Chyba histórie ponúk:", err.message); }
  };

  // --- NOVÁ FUNKCIA: IMPORT POLOŽIEK ZO STAREJ PONUKY ---
  const importOfferItems = async (oldOffer) => {
    if (!confirm(`Importovať ${oldOffer.items_json.length} položiek z ponuky ${oldOffer.offer_number || 'bez čísla'}?`)) return;
    if (!await ensureAuth()) return;
    
    try {
        const itemsToInsert = oldOffer.items_json.map(item => {
            const { id: oldId, created_at, group_name, is_selected, ...cleanItem } = item;
            return { ...cleanItem, job_id: id };
        });

        if (itemsToInsert.length > 0) {
            const { error } = await supabase.from('job_items').insert(itemsToInsert);
            if (error) throw error;
            fetchItems();
            alert("Položky naimportované.");
        }
    } catch (err) { alert("Chyba importu: " + err.message); }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from('job_items').select('*').eq('job_id', id).order('type', { ascending: false }).order('created_at', { ascending: true });
      if (error) throw error;
      if (data) setItems(data);
    } catch (err) { console.error("Chyba položiek:", err.message); }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase.from('job_tasks').select('*').eq('job_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        const formattedTasks = data.map(t => ({
          ...t,
          is_completed: t.is_completed === true || t.is_completed === 'true'
        }));
        setTasks(formattedTasks);
      }
    } catch (err) { console.error("Chyba úkonov:", err.message); }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true);
      if (data) setEmployees(data);
    } catch (err) { console.error("Chyba zamestnancov:", err.message); }
  };

  const fetchCatalog = async () => {
    const { data } = await supabase.from('inventory_catalog').select('*').order('name', { ascending: true });
    if (data) setCatalog(data);
  };

  const fetchWarehouseItems = async () => {
    const { data } = await supabase.from('warehouse_items').select('id, name, part_number, sale_price, unit, quantity').order('name');
    if (data) setWarehouseItems(data);
  };

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase.from('job_photos').select('*').eq('job_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPhotos(data);
    } catch (err) { console.error("Chyba fotiek:", err.message); }
  };

  const fetchFormTemplates = async () => {
    const { data } = await supabase.from('form_templates').select('*').order('created_at', { ascending: false });
    if (data) setFormTemplates(data);
  };

  const fetchSavedForms = async () => {
    const { data } = await supabase.from('job_forms').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (data) setSavedForms(data);
  };

  const openFormFill = (template) => {
    const z = zakazka || {};
    const brandParts = (z.car_brand_model || '').split(' ');
    setActiveFormTemplate(template);
    setFormFillData({
      customer_name: z.customer_name || '',
      customer_address: '',
      customer_phone: z.customer_phone || '',
      customer_ico: '',
      brand: brandParts[0] || '',
      model: brandParts.slice(1).join(' ') || '',
      plate: z.plate_number || '',
      mileage: z.mileage || '',
      year: z.year_produced || '',
      fuel: z.fuel_type || '',
      engine_volume: z.engine_volume || '',
      engine_power: z.engine_power || '',
      note: '',
      date_received: new Date().toISOString().split('T')[0],
      date_returned: '',
      measurements: [
        { label: 'Priechodnosť PRED', value: '' },
        { label: 'Priechodnosť PO', value: '' },
        { label: 'Stav DPF/FAP PRED', value: '' },
        { label: 'Stav DPF/FAP PO', value: '' },
        { label: 'Počet čistení', value: '' },
      ],
    });
    setShowFormSelector(false);
    setShowFormFill(true);
  };

  const handleSaveForm = async () => {
    if (!await ensureAuth()) return;
    setSavingForm(true);
    try {
      const { error } = await supabase.from('job_forms').insert([{
        job_id: id,
        template_id: activeFormTemplate.id,
        template_name: activeFormTemplate.name,
        filled_data: formFillData,
      }]);
      if (error) throw error;
      fetchSavedForms();
      setShowFormFill(false);
    } catch (err) { alert('Chyba: ' + err.message + '\n\nDetail: ' + JSON.stringify(err)); }
    finally { setSavingForm(false); }
  };

  const handlePrintForm = () => {
    const d = formFillData;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${activeFormTemplate?.name || 'Formulár'}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#000;font-size:11px}
      h1{color:#0000aa;font-size:16px;margin:0} h2{color:#cc0000;font-size:13px;margin:4px 0 12px}
      p{margin:0 0 2px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0000aa;padding-bottom:10px;margin-bottom:16px}
      .logo-area{text-align:right;font-size:10px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      td,th{border:1px solid #aaa;padding:5px 8px;font-size:11px}
      th{background:#e8e8ff;text-align:left;font-weight:bold;color:#0000aa;font-size:10px;text-transform:uppercase;width:30%}
      .section-label{background:#0000aa;color:#fff;font-weight:bold;padding:4px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.1em}
      .measure-table td{border:1px solid #aaa;padding:5px 8px}
      .measure-header{background:#ffeeee;font-weight:bold;color:#cc0000;font-size:10px;text-transform:uppercase}
      .dates{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      .date-box{border:1px solid #aaa;padding:8px;border-radius:4px}
      .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
      .sign-line{border-top:1px solid #000;padding-top:4px;font-size:10px;color:#555}
      @media print{body{padding:10px}}
    </style></head><body>
    <div class="header">
      <div><h1>${activeFormTemplate?.name || 'PROTOKOL'}</h1><h2>AutoAlma Servis s.r.o.</h2><p>DPF, FAP filtrov pevných častíc, katalyzátorov</p></div>
      <div class="logo-area"><strong>AutoAlma Servis s.r.o.</strong><br/>Tel: 0940 449 449<br/>0908 647 227<br/>ul. Svornosti 119<br/>821 06 Bratislava</div>
    </div>
    <p class="section-label">Odovzdávajúci</p>
    <table><tr><th>Meno / Názov spol.</th><td>${d.customer_name}</td></tr>
    <tr><th>Adresa</th><td>${d.customer_address}</td></tr>
    <tr><th>Tel. číslo</th><td>${d.customer_phone}</td><th>IČO</th><td>${d.customer_ico}</td></tr></table>
    <p class="section-label" style="margin-top:10px">Údaje o vozidle</p>
    <table>
    <tr><th>Značka</th><td>${d.brand}</td><th>KW</th><td>${d.engine_power}</td></tr>
    <tr><th>Model</th><td>${d.model}</td><th>Objem motora</th><td>${d.engine_volume}</td></tr>
    <tr><th>EČV</th><td>${d.plate}</td><th>Rok výroby</th><td>${d.year}</td></tr>
    <tr><th>Stav KM</th><td>${d.mileage}</td><th>Palivo</th><td>${d.fuel}</td></tr>
    <tr><th>Poznámka</th><td colspan="3">${d.note}</td></tr></table>
    ${d.measurements.length > 0 ? `
    <p class="section-label" style="margin-top:10px">Merania</p>
    <table class="measure-table">${d.measurements.map(m => `<tr><th class="measure-header">${m.label}</th><td>${m.value}</td></tr>`).join('')}</table>` : ''}
    <div class="dates">
      <div class="date-box"><p>Prevzaté dňa</p><strong>${d.date_received ? new Date(d.date_received + 'T12:00:00').toLocaleDateString('sk-SK') : '—'}</strong></div>
      <div class="date-box"><p>Odovzdané dňa</p><strong>${d.date_returned ? new Date(d.date_returned + 'T12:00:00').toLocaleDateString('sk-SK') : '—'}</strong></div>
    </div>
    <div class="sign"><div class="sign-line">Podpis Preberajúceho</div><div class="sign-line">Podpis Odovzdávajúceho</div></div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('job_photos').insert([{
        job_id: id,
        url: publicUrl,
        storage_path: filePath
      }]);

      if (dbError) throw dbError;
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri nahrávaní: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (!confirm("Naozaj chcete vymazať túto fotografiu?")) return;
    try {
      const { error: storageError } = await supabase.storage
        .from('service-images')
        .remove([photo.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('job_photos')
        .delete()
        .eq('id', photo.id);

      if (dbError) throw dbError;
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri mazaní fotky: " + err.message);
    }
  };

  const fetchCurrentOffer = async () => {
    const { data } = await supabase
      .from('price_offers')
      .select('*')
      .eq('job_id', id)
      .not('status', 'eq', 'Preklopené')
      .maybeSingle();
    setActiveOffer(data || null);
  };

  const createPriceOffer = async () => {
    if (items.length === 0) {
      alert("Najprv pridajte položky do rozpisu, ktoré chcete poslať na schválenie.");
      return;
    }
    const { subtotal } = calculateTotal();
    const { data, error } = await supabase.from('price_offers').insert([{
      job_id: id,
      items_json: items,
      total_amount: subtotal,
      status: 'Odoslané'
    }]).select().single();

    if (!error) {
      setActiveOffer(data);
      const link = `${window.location.origin}/ponuka/${data.id}`;
      prompt("Cenová ponuka vytvorená! Link pre zákazníka:", link);
    }
  };

  const convertOfferToItems = async () => {
    if (!activeOffer || (activeOffer.status !== 'Schválené' && activeOffer.status !== 'Zamietnuté')) return;
    
    if (activeOffer.status === 'Schválené') {
        if (!confirm("Schválené položky sa pridajú do rozpisu a neschválené sa zapíšu ako závady. Pokračovať?")) return;
    } else {
        if (!confirm("Zákazník zamietol celú ponuku. Všetky položky sa zapíšu ako závady a ponuka sa archivuje. Pokračovať?")) return;
    }

    try {
      const allOfferItems = activeOffer.items_json;
      
      const approvedItems = allOfferItems.filter(item => item.is_selected === true);
      const itemsToInsert = approvedItems.map(item => {
        const { id: oldId, created_at, job_id: oldJobId, group_name, is_selected, ...cleanItem } = item;
        return {
          ...cleanItem,
          job_id: id 
        };
      });

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('job_items').insert(itemsToInsert);
        if (insertError) throw insertError;
      }

      const rejectedItems = allOfferItems.filter(item => item.is_selected === false);
      if (rejectedItems.length > 0) {
        const rejectedText = rejectedItems.map(i => `[ODMIETNUTÉ] ${i.group_name || 'Servis'}: ${i.name}`).join('\n');
        
        const { data: jobData } = await supabase.from('job_tickets').select('complaints').eq('id', id).single();
        const newComplaints = jobData?.complaints 
          ? `${jobData.complaints}\n\n${rejectedText}` 
          : rejectedText;

        await supabase.from('job_tickets').update({ complaints: newComplaints, status: 'Prebieha' }).eq('id', id);
      }

      await supabase.from('price_offers').update({ status: 'Preklopené' }).eq('id', activeOffer.id);
      
      setActiveOffer(null);
      fetchItems();
      fetchDetail(); 
      alert("Spracované.");
    } catch (err) {
      alert("Chyba pri spracovaní: " + err.message);
    }
  };

  const syncToCatalog = async (item) => {
    if (['M1', 'M2', 'E1', 'E2'].includes(item.type)) return;
    const payload = {
      name: item.name.trim().toUpperCase(),
      unit_price: item.unit_price,
      unit: item.unit,
      type: item.type === 'Práca' ? 'práca' : 'materiál'
    };
    await supabase.from('inventory_catalog').upsert([payload], { onConflict: 'name,type' });
    fetchCatalog();
  };

  const updateJobStatus = async (newStatus) => {
    const { error } = await supabase.from('job_tickets').update({ status: newStatus, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, status: newStatus }));
    else alert("Chyba pri zmene stavu: " + error.message);
  };

  const updateMechanic = async (employeeId) => {
    const selectedEmp = employees.find(e => e.id === employeeId);
    if (!selectedEmp) return;
    const { error } = await supabase.from('job_tickets').update({ assigned_worker_id: employeeId, technician_name: selectedEmp.name, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, assigned_worker_id: employeeId, technician_name: selectedEmp.name }));
  };

  // --- UPRAVENÁ FUNKCIA FINALIZÁCIE S ADRESAMI A SPLATNOSŤOU ---
  const handleFinalizeJob = async (isOfficial) => {
    setInvoiceLoading(true);
    try {
      const { subtotal, tax, total } = calculateTotal();
      const teraz = new Date();
      
      // LOGIKA SPLATNOSTI (+14 dní)
      const datumSplatnosti = new Date();
      datumSplatnosti.setDate(teraz.getDate() + 14);

      const dd = String(teraz.getDate()).padStart(2, '0');
      const mm = String(teraz.getMonth() + 1).padStart(2, '0');
      const rr = String(teraz.getFullYear()).slice(-2);
      const dnesnyDátum = `${dd}${mm}${rr}`;

      let query = supabase.from('invoices').select('*', { count: 'exact', head: true });

      if (isOfficial) {
          query = query.like('invoice_number', `${dnesnyDátum}%`).not('invoice_number', 'ilike', 'A%');
      } else {
          query = query.like('invoice_number', `A${dnesnyDátum}%`);
      }

      const { count, error: countError } = await query;
      if (countError) throw countError;

      const poradie = String((count || 0) + 1).padStart(3, '0');
      const konecneCislo = isOfficial ? `${dnesnyDátum}${poradie}` : `A${dnesnyDátum}${poradie}`;
      
      const invoicePayload = {
        invoice_number: konecneCislo, 
        job_id: id,
        customer_name: zakazka.customer_name,
        customer_email: zakazka.customer_email || null,
        customer_phone: zakazka.customer_phone || null,
        items_json: items,
        subtotal_amount: Number(subtotal) || 0,
        tax_amount: Number(tax) || 0,
        total_amount: Number(total) || 0,
        is_official: isOfficial,
        
        // DOPLNENÉ: ÚDAJE O DODÁVATEĽOVI
        supplier_details: {
            company_name: "AutoAlma Servis s.r.o.", 
            address: "Slovenská ulica 12, 040 01 Košice",
            ico: "12345678",
            dic: "2021234567",
            ic_dph: "SK2021234567",
            bank_account: "SK12 1100 0000 0012 3456 7890", 
            bank_name: "Tatra Banka, a.s."
        },

        // DOPLNENÉ: KOMPLETNÉ ÚDAJE O ZÁKAZNÍKOVI (ADRESA ZAKLADANÁ)
        company_details: { 
          company_name: zakazka.company_name || zakazka.customer_name, 
          ico: zakazka.ico, 
          dic: zakazka.dic,
          ic_dph: zakazka.ic_dph,
          address: zakazka.address || zakazka.customer_address, // Adresa z tabuľky
          city: zakazka.city || zakazka.customer_city,
          zip: zakazka.zip || zakazka.customer_zip
        },

        // DOPLNENÉ: PLATOBNÉ INFO
        payment_info: {
            issue_date: teraz.toISOString(),
            due_date: datumSplatnosti.toISOString(),
            payment_method: isOfficial ? "Prevodom" : "Hotovosť"
        },

        car_details: { 
          brand: zakazka.car_brand_model, 
          plate: zakazka.plate_number, 
          vin: zakazka.vin_number,
          mileage: zakazka.mileage
        }
      };

      const { data: invData, error: invError } = await supabase.from('invoices').insert([invoicePayload]).select().single();
      if (invError) throw invError;

      await updateJobStatus('Archivované');
      router.push(`/faktury/${invData.id}`);
    } catch (err) { 
      alert("Chyba pri vytváraní faktúry: " + err.message); 
    } finally { 
      setInvoiceLoading(false); 
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const { error } = await supabase.from('job_tasks').insert([{ job_id: id, task_description: newTaskText, is_completed: false }]);
    if (!error) { setNewTaskText(''); fetchTasks(); }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = !currentStatus;
    setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));
    await supabase.from('job_tasks').update({ is_completed: newStatus }).eq('id', taskId);
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
    if (!error) fetchTasks();
  };

  const deleteWholeJob = async () => {
    const { error } = await supabase.from('job_tickets').delete().eq('id', id);
    if (!error) router.push('/zakazky');
  };

  const selectWarehouseItem = (w) => {
    setNewItem(prev => ({ ...prev, name: w.name, unit_price: parseFloat(w.sale_price) || 0, unit: w.unit || 'ks', type: 'Materiál' }));
    setShowItemDropdown(false);
    setWarehouseModalOpen(false);
  };

  const selectCatalogItem = (c) => {
    setNewItem(prev => ({ ...prev, name: c.name, unit_price: c.unit_price, unit: c.unit, type: c.type === 'práca' ? 'Práca' : 'Materiál' }));
    setShowItemDropdown(false);
  };

  const decreaseWarehouseStock = async (itemName, qty) => {
    try {
      const { data: wItem } = await supabase
        .from('warehouse_items')
        .select('id, quantity')
        .ilike('name', itemName.trim())
        .maybeSingle();
      if (!wItem) return;
      const newQty = Math.max(0, parseFloat(wItem.quantity) - qty);
      await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', wItem.id);
      await supabase.from('warehouse_movements').insert([{
        item_id: wItem.id,
        movement_type: 'out',
        quantity: qty,
        job_id: id,
        note: `Zákazka ${zakazka?.plate_number || ''}`,
      }]);
    } catch (err) {
      console.error('warehouse stock error:', err.message);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name) return;
    if (!await ensureAuth()) return;

    const isPraca = newItem.type === 'Práca';
    const itemToSave = {
      ...newItem,
      type: isPraca ? 'Práca' : 'Materiál',
      unit_price: isPraca ? getRateValue(newItem.rateType) : newItem.unit_price,
      unit: isPraca ? 'hod' : newItem.unit,
    };

    if (!isPraca) syncToCatalog(itemToSave);

    const { rateType: _rt, ...itemForDb } = itemToSave;
    const { error } = await supabase.from('job_items').insert([{ ...itemForDb, job_id: id }]);
    if (!error) {
      if (!isPraca) decreaseWarehouseStock(itemToSave.name, parseFloat(itemToSave.quantity));
      setNewItem({ name: isPraca ? `Servisná práca ${newItem.rateType}` : '', quantity: 1, unit: isPraca ? 'hod' : 'ks', unit_price: isPraca ? getRateValue(newItem.rateType) : 0, type: newItem.type, rateType: newItem.rateType });
      fetchItems();
    }
  };

  const deleteItem = async (itemId) => {
    if (!await ensureAuth()) return;
    const { error } = await supabase.from('job_items').delete().eq('id', itemId);
    if (!error) fetchItems();
  };

  const calculateTotal = () => {
    const subtotalMaterial = items.filter(i => i.type === 'Materiál').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const subtotalWork = items.filter(i => i.type === 'Práca').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const subtotal = subtotalMaterial + subtotalWork;
    const tax = subtotal * 0.23;
    const total = subtotal + tax;
    return { subtotalMaterial, subtotalWork, subtotal, tax, total };
  };

  const { subtotalMaterial, subtotalWork, subtotal, tax, total } = calculateTotal();
  const handlePrint = () => window.print();

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center py-20 font-sans font-bold uppercase italic tracking-widest text-red-600 animate-pulse">
      Generujem rozpis...
    </div>
  );

  if (!zakazka) return <div className="min-h-screen bg-black flex items-center justify-center">ZÁKAZKA NENÁJDENÁ</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-12 relative font-sans font-bold">
      
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 no-print max-w-5xl mx-auto gap-4">
        <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest font-bold">← Späť</button>
        
        <div className="flex bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 gap-2">
            <button onClick={() => updateJobStatus('Prebieha')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Prebieha' ? 'bg-amber-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Prebieha</button>
            <button onClick={() => updateJobStatus('Čaká na schválenie')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Čaká na schválenie' ? 'bg-purple-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Čaká na schválenie</button>
            <button onClick={() => updateJobStatus('Dokončené')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Dokončené' ? 'bg-green-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Dokončené</button>
            <button onClick={() => updateJobStatus('Archivované')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${zakazka.status === 'Archivované' ? 'bg-zinc-700 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>Archivovať</button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsDeleteModalOpen(true)} className="bg-zinc-900 border border-red-900/30 text-red-900 hover:bg-red-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest font-bold">🗑️ Vymazať</button>
          <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest font-bold">🖨️ Tlačiť protokol</button>
        </div>
      </div>

      <div className="printable-area no-print bg-zinc-900 border border-zinc-800 p-8 md:p-16 rounded-[3rem] shadow-2xl max-w-5xl mx-auto text-white">
        
        <div className="flex justify-between items-start border-b-2 border-red-600 pb-8 mb-8 font-bold">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">AutoAlma <span className="text-red-600">Servis</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic uppercase">Slovenská ulica 12, Košice | www.autoalma.sk</p>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border inline-block mb-3 ${zakazka.status === 'Dokončené' ? 'border-green-600 text-green-500' : 'border-amber-600 text-amber-500'}`}>{zakazka.status}</span>
            <p className="text-[10px] font-black text-zinc-500 uppercase mb-1 italic">Číslo záznamu</p>
            <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">
              {zakazka.job_number || `#${zakazka.id.slice(0, 8)}`}
            </p>
          </div>
        </div>

        {/* --- HLAVIČKA FAKTÚRY S ADRESAMI --- */}
        <div className="grid grid-cols-2 gap-10 mb-10 border-b border-zinc-800 pb-10">
          <div>
            <h4 className="text-red-600 uppercase text-[10px] mb-3 font-black tracking-widest italic">Dodávateľ</h4>
            <p className="text-lg font-black italic">AutoAlma Servis s.r.o.</p>
            <p className="text-xs text-zinc-400">Slovenská ulica 12, 040 01 Košice</p>
            <div className="mt-4 text-[10px] font-bold text-zinc-500 uppercase leading-relaxed font-black">
              <p>IČO: 12345678 | DIČ: 2021234567</p>
              <p className="mt-2 text-white italic">IBAN: SK12 1100 0000 0012 3456 7890</p>
            </div>
          </div>
          
          <div className="text-right">
            <h4 className="text-blue-500 uppercase text-[10px] mb-3 font-black tracking-widest italic">Odberateľ</h4>
            <p className="text-lg font-black italic">{zakazka.company_name || zakazka.customer_name}</p>
            {/* DOPLNENÁ ADRESA ODBERATEĽA */}
            <p className="text-xs text-zinc-400">{zakazka.address || zakazka.customer_address || 'Adresa neuvedená'}</p>
            <p className="text-xs text-zinc-400">{zakazka.zip || ''} {zakazka.city || ''}</p>
            <div className="mt-4 text-[10px] font-bold text-zinc-500 uppercase leading-relaxed font-black">
              <p>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
              {zakazka.ic_dph && <p>IČ DPH: {zakazka.ic_dph}</p>}
            </div>
          </div>
        </div>

        {/* PLATOBNÉ INFO V TLAČI */}
        <div className="grid grid-cols-3 gap-4 mb-10 bg-zinc-800/20 p-8 rounded-[2rem] border border-zinc-800 text-center font-black uppercase italic">
          <div>
            <p className="text-[9px] text-zinc-500 mb-1">Dátum vystavenia</p>
            <p className="text-xs">{new Date().toLocaleDateString('sk-SK')}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 mb-1">Dátum splatnosti</p>
            <p className="text-xs text-red-600">{new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('sk-SK')}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 mb-1">Forma úhrady</p>
            <p className="text-xs">Prevodom / Karta</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 border-b border-zinc-800 pb-8 font-bold">
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 italic">Dátum príjmu</p><p className="font-bold">{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</p></div>
          <div className="relative group">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest italic">Zodp. Mechanik</p>
            <div className="relative no-print">
                <select 
                  className="bg-black/40 border-2 border-zinc-700 hover:border-red-600 rounded-xl px-3 py-2 text-[11px] font-black uppercase text-red-600 outline-none cursor-pointer appearance-none w-full -ml-12"
                  value={zakazka.assigned_worker_id || ''}
                  onChange={(e) => updateMechanic(e.target.value)}
                >
                  <option value="" disabled>VYBRAŤ...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-zinc-900 text-white font-sans not-italic font-bold">{emp.name.toUpperCase()}</option>
                  ))}
                </select>
            </div>
            <p className="hidden print-block text-red-600 uppercase italic font-black text-sm">{zakazka.technician_name || 'Pridelený tím'}</p>
          </div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 italic">KM</p><p className="font-bold">{zakazka.mileage || '---'} km</p></div>
          <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1 italic text-red-600">ŠPZ</p><p className="text-xl tracking-widest italic font-black uppercase text-red-600">{zakazka.plate_number}</p></div>
        </div>

        <div className="no-print mb-12">
            <SmsPanel 
                phone={zakazka.customer_phone} 
                plate={zakazka.plate_number} 
                customerName={zakazka.customer_name}
                userId={zakazka.customer_id} 
            />
        </div>

        {activeOffer && (
          <div className={`mb-10 p-8 rounded-[2.5rem] border-2 flex flex-col md:flex-row justify-between items-center shadow-2xl no-print gap-6 
            ${activeOffer.status === 'Schválené' ? 'bg-green-600/10 border-green-600 animate-pulse' : 
              activeOffer.status === 'Zamietnuté' ? 'bg-red-600/10 border-red-600' : 
              'bg-blue-600/10 border-blue-600'}`}>
            
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic font-bold">Cenová ponuka</p>
              <h3 className={`text-2xl font-black uppercase italic tracking-tighter 
                ${activeOffer.status === 'Schválené' ? 'text-green-500' : 
                  activeOffer.status === 'Zamietnuté' ? 'text-red-500' : 
                  'text-blue-500'}`}>
                {activeOffer.status === 'Schválené' ? '✅ Zákazník ponuku schválil' : 
                 activeOffer.status === 'Zamietnuté' ? '❌ Zákazník ponuku zamietol' : 
                 '📩 Ponuka odoslaná na schválenie'}
              </h3>
            </div>

            <div className="flex gap-3">
              {(activeOffer.status === 'Schválené' || activeOffer.status === 'Zamietnuté') ? (
                <button onClick={convertOfferToItems} className={`${activeOffer.status === 'Schválené' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white px-10 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-xl tracking-widest`}>
                  {activeOffer.status === 'Schválené' ? '📥 Preklopiť schválené práce' : '📥 Zapísať do závad a zavrieť'}
                </button>
              ) : (
                <button onClick={() => prompt("Link pre zákazníka:", `${window.location.origin}/ponuka/${activeOffer.id}`)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-xl tracking-widest">
                  🔗 Zdieľať link
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12 font-bold">
          <div className="space-y-4">
              <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">Partner a Technika</h2>
              <div className="bg-black/30 p-8 rounded-3xl border border-zinc-800 space-y-4">
                <div>
                  <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">{zakazka.customer_name}</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">{zakazka.customer_phone} | {zakazka.customer_email}</p>
                </div>
                {(zakazka.ico || zakazka.company_name) && (
                  <div className="pt-4 border-t border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-400">
                    <p className="text-white mb-1">{zakazka.company_name}</p>
                    <p>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-800/50">
                  <p className="text-lg font-black uppercase text-zinc-300 italic tracking-tight leading-none">{zakazka.car_brand_model}</p>
                  <p className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase mt-1">VIN: {zakazka.vin_number || '---'}</p>
                </div>
              </div>
              
              <div className="bg-red-600/5 p-8 rounded-[2rem] border border-red-600/20 shadow-inner">
                <h2 className="text-red-600 font-black uppercase text-[10px] tracking-widest mb-4 italic font-black">Zistené závady / Poznámky</h2>
                <pre className="text-xs font-sans text-zinc-400 whitespace-pre-wrap font-bold leading-relaxed">
                  {zakazka.complaints || 'Žiadne zaznamenané závady.'}
                </pre>
              </div>
          </div>

          <div className="space-y-4 font-bold">
            <div className="flex justify-between items-end">
                <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
                <span className="text-[9px] font-black text-zinc-500 uppercase">{tasks.filter(t => t.is_completed === true).length} / {tasks.length} HOTOVO</span>
            </div>
            <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
              {tasks.map((task) => {
                const done = task.is_completed === true;
                return (
                  <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${done ? 'bg-green-600/10 border-green-600 text-green-500 shadow-[0_0_15px_rgba(22,163,74,0.1)]' : 'bg-red-600/5 border-red-600/40 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.05)]'}`}>
                    <div className="flex items-center gap-4 cursor-pointer flex-grow no-print" onClick={() => toggleTaskStatus(task.id, task.is_completed)}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${done ? 'bg-green-600 border-green-600 shadow-lg shadow-green-900/40' : 'bg-transparent border-red-600'}`}>
                        {done ? <span className="text-white text-xs font-black">✓</span> : <span className="text-red-600 text-[10px] font-black uppercase tracking-tighter">X</span>}
                      </div>
                      <span className={`text-sm font-black uppercase tracking-tight italic ${done ? 'line-through opacity-50' : ''}`}>{task.task_description}</span>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg font-bold">✕</button>
                  </div>
                );
              })}
              <form onSubmit={addTask} className="flex gap-2 mt-4 no-print">
                <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="+ Pridať ďalšiu úlohu..." className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all font-black italic tracking-widest" />
                <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
              </form>
            </div>
          </div>
        </div>

        {/* ROZPIS POLOŽIEK */}
        <div className="space-y-4 mb-12">
          <div className="flex justify-between items-center font-bold">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic font-black">2. Rozpis materiálu a servisných prác</h2>
                
                {pastOffers.length > 0 && (
                    <div className="no-print">
                        <select 
                            onChange={(e) => {
                                const selected = pastOffers.find(o => o.id === e.target.value);
                                if (selected) importOfferItems(selected);
                                e.target.value = ""; 
                            }}
                            className="bg-blue-600/10 border border-blue-600/30 text-blue-500 text-[9px] px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-blue-600 hover:text-white transition-all font-black uppercase tracking-tighter"
                        >
                            <option value="">🕒 HISTÓRIA PONÚK ŠPZ ({pastOffers.length})</option>
                            {pastOffers.map(o => (
                                <option key={o.id} value={o.id} className="bg-zinc-900 text-white">
                                    {o.offer_number || 'CP'} - {new Date(o.created_at).toLocaleDateString('sk-SK')} ({(o.total_amount * 1.23).toFixed(2)}€)
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="no-print flex gap-2 items-center">
              <button
                onClick={() => setShowFormSelector(true)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all shadow-lg"
              >
                📋 Pridať formulár
              </button>
              {!activeOffer && (
                <button
                  onClick={() => router.push(`/zakazky/${id}/nova-ponuka`)}
                  className="bg-blue-600 border border-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all font-bold shadow-lg"
                >
                  📝 Vytvoriť novú cenovú ponuku
                </button>
              )}
            </div>
          </div>
          <div className="bg-black/30 rounded-3xl border border-zinc-800 overflow-hidden shadow-inner font-bold">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 tracking-widest italic">
                <tr>
                  <th className="p-4 w-32">Typ</th>
                  <th className="p-4">Položka</th>
                  <th className="p-4 text-center w-24">Množ.</th>
                  <th className="p-4 text-right">Cena/J</th>
                  <th className="p-4 text-right">Spolu</th>
                  <th className="p-4 text-center no-print w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-black italic uppercase">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4"><span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800 shadow-lg' : 'text-orange-400 border-orange-800 shadow-lg'}`}>{item.type}</span></td>
                    <td className="p-4 font-black uppercase text-xs tracking-tight">{item.name}</td>
                    <td className="p-4 text-center font-mono text-xs">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-right font-mono text-xs">{parseFloat(item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-right font-black text-xs">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                    <td className="p-4 text-center no-print"><button onClick={() => deleteItem(item.id)} className="text-zinc-800 hover:text-red-600 transition-colors">✕</button></td>
                  </tr>
                ))}
                
                <tr className="no-print bg-black/50 border-t-2 border-red-600/20">
                  <td className="p-3">
                    <div className="flex gap-1.5">
                    <select
                      className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-[9px] font-black uppercase outline-none focus:border-red-600 cursor-pointer"
                      value={newItem.type}
                      onChange={(e) => {
                        const t = e.target.value;
                        const isPraca = t === 'Práca';
                        setNewItem({
                          ...newItem,
                          type: t,
                          unit: isPraca ? 'hod' : 'ks',
                          unit_price: isPraca ? getRateValue(newItem.rateType) : 0,
                          name: isPraca ? `Servisná práca ${newItem.rateType}` : '',
                        });
                      }}
                    >
                      <option value="Materiál">MATERIÁL</option>
                      <option value="Práca">PRÁCA</option>
                    </select>
                    {newItem.type === 'Práca' && (
                      <select
                        className="bg-zinc-900 border border-red-600/50 p-3 rounded-xl text-white text-[9px] font-black uppercase outline-none focus:border-red-600 cursor-pointer"
                        value={newItem.rateType}
                        onChange={(e) => {
                          const rt = e.target.value;
                          setNewItem({ ...newItem, rateType: rt, unit_price: getRateValue(rt), name: `Servisná práca ${rt}` });
                        }}
                      >
                        {rateCategories.map(c => (
                          <option key={c.key} value={c.key}>{c.key} — {c.value}€</option>
                        ))}
                      </select>
                    )}
                  </div>
                  </td>
                  <td className="p-3 relative" ref={dropdownRef}>
                    <div className="flex gap-1.5">
                      <div className="relative flex-grow">
                        <input
                          type="text"
                          placeholder="Názov položky..."
                          className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs font-black uppercase italic"
                          value={newItem.name}
                          autoComplete="off"
                          onFocus={() => setShowItemDropdown(true)}
                          onChange={(e) => {
                            setNewItem({ ...newItem, name: e.target.value });
                            setShowItemDropdown(true);
                          }}
                        />
                        {/* Custom dropdown */}
                        {showItemDropdown && newItem.type === 'Materiál' && (
                          <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
                            {(() => {
                              const q = nd(newItem.name);
                              const wFiltered = warehouseItems.filter(w =>
                                nd(w.name).includes(q) || (w.part_number && nd(w.part_number).includes(q))
                              ).slice(0, 8);
                              const cFiltered = catalog.filter(c =>
                                !warehouseItems.some(w => w.name === c.name) &&
                                nd(c.name).includes(q)
                              ).slice(0, 5);
                              return (
                                <>
                                  {wFiltered.length > 0 && (
                                    <>
                                      <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 bg-black/60 sticky top-0">🏭 Sklad</div>
                                      {wFiltered.map(w => (
                                        <button key={w.id} type="button" onMouseDown={() => selectWarehouseItem(w)}
                                          className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-all flex items-center justify-between gap-3 border-b border-zinc-800/40 last:border-0">
                                          <div className="min-w-0">
                                            <span className="text-white font-black text-xs uppercase italic block truncate">{w.name}</span>
                                            {w.part_number && <span className="text-yellow-400 text-[9px] font-black">{w.part_number}</span>}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${w.quantity > 0 ? 'text-green-400 border-green-600/30 bg-green-500/10' : 'text-red-400 border-red-600/30 bg-red-500/10'}`}>
                                              {parseFloat(w.quantity).toFixed(0)} {w.unit}
                                            </span>
                                            <span className="text-white font-black text-xs">{parseFloat(w.sale_price).toFixed(2)} €</span>
                                          </div>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {cFiltered.length > 0 && (
                                    <>
                                      <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 bg-black/60 sticky top-0">📦 Katalóg</div>
                                      {cFiltered.map((c, i) => (
                                        <button key={i} type="button" onMouseDown={() => selectCatalogItem(c)}
                                          className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-all flex items-center justify-between gap-3 border-b border-zinc-800/40 last:border-0">
                                          <span className="text-zinc-300 font-black text-xs uppercase italic truncate">{c.name}</span>
                                          <span className="text-zinc-400 font-black text-xs shrink-0">{parseFloat(c.unit_price).toFixed(2)} €</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {wFiltered.length === 0 && cFiltered.length === 0 && newItem.name && (
                                    <div className="px-4 py-4 text-zinc-600 font-black text-xs uppercase italic text-center">Žiadne výsledky — zadaj manuálne</div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      {/* Browse warehouse button */}
                      {newItem.type === 'Materiál' && (
                        <button type="button" onClick={() => { setWarehouseModalSearch(''); setWarehouseModalOpen(true); }}
                          title="Prehľadávať sklad"
                          className="shrink-0 px-3 bg-zinc-800 border border-zinc-700 hover:bg-red-600 hover:border-red-600 text-zinc-400 hover:text-white rounded-xl transition-all text-sm">
                          🏭
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <input type="number" min="0.5" step="0.5" className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-center text-xs font-bold" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value) || 1})} />
                  </td>
                  <td className="p-3 w-32">
                    <input
                      type="number"
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-right text-xs font-black outline-none disabled:opacity-40"
                      value={newItem.unit_price || 0}
                      disabled={newItem.type === 'Práca'}
                      onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value) || 0})}
                    />
                  </td>
                  <td className="p-3"><button onClick={addItem} className="w-full bg-red-600 text-white font-black py-3 rounded-xl hover:bg-red-500 transition-all shadow-xl text-lg">+</button></td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
            <div className="p-8 bg-zinc-800/20 flex flex-col items-end space-y-3 font-black italic uppercase">
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest"><span>Materiál (Základ):</span><span className="text-white">{subtotalMaterial.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-3"><span>Práca (Základ):</span><span className="text-blue-400">{subtotalWork.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest pt-1"><span>Základ dane:</span><span className="text-white">{subtotal.toFixed(2)} €</span></div>
              <div className="flex justify-between w-72 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b-2 border-zinc-800 pb-3"><span>DPH (23%):</span><span className="text-white">{tax.toFixed(2)} €</span></div>
              <div className="flex justify-between w-80 pt-4"><span className="text-red-600 font-black uppercase italic tracking-tighter text-xl leading-none font-black">Spolu k úhrade:</span><span className="text-4xl font-black italic tracking-tighter leading-none">{total.toFixed(2)} €</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-12 no-print font-bold">
          <div className="flex justify-between items-center">
            <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">3. Fotodokumentácia opravy</h2>
            <label className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer inline-block shadow-lg">
              {uploading ? 'Nahrávam...' : '📸 Pridať fotografiu'}
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploading} />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square rounded-[2rem] overflow-hidden border border-zinc-800 bg-black shadow-xl">
                <img src={photo.url} alt="Servisná fotka" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => deletePhoto(photo)}
                    className="bg-red-600 text-white p-4 rounded-2xl hover:bg-red-500 transition-all shadow-2xl transform translate-y-4 group-hover:translate-y-0 duration-300"
                  >
                    🗑️ Vymazať
                  </button>
                </div>
              </div>
            ))}
            
            {photos.length === 0 && !uploading && (
              <div className="col-span-full py-12 border-2 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-zinc-600 opacity-50">
                <span className="text-3xl mb-2">📸</span>
                <p className="text-[10px] font-black uppercase tracking-widest italic">Zatiaľ neboli nahrané žiadne fotografie</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 no-print font-bold space-y-4">
            {zakazka.status !== 'Dokončené' && zakazka.status !== 'Archivované' && (
                <button
                    onClick={() => updateJobStatus('Dokončené')}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-8 rounded-[2rem] uppercase text-sm tracking-[0.4em] shadow-2xl transition-all italic hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-4 shadow-green-900/40"
                >
                    <span className="text-2xl">✅</span> AUTO JE PRIPRAVENÉ — OZNAČIŤ AKO DOKONČENÉ
                </button>
            )}

            {(zakazka.status === 'Dokončené' || zakazka.status === 'Archivované') && (
                <button
                    onClick={() => setIsInvoiceModalOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-[2rem] uppercase text-sm tracking-[0.4em] shadow-2xl transition-all italic hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-4 shadow-blue-900/40"
                >
                    <span className="text-2xl">💰</span> ZÁKAZNÍK PRIŠIEL — VYSTAVIŤ FAKTÚRU
                </button>
            )}
        </div>

        <div className="grid grid-cols-2 gap-20 mt-20 text-center font-black italic tracking-[0.4em] uppercase font-black">
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 italic">Pečiatka a podpis servisu</div>
          <div className="border-t border-zinc-800 pt-4 text-[9px] text-zinc-500 italic">Podpis zákazníka</div>
        </div>
      </div>

      {/* ===== ČISTÁ TLAČOVÁ FORMA ===== */}
      <div className="zakazka-print-area">

        {/* HLAVIČKA */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
          <tbody><tr>
            <td width="50%" valign="top">
              <img src={myCompany.logo_url || "/autoalma logo.png"} alt="Logo" style={{ width: '100px', height: 'auto', marginBottom: '10pt' }} />
              <div style={{ fontSize: '8.5pt', color: '#000', lineHeight: '1.4' }}>
                <p style={{ margin: '0', color: '#666', fontWeight: '900' }}>DODÁVATEĽ:</p>
                <p style={{ margin: '0' }}><strong>{myCompany.name}</strong></p>
                <p style={{ margin: '0' }}>{myCompany.address}</p>
                <p style={{ margin: '0' }}>{myCompany.zip} {myCompany.city}</p>
                <p style={{ margin: '3pt 0 0 0' }}>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
                <p style={{ margin: '0' }}>{myCompany.phone} | {myCompany.email}</p>
                {myCompany.web && <p style={{ margin: '0' }}>{myCompany.web}</p>}
              </div>
            </td>
            <td width="50%" valign="top" align="right">
              <h2 style={{ fontSize: '16pt', color: '#dc2626', margin: '0' }}>Servisný príkaz</h2>
              <p style={{ fontSize: '22pt', color: '#000', fontWeight: '900', margin: '2pt 0' }}>{zakazka.job_number || `#${zakazka.id.slice(0,8)}`}</p>
              <p style={{ margin: '0', color: '#000', fontSize: '9pt' }}>Dátum príjmu: <strong>{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</strong></p>
              <p style={{ margin: '2pt 0 0 0', fontSize: '9pt', color: '#000' }}>Stav: <strong style={{ color: zakazka.status === 'Dokončené' ? '#16a34a' : '#d97706' }}>{zakazka.status}</strong></p>
            </td>
          </tr></tbody>
        </table>

        {/* ADRESY */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
          <tbody><tr>
            <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
              <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>ODBERATEĽ / ZÁKAZNÍK:</p>
              <p style={{ margin: '0', fontSize: '11pt', color: '#000', fontWeight: '900' }}>{zakazka.company_name || zakazka.customer_name}</p>
              <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{zakazka.address || zakazka.customer_address || ''}</p>
              <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{zakazka.zip || ''} {zakazka.city || ''}</p>
              {(zakazka.ico || zakazka.dic) && (
                <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
              )}
              <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>Tel: {zakazka.customer_phone || '---'}</p>
            </td>
            <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
              <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>VOZIDLO:</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3pt' }}>
                <span style={{ border: '1.5pt solid #000', padding: '1pt 4pt', fontWeight: '900', fontSize: '11pt', color: '#000' }}>{zakazka.plate_number || '---'}</span>
                <span style={{ fontSize: '10pt', fontWeight: '900', color: '#000' }}>{zakazka.car_brand_model || '---'}</span>
              </div>
              <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>VIN: {zakazka.vin_number || '---'}</p>
              <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>KM: {zakazka.mileage || '---'} km | Mechanik: {zakazka.technician_name || '---'}</p>
            </td>
          </tr></tbody>
        </table>

        {/* ZÁVADY */}
        {zakazka.complaints && (
          <div style={{ border: '1pt solid #000', padding: '8pt', marginBottom: '12pt' }}>
            <p style={{ margin: '0 0 4pt 0', fontSize: '8pt', color: '#dc2626', fontWeight: '900' }}>ZISTENÉ ZÁVADY / POŽIADAVKY ZÁKAZNÍKA:</p>
            <p style={{ margin: '0', fontSize: '8.5pt', color: '#000', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{zakazka.complaints}</p>
          </div>
        )}

        {/* CHECKLIST ÚKONOV */}
        {tasks.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12pt' }}>
            <thead>
              <tr style={{ background: '#f4f4f5' }}>
                <th style={{ border: '1pt solid #000', padding: '4pt 6pt', fontSize: '8pt', fontWeight: '900', textAlign: 'left' }}>SERVISNÉ ÚKONY — CHECKLIST</th>
                <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'center', width: '60pt' }}>STAV</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td style={{ border: '0.5pt solid #eee', padding: '4pt 6pt', fontSize: '8.5pt', color: '#000' }}>{task.task_description}</td>
                  <td style={{ border: '0.5pt solid #eee', padding: '4pt', textAlign: 'center', fontSize: '8pt', fontWeight: '900', color: task.is_completed ? '#16a34a' : '#dc2626' }}>
                    {task.is_completed ? '✓ HOTOVO' : '○ ČAKÁ'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* MATERIÁL A PRÁCE */}
        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8pt' }}>
            <thead>
              <tr style={{ background: '#f4f4f5' }}>
                <th style={{ border: '1pt solid #000', padding: '4pt 6pt', fontSize: '8pt', fontWeight: '900', textAlign: 'left' }}>MATERIÁL A SERVISNÉ PRÁCE</th>
                <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'center', width: '40pt' }}>MNŽ.</th>
                <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'right', width: '55pt' }}>CENA/J</th>
                <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'right', width: '60pt' }}>SPOLU</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ border: '0.5pt solid #eee', padding: '3pt 6pt', fontSize: '8.5pt', color: '#000' }}>
                    <span style={{ fontSize: '7pt', color: item.type === 'Práca' ? '#2563eb' : '#ea580c', fontWeight: '900' }}>[{item.type.toUpperCase()}]</span>{' '}{item.name}
                  </td>
                  <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'center', fontSize: '8.5pt', color: '#000' }}>{item.quantity} {item.unit}</td>
                  <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'right', fontSize: '8.5pt', color: '#000' }}>{parseFloat(item.unit_price).toFixed(2)} €</td>
                  <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'right', fontWeight: '900', fontSize: '8.5pt', color: '#000' }}>{(item.quantity * item.unit_price).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* SUMÁR */}
        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10pt' }}>
            <tbody><tr>
              <td></td>
              <td width="200pt" style={{ border: '1.5pt solid #000', padding: '8pt' }}>
                <table width="100%" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ fontSize: '9pt', color: '#000' }}>
                      <td style={{ paddingBottom: '2pt' }}>Základ dane:</td>
                      <td align="right">{subtotal.toFixed(2)} €</td>
                    </tr>
                    <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #000' }}>
                      <td style={{ paddingBottom: '2pt' }}>DPH (23%):</td>
                      <td align="right">{tax.toFixed(2)} €</td>
                    </tr>
                    <tr>
                      <td style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '11pt', color: '#dc2626' }}>CELKOM:</td>
                      <td align="right" style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '16pt' }}>{total.toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr></tbody>
          </table>
        )}

        {/* SPACER — podpisy na spodok */}
        <div className="print-spacer" />

        {/* PODPISY */}
        <div className="print-signature-area">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody><tr>
              <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>PODPIS PREVZAL (ZÁKAZNÍK)</td>
              <td width="10%"></td>
              <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>PEČIATKA A PODPIS SERVISU</td>
            </tr></tbody>
          </table>
        </div>

      </div>

      {/* WAREHOUSE BROWSE MODAL */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex items-center justify-center p-6 no-print">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] max-w-2xl w-full shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Vybrať diel <span className="text-red-600">zo skladu</span></h2>
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">{warehouseItems.length} položiek na sklade</p>
              </div>
              <button onClick={() => setWarehouseModalOpen(false)} className="text-zinc-600 hover:text-white transition-colors font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-800">✕</button>
            </div>
            <div className="p-4 border-b border-zinc-800">
              <div className="relative">
                <input type="text" placeholder="Hľadať diel alebo číslo dielu..." value={warehouseModalSearch}
                  onChange={e => setWarehouseModalSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 px-5 rounded-xl text-white font-black text-xs outline-none focus:border-red-600 uppercase italic tracking-widest transition-all" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {warehouseItems
                .filter(w => {
                  const q = nd(warehouseModalSearch);
                  return nd(w.name).includes(q) || (w.part_number && nd(w.part_number).includes(q));
                })
                .map(w => (
                  <button key={w.id} type="button" onClick={() => selectWarehouseItem(w)}
                    className="w-full text-left px-6 py-4 hover:bg-zinc-900 transition-all flex items-center justify-between gap-4 border-b border-zinc-800/40 last:border-0 group">
                    <div className="min-w-0 flex-grow">
                      <span className="text-white font-black text-sm uppercase italic block truncate group-hover:text-red-400 transition-colors">{w.name}</span>
                      {w.part_number && (
                        <span className="text-yellow-400 text-[9px] font-black bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded mt-1 inline-block">{w.part_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-zinc-500 text-[8px] font-black uppercase block">jednotka</span>
                        <span className="text-zinc-400 font-black text-xs">{w.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 text-[8px] font-black uppercase block">na sklade</span>
                        <span className={`font-black text-sm px-2 py-0.5 rounded-lg border ${parseFloat(w.quantity) > 0 ? 'text-green-400 border-green-600/30 bg-green-500/10' : 'text-red-400 border-red-600/30 bg-red-500/10'}`}>
                          {parseFloat(w.quantity).toFixed(0)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 text-[8px] font-black uppercase block">cena bez DPH</span>
                        <span className="text-white font-black text-sm">{parseFloat(w.sale_price).toFixed(2)} €</span>
                      </div>
                    </div>
                  </button>
                ))}
              {warehouseItems.filter(w => {
                const q = nd(warehouseModalSearch);
                return nd(w.name).includes(q) || (w.part_number && nd(w.part_number).includes(q));
              }).length === 0 && (
                <div className="py-16 text-center text-zinc-600 font-black uppercase text-xs tracking-widest italic">Žiadne výsledky</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 no-print font-black">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl font-bold">
            <h3 className="text-4xl font-black uppercase italic mb-6 tracking-tighter text-white">Finalizácia zákazky</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button disabled={invoiceLoading} onClick={() => handleFinalizeJob(true)} className="bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all shadow-xl font-bold font-sans">📄 VYSTAVIŤ FAKTÚRU</button>
              <button disabled={invoiceLoading} onClick={() => handleFinalizeJob(false)} className="bg-zinc-800 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all font-bold font-sans">📂 IBA ODLOŽIŤ</button>
            </div>
            <button onClick={() => setIsInvoiceModalOpen(false)} className="mt-8 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all italic font-black">Späť k úpravám</button>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-black uppercase italic mb-4 tracking-tighter text-white font-bold">Vymazať zákazku?</h3>
            <div className="flex flex-col gap-3 font-black">
              <button onClick={deleteWholeJob} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all italic font-black">Definitívne vymazať</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] hover:text-white transition-all italic tracking-widest font-black">Zrušiť</button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODÁL: VÝBER FORMULÁRA ── */}
      {showFormSelector && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Vybrať <span className="text-red-600">formulár</span></h3>
              <button onClick={() => setShowFormSelector(false)} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
            </div>
            {formTemplates.length === 0 ? (
              <div className="text-center text-zinc-600 font-black uppercase text-xs tracking-widest py-8">
                Žiadne formuláre. Nahrajte ich v <strong className="text-zinc-400">Nastavenia → Formuláre</strong>.
              </div>
            ) : (
              <div className="space-y-3">
                {formTemplates.map(t => (
                  <button key={t.id} onClick={() => openFormFill(t)} className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-600 p-5 rounded-2xl transition-all text-left group">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="font-black uppercase text-sm group-hover:text-white">{t.name}</p>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString('sk-SK')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODÁL: VYPLNIŤ FORMULÁR ── */}
      {showFormFill && activeFormTemplate && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex no-print font-bold overflow-hidden">
          <div className="flex flex-col w-full max-w-4xl mx-auto bg-zinc-950 border-x border-zinc-800 overflow-y-auto">
            {/* HEADER */}
            <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-8 py-5 flex justify-between items-center z-10">
              <div>
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Formulár</p>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{activeFormTemplate.name}</h3>
              </div>
              <div className="flex gap-3">
                <button onClick={handlePrintForm} className="bg-zinc-800 hover:bg-white hover:text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">🖨️ Vytlačiť</button>
                <button onClick={handleSaveForm} disabled={savingForm} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                  {savingForm ? 'Ukladám...' : '💾 Uložiť do zákazky'}
                </button>
                <button onClick={() => setShowFormFill(false)} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* ODOVZDÁVAJÚCI */}
              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Odovzdávajúci</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[['Meno / Názov spol.', 'customer_name'], ['Adresa', 'customer_address'], ['Tel. číslo', 'customer_phone'], ['IČO', 'customer_ico']].map(([label, key]) => (
                    <div key={key}>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
                      <input value={formFillData[key]} onChange={e => setFormFillData(p => ({...p, [key]: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                    </div>
                  ))}
                </div>
              </section>

              {/* VOZIDLO */}
              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Údaje o vozidle</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[['Značka', 'brand'], ['Model', 'model'], ['EČV', 'plate'], ['Stav KM', 'mileage'], ['Rok výroby', 'year'], ['Palivo', 'fuel'], ['KW', 'engine_power'], ['Objem motora', 'engine_volume']].map(([label, key]) => (
                    <div key={key}>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
                      <input value={formFillData[key]} onChange={e => setFormFillData(p => ({...p, [key]: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Poznámka</label>
                  <textarea value={formFillData.note} onChange={e => setFormFillData(p => ({...p, note: e.target.value}))} rows={2} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold resize-none" />
                </div>
              </section>

              {/* MERANIA */}
              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Merania a hodnoty</h4>
                  <button type="button" onClick={() => setFormFillData(p => ({...p, measurements: [...p.measurements, { label: '', value: '' }]}))} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-all">+ Pridať riadok</button>
                </div>
                <div className="space-y-3">
                  {formFillData.measurements.map((m, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input placeholder="Názov merania" value={m.label} onChange={e => { const ms = [...formFillData.measurements]; ms[i] = {...ms[i], label: e.target.value}; setFormFillData(p => ({...p, measurements: ms})); }} className="flex-[2] bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 font-bold" />
                      <input placeholder="Hodnota" value={m.value} onChange={e => { const ms = [...formFillData.measurements]; ms[i] = {...ms[i], value: e.target.value}; setFormFillData(p => ({...p, measurements: ms})); }} className="flex-1 bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 font-bold" />
                      <button onClick={() => setFormFillData(p => ({...p, measurements: p.measurements.filter((_, j) => j !== i)}))} className="text-zinc-700 hover:text-red-500 transition-all font-black text-lg">×</button>
                    </div>
                  ))}
                </div>
              </section>

              {/* DÁTUMY */}
              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Dátumy</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Prevzaté dňa</label>
                    <input type="date" value={formFillData.date_received} onChange={e => setFormFillData(p => ({...p, date_received: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Odovzdané dňa</label>
                    <input type="date" value={formFillData.date_returned} onChange={e => setFormFillData(p => ({...p, date_returned: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                  </div>
                </div>
              </section>

              {/* PDF REFERENCIA */}
              {activeFormTemplate.pdf_url && (
                <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Referenčný formulár (PDF)</h4>
                  <iframe src={activeFormTemplate.pdf_url} className="w-full h-[500px] rounded-xl border border-zinc-700" title="Formulár" />
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ULOŽENÉ FORMULÁRE V ZÁKAZKE (kompaktný zoznam) ── */}
      {savedForms.length > 0 && (
        <div className="no-print mt-6 space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Uložené formuláre ({savedForms.length})</h4>
          {savedForms.map(f => (
            <div key={f.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800 px-5 py-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <span>📋</span>
                <div>
                  <p className="font-black uppercase text-xs">{f.template_name}</p>
                  <p className="text-[9px] text-zinc-600 uppercase">{new Date(f.created_at).toLocaleDateString('sk-SK')}</p>
                </div>
              </div>
              <button onClick={() => {
                setActiveFormTemplate({ id: f.template_id, name: f.template_name, pdf_url: null });
                setFormFillData(f.filled_data);
                setShowFormFill(true);
              }} className="text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500">
                Otvoriť / Tlačiť
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .zakazka-print-area { display: none; }
        .print-spacer { display: none; }
        .print-signature-area { display: none; }

        @media print {
          @page { size: A4; margin: 0 !important; }
          html, body { background: #fff !important; color: #000 !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .min-h-screen { min-height: 0 !important; padding: 0 !important; background: #fff !important; }

          body * { visibility: hidden !important; }
          .zakazka-print-area { visibility: visible !important; display: flex !important; }
          .zakazka-print-area * { visibility: visible !important; }

          .zakazka-print-area {
            flex-direction: column !important;
            min-height: 26.7cm !important;
            background: #fff !important;
            padding: 0.8cm 1.5cm 1.5cm 1.5cm !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          .print-spacer { display: block !important; flex: 1 !important; visibility: visible !important; }
          .print-signature-area { display: block !important; visibility: visible !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}