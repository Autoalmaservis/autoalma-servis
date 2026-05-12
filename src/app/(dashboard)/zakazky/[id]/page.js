'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import SmsPanel from '../../prijem/SmsPanel'; // PRIDANÝ IMPORT ZACHOVANÝ
import PrintForm from './components/PrintForm';
import CompletionModal from './components/CompletionModal';
import JobPhotos from './components/JobPhotos';
import JobTasks from './components/JobTasks';
import DeleteModal from './components/DeleteModal';
import InvoiceModal from './components/InvoiceModal';
import ChangeCustomerModal from './components/ChangeCustomerModal';
import WarehouseModal from './components/WarehouseModal';
import MechanicSplits from './components/MechanicSplits';
import JobFormManager from './components/JobFormManager';

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
  const dropdownRef = useRef(null);
  const [rateCategories, setRateCategories] = useState([]);
  const [activeOffer, setActiveOffer] = useState(null);
  const [pastOffers, setPastOffers] = useState([]); // HISTÓRIA PONÚK ZACHOVANÁ

  const [myCompany, setMyCompany] = useState({ name: 'AutoAlma Servis', address: '', city: '', zip: '', ico: '', dic: '', bank: '', phone: '', email: '', web: '', logo_url: '' });

  // Zmena odberateľa
  const [showChangeCustomer, setShowChangeCustomer] = useState(false);
  const [discountType, setDiscountType] = useState('pct');
  const [discountValue, setDiscountValue] = useState('');
  const [editingComplaints, setEditingComplaints] = useState(false);
  const [complaintsText, setComplaintsText] = useState('');
  const [savingComplaints, setSavingComplaints] = useState(false);

  // Editácia položiek
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({ name: '', quantity: 1, unit_price: 0, unit: 'ks' });
  const [editItemVatStr, setEditItemVatStr] = useState('');
  const [newItemVatStr, setNewItemVatStr] = useState('');

  const [showFormSelector, setShowFormSelector] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Modál dokončenia zákazky
  const [showCompleteModal, setShowCompleteModal] = useState(false);
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
        await supabase.from('job_tickets').update({ has_unread_finding: false }).eq('id', id);
        return enrichedData;
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

  const openEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemForm({ name: item.name, quantity: item.quantity, unit_price: parseFloat(item.unit_price), unit: item.unit });
    setEditItemVatStr((parseFloat(item.unit_price) * 1.23).toFixed(2));
  };

  const saveEditItem = async (itemId) => {
    if (!await ensureAuth()) return;
    const { error } = await supabase.from('job_items').update({
      name: editItemForm.name,
      quantity: parseFloat(editItemForm.quantity) || 1,
      unit_price: parseFloat(editItemForm.unit_price) || 0,
      unit: editItemForm.unit,
    }).eq('id', itemId);
    if (!error) { setEditingItemId(null); fetchItems(); }
    else alert('Chyba pri ukladaní: ' + error.message);
  };

  const updateJobStatus = async (newStatus) => {
    const { error } = await supabase.from('job_tickets').update({ status: newStatus, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, status: newStatus }));
    else alert("Chyba pri zmene stavu: " + error.message);
  };

  const openCompleteModal = () => setShowCompleteModal(true);

  const updateMechanic = async (employeeId) => {
    const selectedEmp = employees.find(e => e.id === employeeId);
    if (!selectedEmp) return;
    const { error } = await supabase.from('job_tickets').update({ assigned_worker_id: employeeId, technician_name: selectedEmp.name, updated_at: new Date() }).eq('id', id);
    if (!error) setZakazka(prev => ({ ...prev, assigned_worker_id: employeeId, technician_name: selectedEmp.name }));
  };

  // --- UPRAVENÁ FUNKCIA FINALIZÁCIE S ADRESAMI A SPLATNOSŤOU ---
  const handleFinalizeJob = async (isOfficial, paymentMethod) => {
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
        
        // ÚDAJE O DODÁVATEĽOVI z nastavení
        supplier_details: {
            company_name: myCompany.name || 'AutoAlma Servis s.r.o.',
            address: [myCompany.address, myCompany.zip, myCompany.city].filter(Boolean).join(', ') || 'ul. Svornosti 119, 821 06 Bratislava',
            ico: myCompany.ico || '46044876',
            dic: myCompany.dic || '2023194316',
            ic_dph: `SK${(myCompany.dic || '2023194316').replace('SK','')}`,
            bank_account: myCompany.bank || '',
            bank_name: '',
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
            payment_method: isOfficial ? (paymentMethod === 'cash' ? 'Hotovosť' : 'Kartou') : 'Odložená platba',
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

      // Ak hotovosť → zapísať do kasy (bez ohľadu na typ dokladu)
      if (paymentMethod === 'cash') {
        const today = `${teraz.getFullYear()}-${String(teraz.getMonth()+1).padStart(2,'0')}-${String(teraz.getDate()).padStart(2,'0')}`;
        await supabase.from('kasa_entries').insert([{
          date: today,
          type: 'prijem',
          amount: Number(total),
          description: `Zákazka ${zakazka.job_number || zakazka.id.slice(0, 8)} — ${zakazka.car_brand_model || ''}`.trim(),
          spz: zakazka.plate_number,
          job_id: id,
        }]);
      }

      await updateJobStatus('Archivované');
      router.push(`/faktury/${invData.id}`);
    } catch (err) { 
      alert("Chyba pri vytváraní faktúry: " + err.message); 
    } finally { 
      setInvoiceLoading(false); 
    }
  };

  const saveComplaints = async () => {
    if (!await ensureAuth()) return;
    setSavingComplaints(true);
    const { error } = await supabase.from('job_tickets').update({ complaints: complaintsText }).eq('id', id);
    setSavingComplaints(false);
    if (!error) {
      setEditingComplaints(false);
      fetchDetail();
    } else {
      alert('Chyba: ' + error.message);
    }
  };

  const deleteWholeJob = async () => {
    const { error } = await supabase.from('job_tickets').delete().eq('id', id);
    if (!error) router.push('/zakazky');
  };

  const selectWarehouseItem = (w) => {
    const price = parseFloat(w.sale_price) || 0;
    setNewItem(prev => ({ ...prev, name: w.name, unit_price: price, unit: w.unit || 'ks', type: 'Materiál' }));
    setNewItemVatStr((price * 1.23).toFixed(2));
    setShowItemDropdown(false);
    setWarehouseModalOpen(false);
  };

  const selectCatalogItem = (c) => {
    const price = parseFloat(c.unit_price) || 0;
    setNewItem(prev => ({ ...prev, name: c.name, unit_price: price, unit: c.unit, type: c.type === 'práca' ? 'Práca' : 'Materiál' }));
    setNewItemVatStr((price * 1.23).toFixed(2));
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
      quantity: parseFloat(newItem.quantity) || 1,
      unit_price: parseFloat(newItem.unit_price) || 0,
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
    const totalBefore = subtotal + tax;
    const discNum = parseFloat(discountValue) || 0;
    const discountAmount = discountType === 'eur' ? discNum : totalBefore * discNum / 100;
    const total = Math.max(0, totalBefore - discountAmount);
    return { subtotalMaterial, subtotalWork, subtotal, tax, total, discountAmount, totalBefore };
  };

  const { subtotalMaterial, subtotalWork, subtotal, tax, total, discountAmount, totalBefore } = calculateTotal();
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
        
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-red-600 pb-8 mb-8 font-bold">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">AutoAlma <span className="text-red-600">Servis</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic uppercase">{[myCompany.address, myCompany.zip, myCompany.city].filter(Boolean).join(', ') || 'ul. Svornosti 119, 821 06 Bratislava'}{myCompany.web ? ` | ${myCompany.web}` : ''}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 mb-10 border-b border-zinc-800 pb-10">
          <div>
            <h4 className="text-red-600 uppercase text-[10px] mb-3 font-black tracking-widest italic">Dodávateľ</h4>
            <p className="text-lg font-black italic">{myCompany.name || 'AutoAlma Servis s.r.o.'}</p>
            <p className="text-xs text-zinc-400">{[myCompany.address, myCompany.zip, myCompany.city].filter(Boolean).join(', ') || 'ul. Svornosti 119, 821 06 Bratislava'}</p>
            <div className="mt-4 text-[10px] font-bold text-zinc-500 uppercase leading-relaxed font-black">
              <p>IČO: {myCompany.ico || '46044876'} | DIČ: {myCompany.dic || '2023194316'}</p>
              {myCompany.bank && <p className="mt-2 text-white italic">IBAN: {myCompany.bank}</p>}
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center justify-end mb-3">
              <button onClick={() => setShowChangeCustomer(true)} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg transition-all tracking-widest">✏️ Zmeniť odberateľa</button>
            </div>
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-10 bg-zinc-800/20 p-4 sm:p-8 rounded-[2rem] border border-zinc-800 text-center font-black uppercase italic">
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
            <p className="text-xs">{zakazka.payment_method || '—'}</p>
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                    {zakazka.year_produced && <p className="text-[10px] text-zinc-400 font-bold">Rok: <span className="text-zinc-200">{zakazka.year_produced}</span></p>}
                    {zakazka.engine_volume && <p className="text-[10px] text-zinc-400 font-bold">Objem: <span className="text-zinc-200">{zakazka.engine_volume} cm³</span></p>}
                    {zakazka.engine_power && <p className="text-[10px] text-zinc-400 font-bold">Výkon: <span className="text-zinc-200">{zakazka.engine_power} kW</span></p>}
                    {zakazka.mileage && <p className="text-[10px] text-zinc-400 font-bold">KM: <span className="text-zinc-200">{zakazka.mileage} km</span></p>}
                    {zakazka.fuel_type && <p className="text-[10px] text-zinc-400 font-bold">Palivo: <span className="text-zinc-200">{zakazka.fuel_type}</span></p>}
                  </div>
                </div>
              </div>
              
              <div className="bg-red-600/5 p-8 rounded-[2rem] border border-red-600/20 shadow-inner">
                <div className="flex items-center justify-between mb-4 no-print">
                  <h2 className="text-red-600 font-black uppercase text-[10px] tracking-widest italic">Zistené závady / Poznámky</h2>
                  {!editingComplaints ? (
                    <button
                      onClick={() => { setComplaintsText(zakazka.complaints || ''); setEditingComplaints(true); }}
                      className="text-[9px] font-black uppercase text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg transition-all tracking-widest"
                    >✏️ Upraviť</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingComplaints(false)} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white border border-zinc-700 px-3 py-1.5 rounded-lg transition-all tracking-widest">Zrušiť</button>
                      <button onClick={saveComplaints} disabled={savingComplaints} className="text-[9px] font-black uppercase bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg transition-all tracking-widest disabled:opacity-50">{savingComplaints ? 'Ukladám...' : 'Uložiť'}</button>
                    </div>
                  )}
                </div>
                {editingComplaints ? (
                  <textarea
                    value={complaintsText}
                    onChange={e => setComplaintsText(e.target.value)}
                    rows={5}
                    autoFocus
                    className="w-full bg-black/40 border border-red-600/40 focus:border-red-500 p-4 rounded-2xl text-sm text-white font-bold outline-none leading-relaxed resize-none"
                  />
                ) : (
                  <pre className="text-xs font-sans text-zinc-400 whitespace-pre-wrap font-bold leading-relaxed">
                    {zakazka.complaints || 'Žiadne zaznamenané závady.'}
                  </pre>
                )}
              </div>
          </div>

          <JobTasks tasks={tasks} jobId={id} onRefresh={fetchTasks} />
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
          <div className="bg-black/30 rounded-3xl border border-zinc-800 overflow-x-auto shadow-inner font-bold">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 tracking-widest italic">
                <tr>
                  <th className="p-4 w-32">Typ</th>
                  <th className="p-4">Položka</th>
                  <th className="p-4 text-center w-24">Množ.</th>
                  <th className="p-4 text-right w-44">Cena/J</th>
                  <th className="p-4 text-right">Spolu</th>
                  <th className="p-4 text-center no-print w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-black italic uppercase">
                {items.map((item) => (
                  editingItemId === item.id ? (
                    <tr key={item.id} className="bg-zinc-900/60 border-l-2 border-blue-500">
                      <td className="p-3"><span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800' : 'text-orange-400 border-orange-800'}`}>{item.type}</span></td>
                      <td className="p-3">
                        <input type="text" value={editItemForm.name}
                          onChange={e => setEditItemForm(p => ({...p, name: e.target.value}))}
                          className="w-full bg-black border border-zinc-700 p-2 rounded-lg text-white text-xs font-black uppercase italic outline-none focus:border-blue-500" />
                      </td>
                      <td className="p-3">
                        <input type="number" value={editItemForm.quantity}
                          onChange={e => setEditItemForm(p => ({...p, quantity: e.target.value}))}
                          onFocus={e => e.target.select()}
                          className="w-full bg-black border border-zinc-700 p-2 rounded-lg text-white text-xs text-center font-bold outline-none focus:border-blue-500" />
                      </td>
                      <td className="p-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] text-zinc-500 font-black shrink-0 w-11">bez DPH</span>
                            <input type="number" step="any" value={editItemForm.unit_price}
                              onChange={e => { const v = parseFloat(e.target.value) || 0; setEditItemForm(p => ({...p, unit_price: v})); setEditItemVatStr((v * 1.23).toFixed(2)); }}
                              onFocus={e => e.target.select()}
                              className="flex-1 bg-black border border-zinc-700 p-1.5 rounded-lg text-white text-xs text-right font-black outline-none focus:border-blue-500" />
                            <span className="text-[8px] text-zinc-600 shrink-0">€</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] text-amber-500 font-black shrink-0 w-11">s DPH</span>
                            <input type="number" step="any" value={editItemVatStr}
                              onChange={e => { setEditItemVatStr(e.target.value); setEditItemForm(p => ({...p, unit_price: parseFloat((parseFloat(e.target.value || 0) / 1.23).toFixed(4)) || 0})); }}
                              onFocus={e => e.target.select()}
                              className="flex-1 bg-black border border-amber-600/30 p-1.5 rounded-lg text-amber-300 text-xs text-right font-black outline-none focus:border-amber-500" />
                            <span className="text-[8px] text-zinc-600 shrink-0">€</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-xs text-zinc-400">
                        {(parseFloat(editItemForm.quantity || 0) * parseFloat(editItemForm.unit_price || 0)).toFixed(2)} €
                      </td>
                      <td className="p-3 no-print">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => saveEditItem(item.id)} className="w-8 h-8 flex items-center justify-center bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded-xl transition-all font-black text-sm">✓</button>
                          <button onClick={() => setEditingItemId(null)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all font-black text-sm">✕</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="hover:bg-white/5 transition-all">
                      <td className="p-4"><span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800 shadow-lg' : 'text-orange-400 border-orange-800 shadow-lg'}`}>{item.type}</span></td>
                      <td className="p-4 font-black uppercase text-xs tracking-tight">{item.name}</td>
                      <td className="p-4 text-center font-mono text-xs">{item.quantity} {item.unit}</td>
                      <td className="p-4 text-right">
                        <p className="font-mono text-xs text-white">{parseFloat(item.unit_price).toFixed(2)} €</p>
                        <p className="font-mono text-[9px] text-amber-500/60">{(parseFloat(item.unit_price) * 1.23).toFixed(2)} € s DPH</p>
                      </td>
                      <td className="p-4 text-right font-black text-xs">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                      <td className="p-4 text-center no-print">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => openEditItem(item)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-blue-600/20 text-zinc-500 hover:text-blue-400 rounded-xl transition-all text-sm">✏️</button>
                          <button onClick={() => deleteItem(item.id)} className="w-8 h-8 flex items-center justify-center bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white rounded-xl transition-all font-black text-base">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
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
                        setNewItemVatStr(isPraca ? (getRateValue(newItem.rateType) * 1.23).toFixed(2) : '');
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
                          const rateVal = getRateValue(rt);
                          setNewItem({ ...newItem, rateType: rt, unit_price: rateVal, name: `Servisná práca ${rt}` });
                          setNewItemVatStr((rateVal * 1.23).toFixed(2));
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
                        <button type="button" onClick={() => setWarehouseModalOpen(true)}
                          title="Prehľadávať sklad"
                          className="shrink-0 px-3 bg-zinc-800 border border-zinc-700 hover:bg-red-600 hover:border-red-600 text-zinc-400 hover:text-white rounded-xl transition-all text-sm">
                          🏭
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <input type="number" min="0" step="any" className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-center text-xs font-bold" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: e.target.value})} onFocus={e => e.target.select()} />
                  </td>
                  <td className="p-3 w-48">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-zinc-500 font-black shrink-0 w-11">bez DPH</span>
                        <input type="number" step="any" min="0"
                          value={newItem.unit_price || ''}
                          placeholder="0.00"
                          onChange={e => { const v = parseFloat(e.target.value) || 0; setNewItem({...newItem, unit_price: v}); setNewItemVatStr((v * 1.23).toFixed(2)); }}
                          onFocus={e => e.target.select()}
                          className="flex-1 bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-white text-xs text-right font-black outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-amber-500 font-black shrink-0 w-11">s DPH</span>
                        <input type="number" step="any" min="0"
                          value={newItemVatStr}
                          placeholder="0.00"
                          onChange={e => { setNewItemVatStr(e.target.value); setNewItem({...newItem, unit_price: parseFloat((parseFloat(e.target.value || 0) / 1.23).toFixed(4)) || 0}); }}
                          onFocus={e => e.target.select()}
                          className="flex-1 bg-zinc-900 border border-amber-600/30 p-2 rounded-lg text-amber-300 text-xs text-right font-black outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
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

              {/* ZĽAVA */}
              {zakazka.status !== 'Archivované' && (
                <div className="w-80 no-print">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Zľava:</span>
                    <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-[10px] font-black">
                      <button onClick={() => setDiscountType('pct')} className={`px-3 py-1 transition-all ${discountType === 'pct' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>%</button>
                      <button onClick={() => setDiscountType('eur')} className={`px-3 py-1 transition-all ${discountType === 'eur' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>€</button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder={discountType === 'pct' ? '0 %' : '0.00 €'}
                      className="w-24 bg-black border border-zinc-700 focus:border-red-500 px-3 py-1 rounded-lg text-white text-[11px] font-black outline-none text-right"
                    />
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between w-full text-red-500 text-[11px] font-black uppercase tracking-widest">
                      <span>Zľava {discountType === 'pct' ? `(${discountValue}%)` : ''}:</span>
                      <span>− {discountAmount.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between w-80 pt-4 border-t-2 border-zinc-700">
                <span className="text-red-600 font-black uppercase italic tracking-tighter text-xl leading-none">Spolu k úhrade:</span>
                <span className={`text-4xl font-black italic tracking-tighter leading-none ${discountAmount > 0 ? 'text-green-400' : ''}`}>{total.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        <JobPhotos jobId={id} />

        <MechanicSplits jobId={id} zakazka={zakazka} items={items} employees={employees} />

        <div className="no-print font-bold space-y-4">
            {zakazka.status !== 'Dokončené' && zakazka.status !== 'Archivované' && (
                <button
                    onClick={openCompleteModal}
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
      <PrintForm
        zakazka={zakazka}
        items={items}
        tasks={tasks}
        myCompany={myCompany}
        subtotal={subtotal}
        tax={tax}
        total={total}
      />

      {warehouseModalOpen && (
        <WarehouseModal
          warehouseItems={warehouseItems}
          onSelect={selectWarehouseItem}
          onClose={() => setWarehouseModalOpen(false)}
        />
      )}

      {isInvoiceModalOpen && (
        <InvoiceModal
          zakazka={zakazka}
          total={total}
          invoiceLoading={invoiceLoading}
          onFinalize={(isOfficial, paymentMethod) => handleFinalizeJob(isOfficial, paymentMethod)}
          onClose={() => setIsInvoiceModalOpen(false)}
        />
      )}

      {/* ===== MODÁL DOKONČENIA ZÁKAZKY ===== */}
      {showCompleteModal && (
        <CompletionModal
          zakazka={zakazka}
          onClose={() => setShowCompleteModal(false)}
          onComplete={() => updateJobStatus('Dokončené')}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteModal
          onConfirm={deleteWholeJob}
          onClose={() => setIsDeleteModalOpen(false)}
        />
      )}
      <JobFormManager
        jobId={id}
        zakazka={zakazka}
        ensureAuth={ensureAuth}
        myCompany={myCompany}
        isOpen={showFormSelector}
        onClose={() => setShowFormSelector(false)}
      />

      {showChangeCustomer && (
        <ChangeCustomerModal
          zakazka={zakazka}
          jobId={id}
          ensureAuth={ensureAuth}
          onComplete={fetchDetail}
          onClose={() => setShowChangeCustomer(false)}
        />
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