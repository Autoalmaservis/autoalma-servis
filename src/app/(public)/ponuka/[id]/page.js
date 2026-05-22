'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function VerejnaPonukaPage() {
  const { id } = useParams();
  const router = useRouter();
  const [offer, setOffer] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responded, setResponded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin inline edit
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemValues, setEditItemValues] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  // Discount
  const [discountType, setDiscountType] = useState('pct');
  const [discountValue, setDiscountValue] = useState('');

  const [myCompany, setMyCompany] = useState({
    name: 'AutoAlma Servis',
    address: '', city: '', zip: '', ico: '', dic: '', ic_dph: '',
    phone: '', email: '', web: ''
  });

  useEffect(() => {
    if (id) {
      fetchOffer();
      fetchMyCompanySettings();
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });
  }, [id]);

  const fetchMyCompanySettings = async () => {
    const { data } = await supabase.from('business_settings').select('*');
    if (data) {
      setMyCompany({
        name: data.find(s => s.id === 'company_name')?.value || 'AutoAlma Servis',
        address: data.find(s => s.id === 'company_address')?.value || '',
        city: data.find(s => s.id === 'company_city')?.value || '',
        zip: data.find(s => s.id === 'company_zip')?.value || '',
        ico: data.find(s => s.id === 'company_ico')?.value || '',
        dic: data.find(s => s.id === 'company_dic')?.value || '',
        ic_dph: data.find(s => s.id === 'company_ic_dph')?.value || '',
        phone: data.find(s => s.id === 'company_phone')?.value || '',
        email: data.find(s => s.id === 'company_email')?.value || '',
        web: data.find(s => s.id === 'company_web')?.value || '',
        logo_url: data.find(s => s.id === 'company_logo')?.value || '',
      });
    }
  };

  const fetchOffer = async () => {
    const { data } = await supabase
      .from('price_offers')
      .select(`*, job_tickets (*, id, customer_id, customer_name, customer_phone, customer_email, address, city, car_brand_model, plate_number, vin_number, mileage)`)
      .eq('id', id)
      .single();

    if (data) {
      const ticketData = Array.isArray(data.job_tickets) ? data.job_tickets[0] : data.job_tickets;
      setOffer({ ...data, job_tickets: ticketData });

      const raw = data.items_json;
      let parsedItems, parsedDiscount = null;
      if (Array.isArray(raw)) {
        parsedItems = raw;
      } else {
        parsedItems = raw?.items || [];
        parsedDiscount = raw?.discount || null;
      }
      if (parsedDiscount) {
        setDiscountType(parsedDiscount.type || 'pct');
        setDiscountValue(parsedDiscount.value || '');
      }
      setItems(parsedItems.map(item => ({
        ...item,
        is_selected: item.is_selected !== undefined ? item.is_selected : true
      })));
    }
    setLoading(false);
  };

  const toggleGroup = (groupName) => {
    if (responded || offer.status !== 'Odoslané') return;
    const groupItems = items.filter(i => i.group_name === groupName);
    const allSelected = groupItems.every(i => i.is_selected);
    setItems(items.map(item => item.group_name === groupName ? { ...item, is_selected: !allSelected } : item));
  };

  const calculateSelectedTotal = () => {
    return items.filter(i => i.is_selected).reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) * 1.23;
  };

  const getDiscountAmount = (baseTotal) => {
    const discNum = parseFloat(discountValue) || 0;
    return discountType === 'eur' ? discNum : baseTotal * discNum / 100;
  };

  // --- Admin edit ---
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemValues({ name: item.name, quantity: item.quantity, unit: item.unit, unit_price: item.unit_price });
  };

  const saveEditItem = (itemId) => {
    setItems(prev => prev.map(it => it.id !== itemId ? it : {
      ...it,
      name: editItemValues.name,
      quantity: parseFloat(editItemValues.quantity) || 0,
      unit: editItemValues.unit,
      unit_price: parseFloat(editItemValues.unit_price) || 0,
    }));
    setEditingItemId(null);
    setHasUnsavedChanges(true);
  };

  const cancelEdit = () => setEditingItemId(null);

  const saveChangesToDb = async () => {
    setSavingChanges(true);
    const baseTotal = items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) * 1.23;
    const discountAmount = getDiscountAmount(baseTotal);
    const newTotal = Math.max(0, baseTotal - discountAmount);
    const discNum = parseFloat(discountValue) || 0;
    const itemsData = discNum > 0
      ? { items, discount: { type: discountType, value: discountValue } }
      : items;
    try {
      const { error } = await supabase.from('price_offers')
        .update({ items_json: itemsData, total_amount: newTotal })
        .eq('id', id);
      if (error) throw error;
      setHasUnsavedChanges(false);
      setOffer(prev => ({ ...prev, total_amount: newTotal }));
    } catch (err) {
      alert('Chyba pri ukladaní: ' + err.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // --- Customer response ---
  const handleResponse = async () => {
    const selectedCount = items.filter(i => i.is_selected).length;
    const baseTotal = calculateSelectedTotal();
    const discountAmount = getDiscountAmount(baseTotal);
    const finalTotal = Math.max(0, baseTotal - discountAmount);
    const message = selectedCount === 0
      ? 'Naozaj chcete zamietnuť všetky položky ponuky?'
      : `Potvrdzujete vybraté opravy v celkovej hodnote ${finalTotal.toFixed(2)}€?`;
    if (!confirm(message)) return;

    const finalStatus = selectedCount === 0 ? 'Zamietnuté' : 'Schválené';
    const { error } = await supabase.from('price_offers').update({ status: finalStatus, items_json: items }).eq('id', id);

    if (!error) {
      if (offer?.job_id || offer?.job_tickets?.id) {
        const jobId = offer.job_id || offer.job_tickets.id;
        await supabase.from('job_tickets').update({ status: finalStatus === 'Schválené' ? 'Prebieha' : 'Ponuka zamietnutá' }).eq('id', jobId);
      }
      const targetUserId = offer?.job_tickets?.customer_id;
      if (targetUserId) {
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          customer_id: targetUserId,
          title: finalStatus === 'Schválené' ? '✅ Ponuka schválená' : '✕ Ponuka zamietnutá',
          content: finalStatus === 'Schválené'
            ? `Vozidlo ${offer.job_tickets.plate_number}: Schválili ste opravy za ${finalTotal.toFixed(2)}€.`
            : `Vozidlo ${offer.job_tickets.plate_number}: Ponuka bola zamietnutá.`,
          type: finalStatus === 'Schválené' ? 'success' : 'error',
          is_read: false,
          link: '/garaz'
        }]);
      }
      setResponded(true);
      setOffer({ ...offer, status: finalStatus });
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.3em]">Načítavam ponuku...</div>;
  if (!offer) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Ponuka neexistuje</div>;

  const groupedItems = items.reduce((groups, item) => {
    const g = groups[item.group_name] || [];
    g.push(item);
    groups[item.group_name] = g;
    return groups;
  }, {});

  const dateCreated = new Date(offer.created_at);
  const dateExpiry = new Date(offer.created_at);
  dateExpiry.setDate(dateExpiry.getDate() + 14);

  const baseTotal = calculateSelectedTotal();
  const discountAmount = getDiscountAmount(baseTotal);
  const finalTotal = Math.max(0, baseTotal - discountAmount);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-12 font-sans font-bold">

      {/* TOP BAR */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center no-print">
        <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black tracking-widest shadow-xl">
          ← Späť
        </button>
        <div className="flex gap-3 items-center">
          {isAdmin && hasUnsavedChanges && (
            <button
              onClick={saveChangesToDb}
              disabled={savingChanges}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl transition-all"
            >
              {savingChanges ? 'Ukladám...' : '💾 Uložiť zmeny'}
            </button>
          )}
          <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl flex items-center gap-2">
            🖨️ Tlačiť ponuku
          </button>
        </div>
      </div>

      {isAdmin && hasUnsavedChanges && (
        <div className="max-w-4xl mx-auto mb-4 no-print">
          <div className="bg-amber-600/10 border border-amber-600/30 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-amber-400">
            ⚠️ Máte neuložené zmeny — kliknite "Uložiť zmeny" pred zatvorením
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl printable-area">

        {/* PRINT HEADER */}
        <div className="hidden print-block">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10pt' }}>
            <tbody>
              <tr>
                <td width="20%" valign="middle">
                  <img src={myCompany.logo_url || '/autoalma logo.png'} alt="Logo" style={{ width: '90px', height: 'auto', display: 'block' }} />
                </td>
                <td width="40%" valign="top" style={{ paddingLeft: '15pt' }}>
                  <div style={{ fontSize: '8.5pt', color: '#000', lineHeight: '1.3' }}>
                    <p style={{ margin: '0', fontSize: '10pt' }}><strong>{myCompany.name}</strong></p>
                    <p style={{ margin: '0' }}>{myCompany.address}, {myCompany.zip} {myCompany.city}</p>
                    <p style={{ margin: '0' }}>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
                    <p style={{ margin: '2pt 0 0 0', color: '#444' }}>{myCompany.phone} | {myCompany.email}</p>
                    {myCompany.web && <p style={{ margin: '0', color: '#444' }}>{myCompany.web}</p>}
                  </div>
                </td>
                <td width="40%" valign="top" align="right">
                  <h2 style={{ fontSize: '14pt', color: '#dc2626', margin: '0', textTransform: 'uppercase', fontWeight: '900' }}>Cenová ponuka</h2>
                  <p style={{ fontSize: '10pt', color: '#000', fontWeight: '900', margin: '2pt 0' }}>#{offer.offer_number || id.slice(0, 8).toUpperCase()}</p>
                  <p style={{ margin: '0', color: '#000', fontSize: '8pt' }}>Vystavené: <strong>{dateCreated.toLocaleDateString('sk-SK')}</strong></p>
                  <p style={{ margin: '0', color: '#000', fontSize: '8pt' }}>Platnosť do: <strong>{dateExpiry.toLocaleDateString('sk-SK')}</strong></p>
                </td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt', border: '0.5pt solid #000' }}>
            <tbody>
              <tr style={{ fontSize: '8pt' }}>
                <td width="50%" style={{ padding: '6pt', borderRight: '0.5pt solid #000' }} valign="top">
                  <p style={{ color: '#666', fontWeight: '900', margin: '0 0 2pt 0', fontSize: '7pt' }}>ODBERATEĽ:</p>
                  <p style={{ fontWeight: '900', margin: '0', color: '#000' }}>{offer.job_tickets?.customer_name}</p>
                  <p style={{ margin: '0', color: '#000' }}>{offer.job_tickets?.customer_phone}</p>
                  <p style={{ margin: '0', color: '#000' }}>{offer.job_tickets?.customer_email}</p>
                </td>
                <td width="50%" style={{ padding: '6pt' }} valign="top">
                  <p style={{ color: '#666', fontWeight: '900', margin: '0 0 2pt 0', fontSize: '7pt' }}>VOZIDLO:</p>
                  <p style={{ fontWeight: '900', margin: '0', color: '#000' }}>{offer.job_tickets?.plate_number} • {offer.job_tickets?.car_brand_model}</p>
                  <p style={{ margin: '0', color: '#000' }}>VIN: {offer.job_tickets?.vin_number || '---'}</p>
                  <p style={{ margin: '0', color: '#000' }}>KM: {offer.job_tickets?.mileage || '---'}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* WEB HEADER */}
        <div className="bg-blue-600 p-10 flex justify-between items-center text-white header-bg no-print">
          <div className="flex items-center gap-6">
            <img src={myCompany.logo_url || '/autoalma logo.png'} alt="Logo" className="w-20 h-auto brightness-0 invert" />
            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Cenová ponuka</h1>
              <p className="text-blue-100 text-[10px] uppercase tracking-[0.3em] mt-2 font-black italic">#{id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase opacity-70">Platnosť ponuky do:</p>
            <p className="text-xl font-black">{dateExpiry.toLocaleDateString('sk-SK')}</p>
          </div>
        </div>

        <div className="p-10 space-y-10 bg-zinc-900 print-p-0">

          {/* INFO O KLIENTOVI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-zinc-800 pb-10 no-print">
            <div className="space-y-4">
              <h4 className="text-blue-500 text-[10px] uppercase tracking-widest">Odberateľ</h4>
              <div>
                <p className="text-2xl font-black uppercase italic leading-none">{offer.job_tickets?.customer_name}</p>
                <p className="text-xs text-zinc-400 mt-1">{offer.job_tickets?.customer_phone}</p>
              </div>
            </div>
            <div className="space-y-4 md:text-right">
              <h4 className="text-blue-500 text-[10px] uppercase tracking-widest">Vozidlo</h4>
              <div>
                <p className="text-2xl font-black uppercase italic leading-none">{offer.job_tickets?.car_brand_model}</p>
                <p className="text-sm font-black text-white mt-1">ŠPZ: {offer.job_tickets?.plate_number}</p>
              </div>
            </div>
          </div>

          {/* POLOŽKY */}
          <div className="space-y-8">
            <div className="flex justify-between items-end no-print">
              <p className="text-[10px] text-blue-500 uppercase tracking-[0.2em] italic font-black">Rozpis navrhovaných prác a materiálu:</p>
              <p className="text-[10px] text-zinc-500 uppercase">Dátum: {dateCreated.toLocaleDateString('sk-SK')}</p>
            </div>

            {Object.keys(groupedItems).map((groupName) => {
              const isSelected = groupedItems[groupName].every(i => i.is_selected);
              return (
                <div key={groupName} className={`rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden print-no-round print-border-thin ${isSelected ? 'border-blue-600 bg-blue-600/5' : 'border-zinc-800 bg-black/20 opacity-40 no-print'}`}>
                  <div className={`p-5 flex justify-between items-center transition-all duration-300 print-bg-gray ${isSelected ? 'bg-blue-600/20' : 'bg-zinc-800/30'}`}>
                    <h3 className={`font-black uppercase italic tracking-wider print-text-black ${isSelected ? 'text-white' : 'text-zinc-500'}`}>📂 {groupName}</h3>
                    <button
                      disabled={responded || offer.status !== 'Odoslané'}
                      onClick={() => toggleGroup(groupName)}
                      className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 no-print ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      {isSelected ? 'Vybraté ✓' : 'Vynechať ✕'}
                    </button>
                  </div>
                  <div className="p-6 space-y-3 print-p-2">
                    {groupedItems[groupName].map((item) => (
                      editingItemId === item.id ? (
                        <div key={item.id} className="bg-blue-600/10 border border-blue-500/40 rounded-2xl p-4 space-y-3 no-print">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={editItemValues.name}
                              onChange={e => setEditItemValues({ ...editItemValues, name: e.target.value })}
                              className="md:col-span-3 bg-black border border-zinc-600 focus:border-blue-500 px-3 py-2 rounded-xl text-sm font-black text-white uppercase outline-none"
                              placeholder="Názov položky"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={editItemValues.quantity}
                                onChange={e => setEditItemValues({ ...editItemValues, quantity: e.target.value })}
                                className="w-full bg-black border border-zinc-600 focus:border-blue-500 px-3 py-2 rounded-xl text-sm font-black text-white text-center outline-none"
                                placeholder="Mn."
                                step="any"
                              />
                              <select
                                value={editItemValues.unit}
                                onChange={e => setEditItemValues({ ...editItemValues, unit: e.target.value })}
                                className="bg-black border border-zinc-600 focus:border-blue-500 px-2 py-2 rounded-xl text-xs font-black text-white outline-none"
                              >
                                <option value="ks">ks</option>
                                <option value="hod">hod</option>
                                <option value="l">l</option>
                                <option value="m">m</option>
                                <option value="bal">bal</option>
                                <option value="sada">sada</option>
                                <option value="norma">norma</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editItemValues.unit_price}
                                onChange={e => setEditItemValues({ ...editItemValues, unit_price: e.target.value })}
                                className="w-full bg-black border border-zinc-600 focus:border-blue-500 px-3 py-2 rounded-xl text-sm font-black text-white text-right outline-none"
                                placeholder="Cena/j"
                                step="any"
                              />
                              <span className="text-zinc-500 text-xs shrink-0">€/j</span>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-zinc-400 text-xs font-black">
                                = {(parseFloat(editItemValues.quantity || 0) * parseFloat(editItemValues.unit_price || 0)).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEditItem(item.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                              ✓ Potvrdiť
                            </button>
                            <button onClick={cancelEdit} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                              ✕ Zrušiť
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} className={`flex justify-between items-center border-b border-zinc-800/50 pb-2 print-border-black group ${isSelected ? 'opacity-100' : 'opacity-50'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black uppercase italic print-text-black">{item.name}</p>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest print-text-black">{item.quantity} {item.unit} • {(item.unit_price || 0).toFixed(2)}€ / j</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <p className={`text-lg font-black italic tracking-tighter print-text-black ${isSelected ? 'text-white' : 'text-zinc-600'}`}>{(item.quantity * item.unit_price).toFixed(2)}€</p>
                            {isAdmin && (
                              <button
                                onClick={() => startEditItem(item)}
                                className="no-print opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-blue-400 text-sm px-1"
                                title="Upraviť položku"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ZĽAVA — admin only, no-print */}
          {isAdmin && (
            <div className="no-print flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Zľava:</span>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-[10px] font-black">
                  <button
                    onClick={() => { setDiscountType('pct'); setHasUnsavedChanges(true); }}
                    className={`px-3 py-1 transition-all ${discountType === 'pct' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >%</button>
                  <button
                    onClick={() => { setDiscountType('eur'); setHasUnsavedChanges(true); }}
                    className={`px-3 py-1 transition-all ${discountType === 'eur' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >€</button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={e => { setDiscountValue(e.target.value); setHasUnsavedChanges(true); }}
                  onFocus={e => e.target.select()}
                  placeholder={discountType === 'pct' ? '0 %' : '0.00 €'}
                  className="w-24 bg-black border border-zinc-700 focus:border-blue-500 px-3 py-1 rounded-lg text-white text-[11px] font-black outline-none text-right"
                />
              </div>
              {discountAmount > 0 && (
                <div className="text-red-400 text-[11px] font-black uppercase tracking-widest">
                  Zľava {discountType === 'pct' ? `(${discountValue}%)` : ''}: − {discountAmount.toFixed(2)} €
                </div>
              )}
            </div>
          )}

          {/* SUMA */}
          <div className={`p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-2 shadow-lg print-no-round print-p-4 print-border-thick ${discountAmount > 0 ? 'bg-green-600 text-white border-2 border-green-500' : 'bg-white text-black border border-zinc-200'}`}>
            <div className="text-left">
              <span className="text-sm font-black uppercase italic leading-none block">Celková suma s DPH:</span>
              <span className={`text-[8px] uppercase font-black tracking-widest mt-1 block ${discountAmount > 0 ? 'opacity-70' : 'opacity-40'}`}>
                Sadzba DPH 23%{discountAmount > 0 ? ` · Pred zľavou: ${baseTotal.toFixed(2)} €` : ''}
              </span>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black italic leading-none tracking-tighter print-text-2xl">{finalTotal.toFixed(2)}€</p>
            </div>
          </div>

          {/* PRINT: zľava riadok */}
          {discountAmount > 0 && (
            <div className="hidden print-block" style={{ textAlign: 'right', fontSize: '8pt', color: '#dc2626', fontWeight: '900', marginTop: '-8pt' }}>
              Zľava {discountType === 'pct' ? `(${discountValue}%)` : ''}: − {discountAmount.toFixed(2)} €
            </div>
          )}

          {/* AKCIA */}
          <div className="no-print">
            {!responded && offer.status === 'Odoslané' ? (
              <button onClick={handleResponse} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-7 rounded-[2rem] uppercase text-sm tracking-[0.2em] italic transition-all shadow-2xl shadow-blue-900/40">
                Odoslať vyjadrenie do servisu
              </button>
            ) : (
              <div className={`p-8 rounded-[2.5rem] text-center font-black uppercase tracking-widest italic border-2 ${offer.status === 'Schválené' ? 'bg-green-600/10 text-green-500 border-green-600/50' : 'bg-red-600/10 text-red-500 border-red-600/50'}`}>
                {offer.status === 'Schválené' ? '✓ Ponuka bola schválená' : offer.status === 'Zamietnuté' ? '✕ Ponuka bola odmietnutá' : offer.status}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-center mt-8 text-zinc-600 text-[9px] uppercase tracking-[0.4em] font-black italic no-print">
        {myCompany.name} • {myCompany.address}, {myCompany.city} • {myCompany.web}
      </p>

      <style jsx global>{`
        .print-block { display: none; }
        @media print {
          @page { size: A4; margin: 0 !important; }
          body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          .min-h-screen { background: white !important; padding: 0 !important; min-height: 0 !important; }
          .printable-area { border: none !important; background: white !important; box-shadow: none !important; color: black !important; border-radius: 0 !important; max-width: 100% !important; padding: 1.5cm 1.5cm 1.5cm 1.5cm !important; }
          .bg-zinc-900, .bg-zinc-950, .bg-black { background: white !important; color: black !important; }
          .print-no-round { border-radius: 0 !important; }
          .print-border-thin { border: 0.5pt solid #bbb !important; margin-bottom: 10pt !important; }
          .print-border-thick { border: 1.2pt solid #000 !important; }
          .print-bg-gray { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; border-bottom: 0.5pt solid #000 !important; }
          .print-text-black { color: black !important; }
          .print-text-2xl { font-size: 20pt !important; }
          .print-p-0 { padding: 0 !important; }
          .print-p-4 { padding: 10pt !important; }
          .print-p-2 { padding: 5pt !important; }
          .print-border-black { border-bottom: 0.2pt solid #eee !important; }
          input { border: none !important; background: none !important; padding: 0 !important; color: black !important; }
          select { display: none !important; }
        }
      `}</style>
    </div>
  );
}
