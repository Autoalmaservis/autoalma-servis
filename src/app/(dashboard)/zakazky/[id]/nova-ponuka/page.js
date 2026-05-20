'use client';
import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';
import { useParams, useRouter } from 'next/navigation';

export default function NovaPonukaPage() {
    const { id } = useParams();
    const router = useRouter();
    
    const [zakazka, setZakazka] = useState(null);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatedNumber, setGeneratedNumber] = useState(''); // Stav pre číslo ponuky

    const [offerItems, setOfferItems] = useState([]);
    const [rateCategories, setRateCategories] = useState([]);
    const [jobTasks, setJobTasks] = useState([]);
    const [jobItems, setJobItems] = useState([]);
    const [sendSms, setSendSms] = useState(false);

    const [newItem, setNewItem] = useState({
        group_name: '',
        name: '',
        quantity: 1,
        unit: 'ks',
        unit_price: '',
        type: 'Materiál',
        rateType: 'M1',
    });

    // --- LOGIKA DÁTUMOV ---
    const dateCreated = new Date();
    const dateExpiry = new Date();
    dateExpiry.setDate(dateCreated.getDate() + 14);

    useEffect(() => {
        if (id) {
            loadInitialData();
        }
    }, [id]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [jobRes, catalogRes, settingsRes, tasksRes, itemsRes] = await Promise.all([
                supabase.from('job_tickets').select('*').eq('id', id).single(),
                supabase.from('inventory_catalog').select('*').order('name', { ascending: true }),
                supabase.from('business_settings').select('*'),
                supabase.from('job_tasks').select('*').eq('job_id', id).order('created_at', { ascending: true }),
                supabase.from('job_items').select('*').eq('job_id', id).order('created_at', { ascending: true })
            ]);

            if (jobRes.data) {
                let jobData = jobRes.data;
                if (!jobData.customer_id && jobData.plate_number) {
                    const { data: vData } = await supabase
                        .from('vehicles')
                        .select('owner_id')
                        .eq('license_plate', jobData.plate_number.toUpperCase())
                        .maybeSingle();
                    if (vData?.owner_id) jobData = { ...jobData, customer_id: vData.owner_id };
                }
                setZakazka(jobData);
            }
            if (catalogRes.data) setCatalog(catalogRes.data);
            if (tasksRes.data) setJobTasks(tasksRes.data);
            if (itemsRes.data) setJobItems(itemsRes.data.filter(i => i.unit_price === 0 || i.unit_price === null));
            if (settingsRes.data) {
                const rateCategoriesRaw = settingsRes.data.find(s => s.id === 'rate_categories')?.value;
                if (rateCategoriesRaw) {
                    try { setRateCategories(JSON.parse(rateCategoriesRaw)); } catch {}
                } else {
                    setRateCategories([
                        { key: 'M1', label: 'Základná mechanická', value: settingsRes.data.find(s => s.id === 'rate_m1')?.value || '0' },
                        { key: 'M2', label: 'Prémiová mechanická', value: settingsRes.data.find(s => s.id === 'rate_m2')?.value || '0' },
                        { key: 'E1', label: 'Elektrodiagnostika', value: settingsRes.data.find(s => s.id === 'rate_e1')?.value || '0' },
                        { key: 'E2', label: 'Špeciálne elektro', value: settingsRes.data.find(s => s.id === 'rate_e2')?.value || '0' },
                    ]);
                }
            }

            // --- PRED-GENEROVANIE ČÍSLA PONUKY ---
            const teraz = new Date();
            const dd = String(teraz.getDate()).padStart(2, '0');
            const mm = String(teraz.getMonth() + 1).padStart(2, '0');
            const rr = String(teraz.getFullYear()).slice(-2);
            const dnesnyDatumPrefix = `P${dd}${mm}${rr}`;

            const { count } = await supabase
                .from('price_offers')
                .select('*', { count: 'exact', head: true })
                .like('offer_number', `${dnesnyDatumPrefix}%`);

            const poradie = String((count || 0) + 1).padStart(3, '0');
            setGeneratedNumber(`${dnesnyDatumPrefix}${poradie}`);

        } catch (err) {
            console.error("Chyba pri načítaní:", err);
        }
        setLoading(false);
    };

    const getRateValue = (key) => parseFloat(rateCategories.find(c => c.key === key)?.value) || 0;

    const addItemToOffer = (e) => {
        e.preventDefault();
        if (!newItem.name || !newItem.group_name) {
            alert("Vyplňte názov skupiny aj názov položky.");
            return;
        }

        const isPraca = newItem.type === 'Práca';
        const { rateType: _rt, ...itemForOffer } = newItem;

        const itemToAdd = {
            ...itemForOffer,
            id: crypto.randomUUID(),
            unit_price: isPraca ? getRateValue(newItem.rateType) : (parseFloat(newItem.unit_price) || 0),
            unit: isPraca ? 'hod' : newItem.unit,
            group_name: newItem.group_name.trim().toUpperCase(),
            is_selected: true
        };

        setOfferItems([...offerItems, itemToAdd]);
        setNewItem({
            ...newItem,
            name: isPraca ? `Servisná práca ${newItem.rateType}` : '',
            quantity: 1,
            unit_price: isPraca ? getRateValue(newItem.rateType) : ''
        });
    };

    const removeItem = (tempId) => {
        setOfferItems(offerItems.filter(item => item.id !== tempId));
    };

    const calculateTotal = () => {
        const subtotal = offerItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
        const tax = subtotal * 0.23;
        const total = subtotal + tax;
        return { subtotal, tax, total };
    };

    // --- FUNKCIA PRE SAMOTNÉ ULOŽENIE (BEZ ODOSLANIA) ---
    const saveOnly = async () => {
        if (offerItems.length === 0) {
            alert("Ponuka musí obsahovať aspoň jednu položku.");
            return;
        }
        setSaving(true);
        const { subtotal } = calculateTotal();

        try {
            const { error: offerError } = await supabase
                .from('price_offers')
                .insert([{
                    job_id: id,
                    customer_id: zakazka?.customer_id,
                    items_json: offerItems,
                    total_amount: subtotal,
                    status: 'Rozpracované', // Iný status pre rozpracovanú ponuku
                    offer_number: generatedNumber
                }]);

            if (offerError) throw offerError;

            alert("Ponuka bola úspešne uložená (interný záznam).");
            router.push(`/zakazky/${id}`);
        } catch (err) {
            alert("Chyba pri ukladaní: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const saveOffer = async () => {
        if (offerItems.length === 0) {
            alert("Ponuka musí obsahovať aspoň jednu položku.");
            return;
        }
        setSaving(true);
        const { subtotal, total } = calculateTotal();

        try {
            const { data: offerData, error: offerError } = await supabase
                .from('price_offers')
                .insert([{
                    job_id: id,
                    customer_id: zakazka?.customer_id,
                    items_json: offerItems,
                    total_amount: subtotal,
                    status: 'Odoslané',
                    offer_number: generatedNumber
                }])
                .select()
                .single();

            if (offerError) throw offerError;

            await supabase
                .from('job_tickets')
                .update({ status: 'Čaká na schválenie' })
                .eq('id', id);

            if (zakazka?.customer_id) {
                await supabase.from('notifications').insert([{
                    user_id: zakazka.customer_id,
                    customer_id: zakazka.customer_id,
                    title: 'Nová cenová ponuka 📄',
                    content: `K Vašej zákazke (${zakazka.plate_number}) bola vypracovaná ponuka č. ${generatedNumber} v hodnote ${total.toFixed(2)} €.`,
                    type: 'info',
                    link: `/ponuka/${offerData.id}`
                }]);
            }

            if (sendSms && zakazka?.customer_phone) {
                const ponukaUrl = `${window.location.origin}/ponuka/${offerData.id}`;
                const { data: settData } = await supabase.from('business_settings').select('id, value').in('id', ['company_name']);
                const companyName = settData?.find(r => r.id === 'company_name')?.value || 'AutoAlma Servis';
                const smsText = `Vazeny p. ${zakazka.customer_name || 'zakaznik'}, servis Vasho vozidla ${zakazka.plate_number || ''} - ${companyName} Vam poslala cenovu ponuku. Pre zobrazenie a schvalenie kliknite na: ${ponukaUrl}`;
                const doSend = confirm(`Odoslať SMS zákazníkovi ${zakazka.customer_name} (${zakazka.customer_phone})?`);
                if (doSend) {
                    await fetchWithAuth('/api/send-sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: zakazka.customer_phone, message: smsText }),
                    });
                }
            }

            router.push(`/zakazky/${id}`);
        } catch (err) {
            alert("Chyba pri ukladaní: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const groupedItems = offerItems.reduce((groups, item) => {
        const group = groups[item.group_name] || [];
        group.push(item);
        groups[item.group_name] = group;
        return groups;
    }, {});

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic animate-pulse tracking-widest uppercase">
            Pripravujem konfigurátor...
        </div>
    );

    const { subtotal, tax, total } = calculateTotal();

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-12 font-sans font-bold">
            <div className="max-w-6xl mx-auto">
                
                {/* --- HEADER OVLÁDANIE --- */}
                <div className="flex justify-between items-center mb-8 no-print">
                    <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-xs uppercase font-black tracking-widest">← Zrušiť</button>
                    <div className="flex gap-4">
                        <button onClick={() => window.print()} className="bg-zinc-800 border border-zinc-700 px-6 py-3 rounded-2xl text-white hover:bg-zinc-700 transition-all text-xs uppercase font-black tracking-widest">🖨️ Tlačiť</button>
                        
                        <button onClick={saveOnly} disabled={saving} className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all tracking-widest">
                            💾 Iba uložiť
                        </button>

                        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-2">
                            {zakazka?.customer_phone ? (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={sendSms}
                                        onChange={e => setSendSms(e.target.checked)}
                                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 whitespace-nowrap">
                                        📱 SMS ({zakazka.customer_phone})
                                    </span>
                                </label>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 whitespace-nowrap">📵 Chýba tel. číslo</span>
                            )}
                        </div>

                        <button onClick={saveOffer} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 transition-all tracking-widest">
                            {saving ? 'Ukladám...' : '🚀 Odoslať ponuku'}
                        </button>
                    </div>
                </div>

                <div className="printable-area">
                    {/* Skrytá hlavička pre tlač */}
                    <div className="hidden print-block mb-10 border-b-2 border-black pb-6 text-center">
                        <h1 className="text-4xl font-black uppercase italic">Cenová ponuka</h1>
                        <p className="text-[10px] tracking-[0.3em] uppercase">AutoAlma Servis</p>
                    </div>

                    {/* Info Box - PORADOVÉ ČÍSLO V STREDE */}
                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center info-box">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Zákazník</p>
                                <p className="text-xl italic uppercase font-black text-blue-400 print-black">{zakazka?.customer_name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Dátumy</p>
                                <p className="text-[11px] font-black text-white print-black">
                                    Vystavené: {dateCreated.toLocaleDateString('sk-SK')} <br/>
                                    Platnosť: <span className="text-red-500 print-black">{dateExpiry.toLocaleDateString('sk-SK')}</span>
                                </p>
                            </div>
                        </div>

                        <div className="text-center border-x border-zinc-800/50 px-4 py-2 print-border-none">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Číslo ponuky</p>
                            <div className="bg-white/5 border border-zinc-800 px-4 py-3 rounded-2xl print-no-bg">
                                <p className="text-3xl font-black tracking-tighter text-blue-500 print-black">
                                    {generatedNumber}
                                </p>
                            </div>
                        </div>

                        <div className="md:text-right">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-black">Vozidlo</p>
                            <p className="text-xl italic uppercase font-black print-black">{zakazka?.car_brand_model}</p>
                            <p className="text-blue-500 text-lg font-black tracking-widest print-black mt-1">[{zakazka?.plate_number}]</p>
                        </div>
                    </div>

                    {/* Panel záverov mechanika - SKRYTÝ PRI TLAČI */}
                    {(jobTasks.length > 0 || jobItems.length > 0 || zakazka?.complaints) && (
                        <div className="no-print bg-amber-950/30 border border-amber-600/30 rounded-[2rem] p-6 mb-6">
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">🔧 Záznamy mechanika zo zákazky</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {zakazka?.complaints && (
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2 font-black">Poznámky</p>
                                        <pre className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">{zakazka.complaints}</pre>
                                    </div>
                                )}
                                {jobItems.length > 0 && (
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2 font-black">Závady na vozidle ({jobItems.length})</p>
                                        <div className="space-y-1.5">
                                            {jobItems.map(item => (
                                                <div key={item.id} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-orange-600/20">
                                                    <span className="text-xs font-bold uppercase text-orange-300">{item.name}</span>
                                                    <span className="text-[9px] font-black text-zinc-500 shrink-0 ml-2">{item.quantity} {item.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {jobTasks.length > 0 && (
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2 font-black">Checklist ({jobTasks.filter(t => t.is_completed).length}/{jobTasks.length} hotovo)</p>
                                        <div className="space-y-1.5">
                                            {jobTasks.map(task => (
                                                <div key={task.id} className="flex items-start gap-2">
                                                    <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 text-[9px] font-black ${task.is_completed ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                        {task.is_completed ? '✓' : '○'}
                                                    </span>
                                                    <span className={`text-xs font-bold uppercase ${task.is_completed ? 'text-green-400 line-through opacity-60' : 'text-white'}`}>
                                                        {task.task_description}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Form Box - SKRYTÝ PRI TLAČI */}
                    <div className="bg-zinc-900 border-t-4 border-blue-600 p-8 rounded-[2.5rem] mb-8 shadow-2xl no-print">
                        <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] mb-6 italic">Nová položka do rozpočtu</h2>
                        <form onSubmit={addItemToOffer} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest font-black">Skupina</label>
                                <input type="text" placeholder="MOTOR..." className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase focus:border-blue-500 outline-none transition-colors" value={newItem.group_name} onChange={(e) => setNewItem({...newItem, group_name: e.target.value})} onFocus={(e) => e.target.select()} />
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest font-black">Typ</label>
                                <div className="flex gap-1.5">
                                    <select className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase focus:border-blue-500 outline-none transition-colors cursor-pointer" value={newItem.type} onChange={(e) => {
                                        const t = e.target.value;
                                        const isPraca = t === 'Práca';
                                        setNewItem({ ...newItem, type: t, unit: isPraca ? 'hod' : 'ks', unit_price: isPraca ? getRateValue(newItem.rateType) : '', name: isPraca ? `Servisná práca ${newItem.rateType}` : '' });
                                    }}>
                                        <option value="Materiál">Materiál</option>
                                        <option value="Práca">Práca</option>
                                    </select>
                                    {newItem.type === 'Práca' && (
                                        <select className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase focus:border-blue-500 outline-none transition-colors cursor-pointer" value={newItem.rateType} onChange={(e) => {
                                            const rt = e.target.value;
                                            setNewItem({ ...newItem, rateType: rt, unit_price: getRateValue(rt), name: `Servisná práca ${rt}` });
                                        }}>
                                            {rateCategories.map(c => (
                                                <option key={c.key} value={c.key}>{c.key} — {c.value}€</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest font-black">Položka</label>
                                <input list="catalog-list" type="text" placeholder="Hľadať v katalógu..." className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-colors" value={newItem.name}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const match = catalog.find(c => c.name === val.toUpperCase());
                                        if (match) {
                                            setNewItem({ ...newItem, name: val, unit_price: match.unit_price, unit: match.unit || 'ks', type: match.type === 'práca' ? 'Práca' : 'Materiál' });
                                        } else {
                                            setNewItem({...newItem, name: val});
                                        }
                                    }}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest text-center font-black">Mn.</label>
                                <input type="number" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-center text-xs font-black focus:border-blue-500 outline-none" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value) || 0})} onFocus={(e) => e.target.select()} />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest text-center font-black">Jedn.</label>
                                <select className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-[10px] font-black uppercase focus:border-blue-500 outline-none transition-colors cursor-pointer" value={newItem.unit} onChange={(e) => setNewItem({...newItem, unit: e.target.value})}>
                                    <option value="ks">ks</option><option value="l">l</option><option value="m">m</option><option value="hod">hod</option><option value="norma">norma</option><option value="bal">bal</option><option value="sada">sada</option>
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[9px] uppercase text-zinc-500 mb-2 block tracking-widest text-right font-black">Cena/J</label>
                                <input type="text" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-right text-xs font-black focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" value={newItem.unit_price} placeholder="0.00" disabled={newItem.type === 'Práca'}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (/^\d*\.?\d*$/.test(val)) setNewItem({...newItem, unit_price: val});
                                    }}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button type="submit" className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-black py-3 rounded-xl transition-all border border-blue-600/30 text-xl shadow-lg shadow-blue-900/10">+</button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl table-container">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-800/50 text-[10px] uppercase font-black text-zinc-400 tracking-widest italic">
                                <tr>
                                    <th className="p-4">Typ</th>
                                    <th className="p-4">Položka</th>
                                    <th className="p-4 text-center">Množstvo</th>
                                    <th className="p-4 text-right">Cena/J</th>
                                    <th className="p-4 text-right">Spolu</th>
                                    <th className="p-4 text-center w-10 no-print"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 font-black italic uppercase">
                                {Object.keys(groupedItems).map((groupName) => (
                                    <Fragment key={groupName}>
                                        <tr className="bg-blue-600/10 border-l-4 border-blue-600 print-row-bg">
                                            <td colSpan="6" className="p-4 text-blue-400 text-[11px] font-black tracking-widest uppercase italic print-black">
                                                📂 {groupName}
                                            </td>
                                        </tr>
                                        {groupedItems[groupName].map((item) => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-all group">
                                                <td className="p-4">
                                                    <span className={`text-[8px] font-black px-2 py-1 rounded border ${item.type === 'Práca' ? 'text-blue-400 border-blue-800' : 'text-orange-400 border-orange-800'} print-black-border print-black`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs tracking-tight print-black">{item.name}</td>
                                                <td className="p-4 text-center text-xs font-mono print-black">{item.quantity} {item.unit}</td>
                                                <td className="p-4 text-right text-xs font-mono print-black">{(Number(item.unit_price)).toFixed(2)} €</td>
                                                <td className="p-4 text-right text-xs font-mono print-black">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                                                <td className="p-4 text-center no-print">
                                                    <button onClick={() => removeItem(item.id)} className="text-zinc-800 group-hover:text-red-600 transition-colors">✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>

                        <div className="p-10 bg-black/40 border-t border-zinc-800 flex flex-col items-end space-y-2 recap-area">
                            <div className="flex justify-between w-64 text-zinc-500 text-[10px] font-black uppercase italic tracking-widest print-black">
                                <span>Základ:</span>
                                <span>{subtotal.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between w-64 text-zinc-500 text-[10px] font-black uppercase italic tracking-widest border-b border-zinc-800 pb-3 print-black">
                                <span>DPH (23%):</span>
                                <span>{tax.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between w-80 pt-4 items-center">
                                <span className="text-blue-500 font-black uppercase italic text-xl tracking-tighter print-black">Celkom ponuka:</span>
                                <span className="text-4xl font-black italic tracking-tighter leading-none print-black">{total.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <datalist id="catalog-list">
                {catalog.map((c, i) => (<option key={i} value={c.name}>{c.unit_price} €</option>))}
            </datalist>

            <style jsx global>{`
                .print-block { display: none; }
                @media print {
                    @page { size: A4; margin: 1cm; }
                    body { background: white !important; color: black !important; }
                    .no-print { display: none !important; }
                    .print-block { display: block !important; }
                    .printable-area { background: white !important; padding: 0 !important; width: 100% !important; }
                    .bg-zinc-900, .bg-zinc-900/50, .bg-black/40, .bg-black { background: white !important; }
                    .border, .border-zinc-800, .border-t { border-color: #eee !important; }
                    .info-box { border: 1pt solid #000 !important; border-radius: 10pt !important; margin-bottom: 20pt !important; display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; }
                    .print-border-none { border: none !important; }
                    .print-no-bg { background: none !important; border: 1px solid #000 !important; }
                    .table-container { border: 1pt solid #000 !important; border-radius: 10pt !important; overflow: hidden !important; }
                    .print-black { color: black !important; }
                    .print-black-border { border-color: black !important; }
                    .print-row-bg { background: #f8fafc !important; }
                    p, span, h1, h2, td, th { color: black !important; }
                    .recap-area { border-top: 2pt solid black !important; background: #fff !important; }
                }
            `}</style>
        </div>
    );
}