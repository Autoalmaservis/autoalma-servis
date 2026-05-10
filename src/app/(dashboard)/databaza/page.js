'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';

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
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef(null);

  function emptyImportLine() {
    return { existing_id: '', name: '', part_number: '', quantity: 1, purchase_price: '', sale_price: '', unit: 'ks', dodaci_list: '' };
  }

  useEffect(() => {
    fetchNorms();
    fetchWarehouse();
  }, []);

  const nd = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    if (confirm('Naozaj vymazať túto prácu?')) {
      await supabase.from('service_norms').delete().eq('id', id);
      fetchNorms();
    }
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

  const deleteSkladItem = async (id) => {
    if (confirm('Naozaj vymazať položku zo skladu? Zmažú sa aj všetky pohyby.')) {
      await supabase.from('warehouse_items').delete().eq('id', id);
      fetchWarehouse();
    }
  };

  const addImportLine = () => setImportLines(l => [...l, emptyImportLine()]);
  const removeImportLine = (i) => setImportLines(l => l.filter((_, idx) => idx !== i));
  const updateImportLine = (i, field, value) =>
    setImportLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const handleImportSelect = (i, existing_id) => {
    const w = warehouseItems.find(x => x.id === existing_id);
    if (w) {
      setImportLines(l => l.map((line, idx) => idx === i
        ? { ...line, existing_id, name: w.name, part_number: w.part_number || '', purchase_price: w.purchase_price, sale_price: w.sale_price, unit: w.unit }
        : line));
    } else {
      setImportLines(l => l.map((line, idx) => idx === i ? { ...line, existing_id: '', name: '', part_number: '' } : line));
    }
  };

  const submitImport = async (e) => {
    e.preventDefault();
    setImportSaving(true);
    for (const line of importLines) {
      const qty = parseFloat(line.quantity) || 0;
      if (qty <= 0) continue;
      if (line.existing_id) {
        const existing = warehouseItems.find(w => w.id === line.existing_id);
        if (!existing) continue;
        const note1 = [
          `Fakt: ${importHeader.doc_number || '—'}`,
          line.dodaci_list ? `DL: ${line.dodaci_list}` : null,
          importHeader.supplier || null,
        ].filter(Boolean).join(' | ');
        await supabase.from('warehouse_movements').insert([{
          item_id: line.existing_id, movement_type: 'in', quantity: qty, note: note1,
        }]);
        const upd = { quantity: parseFloat(existing.quantity) + qty };
        if (line.purchase_price) upd.purchase_price = parseFloat(line.purchase_price);
        await supabase.from('warehouse_items').update(upd).eq('id', line.existing_id);
      } else if (line.name.trim()) {
        const newPayload = {
          name: line.name.toUpperCase(),
          part_number: line.part_number || null,
          purchase_price: parseFloat(line.purchase_price) || 0,
          sale_price: parseFloat(line.sale_price) || 0,
          unit: line.unit || 'ks',
          quantity: qty,
        };
        const { data: newItem } = await supabase.from('warehouse_items').insert([newPayload]).select().single();
        if (newItem) {
          const note2 = [
            `Fakt: ${importHeader.doc_number || '—'}`,
            line.dodaci_list ? `DL: ${line.dodaci_list}` : null,
            importHeader.supplier || null,
          ].filter(Boolean).join(' | ');
          await supabase.from('warehouse_movements').insert([{
            item_id: newItem.id, movement_type: 'in', quantity: qty, note: note2,
          }]);
        }
      }
    }
    setImportSaving(false);
    setImportLines([emptyImportLine()]);
    setImportHeader({ supplier: '', doc_number: '', date: new Date().toISOString().slice(0, 10) });
    setWarehouseSubTab('zoznam');
    fetchWarehouse();
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
      const res = await fetch('/api/parse-supplier-pdf', { method: 'POST', body: formData });
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
          const existing = warehouseItems.find(w =>
            (item.part_number && w.part_number === item.part_number) ||
            w.name === (item.name || '').toUpperCase()
          );
          return {
            existing_id: existing?.id || '',
            name: existing ? existing.name : (item.name || ''),
            part_number: item.part_number || existing?.part_number || '',
            quantity: item.quantity || 1,
            purchase_price: item.purchase_price || '',
            purchase_price_with_vat: item.purchase_price_with_vat || '',
            sale_price: existing?.sale_price || '',
            unit: item.unit || existing?.unit || 'ks',
            dodaci_list: item.dodaci_list || '',
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

  const filteredWarehouse = warehouseItems.filter(w =>
    nd(w.name).includes(nd(warehouseSearch)) ||
    (w.part_number && nd(w.part_number).includes(nd(warehouseSearch)))
  );

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
      </header>

      {/* ZÁLOŽKY */}
      <div className="flex bg-zinc-900/50 p-1.5 rounded-[1.8rem] border border-zinc-800 mb-8 w-full md:w-auto">
        {[
          { key: 'sklad', label: '🏭 Sklad' },
          { key: 'práca', label: '🛠️ Práce' },
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
            ].map(st => (
              <button key={st.key}
                onClick={() => setWarehouseSubTab(st.key)}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${warehouseSubTab === st.key ? 'bg-red-600 text-white italic shadow-lg' : 'text-zinc-500 hover:text-white'}`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* ZOZNAM SKLADU */}
          {warehouseSubTab === 'zoznam' && (
            <>
              <div className="relative w-full md:w-96">
                <input type="text" placeholder="Hľadať podľa názvu alebo čísla dielu..." value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 px-6 rounded-2xl text-[10px] uppercase font-black outline-none focus:border-red-600 transition-all italic tracking-widest" />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
              </div>

              <div className="hidden md:grid grid-cols-[140px_1fr_80px_100px_120px_120px_130px_120px] gap-3 px-6 py-2">
                {['Číslo dielu', 'Názov', 'Jedn.', 'Na sklade', 'Nákup bez DPH', 'Pult bez DPH', 'Pult s DPH', ''].map(h => (
                  <span key={h} className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{h}</span>
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
                        <button onClick={() => openSkladEdit(w)}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black transition-all text-xs">✏️</button>
                        <button onClick={() => deleteSkladItem(w.id)}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 text-xs">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                  Celkom položiek: <span className="text-white">{filteredWarehouse.length}</span>
                </span>
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                  Hodnota skladu (nákup bez DPH):&nbsp;
                  <span className="text-white">{filteredWarehouse.reduce((sum, w) => sum + parseFloat(w.purchase_price) * parseFloat(w.quantity), 0).toFixed(2)} €</span>
                </span>
              </div>
            </>
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
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Položky</p>

                <div className="hidden md:grid grid-cols-[180px_130px_160px_60px_100px_80px_100px_50px_110px_28px] gap-2 px-2">
                  {['Existujúci diel', 'Číslo dielu', 'Názov (nový diel)', 'Množ.', 'Nákup bez DPH', 'S DPH', 'Pult bez DPH', 'Jedn.', 'Dodací list', ''].map(h => (
                    <span key={h} className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{h}</span>
                  ))}
                </div>

                {importLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[180px_130px_160px_60px_100px_80px_100px_50px_110px_28px] gap-2 items-center border border-zinc-800/50 rounded-2xl p-3 bg-black/30">
                    <select value={line.existing_id} onChange={e => handleImportSelect(i, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none cursor-pointer transition-all">
                      <option value="">— Nový diel —</option>
                      {warehouseItems.map(w => <option key={w.id} value={w.id}>{w.name}{w.part_number ? ` (${w.part_number})` : ''}</option>)}
                    </select>
                    <input type="text" placeholder="Číslo dielu" value={line.part_number}
                      onChange={e => updateImportLine(i, 'part_number', e.target.value)}
                      disabled={!!line.existing_id}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all disabled:opacity-40" />
                    <input type="text" placeholder="Názov dielu" value={line.name}
                      onChange={e => updateImportLine(i, 'name', e.target.value)}
                      disabled={!!line.existing_id}
                      required={!line.existing_id}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all disabled:opacity-40" />
                    <input type="number" min="0.001" step="0.001" value={line.quantity}
                      onChange={e => updateImportLine(i, 'quantity', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none transition-all text-center" />
                    {/* Nákup bez DPH */}
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={line.purchase_price}
                        onChange={e => updateImportLine(i, 'purchase_price', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 pr-5 rounded-xl text-white font-black text-xs outline-none transition-all" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[9px] font-black">€</span>
                    </div>
                    {/* S DPH - readonly náhľad */}
                    <div className="bg-zinc-900/40 border border-zinc-800/50 p-2.5 rounded-xl text-center">
                      <span className="text-zinc-400 font-black text-xs">
                        {line.purchase_price_with_vat
                          ? `${parseFloat(line.purchase_price_with_vat).toFixed(2)} €`
                          : line.purchase_price
                            ? `${(parseFloat(line.purchase_price) * 1.23).toFixed(2)} €`
                            : '—'}
                      </span>
                    </div>
                    {/* Pult bez DPH */}
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={line.sale_price}
                        onChange={e => updateImportLine(i, 'sale_price', e.target.value)}
                        disabled={!!line.existing_id}
                        placeholder="—"
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 pr-5 rounded-xl text-white font-black text-xs outline-none transition-all disabled:opacity-40" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[9px] font-black">€</span>
                    </div>
                    <select value={line.unit} onChange={e => updateImportLine(i, 'unit', e.target.value)}
                      disabled={!!line.existing_id}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-600 p-2.5 rounded-xl text-white font-black text-xs outline-none cursor-pointer transition-all disabled:opacity-40">
                      <option value="ks">ks</option>
                      <option value="l">l</option>
                      <option value="sada">sada</option>
                      <option value="m">m</option>
                      <option value="kg">kg</option>
                    </select>
                    {/* Dodací list */}
                    <input type="text" placeholder="DL číslo" value={line.dodaci_list || ''}
                      onChange={e => updateImportLine(i, 'dodaci_list', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-500 p-2.5 rounded-xl text-yellow-400 font-black text-xs outline-none transition-all" />
                    <button type="button" onClick={() => removeImportLine(i)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 transition-all text-xs">✕</button>
                  </div>
                ))}

                <button type="button" onClick={addImportLine}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl py-3 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                  + Pridať riadok
                </button>
              </div>

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

      {/* MODALY SKLAD */}
      {skladModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-8 md:p-12 rounded-[3rem] max-w-lg w-full shadow-2xl">

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
          </div>
        </div>
      )}

    </div>
  );
}
