'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';

const VAT = 1.23;

export default function DatabazaPage() {
  const [activeTab, setActiveTab] = useState('sklad');

  // --- PRÁCA (SERVICE NORMS) ---
  const [categories, setCategories] = useState([]);
  const [norms, setNorms] = useState([]);
  const [normsLoading, setNormsLoading] = useState(true);
  const [normSearch, setNormSearch] = useState('');
  const [normFilter, setNormFilter] = useState('all');
  const [newCatName, setNewCatName] = useState('');
  const [newNorm, setNewNorm] = useState({ category_id: '', service_name: '', duration_minutes: 30 });
  const [showCatPanel, setShowCatPanel] = useState(false);
  const [editNorm, setEditNorm] = useState(null);

  // --- ÚKONY ---
  const [ukonActions, setUkonActions] = useState([]);
  const [ukonLoading, setUkonLoading] = useState(false);
  const [ukonSearch, setUkonSearch] = useState('');
  const [newUkon, setNewUkon] = useState({ name: '', unit_price: '', unit: 'ks' });
  const [newUkonVatStr, setNewUkonVatStr] = useState('');
  const [editUkon, setEditUkon] = useState(null);
  const [editUkonVatStr, setEditUkonVatStr] = useState('');

  // --- SKLAD ---
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseFetched, setWarehouseFetched] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseSubTab, setWarehouseSubTab] = useState('zoznam');
  const [skladModal, setSkladModal] = useState(null);
  const [importLines, setImportLines] = useState([emptyImportLine()]);
  const [importHeader, setImportHeader] = useState({ supplier: '', doc_number: '', date: new Date().toISOString().slice(0, 10) });
  const [importSaving, setImportSaving] = useState(false);
  const [globalMargin, setGlobalMargin] = useState(30);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef(null);

  // --- HISTÓRIA IMPORTOV ---
  const [importHistory, setImportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revertingId, setRevertingId] = useState(null);
  const [dupWarning, setDupWarning] = useState(null);

  // --- VRATKA ---
  const [vratkaLines, setVratkaLines] = useState([emptyVratkaLine()]);
  const [vratkaHeader, setVratkaHeader] = useState({ supplier: '', doc_number: '', date: new Date().toISOString().slice(0, 10) });
  const [vratkaSaving, setVratkaSaving] = useState(false);

  // --- SPOTREBA ---
  const [spotrebaLines, setSpotrebaLines] = useState([emptySpotrebaLine()]);
  const [spotrebaNote, setSpotrebaNote] = useState('');
  const [spotrebaDate, setSpotrebaDate] = useState(new Date().toISOString().slice(0, 10));
  const [spotrebaSaving, setSpotrebaSaving] = useState(false);

  // --- SORT SKLAD ---
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function emptyImportLine() {
    return { name: '', part_number: '', quantity: 1, purchase_price: '', sale_price: '', unit: 'ks', dodaci_list: '', matched_item: null, merge_action: 'add' };
  }

  function emptyVratkaLine() {
    return { part_number: '', name: '', quantity: 1, matched_item: null };
  }

  function emptySpotrebaLine() {
    return { part_number: '', name: '', quantity: 1, matched_item: null };
  }

  const autoMatch = (line, items) => {
    if (!line.part_number || !line.part_number.trim()) return null;
    return items.find(w => w.part_number && w.part_number.trim().toLowerCase() === line.part_number.trim().toLowerCase()) || null;
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  useEffect(() => {
    fetchNorms();
    fetchWarehouse();
    fetchUkony();
    fetchImportHistory();
  }, []);

  const nd = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---- ÚKONY ----
  const fetchUkony = async () => {
    setUkonLoading(true);
    const { data } = await supabase.from('service_actions').select('*').order('name');
    if (data) setUkonActions(data);
    setUkonLoading(false);
  };

  const addUkon = async (e) => {
    e.preventDefault();
    if (!newUkon.name.trim() || !newUkon.unit_price) return;
    await supabase.from('service_actions').insert([{
      name: newUkon.name.trim(),
      unit_price: parseFloat(newUkon.unit_price),
      unit: newUkon.unit || 'ks',
    }]);
    setNewUkon({ name: '', unit_price: '', unit: 'ks' });
    setNewUkonVatStr('');
    fetchUkony();
  };

  const saveEditUkon = async (e) => {
    e.preventDefault();
    await supabase.from('service_actions').update({
      name: editUkon.name.trim(),
      unit_price: parseFloat(editUkon.unit_price),
      unit: editUkon.unit || 'ks',
    }).eq('id', editUkon.id);
    setEditUkon(null);
    fetchUkony();
  };

  const deleteUkon = async (id) => {
    if (!confirm('Naozaj vymazať tento úkon?\n\nPOZOR: Úkon zmizne z katalógu, ale v zákazkách kde bol použitý zostane zachovaný.')) return;
    await supabase.from('service_actions').delete().eq('id', id);
    fetchUkony();
  };

  // ---- PRÁCA / NORMY ----
  const fetchNorms = async () => {
    setNormsLoading(true);
    const { data: catData } = await supabase.from('service_categories').select('*').order('name');
    if (catData) setCategories(catData);
    const { data: normData } = await supabase.from('service_norms').select('*, service_categories(name)').order('service_name');
    if (normData) setNorms(normData);
    setNormsLoading(false);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await supabase.from('service_categories').insert([{ name: newCatName.toUpperCase() }]);
    setNewCatName('');
    fetchNorms();
  };

  const deleteCategory = async (id) => {
    if (!confirm('Zmazaním kategórie zmažete aj všetky priradené práce. Pokračovať?')) return;
    await supabase.from('service_categories').delete().eq('id', id);
    fetchNorms();
  };

  const addNorm = async (e) => {
    e.preventDefault();
    if (!newNorm.service_name || !newNorm.category_id) return;
    await supabase.from('service_norms').insert([newNorm]);
    setNewNorm({ ...newNorm, service_name: '' });
    fetchNorms();
  };

  const saveEditNorm = async (e) => {
    e.preventDefault();
    await supabase.from('service_norms').update({
      service_name: editNorm.service_name,
      duration_minutes: parseInt(editNorm.duration_minutes),
      category_id: editNorm.category_id,
    }).eq('id', editNorm.id);
    setEditNorm(null);
    fetchNorms();
  };

  const deleteNorm = async (id) => {
    if (!confirm('Naozaj vymazať túto normu práce?')) return;
    await supabase.from('service_norms').delete().eq('id', id);
    fetchNorms();
  };

  const filteredNorms = norms.filter(n =>
    (normFilter === 'all' || n.category_id === normFilter) &&
    nd(n.service_name).includes(nd(normSearch))
  );

  // ---- SKLAD ----
  const fetchWarehouse = async () => {
    setWarehouseLoading(true);
    const { data } = await supabase.from('warehouse_items').select('*').order('name');
    if (data) setWarehouseItems(data);
    setWarehouseLoading(false);
    setWarehouseFetched(true);
  };

  const fetchImportHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) console.error('import_batches fetch error:', error.message);
    setImportHistory(data || []);
    setHistoryLoading(false);
  };

  const revertImport = async (batch) => {
    const isOut = batch.batch_type === 'vratka' || batch.batch_type === 'spotreba';
    const labelMap = { vratka: 'vratku', spotreba: 'spotrebu', import: 'import' };
    const label = labelMap[batch.batch_type] || 'import';
    const confirmMsg = isOut ? 'Množstvo sa vráti späť na sklad.' : 'Z každého dielu sa odráta naskladnené množstvo.';
    if (!confirm(`Naozaj zrušiť ${label} "${batch.doc_number || batch.supplier || batch.note || 'bez názvu'}"?\n\n${confirmMsg}`)) return;
    setRevertingId(batch.id);
    for (const item of (batch.items_json || [])) {
      if (!item.item_id || item.quantity <= 0) continue;
      const existing = warehouseItems.find(w => w.id === item.item_id);
      if (!existing) continue;
      if (isOut) {
        await supabase.from('warehouse_items').update({ quantity: parseFloat(existing.quantity) + item.quantity }).eq('id', item.item_id);
      } else {
        const newQty = Math.max(0, parseFloat(existing.quantity) - item.quantity);
        await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', item.item_id);
      }
    }
    await supabase.from('import_batches').delete().eq('id', batch.id);
    setRevertingId(null);
    fetchWarehouse();
    fetchImportHistory();
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'sklad' && !warehouseFetched) fetchWarehouse();
  };

  const openSkladAdd = () => setSkladModal({
    mode: 'add',
    item: { name: '', part_number: '', purchase_price: '', sale_price: '', unit: 'ks', initial_quantity: '' }
  });

  const openSkladEdit = (w) => setSkladModal({
    mode: 'edit',
    item: { id: w.id, name: w.name, part_number: w.part_number || '', purchase_price: w.purchase_price, sale_price: w.sale_price, unit: w.unit }
  });

  const openNaskladnit = (w) => setSkladModal({
    mode: 'naskladnit',
    item: { id: w.id, name: w.name, qty: '', new_purchase_price: '', note: '', current_quantity: w.quantity }
  });

  const openSkladSpotreba = (w) => setSkladModal({
    mode: 'spotreba_item',
    item: { id: w.id, name: w.name, unit: w.unit, purchase_price: w.purchase_price, qty: '', note: '', current_quantity: w.quantity }
  });

  const saveSkladItem = async (e) => {
    e.preventDefault();
    const item = skladModal.item;
    const payload = {
      name: item.name.toUpperCase(),
      part_number: item.part_number || null,
      purchase_price: parseFloat(item.purchase_price) || 0,
      sale_price: parseFloat(item.sale_price) || 0,
      unit: item.unit || 'ks',
    };
    if (skladModal.mode === 'edit') {
      await supabase.from('warehouse_items').update(payload).eq('id', item.id);
    } else {
      const qty = parseFloat(item.initial_quantity) || 0;
      const { data: newItem } = await supabase.from('warehouse_items')
        .insert([{ ...payload, quantity: qty }]).select().single();
      if (newItem && qty > 0) {
        await supabase.from('warehouse_movements').insert([{
          item_id: newItem.id, movement_type: 'in', quantity: qty, note: 'Počiatočný stav'
        }]);
      }
    }
    setSkladModal(null);
    fetchWarehouse();
  };

  const doNaskladnit = async (e) => {
    e.preventDefault();
    const { item } = skladModal;
    const qty = parseFloat(item.qty) || 0;
    if (qty <= 0) return;
    await supabase.from('warehouse_movements').insert([{
      item_id: item.id, movement_type: 'in', quantity: qty, note: item.note || null,
    }]);
    const updatePayload = { quantity: parseFloat(item.current_quantity) + qty };
    if (item.new_purchase_price) updatePayload.purchase_price = parseFloat(item.new_purchase_price);
    await supabase.from('warehouse_items').update(updatePayload).eq('id', item.id);
    setSkladModal(null);
    fetchWarehouse();
  };

  const doSkladSpotreba = async (e) => {
    e.preventDefault();
    const { item } = skladModal;
    const qty = parseFloat(item.qty) || 0;
    if (qty <= 0) return;
    const note = ['Spotreba', item.note.trim() || null].filter(Boolean).join(': ');
    await supabase.from('warehouse_movements').insert([{ item_id: item.id, movement_type: 'out', quantity: qty, note }]);
    const newQty = Math.max(0, parseFloat(item.current_quantity) - qty);
    await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', item.id);
    const totalWithoutVat = qty * (parseFloat(item.purchase_price) || 0);
    await supabase.from('import_batches').insert([{
      doc_number: item.note.trim() || null,
      supplier: null,
      import_date: new Date().toISOString().slice(0, 10),
      total_without_vat: totalWithoutVat,
      total_with_vat: totalWithoutVat * 1.23,
      items_json: [{ item_id: item.id, name: item.name, part_number: null, quantity: qty, purchase_price: parseFloat(item.purchase_price) || 0, sale_price: 0 }],
      batch_type: 'spotreba',
    }]);
    setSkladModal(null);
    await Promise.all([fetchWarehouse(), fetchImportHistory()]);
  };

  const deleteSkladItem = async (id) => {
    if (!confirm('Naozaj vymazať túto položku zo skladu?\n\nPOZOR: Položka zmizne z katalógu, ale v zákazkách kde bola použitá zostane zachovaná. Zmažú sa aj všetky skladové pohyby.')) return;
    await supabase.from('warehouse_items').delete().eq('id', id);
    fetchWarehouse();
  };

  const addImportLine = () => setImportLines(l => [...l, emptyImportLine()]);
  const removeImportLine = (i) => setImportLines(l => l.filter((_, idx) => idx !== i));
  const updateImportLine = (i, field, value) =>
    setImportLines(l => l.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
      if (field === 'purchase_price' && !line.sale_price && value) {
        updated.sale_price = (parseFloat(value) * (1 + globalMargin / 100)).toFixed(2);
      }
      if (field === 'part_number') {
        updated.matched_item = autoMatch({ ...line, part_number: value }, warehouseItems);
      }
      return updated;
    }));

  const applyMarginToAll = () => {
    setImportLines(l => l.map(line => ({
      ...line,
      sale_price: line.purchase_price
        ? (parseFloat(line.purchase_price) * (1 + globalMargin / 100)).toFixed(2)
        : line.sale_price,
    })));
  };

  const submitImport = async (e, force = false) => {
    e.preventDefault();

    // Dedup check
    if (importHeader.doc_number && !force) {
      const { data: existing } = await supabase
        .from('import_batches').select('id, doc_number, supplier, created_at')
        .eq('doc_number', importHeader.doc_number).maybeSingle();
      if (existing) {
        setDupWarning({ existing, evt: e });
        return;
      }
    }

    setImportSaving(true);
    const batchItems = [];

    for (const line of importLines) {
      const qty = parseFloat(line.quantity) || 0;
      if (qty <= 0) continue;
      const note = [
        importHeader.doc_number ? `Doklad: ${importHeader.doc_number}` : null,
        importHeader.supplier || null,
        line.dodaci_list ? `DL: ${line.dodaci_list}` : null,
      ].filter(Boolean).join(' | ');

      if (line.matched_item && line.merge_action === 'add') {
        const existing = line.matched_item;
        await supabase.from('warehouse_movements').insert([{ item_id: existing.id, movement_type: 'in', quantity: qty, note }]);
        const upd = { quantity: parseFloat(existing.quantity) + qty };
        if (line.purchase_price) upd.purchase_price = parseFloat(line.purchase_price);
        if (line.sale_price) upd.sale_price = parseFloat(line.sale_price);
        await supabase.from('warehouse_items').update(upd).eq('id', existing.id);
        batchItems.push({ item_id: existing.id, name: existing.name, part_number: line.part_number || null, quantity: qty, purchase_price: parseFloat(line.purchase_price) || 0, sale_price: parseFloat(line.sale_price) || 0 });
      } else if (line.name.trim()) {
        const newPayload = { name: line.name.toUpperCase(), part_number: line.part_number || null, purchase_price: parseFloat(line.purchase_price) || 0, sale_price: parseFloat(line.sale_price) || 0, unit: line.unit || 'ks', quantity: qty };
        const { data: newItem } = await supabase.from('warehouse_items').insert([newPayload]).select().single();
        if (newItem) {
          await supabase.from('warehouse_movements').insert([{ item_id: newItem.id, movement_type: 'in', quantity: qty, note }]);
          batchItems.push({ item_id: newItem.id, name: newPayload.name, part_number: line.part_number || null, quantity: qty, purchase_price: newPayload.purchase_price, sale_price: newPayload.sale_price });
        }
      }
    }

    // Uložiť batch do histórie
    const totalWithoutVat = batchItems.reduce((s, i) => s + i.quantity * i.purchase_price, 0);
    await supabase.from('import_batches').insert([{
      doc_number: importHeader.doc_number || null,
      supplier: importHeader.supplier || null,
      import_date: importHeader.date,
      total_without_vat: totalWithoutVat,
      total_with_vat: totalWithoutVat * 1.23,
      items_json: batchItems,
    }]);

    setImportSaving(false);
    setDupWarning(null);
    setImportLines([emptyImportLine()]);
    setImportHeader({ supplier: '', doc_number: '', date: new Date().toISOString().slice(0, 10) });
    await Promise.all([fetchWarehouse(), fetchImportHistory()]);
    setWarehouseSubTab('historia');
  };

  // ---- VRATKA ----
  const updateVratkaLine = (i, field, value) =>
    setVratkaLines(l => l.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
      if (field === 'part_number') {
        const pn = value.trim().toLowerCase();
        updated.matched_item = pn ? (warehouseItems.find(w => w.part_number && w.part_number.trim().toLowerCase() === pn) || null) : null;
        if (updated.matched_item) updated.name = updated.matched_item.name;
      }
      return updated;
    }));

  const submitVratka = async (e) => {
    e.preventDefault();
    setVratkaSaving(true);
    const batchItems = [];
    for (const line of vratkaLines) {
      const qty = parseFloat(line.quantity) || 0;
      if (qty <= 0 || !line.matched_item) continue;
      const item = line.matched_item;
      const note = [
        `Vratka${vratkaHeader.doc_number ? `: ${vratkaHeader.doc_number}` : ''}`,
        vratkaHeader.supplier || null,
      ].filter(Boolean).join(' | ');
      await supabase.from('warehouse_movements').insert([{ item_id: item.id, movement_type: 'out', quantity: qty, note }]);
      const newQty = Math.max(0, parseFloat(item.quantity) - qty);
      await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', item.id);
      batchItems.push({ item_id: item.id, name: item.name, part_number: item.part_number || null, quantity: qty, purchase_price: parseFloat(item.purchase_price) || 0, sale_price: parseFloat(item.sale_price) || 0 });
    }
    if (batchItems.length > 0) {
      const totalWithoutVat = batchItems.reduce((s, i) => s + i.quantity * i.purchase_price, 0);
      await supabase.from('import_batches').insert([{
        doc_number: vratkaHeader.doc_number || null,
        supplier: vratkaHeader.supplier || null,
        import_date: vratkaHeader.date,
        total_without_vat: totalWithoutVat,
        total_with_vat: totalWithoutVat * 1.23,
        items_json: batchItems,
        batch_type: 'vratka',
      }]);
    }
    setVratkaSaving(false);
    setVratkaLines([emptyVratkaLine()]);
    setVratkaHeader({ supplier: '', doc_number: '', date: new Date().toISOString().slice(0, 10) });
    await Promise.all([fetchWarehouse(), fetchImportHistory()]);
    setWarehouseSubTab('historia');
  };

  // ---- SPOTREBA ----
  const updateSpotrebaLine = (i, field, value) =>
    setSpotrebaLines(l => l.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
      if (field === 'part_number') {
        const pn = value.trim().toLowerCase();
        updated.matched_item = pn ? (warehouseItems.find(w => w.part_number && w.part_number.trim().toLowerCase() === pn) || null) : null;
        if (updated.matched_item) updated.name = updated.matched_item.name;
      }
      return updated;
    }));

  const submitSpotreba = async (e) => {
    e.preventDefault();
    setSpotrebaSaving(true);
    const batchItems = [];
    for (const line of spotrebaLines) {
      const qty = parseFloat(line.quantity) || 0;
      if (qty <= 0 || !line.matched_item) continue;
      const item = line.matched_item;
      const note = ['Spotreba', spotrebaNote.trim() || null].filter(Boolean).join(': ');
      await supabase.from('warehouse_movements').insert([{ item_id: item.id, movement_type: 'out', quantity: qty, note }]);
      const newQty = Math.max(0, parseFloat(item.quantity) - qty);
      await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', item.id);
      batchItems.push({ item_id: item.id, name: item.name, part_number: item.part_number || null, quantity: qty, purchase_price: parseFloat(item.purchase_price) || 0, sale_price: parseFloat(item.sale_price) || 0 });
    }
    if (batchItems.length > 0) {
      const totalWithoutVat = batchItems.reduce((s, i) => s + i.quantity * i.purchase_price, 0);
      await supabase.from('import_batches').insert([{
        doc_number: spotrebaNote.trim() || null,
        supplier: null,
        import_date: spotrebaDate,
        total_without_vat: totalWithoutVat,
        total_with_vat: totalWithoutVat * 1.23,
        items_json: batchItems,
        batch_type: 'spotreba',
      }]);
    }
    setSpotrebaSaving(false);
    setSpotrebaLines([emptySpotrebaLine()]);
    setSpotrebaNote('');
    setSpotrebaDate(new Date().toISOString().slice(0, 10));
    await Promise.all([fetchWarehouse(), fetchImportHistory()]);
    setWarehouseSubTab('historia');
  };

  // ---- PDF IMPORT ----
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('Prosím nahraj PDF súbor.');
      return;
    }
    setPdfError('');
    setPdfParsing(true);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetchWithAuth('/api/parse-supplier-pdf', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chyba parsovanie');
      if (json.items && json.items.length > 0) {
        setImportHeader(h => ({
          ...h,
          supplier: json.supplier || h.supplier,
          doc_number: json.doc_number || h.doc_number,
          date: json.date || h.date,
        }));
        setImportLines(json.items.map(item => {
          const matched = warehouseItems.find(w =>
            item.part_number && w.part_number &&
            w.part_number.trim().toLowerCase() === item.part_number.trim().toLowerCase()
          ) || null;
          return {
            name: matched ? matched.name : (item.name || ''),
            part_number: item.part_number || '',
            quantity: item.quantity || 1,
            purchase_price: item.purchase_price || '',
            purchase_price_with_vat: item.purchase_price_with_vat || '',
            sale_price: item.sale_price || (matched ? matched.sale_price : '') || '',
            unit: item.unit || matched?.unit || 'ks',
            dodaci_list: item.dodaci_list || '',
            matched_item: matched,
            merge_action: matched ? 'add' : 'new',
          };
        }));
        setWarehouseSubTab('import');
      } else {
        setPdfError('Z faktúry sa nepodarilo extrahovať žiadne položky.');
      }
    } catch (err) {
      setPdfError('Chyba: ' + err.message);
    } finally {
      setPdfParsing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const filteredWarehouse = (() => {
    const filtered = warehouseItems.filter(w =>
      nd(w.name).includes(nd(warehouseSearch)) ||
      (w.part_number && nd(w.part_number).includes(nd(warehouseSearch)))
    );
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      const va = parseFloat(a[sortField]) || 0;
      const vb = parseFloat(b[sortField]) || 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  })();

  const filteredUkony = ukonActions.filter(u => nd(u.name).includes(nd(ukonSearch)));

  const qtyColor = (qty) => {
    if (qty <= 0) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (qty <= 3) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-white font-bold">

      <header className="mb-10 border-l-4 border-red-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Databáza <span className="text-red-600 text-4xl">Cenník</span></h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mt-2 font-black italic">Sklad náhradných dielov a normy prác</p>
        </div>
        {activeTab === 'sklad' && warehouseSubTab === 'zoznam' && (
          <button onClick={openSkladAdd} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl tracking-widest">
            + Pridať na sklad
          </button>
        )}
        {activeTab === 'ukon' && (
          <button onClick={() => document.getElementById('ukon-form-name')?.focus()} className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-500 transition-all shadow-xl tracking-widest">
            + Pridať úkon
          </button>
        )}
      </header>

      {/* ZÁLOŽKY */}
      <div className="flex bg-zinc-900/50 p-1.5 rounded-[1.8rem] border border-zinc-800 mb-8 w-full md:w-auto">
        {[
          { key: 'sklad', label: '🏭 Sklad' },
          { key: 'práca', label: '🛠️ Práce' },
          { key: 'ukon', label: '⚡ Úkony' },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === tab.key ? 'bg-red-600 text-white italic shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: SKLAD ===== */}
      {activeTab === 'sklad' && (
        <div className="space-y-6">

          {/* SUB-TABS */}
          <div className="flex flex-wrap gap-2 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 w-fit">
            {[
              { key: 'zoznam', label: '📋 Zoznam skladu' },
              { key: 'import', label: '📥 Import dodacieho listu' },
              { key: 'vratka', label: '📤 Vratka' },
              { key: 'spotreba', label: '🔧 Spotreba' },
              { key: 'historia', label: '📜 História' },
            ].map(st => (
              <button key={st.key}
                onClick={() => setWarehouseSubTab(st.key)}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${warehouseSubTab === st.key ? 'bg-red-600 text-white italic shadow-lg' : 'text-zinc-500 hover:text-white'}`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* HODNOTA SKLADU — vždy viditeľná */}
          {(() => {
            const nakupBezDph = warehouseItems.reduce((s, w) => s + parseFloat(w.purchase_price) * parseFloat(w.quantity), 0);
            const pultBezDph = warehouseItems.reduce((s, w) => s + parseFloat(w.sale_price) * parseFloat(w.quantity), 0);
            return (
              <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-5">
                <div className="flex flex-wrap gap-6 items-center justify-between">
                  <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                    Celkom položiek na sklade: <span className="text-white text-sm ml-1">{warehouseItems.length}</span>
                  </span>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Nákup bez DPH</p>
                      <p className="text-lg font-black text-white">{nakupBezDph.toFixed(2)} €</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Nákup s DPH</p>
                      <p className="text-lg font-black text-amber-300">{(nakupBezDph * 1.23).toFixed(2)} €</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Pult bez DPH</p>
                      <p className="text-lg font-black text-zinc-300">{pultBezDph.toFixed(2)} €</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-green-500 mb-0.5">Pult s DPH</p>
                      <p className="text-lg font-black text-green-300">{(pultBezDph * 1.23).toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ZOZNAM SKLADU */}
          {warehouseSubTab === 'zoznam' && (
            <>
              <div className="relative w-full md:w-96">
                <input type="text" placeholder="Hľadať podľa názvu alebo čísla dielu..." value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 px-6 rounded-2xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest" />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
              </div>

              <div className="hidden md:grid grid-cols-[140px_1fr_80px_100px_120px_120px_130px_120px] gap-3 px-6 py-2">
                {['Číslo dielu', 'Názov', 'Jedn.'].map(h => (
                  <span key={h} className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{h}</span>
                ))}
                {[
                  { label: 'Na sklade', field: 'quantity' },
                  { label: 'Nákup bez DPH', field: 'purchase_price' },
                  { label: 'Pult bez DPH', field: 'sale_price' },
                  { label: 'Pult s DPH', field: null },
                  { label: '', field: null },
                ].map(({ label, field }) => field ? (
                  <button key={label} onClick={() => toggleSort(field)}
                    className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors text-left">
                    {label}
                    <span className={`text-[10px] ${sortField === field ? 'text-red-500' : 'text-zinc-700'}`}>
                      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  <span key={label} className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
                ))}
              </div>

              {warehouseLoading ? (
                <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam sklad...</div>
              ) : filteredWarehouse.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">Sklad je prázdny</div>
              ) : (
                <div className="space-y-2">
                  {filteredWarehouse.map(w => (
                    <div key={w.id} className="bg-zinc-950 border border-zinc-900 hover:border-zinc-700 p-4 md:px-6 rounded-2xl flex flex-col md:grid md:grid-cols-[140px_1fr_80px_100px_120px_120px_130px_120px] md:items-center gap-3 group transition-all">
                      <div>
                        {w.part_number
                          ? <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">{w.part_number}</span>
                          : <span className="text-zinc-700 text-[9px] font-black">—</span>}
                      </div>
                      <span className="text-sm font-black uppercase italic text-white truncate">{w.name}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase">{w.unit}</span>
                      <div>
                        <span className={`text-sm font-black px-3 py-1 rounded-lg border ${qtyColor(w.quantity)}`}>
                          {parseFloat(w.quantity).toFixed(w.unit === 'ks' ? 0 : 2)} {w.unit}
                        </span>
                      </div>
                      <span className="text-sm font-black text-zinc-300">{parseFloat(w.purchase_price).toFixed(2)} €</span>
                      <span className="text-sm font-black text-zinc-300">{parseFloat(w.sale_price).toFixed(2)} €</span>
                      <span className="text-sm font-black text-white">{(parseFloat(w.sale_price) * VAT).toFixed(2)} €</span>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openNaskladnit(w)} title="Naskladniť"
                          className="p-2.5 bg-green-600/20 border border-green-600/30 text-green-400 rounded-xl hover:bg-green-600 hover:text-white transition-all text-xs font-black px-3">
                          + Sklad
                        </button>
                        <button onClick={() => openSkladSpotreba(w)} title="Vydať do spotreby"
                          className="p-2.5 bg-purple-600/20 border border-purple-600/30 text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white transition-all text-xs font-black px-3">
                          🔧
                        </button>
                        <button onClick={() => openSkladEdit(w)}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                        {parseFloat(w.quantity) <= 0 && (
                          <button onClick={() => deleteSkladItem(w.id)}
                            className="p-2.5 bg-red-600/20 border border-red-600/40 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all text-xs" title="Vymazať (0 ks na sklade)">🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </>
          )}

          {/* HISTÓRIA IMPORTOV */}
          {warehouseSubTab === 'historia' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                  Importy a vrátky — kliknutím na <span className="text-red-500">Vrátiť</span> sa operácia zruší
                </p>
                <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">{importHistory.length} záznamov</span>
              </div>
              {historyLoading ? (
                <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam históriu...</div>
              ) : importHistory.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">Žiadne importy</div>
              ) : (
                <div className="space-y-3">
                  {importHistory.map(batch => (
                    <div key={batch.id} className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-[2rem] p-5 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            {batch.batch_type === 'vratka' ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">📤 Vratka</span>
                            ) : batch.batch_type === 'spotreba' ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">🔧 Spotreba</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg">📥 Naskladnenie</span>
                            )}
                            {batch.doc_number && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">
                                {batch.doc_number}
                              </span>
                            )}
                            {batch.supplier && (
                              <span className="text-sm font-black uppercase italic text-white">{batch.supplier}</span>
                            )}
                            <span className="text-[9px] text-zinc-500 font-black">
                              {batch.import_date ? new Date(batch.import_date).toLocaleDateString('sk-SK') : ''} · {new Date(batch.created_at).toLocaleDateString('sk-SK')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                              {(batch.items_json || []).length} položiek
                            </span>
                            <span className="text-[9px] text-zinc-400 font-black">
                              {parseFloat(batch.total_without_vat).toFixed(2)} € bez DPH
                            </span>
                            <span className="text-[9px] text-amber-400 font-black">
                              {parseFloat(batch.total_with_vat).toFixed(2)} € s DPH
                            </span>
                          </div>
                          {/* Položky */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(batch.items_json || []).slice(0, 6).map((item, idx) => (
                              <span key={idx} className="text-[8px] font-black uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-400">
                                {item.name} ×{item.quantity}
                              </span>
                            ))}
                            {(batch.items_json || []).length > 6 && (
                              <span className="text-[8px] font-black text-zinc-600">+{batch.items_json.length - 6} ďalších</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => revertImport(batch)}
                          disabled={revertingId === batch.id}
                          className="shrink-0 bg-red-600/10 hover:bg-red-600 border border-red-600/30 hover:border-red-600 text-red-500 hover:text-white font-black px-5 py-3 rounded-2xl uppercase text-[9px] tracking-widest transition-all disabled:opacity-50"
                        >
                          {revertingId === batch.id ? 'Vraciam...' : batch.batch_type === 'vratka' ? '↩ Zrušiť vratku' : batch.batch_type === 'spotreba' ? '↩ Zrušiť spotrebu' : '↩ Vrátiť import'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* IMPORT DODACIEHO LISTU */}
          {warehouseSubTab === 'import' && (
            <form onSubmit={submitImport} className="space-y-6">

              {/* PDF IMPORT */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4">Import faktúry / dodacieho listu — PDF</p>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className={`flex items-center gap-3 cursor-pointer px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border-2 border-dashed ${pdfParsing ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' : 'border-red-600/50 text-red-500 hover:bg-red-600/10'}`}>
                    {pdfParsing
                      ? <><span className="animate-spin">⏳</span> Analyzujem PDF...</>
                      : <><span>📄</span> Nahrať PDF faktúru od dodávateľa</>}
                    <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" disabled={pdfParsing} onChange={handlePdfUpload} />
                  </label>
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                    Claude AI rozpozná položky, čísla dielov a ceny automaticky
                  </p>
                </div>
                {pdfError && (
                  <p className="mt-3 text-red-500 text-xs font-black uppercase tracking-widest">{pdfError}</p>
                )}
              </div>

              {/* HLAVIČKA DOKLADU */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-5">Údaje dokladu</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dodávateľ</label>
                    <input type="text" value={importHeader.supplier} onChange={e => setImportHeader(h => ({ ...h, supplier: e.target.value }))}
                      placeholder="napr. AutoParts s.r.o."
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Číslo dokladu</label>
                    <input type="text" value={importHeader.doc_number} onChange={e => setImportHeader(h => ({ ...h, doc_number: e.target.value }))}
                      placeholder="napr. DL-2024-001"
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dátum</label>
                    <input type="date" value={importHeader.date} onChange={e => setImportHeader(h => ({ ...h, date: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                </div>
              </div>

              {/* RIADKY */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Položky</p>
                  <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Marža pre pult cenu</span>
                    <div className="relative">
                      <input type="number" min="0" max="500" step="1" value={globalMargin}
                        onChange={e => setGlobalMargin(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-black border border-zinc-700 focus:border-red-600 p-2 pr-5 rounded-xl text-white font-black text-xs outline-none text-center transition-all" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px] font-black">%</span>
                    </div>
                    <button type="button" onClick={applyMarginToAll}
                      className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl uppercase text-[9px] tracking-widest transition-all whitespace-nowrap">
                      Aplikovať na všetky
                    </button>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-[130px_160px_60px_100px_80px_100px_50px_110px_28px] gap-2 px-2">
                  {['Číslo dielu', 'Názov dielu', 'Množ.', 'Nákup bez DPH', 'S DPH', 'Pult bez DPH', 'Jedn.', 'Dodací list', ''].map(h => (
                    <span key={h} className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{h}</span>
                  ))}
                </div>

                {importLines.map((line, i) => {
                  const priceMatch = line.matched_item && line.purchase_price &&
                    parseFloat(line.purchase_price).toFixed(2) === parseFloat(line.matched_item.purchase_price).toFixed(2);
                  return (
                  <div key={i} className={`rounded-2xl border overflow-hidden ${priceMatch ? 'border-green-600/40' : line.matched_item ? 'border-yellow-600/50' : 'border-zinc-800/50'}`}>
                    {/* Zhoda + rovnaká cena → zelený banner, automatické zlúčenie */}
                    {priceMatch && (
                      <div className="bg-green-600/10 border-b border-green-600/30 px-3 py-2 flex items-center gap-3">
                        <span className="text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-500/20 px-2 py-0.5 rounded-lg">✓ Zhoda + rovnaká cena</span>
                        <span className="text-green-300 text-[10px] font-black uppercase">{line.matched_item.name}</span>
                        <span className="text-green-600 text-[9px]">· {parseFloat(line.matched_item.quantity).toFixed(0)} {line.matched_item.unit} na sklade → pridáme k existujúcemu</span>
                      </div>
                    )}
                    {/* Zhoda + iná cena → žltý banner s výberom akcie */}
                    {line.matched_item && !priceMatch && (
                      <div className="bg-yellow-600/10 border-b border-yellow-600/30 px-3 py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-lg">⚠️ Zhoda — iná cena</span>
                          <span className="text-yellow-300 text-[10px] font-black uppercase">{line.matched_item.name}</span>
                          <span className="text-yellow-600 text-[9px]">· {parseFloat(line.matched_item.quantity).toFixed(0)} {line.matched_item.unit} na sklade</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => updateImportLine(i, 'merge_action', 'add')}
                            className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${line.merge_action === 'add' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>
                            + Pridať k existujúcemu
                          </button>
                          <button type="button" onClick={() => updateImportLine(i, 'merge_action', 'new')}
                            className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${line.merge_action === 'new' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>
                            Vytvoriť nový
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Existujúci diel — porovnanie cien */}
                    {line.matched_item && (
                      <div className="grid grid-cols-[130px_160px_60px_100px_80px_100px_50px_110px_28px] gap-2 items-center px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/50">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest col-span-2">Existujúce ceny:</span>
                        <span className="text-center text-[10px] font-black text-zinc-500">{parseFloat(line.matched_item.quantity).toFixed(0)}</span>
                        <span className="text-[10px] font-black text-zinc-400">{parseFloat(line.matched_item.purchase_price).toFixed(2)} €</span>
                        <span className="text-[10px] font-black text-zinc-400 text-center">{(parseFloat(line.matched_item.purchase_price) * 1.23).toFixed(2)} €</span>
                        <span className="text-[10px] font-black text-zinc-400">{parseFloat(line.matched_item.sale_price).toFixed(2)} €</span>
                        <span className="text-[10px] font-black text-zinc-500">{line.matched_item.unit}</span>
                        <span />
                        <span />
                      </div>
                    )}
                    {/* Nový import riadok */}
                    <div className={`grid grid-cols-1 md:grid-cols-[130px_160px_60px_100px_80px_100px_50px_110px_28px] gap-2 items-center p-3 ${priceMatch ? 'bg-green-900/10' : line.matched_item ? (line.merge_action === 'add' ? 'bg-green-900/10' : 'bg-blue-900/10') : 'bg-black/30'}`}>
                      <input type="text" placeholder="Číslo dielu" value={line.part_number}
                        onChange={e => updateImportLine(i, 'part_number', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-yellow-300 font-black text-xs outline-none transition-all" />
                      <input type="text" placeholder="Názov dielu" value={line.name}
                        onChange={e => updateImportLine(i, 'name', e.target.value)}
                        required={!line.matched_item || line.merge_action === 'new'}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all" />
                      <input type="number" min="0.001" step="0.001" value={line.quantity}
                        onChange={e => updateImportLine(i, 'quantity', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all text-center" />
                      <div className="relative">
                        <input type="number" min="0" step="0.01" value={line.purchase_price}
                          onChange={e => updateImportLine(i, 'purchase_price', e.target.value)}
                          className={`w-full bg-zinc-900 border p-2.5 pr-5 rounded-xl font-black text-xs outline-none transition-all ${!priceMatch && line.matched_item && line.purchase_price && parseFloat(line.purchase_price).toFixed(2) !== parseFloat(line.matched_item.purchase_price).toFixed(2) ? 'border-yellow-600/60 text-yellow-300' : 'border-zinc-800 text-white'}`} />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[9px] font-black">€</span>
                      </div>
                      <div className="bg-zinc-900/40 border border-zinc-800/50 p-2.5 rounded-xl text-center">
                        <span className="text-zinc-400 font-black text-xs">
                          {line.purchase_price_with_vat
                            ? `${parseFloat(line.purchase_price_with_vat).toFixed(2)} €`
                            : line.purchase_price
                              ? `${(parseFloat(line.purchase_price) * 1.23).toFixed(2)} €`
                              : '—'}
                        </span>
                      </div>
                      <div className="relative">
                        <input type="number" min="0" step="0.01" value={line.sale_price}
                          onChange={e => updateImportLine(i, 'sale_price', e.target.value)}
                          placeholder="—"
                          className={`w-full bg-zinc-900 border p-2.5 pr-5 rounded-xl font-black text-xs outline-none transition-all ${line.matched_item && parseFloat(line.sale_price) !== parseFloat(line.matched_item.sale_price) ? 'border-yellow-600/60 text-yellow-300' : 'border-red-600/30 text-red-400 focus:border-red-600'}`} />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[9px] font-black">€</span>
                      </div>
                      <select value={line.unit} onChange={e => updateImportLine(i, 'unit', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none cursor-pointer transition-all">
                        <option value="ks">ks</option>
                        <option value="l">l</option>
                        <option value="sada">sada</option>
                        <option value="m">m</option>
                        <option value="kg">kg</option>
                      </select>
                      <input type="text" placeholder="DL číslo" value={line.dodaci_list || ''}
                        onChange={e => updateImportLine(i, 'dodaci_list', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-500 p-2.5 rounded-xl text-yellow-400 font-black text-xs outline-none transition-all" />
                      <button type="button" onClick={() => removeImportLine(i)}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs">✕</button>
                    </div>
                  </div>
                  );
                })}

                <button type="button" onClick={addImportLine}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl py-3 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                  + Pridať riadok
                </button>
              </div>

              {/* CELKOVÁ SUMA */}
              {importLines.some(l => parseFloat(l.purchase_price) > 0) && (() => {
                const totalNoVat = importLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.purchase_price) || 0), 0);
                const totalVat = totalNoVat * 1.23;
                return (
                  <div className="bg-zinc-950 border border-zinc-700 rounded-[2rem] p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Celková suma objednávky (kontrola)</p>
                    <div className="flex gap-8 items-center">
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Bez DPH</p>
                        <p className="text-xl font-black text-white">{totalNoVat.toFixed(2)} €</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-0.5">S DPH (23%)</p>
                        <p className="text-xl font-black text-amber-300">{totalVat.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-4">
                <button type="button" onClick={() => setWarehouseSubTab('zoznam')}
                  className="flex-1 bg-zinc-900 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                  Zrušiť
                </button>
                <button type="submit" disabled={importSaving}
                  className="flex-[3] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl disabled:opacity-50">
                  {importSaving ? 'Naskladňujem...' : '📥 Potvrdiť naskladnenie'}
                </button>
              </div>
            </form>
          )}

          {/* VRATKA */}
          {warehouseSubTab === 'vratka' && (
            <form onSubmit={submitVratka} className="space-y-6">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-[2rem] px-6 py-4 flex items-center gap-4">
                <span className="text-2xl">📤</span>
                <p className="text-orange-300 text-xs font-bold leading-relaxed">
                  Zadajte diely, ktoré vraciate dodávateľovi. Množstvo sa odráta zo skladu a zaznamená sa pohyb.
                </p>
              </div>

              {/* HLAVIČKA */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-5">Údaje dokladu</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dodávateľ</label>
                    <input type="text" value={vratkaHeader.supplier} onChange={e => setVratkaHeader(h => ({ ...h, supplier: e.target.value }))}
                      placeholder="napr. AutoParts s.r.o."
                      className="w-full bg-black border border-zinc-800 focus:border-orange-500 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Číslo dokladu (vratky)</label>
                    <input type="text" value={vratkaHeader.doc_number} onChange={e => setVratkaHeader(h => ({ ...h, doc_number: e.target.value }))}
                      placeholder="napr. VR-2024-001"
                      className="w-full bg-black border border-zinc-800 focus:border-orange-500 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dátum</label>
                    <input type="date" value={vratkaHeader.date} onChange={e => setVratkaHeader(h => ({ ...h, date: e.target.value }))}
                      className="w-full bg-black border border-zinc-800 focus:border-orange-500 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                </div>
              </div>

              {/* RIADKY */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Vracané položky</p>

                {vratkaLines.map((line, i) => (
                  <div key={i} className={`rounded-2xl border overflow-hidden ${line.matched_item ? 'border-orange-500/40' : 'border-zinc-800/50'}`}>
                    {line.matched_item && (
                      <div className="bg-orange-500/10 border-b border-orange-500/20 px-3 py-2 flex items-center gap-3">
                        <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-lg">✓ Nájdené na sklade</span>
                        <span className="text-orange-300 text-[10px] font-black uppercase">{line.matched_item.name}</span>
                        <span className="text-orange-600 text-[9px]">· {parseFloat(line.matched_item.quantity).toFixed(2)} {line.matched_item.unit} aktuálne na sklade</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 p-3 items-end">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Číslo dielu (OEM)</label>
                        <input type="text" placeholder="napr. 04L115561H" value={line.part_number}
                          onChange={e => updateVratkaLine(i, 'part_number', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-500 p-2.5 rounded-xl text-yellow-400 font-black text-xs outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Názov dielu</label>
                        <input type="text" placeholder={line.matched_item ? line.matched_item.name : 'zadajte OEM číslo...'} value={line.name}
                          onChange={e => updateVratkaLine(i, 'name', e.target.value)}
                          readOnly={!!line.matched_item}
                          className={`w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl font-black text-xs outline-none transition-all ${line.matched_item ? 'text-zinc-400 cursor-default' : 'text-white focus:border-orange-500'}`} />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Množstvo</label>
                        <input type="number" min="0.001" step="0.001" value={line.quantity}
                          onChange={e => updateVratkaLine(i, 'quantity', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-500 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all text-center" />
                      </div>
                      <button type="button" onClick={() => setVratkaLines(l => l.filter((_, idx) => idx !== i))}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs mb-0.5">✕</button>
                    </div>
                    {!line.matched_item && line.part_number.trim() && (
                      <div className="px-3 pb-3">
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">⚠ Diel s týmto číslom nebol nájdený na sklade — skontrolujte OEM číslo</p>
                      </div>
                    )}
                  </div>
                ))}

                <button type="button" onClick={() => setVratkaLines(l => [...l, emptyVratkaLine()])}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl py-3 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                  + Pridať riadok
                </button>
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => setWarehouseSubTab('zoznam')}
                  className="flex-1 bg-zinc-900 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                  Zrušiť
                </button>
                <button type="submit" disabled={vratkaSaving || !vratkaLines.some(l => l.matched_item && parseFloat(l.quantity) > 0)}
                  className="flex-[3] bg-orange-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all shadow-xl disabled:opacity-50">
                  {vratkaSaving ? 'Spracovávam...' : '📤 Potvrdiť vratku'}
                </button>
              </div>
            </form>
          )}

          {/* SPOTREBA */}
          {warehouseSubTab === 'spotreba' && (
            <form onSubmit={submitSpotreba} className="space-y-6">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-[2rem] px-6 py-4 flex items-center gap-4">
                <span className="text-2xl">🔧</span>
                <p className="text-purple-300 text-xs font-bold leading-relaxed">
                  Vydajte diely do internej spotreby (oprava vozidla servisu, réžia...). Množstvo sa odráta zo skladu.
                </p>
              </div>

              {/* HLAVIČKA */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-5">Dôvod spotreby</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dátum</label>
                    <input type="date" value={spotrebaDate} onChange={e => setSpotrebaDate(e.target.value)}
                      className="w-full bg-black border border-zinc-800 focus:border-purple-500 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Dôvod / poznámka</label>
                    <input type="text" value={spotrebaNote} onChange={e => setSpotrebaNote(e.target.value)}
                      placeholder="napr. Oprava servisného vozidla BA123AB"
                      className="w-full bg-black border border-zinc-800 focus:border-purple-500 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
                  </div>
                </div>
              </div>

              {/* RIADKY */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Vydané položky</p>

                {spotrebaLines.map((line, i) => (
                  <div key={i} className={`rounded-2xl border overflow-hidden ${line.matched_item ? 'border-purple-500/40' : 'border-zinc-800/50'}`}>
                    {line.matched_item && (
                      <div className="bg-purple-500/10 border-b border-purple-500/20 px-3 py-2 flex items-center gap-3">
                        <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-lg">✓ Nájdené na sklade</span>
                        <span className="text-purple-300 text-[10px] font-black uppercase">{line.matched_item.name}</span>
                        <span className="text-purple-600 text-[9px]">· {parseFloat(line.matched_item.quantity).toFixed(2)} {line.matched_item.unit} aktuálne na sklade</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 p-3 items-end">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Číslo dielu (OEM)</label>
                        <input type="text" placeholder="napr. 04L115561H" value={line.part_number}
                          onChange={e => updateSpotrebaLine(i, 'part_number', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 p-2.5 rounded-xl text-yellow-400 font-black text-xs outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Názov dielu</label>
                        <input type="text" placeholder={line.matched_item ? line.matched_item.name : 'zadajte OEM číslo…'} value={line.name}
                          onChange={e => updateSpotrebaLine(i, 'name', e.target.value)}
                          readOnly={!!line.matched_item}
                          className={`w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl font-black text-xs outline-none transition-all ${line.matched_item ? 'text-zinc-400 cursor-default' : 'text-white focus:border-purple-500'}`} />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Množstvo</label>
                        <input type="number" min="0.001" step="0.001" value={line.quantity}
                          onChange={e => updateSpotrebaLine(i, 'quantity', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all text-center" />
                      </div>
                      <button type="button" onClick={() => setSpotrebaLines(l => l.filter((_, idx) => idx !== i))}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs mb-0.5">✕</button>
                    </div>
                    {!line.matched_item && line.part_number.trim() && (
                      <div className="px-3 pb-3">
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">⚠ Diel s týmto číslom nebol nájdený — skontrolujte OEM číslo</p>
                      </div>
                    )}
                  </div>
                ))}

                <button type="button" onClick={() => setSpotrebaLines(l => [...l, emptySpotrebaLine()])}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl py-3 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                  + Pridať riadok
                </button>
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => setWarehouseSubTab('zoznam')}
                  className="flex-1 bg-zinc-900 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                  Zrušiť
                </button>
                <button type="submit" disabled={spotrebaSaving || !spotrebaLines.some(l => l.matched_item && parseFloat(l.quantity) > 0)}
                  className="flex-[3] bg-purple-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all shadow-xl disabled:opacity-50">
                  {spotrebaSaving ? 'Spracovávam...' : '🔧 Potvrdiť spotrebu'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ===== TAB: PRÁCE ===== */}
      {activeTab === 'práca' && (
        <div className="space-y-6">
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl px-6 py-4 flex items-center gap-4">
            <span className="text-2xl">💡</span>
            <p className="text-blue-300 text-xs font-bold leading-relaxed">
              Práce zadané tu si môže zákazník vybrať pri online objednávaní servisu. Každá práca patrí do kategórie a má zadaný čas trvania.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
            <button onClick={() => setShowCatPanel(!showCatPanel)}
              className="w-full flex items-center justify-between p-6 hover:bg-zinc-900/40 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Kategórie prác</span>
                <span className="text-[9px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-lg">{categories.length}</span>
              </div>
              <span className="text-zinc-600 text-sm">{showCatPanel ? '▲' : '▼'}</span>
            </button>
            {showCatPanel && (
              <div className="border-t border-zinc-900 p-6 space-y-4">
                <form onSubmit={addCategory} className="flex gap-3">
                  <input required type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    placeholder="Nová kategória (napr. MOTOR)" className="flex-grow bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black uppercase text-sm outline-none transition-all" />
                  <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all">+ Pridať</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-white">{cat.name}</span>
                      <button onClick={() => deleteCategory(cat.id)} className="text-zinc-600 hover:text-red-500 transition-colors text-xs font-bold">✕</button>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-zinc-700 text-xs font-bold italic">Zatiaľ žiadne kategórie</p>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4">Pridať prácu</p>
            <form onSubmit={addNorm} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_120px_auto] gap-3 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Kategória</label>
                <select required value={newNorm.category_id} onChange={e => setNewNorm({ ...newNorm, category_id: e.target.value })}
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-xs outline-none transition-all cursor-pointer">
                  <option value="">-- Kategória --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Názov práce</label>
                <input required type="text" value={newNorm.service_name} onChange={e => setNewNorm({ ...newNorm, service_name: e.target.value })}
                  placeholder="napr. Výmena oleja a filtrov"
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-sm outline-none transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Minúty</label>
                <input required type="number" min="5" value={newNorm.duration_minutes} onChange={e => setNewNorm({ ...newNorm, duration_minutes: parseInt(e.target.value) })}
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black text-center outline-none transition-all" />
              </div>
              <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all whitespace-nowrap">
                + Pridať
              </button>
            </form>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <select value={normFilter} onChange={e => setNormFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 focus:border-zinc-600 p-3 rounded-xl text-zinc-400 text-[10px] font-black uppercase outline-none cursor-pointer transition-all">
              <option value="all">Všetky kategórie</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <div className="relative flex-grow">
              <input type="text" placeholder="Hľadať prácu..." value={normSearch} onChange={e => setNormSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 p-3 px-5 rounded-xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-sm">🔍</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-5 rounded-xl">
              <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">Celkom:</span>
              <span className="text-white font-black text-sm">{filteredNorms.length}</span>
            </div>
          </div>

          {normsLoading ? (
            <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
          ) : filteredNorms.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">Žiadne práce</div>
          ) : (
            <div className="space-y-2">
              {filteredNorms.map(norm => (
                <div key={norm.id} className="bg-zinc-950 border border-zinc-900 hover:border-zinc-700 p-4 md:px-6 rounded-2xl flex items-center gap-4 group transition-all">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg shrink-0 hidden md:block whitespace-nowrap">
                    {norm.service_categories?.name}
                  </span>
                  <span className="flex-grow text-sm font-black uppercase italic text-zinc-300 truncate">{norm.service_name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[8px] text-zinc-600 block uppercase font-black">min</span>
                      <span className="text-white font-black text-sm">{norm.duration_minutes}</span>
                    </div>
                    <button onClick={() => setEditNorm({ id: norm.id, service_name: norm.service_name, duration_minutes: norm.duration_minutes, category_id: norm.category_id })}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                    <button onClick={() => deleteNorm(norm.id)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: ÚKONY ===== */}
      {activeTab === 'ukon' && (
        <div className="space-y-6">

          {/* Formulár: nový úkon */}
          <div className="bg-zinc-950 border border-purple-600/20 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-4">Nový úkon</p>
            <form onSubmit={addUkon} className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-grow">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Názov úkonu</label>
                <input id="ukon-form-name" required type="text"
                  value={newUkon.name}
                  onChange={e => setNewUkon({ ...newUkon, name: e.target.value })}
                  placeholder="napr. Čistenie DPF filtra v stroji"
                  className="w-full bg-black border border-zinc-800 focus:border-purple-600 p-3 rounded-xl text-white font-black outline-none transition-all italic" />
              </div>
              <div className="w-36">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Cena bez DPH (€)</label>
                <input required type="number" min="0" step="0.01"
                  value={newUkon.unit_price}
                  onChange={e => {
                    setNewUkon({ ...newUkon, unit_price: e.target.value });
                    setNewUkonVatStr(e.target.value ? (parseFloat(e.target.value) * VAT).toFixed(2) : '');
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="0.00"
                  className="w-full bg-black border border-zinc-800 focus:border-purple-600 p-3 rounded-xl text-white font-black text-center outline-none transition-all" />
              </div>
              <div className="w-36">
                <label className="text-[9px] font-black uppercase tracking-widest text-amber-600 block mb-2">Cena s DPH (€)</label>
                <input type="number" min="0" step="0.01"
                  value={newUkonVatStr}
                  onChange={e => {
                    setNewUkonVatStr(e.target.value);
                    setNewUkon({ ...newUkon, unit_price: e.target.value ? String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100) : '' });
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="0.00"
                  className="w-full bg-black border border-amber-800/50 focus:border-amber-500 p-3 rounded-xl text-amber-300 font-black text-center outline-none transition-all" />
              </div>
              <div className="w-24">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">Jednotka</label>
                <input type="text"
                  value={newUkon.unit}
                  onChange={e => setNewUkon({ ...newUkon, unit: e.target.value })}
                  placeholder="ks"
                  className="w-full bg-black border border-zinc-800 focus:border-purple-600 p-3 rounded-xl text-white font-black text-center outline-none transition-all" />
              </div>
              <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all whitespace-nowrap">
                + Pridať
              </button>
            </form>
          </div>

          {/* Vyhľadávanie */}
          <div className="relative w-full md:w-96">
            <input type="text" placeholder="Hľadať úkon..." value={ukonSearch} onChange={e => setUkonSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-4 px-6 rounded-2xl text-[10px] uppercase font-black outline-none focus:border-purple-600 transition-all italic tracking-widest" />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
          </div>

          {/* Zoznam */}
          {ukonLoading ? (
            <div className="py-20 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam...</div>
          ) : filteredUkony.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 uppercase font-black tracking-[0.5em] text-sm italic">Žiadne úkony</div>
          ) : (
            <div className="space-y-2">
              {filteredUkony.map(u => (
                <div key={u.id} className="bg-zinc-950 border border-zinc-900 hover:border-zinc-700 p-4 md:px-6 rounded-2xl flex items-center gap-4 group transition-all">
                  <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg shrink-0">ÚKON</span>
                  <span className="flex-grow text-sm font-black uppercase italic text-zinc-300 truncate">{u.name}</span>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[8px] text-zinc-600 block uppercase font-black">bez DPH</span>
                      <span className="text-white font-black text-sm">{parseFloat(u.unit_price).toFixed(2)} €</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-amber-500 block uppercase font-black">s DPH</span>
                      <span className="text-amber-300 font-black text-sm">{(parseFloat(u.unit_price) * VAT).toFixed(2)} €</span>
                    </div>
                    <span className="text-zinc-500 font-black text-sm uppercase">{u.unit}</span>
                    <button onClick={() => { setEditUkon({ ...u, unit_price: String(u.unit_price) }); setEditUkonVatStr((parseFloat(u.unit_price) * VAT).toFixed(2)); }}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                    <button onClick={() => deleteUkon(u.id)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT ÚKONU */}
      {editUkon && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">Upraviť <span className="text-purple-500">úkon</span></h2>
            <form onSubmit={saveEditUkon} className="space-y-5">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Názov úkonu</label>
                <input required type="text" value={editUkon.name} onChange={e => setEditUkon({ ...editUkon, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-purple-600 italic transition-all" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Cena bez DPH (€)</label>
                  <input required type="number" min="0" step="0.01" value={editUkon.unit_price}
                    onChange={e => {
                      setEditUkon({ ...editUkon, unit_price: e.target.value });
                      setEditUkonVatStr(e.target.value ? (parseFloat(e.target.value) * VAT).toFixed(2) : '');
                    }}
                    onFocus={e => e.target.select()}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-purple-600 text-center text-xl transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-amber-500 ml-2 tracking-widest block mb-2">Cena s DPH (€)</label>
                  <input type="number" min="0" step="0.01" value={editUkonVatStr}
                    onChange={e => {
                      setEditUkonVatStr(e.target.value);
                      setEditUkon({ ...editUkon, unit_price: e.target.value ? String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100) : '' });
                    }}
                    onFocus={e => e.target.select()}
                    className="w-full bg-zinc-900 border border-amber-800/50 p-4 rounded-2xl text-amber-300 font-black outline-none focus:border-amber-500 text-center text-xl transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Jednotka</label>
                  <input type="text" value={editUkon.unit} onChange={e => setEditUkon({ ...editUkon, unit: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-purple-600 text-center text-xl transition-all" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setEditUkon(null); setEditUkonVatStr(''); }}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">Zrušiť</button>
                <button type="submit"
                  className="flex-[2] bg-purple-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all shadow-xl">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT NORMY */}
      {editNorm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">Upraviť <span className="text-red-600">prácu</span></h2>
            <form onSubmit={saveEditNorm} className="space-y-5">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Kategória</label>
                <select required value={editNorm.category_id} onChange={e => setEditNorm({ ...editNorm, category_id: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 cursor-pointer transition-all">
                  <option value="">-- Vyber kategóriu --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Názov práce</label>
                <input required type="text" value={editNorm.service_name} onChange={e => setEditNorm({ ...editNorm, service_name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 italic transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Trvanie (minúty)</label>
                <input required type="number" min="5" value={editNorm.duration_minutes} onChange={e => setEditNorm({ ...editNorm, duration_minutes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 text-center text-xl transition-all" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditNorm(null)}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">Zrušiť</button>
                <button type="submit"
                  className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl">Uložiť zmeny</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DUPLIKÁTNY DOKLAD */}
      {dupWarning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-yellow-600/40 p-8 md:p-12 rounded-[3rem] max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-black uppercase italic mb-3 tracking-tighter text-center text-yellow-400">⚠️ Doklad už existuje</h2>
            <p className="text-zinc-300 text-sm font-bold text-center mb-2">
              Doklad č. <span className="text-yellow-400 font-black">{dupWarning.existing.doc_number}</span> bol už importovaný.
            </p>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center mb-8">
              {dupWarning.existing.supplier && `Dodávateľ: ${dupWarning.existing.supplier} · `}
              {new Date(dupWarning.existing.created_at).toLocaleDateString('sk-SK')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDupWarning(null)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">
                Zrušiť
              </button>
              <button onClick={() => submitImport(dupWarning.evt, true)}
                className="flex-[2] bg-yellow-600 hover:bg-yellow-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-xl">
                Aj tak importovať
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALY SKLAD */}
      {skladModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">

            {(skladModal.mode === 'add' || skladModal.mode === 'edit') && (
              <>
                <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-center">
                  {skladModal.mode === 'add' ? 'Pridať diel na' : 'Upraviť diel na'} <span className="text-red-600">sklad</span>
                </h2>
                <form onSubmit={saveSkladItem} className="space-y-5">
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Názov dielu</label>
                    <input required type="text" value={skladModal.item.name}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, name: e.target.value } }))}
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 uppercase italic transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Číslo dielu (OEM / katalógové)</label>
                    <input type="text" value={skladModal.item.part_number}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, part_number: e.target.value } }))}
                      placeholder="napr. 04L115561H"
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all" />
                  </div>

                  {/* ZHODY NA SKLADE — živý autocomplete */}
                  {skladModal.mode === 'add' && (() => {
                    const nameQ = nd(skladModal.item.name.trim());
                    const pnQ = nd(skladModal.item.part_number.trim());
                    if (!nameQ && !pnQ) return null;
                    const matches = warehouseItems.filter(w => {
                      if (nameQ.length >= 2 && nd(w.name).includes(nameQ)) return true;
                      if (pnQ.length >= 2 && w.part_number && nd(w.part_number).includes(pnQ)) return true;
                      return false;
                    }).slice(0, 6);
                    if (!matches.length) return null;
                    return (
                      <div className="rounded-2xl border border-yellow-500/30 overflow-hidden">
                        <p className="text-[8px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-4 py-2.5">
                          ⚠️ Zhody na sklade — chcete naskladniť na existujúcu kartu?
                        </p>
                        {matches.map(w => (
                          <button key={w.id} type="button"
                            onClick={() => { setSkladModal(null); openNaskladnit(w); }}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition-all border-t border-zinc-800 text-left group">
                            <div className="min-w-0">
                              <p className="text-white text-xs font-black uppercase italic truncate">{w.name}</p>
                              {w.part_number && (
                                <p className="text-yellow-400 text-[9px] font-black tracking-widest mt-0.5">{w.part_number}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-zinc-400 text-[9px] font-black">{parseFloat(w.quantity).toFixed(2)} {w.unit}</p>
                              <p className="text-green-400 text-[9px] font-black uppercase tracking-widest mt-0.5 group-hover:text-green-300">Naskladniť →</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Nákupná cena bez DPH</label>
                      <div className="relative">
                        <input required type="number" min="0" step="0.01" value={skladModal.item.purchase_price}
                          onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, purchase_price: e.target.value } }))}
                          className="w-full bg-zinc-900 border border-zinc-800 p-4 pr-8 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black">€</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Pultová cena bez DPH</label>
                      <div className="relative">
                        <input required type="number" min="0" step="0.01" value={skladModal.item.sale_price}
                          onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, sale_price: e.target.value } }))}
                          className="w-full bg-zinc-900 border border-zinc-800 p-4 pr-8 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black">€</span>
                      </div>
                    </div>
                  </div>
                  {skladModal.item.sale_price > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-3 flex justify-between items-center">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Pult s DPH (+23%)</span>
                      <span className="text-white font-black text-lg">{(parseFloat(skladModal.item.sale_price) * VAT).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Jednotka</label>
                      <select value={skladModal.item.unit} onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, unit: e.target.value } }))}
                        className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 cursor-pointer transition-all">
                        <option value="ks">ks</option>
                        <option value="l">l</option>
                        <option value="sada">sada</option>
                        <option value="m">m</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    {skladModal.mode === 'add' && (
                      <div>
                        <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Počiatočný stav</label>
                        <input type="number" min="0" step="0.001" value={skladModal.item.initial_quantity}
                          onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, initial_quantity: e.target.value } }))}
                          placeholder="0"
                          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all text-center" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setSkladModal(null)}
                      className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">Zrušiť</button>
                    <button type="submit"
                      className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-xl">
                      {skladModal.mode === 'add' ? 'Pridať na sklad' : 'Uložiť zmeny'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {skladModal.mode === 'naskladnit' && (
              <>
                <h2 className="text-2xl font-black uppercase italic mb-2 tracking-tighter text-center">Naskladniť</h2>
                <p className="text-red-600 font-black uppercase text-sm italic text-center mb-8 tracking-widest">{skladModal.item.name}</p>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-3 flex justify-between items-center mb-6">
                  <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Aktuálny stav</span>
                  <span className={`font-black text-lg px-3 py-1 rounded-lg border ${qtyColor(skladModal.item.current_quantity)}`}>
                    {parseFloat(skladModal.item.current_quantity).toFixed(2)} ks
                  </span>
                </div>
                <form onSubmit={doNaskladnit} className="space-y-5">
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Množstvo na naskladnenie</label>
                    <input required type="number" min="0.001" step="0.001" value={skladModal.item.qty}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, qty: e.target.value } }))}
                      className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-red-600 text-center text-2xl transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Nová nákupná cena bez DPH (voliteľné)</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={skladModal.item.new_purchase_price}
                        onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, new_purchase_price: e.target.value } }))}
                        placeholder="Ponechať pôvodnú"
                        className="w-full bg-zinc-900 border border-zinc-800 p-4 pr-8 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black">€</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Poznámka</label>
                    <input type="text" value={skladModal.item.note}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, note: e.target.value } }))}
                      placeholder="napr. č. dodacieho listu"
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all" />
                  </div>
                  {skladModal.item.qty > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-3 flex justify-between items-center">
                      <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">Stav po naskladnení</span>
                      <span className="text-green-400 font-black text-lg">
                        {(parseFloat(skladModal.item.current_quantity) + parseFloat(skladModal.item.qty || 0)).toFixed(2)} ks
                      </span>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setSkladModal(null)}
                      className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">Zrušiť</button>
                    <button type="submit"
                      className="flex-[2] bg-green-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-green-500 transition-all shadow-xl">
                      ✓ Naskladniť
                    </button>
                  </div>
                </form>
              </>
            )}

            {skladModal.mode === 'spotreba_item' && (
              <>
                <h2 className="text-2xl font-black uppercase italic mb-2 tracking-tighter text-center">Vydať do <span className="text-purple-500">spotreby</span></h2>
                <p className="text-purple-400 font-black uppercase text-sm italic text-center mb-6 tracking-widest">{skladModal.item.name}</p>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-3 flex justify-between items-center mb-6">
                  <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Aktuálny stav</span>
                  <span className={`font-black text-lg px-3 py-1 rounded-lg border ${qtyColor(skladModal.item.current_quantity)}`}>
                    {parseFloat(skladModal.item.current_quantity).toFixed(2)} {skladModal.item.unit}
                  </span>
                </div>
                <form onSubmit={doSkladSpotreba} className="space-y-5">
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Množstvo na vydanie</label>
                    <input required type="number" min="0.001" step="0.001" value={skladModal.item.qty}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, qty: e.target.value } }))}
                      className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-center text-2xl transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest block mb-2">Dôvod spotreby (voliteľné)</label>
                    <input type="text" value={skladModal.item.note}
                      onChange={e => setSkladModal(m => ({ ...m, item: { ...m.item, note: e.target.value } }))}
                      placeholder="napr. Oprava servisného vozidla"
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white font-black outline-none focus:border-purple-500 transition-all" />
                  </div>
                  {parseFloat(skladModal.item.qty) > 0 && (() => {
                    const newQty = parseFloat(skladModal.item.current_quantity) - parseFloat(skladModal.item.qty);
                    const over = newQty < 0;
                    return (
                      <div className={`rounded-2xl px-5 py-3 flex justify-between items-center border ${over ? 'bg-red-500/10 border-red-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${over ? 'text-red-400' : 'text-purple-400'}`}>
                          {over ? '⚠ Nedostatok na sklade!' : 'Stav po výdaji'}
                        </span>
                        <span className={`font-black text-lg ${over ? 'text-red-400' : 'text-purple-300'}`}>
                          {Math.max(0, newQty).toFixed(2)} {skladModal.item.unit}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setSkladModal(null)}
                      className="flex-1 bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:text-white transition-all">Zrušiť</button>
                    <button type="submit"
                      disabled={parseFloat(skladModal.item.qty) > parseFloat(skladModal.item.current_quantity)}
                      className="flex-[2] bg-purple-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all shadow-xl disabled:opacity-40">
                      🔧 Potvrdiť vydanie
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
