'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function JobFormManager({ jobId, zakazka, ensureAuth, myCompany, isOpen, onClose }) {
  const [formTemplates, setFormTemplates] = useState([]);
  const [savedForms, setSavedForms] = useState([]);
  const [showFormFill, setShowFormFill] = useState(false);
  const [formViewOnly, setFormViewOnly] = useState(false);
  const [activeFormTemplate, setActiveFormTemplate] = useState(null);
  const [savingForm, setSavingForm] = useState(false);
  const [formFillData, setFormFillData] = useState({
    customer_name: '', customer_address: '', customer_phone: '', customer_ico: '',
    brand: '', model: '', plate: '', mileage: '', year: '', fuel: '', engine_volume: '', engine_power: '',
    note: '', date_received: new Date().toISOString().split('T')[0], date_returned: '',
    measurements: [],
  });

  useEffect(() => {
    fetchFormTemplates();
    fetchSavedForms();
  }, [jobId]);

  const fetchFormTemplates = async () => {
    const { data } = await supabase.from('form_templates').select('*').order('created_at', { ascending: false });
    if (data) setFormTemplates(data);
  };

  const fetchSavedForms = async () => {
    const { data } = await supabase.from('job_forms').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    if (data) setSavedForms(data);
  };

  const openFormFill = async (template) => {
    const z = zakazka || {};
    const brandParts = (z.car_brand_model || '').split(' ');

    let custAddress = z.address || z.customer_address || '';
    let custIco = z.ico || '';
    if (z.customer_id) {
      const [{ data: cust }, { data: prof }] = await Promise.all([
        supabase.from('customers').select('address, city, zip, ico').eq('id', z.customer_id).maybeSingle(),
        supabase.from('user_profiles').select('address, city, zip, ico').eq('id', z.customer_id).maybeSingle(),
      ]);
      const src = cust || prof;
      if (src) {
        custAddress = [src.address, src.zip, src.city].filter(Boolean).join(', ') || custAddress;
        custIco = src.ico || custIco;
      }
    }

    setActiveFormTemplate(template);
    setFormViewOnly(false);
    setFormFillData({
      customer_name: z.company_name || z.customer_name || '',
      customer_address: custAddress,
      customer_phone: z.customer_phone || '',
      customer_ico: custIco,
      brand: brandParts[0] || '',
      model: brandParts.slice(1).join(' ') || '',
      plate: z.plate_number || '',
      mileage: z.mileage || '',
      year: z.year_produced || '',
      fuel: z.fuel_type || '',
      engine_volume: z.engine_volume || '',
      engine_power: z.engine_power || '',
      note: '',
      date_received: new Date(z.created_at || Date.now()).toISOString().split('T')[0],
      date_returned: '',
      measurements: [
        { label: 'Priechodnosť PRED', value: '' },
        { label: 'Priechodnosť PO', value: '' },
        { label: 'Stav DPF/FAP PRED', value: '' },
        { label: 'Stav DPF/FAP PO', value: '' },
        { label: 'Počet čistení', value: '' },
      ],
    });
    onClose();
    setShowFormFill(true);
  };

  const handleDeleteForm = async (formId) => {
    if (!confirm('Naozaj vymazať tento formulár? Akciu nie je možné vrátiť.')) return;
    if (!await ensureAuth()) return;
    const { error } = await supabase.from('job_forms').delete().eq('id', formId);
    if (!error) fetchSavedForms();
  };

  const handleSaveForm = async () => {
    if (!await ensureAuth()) return;
    setSavingForm(true);
    try {
      const { error } = await supabase.from('job_forms').insert([{
        job_id: jobId,
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
    const title = activeFormTemplate?.name || 'PROTOKOL';
    const logoUrl = myCompany.logo_url || '';
    const compName = myCompany.name || 'AutoAlma Servis s.r.o.';
    const compAddr = [myCompany.address, myCompany.zip, myCompany.city].filter(Boolean).join(', ') || 'ul. Svornosti 119, 821 06 Bratislava';
    const compPhone = myCompany.phone || '0940 449 449';
    const compIco = myCompany.ico || '46044876';
    const compDic = myCompany.dic || '2023194316';
    const dateRec = d.date_received ? new Date(d.date_received + 'T12:00:00').toLocaleDateString('sk-SK') : '';
    const dateRet = d.date_returned ? new Date(d.date_returned + 'T12:00:00').toLocaleDateString('sk-SK') : '';
    const meas = (d.measurements || []).filter(m => m.label);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Arial',sans-serif;background:#fff;color:#1a1a1a;font-size:9.5pt;padding:12mm 14mm 10mm}
      .header{display:flex;align-items:stretch;border:2.5px solid #cc0000;border-radius:3px;margin-bottom:6mm;overflow:hidden}
      .h-logo{background:#cc0000;padding:5mm 6mm;display:flex;align-items:center;justify-content:center;min-width:44mm}
      .h-logo img{max-height:18mm;max-width:40mm;object-fit:contain;filter:brightness(0)invert(1)}
      .h-logo-text{color:#fff;font-size:16pt;font-weight:900;text-transform:uppercase;letter-spacing:-.03em;line-height:1}
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
      td{color:#111}
      td.w18{width:18%} td.w22{width:22%}
      .plate-cell{font-size:13pt;font-weight:900;letter-spacing:.12em;color:#cc0000;text-transform:uppercase}
      .meas th{background:#fff5f5;color:#cc0000;font-size:8pt;width:65%}
      .meas td{font-size:10.5pt;font-weight:700;text-align:center;background:#fffafa}
      .meas tr:nth-child(odd) th{background:#ffecec}
      .meas tr:nth-child(odd) td{background:#fff5f5}
      .dates{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:4mm}
      .date-box{border:1.5px solid #d0d0d0;padding:3mm 4mm;border-radius:2px}
      .date-label{font-size:7pt;text-transform:uppercase;letter-spacing:.12em;color:#888;margin-bottom:1mm}
      .date-val{font-size:12pt;font-weight:900;letter-spacing:.04em}
      .signs{display:grid;grid-template-columns:1fr 1fr;gap:24mm;margin-top:14mm}
      .sign{text-align:center}
      .sign-line{border-top:1.5px solid #333;padding-top:2mm;font-size:7.5pt;color:#666;text-transform:uppercase;letter-spacing:.1em}
      .footer{margin-top:6mm;border-top:1px solid #e0e0e0;padding-top:2.5mm;display:flex;justify-content:space-between;font-size:7pt;color:#aaa}
      @media print{body{padding:8mm 10mm 6mm}@page{size:A4;margin:0}}
    </style></head><body>

    <div class="header">
      <div class="h-logo">
        ${logoUrl
          ? `<img src="${logoUrl}" alt="Logo" />`
          : `<div class="h-logo-text">${compName.split(' ')[0]}</div>`}
      </div>
      <div class="h-title">
        <div class="doc-name">${title}</div>
        <div class="doc-sub">Servisný protokol • AutoAlma</div>
      </div>
      <div class="h-info">
        <b>${compName}</b>
        ${compAddr}<br/>
        Tel: ${compPhone}<br/>
        IČO: ${compIco}&nbsp;&nbsp;DIČ: ${compDic}
      </div>
    </div>

    <div class="two-col">
      <div class="sec">
        <div class="sec-head">Odovzdávajúci (zákazník)</div>
        <table>
          <tr><th>Meno / Firma</th><td colspan="3"><b>${d.customer_name||''}</b></td></tr>
          <tr><th>Adresa</th><td colspan="3">${d.customer_address||''}</td></tr>
          <tr><th>Telefón</th><td>${d.customer_phone||''}</td></tr>
          <tr><th>IČO</th><td>${d.customer_ico||''}</td></tr>
        </table>
      </div>
      <div class="sec">
        <div class="sec-head dark">Dátumy servisu</div>
        <table>
          <tr><th>Prevzaté dňa</th><td><b>${dateRec||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</b></td></tr>
          <tr><th>Odovzdané dňa</th><td><b>${dateRet||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</b></td></tr>
        </table>
      </div>
    </div>

    <div class="sec">
      <div class="sec-head dark">Údaje o vozidle</div>
      <table>
        <tr>
          <th>EČV</th><td class="plate-cell w22">${d.plate||''}</td>
          <th>Značka / Model</th><td>${(d.brand||'')+' '+(d.model||'')}</td>
          <th>Rok výroby</th><td class="w18">${d.year||''}</td>
        </tr>
        <tr>
          <th>Palivo</th><td class="w22">${d.fuel||''}</td>
          <th>Stav KM pri prevzatí</th><td><b>${d.mileage ? d.mileage+' km' : ''}</b></td>
          <th>Výkon / Objem</th><td class="w18">${d.engine_power ? d.engine_power+' kW' : ''} ${d.engine_volume ? '/ '+d.engine_volume : ''}</td>
        </tr>
        ${d.note ? `<tr><th>Poznámka</th><td colspan="5">${d.note}</td></tr>` : ''}
      </table>
    </div>

    ${meas.length ? `
    <div class="sec">
      <div class="sec-head">Merania a namerané hodnoty</div>
      <table class="meas">
        <tr><th style="background:#f0f0f0;color:#333">Meranie / Parameter</th><td style="background:#f0f0f0;text-align:center;font-weight:700;font-size:9pt;color:#333">Nameraná hodnota</td></tr>
        ${meas.map(m=>`<tr><th>${m.label}</th><td>${m.value||''}</td></tr>`).join('')}
      </table>
    </div>` : ''}

    <div class="signs">
      <div class="sign"><div style="height:16mm;border-bottom:1px dashed #ccc;margin-bottom:2mm"></div><div class="sign-line">Podpis zákazníka — odovzdávajúci</div></div>
      <div class="sign"><div style="height:16mm;border-bottom:1px dashed #ccc;margin-bottom:2mm"></div><div class="sign-line">Podpis technika — preberajúci</div></div>
    </div>

    <div class="footer">
      <span>${compName} • ${compAddr} • IČ DPH: SK${compDic.replace('SK','')}</span>
      <span>Vytlačené: ${new Date().toLocaleDateString('sk-SK')}</span>
    </div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <>
      {/* ── MODÁL: VÝBER FORMULÁRA ── */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Vybrať <span className="text-red-600">formulár</span></h3>
              <button onClick={onClose} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
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
            <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-8 py-5 flex justify-between items-center z-10">
              <div>
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Formulár</p>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{activeFormTemplate.name}</h3>
              </div>
              <div className="flex gap-3 items-center">
                {formViewOnly && <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest border border-zinc-800 px-3 py-1.5 rounded-lg">Archív — len na čítanie</span>}
                <button onClick={handlePrintForm} className="bg-zinc-800 hover:bg-white hover:text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">🖨️ Vytlačiť</button>
                {!formViewOnly && (
                  <button onClick={handleSaveForm} disabled={savingForm} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                    {savingForm ? 'Ukladám...' : '💾 Uložiť do zákazky'}
                  </button>
                )}
                <button onClick={() => setShowFormFill(false)} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Odovzdávajúci</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[['Meno / Názov spol.', 'customer_name'], ['Adresa', 'customer_address'], ['Tel. číslo', 'customer_phone'], ['IČO', 'customer_ico']].map(([label, key]) => (
                    <div key={key}>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
                      {formViewOnly
                        ? <p className="p-3 text-white text-sm font-bold">{formFillData[key] || '—'}</p>
                        : <input value={formFillData[key]} onChange={e => setFormFillData(p => ({...p, [key]: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                      }
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Údaje o vozidle</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[['Značka', 'brand'], ['Model', 'model'], ['EČV', 'plate'], ['Stav KM', 'mileage'], ['Rok výroby', 'year'], ['Palivo', 'fuel'], ['KW', 'engine_power'], ['Objem motora', 'engine_volume']].map(([label, key]) => (
                    <div key={key}>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
                      {formViewOnly
                        ? <p className="p-3 text-white text-sm font-bold">{formFillData[key] || '—'}</p>
                        : <input value={formFillData[key]} onChange={e => setFormFillData(p => ({...p, [key]: e.target.value}))} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                      }
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Poznámka</label>
                  {formViewOnly
                    ? <p className="p-3 text-white text-sm font-bold">{formFillData.note || '—'}</p>
                    : <textarea value={formFillData.note} onChange={e => setFormFillData(p => ({...p, note: e.target.value}))} rows={2} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold resize-none" />
                  }
                </div>
              </section>

              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Merania a hodnoty</h4>
                  {!formViewOnly && <button type="button" onClick={() => setFormFillData(p => ({...p, measurements: [...p.measurements, { label: '', value: '' }]}))} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-all">+ Pridať riadok</button>}
                </div>
                <div className="space-y-3">
                  {(formFillData.measurements || []).map((m, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      {formViewOnly ? (
                        <>
                          <p className="flex-[2] p-3 text-white text-sm font-bold">{m.label || '—'}</p>
                          <p className="flex-1 p-3 text-red-400 text-sm font-black">{m.value || '—'}</p>
                        </>
                      ) : (
                        <>
                          <input placeholder="Názov merania" value={m.label} onChange={e => { const ms = [...formFillData.measurements]; ms[i] = {...ms[i], label: e.target.value}; setFormFillData(p => ({...p, measurements: ms})); }} className="flex-[2] bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 font-bold" />
                          <input placeholder="Hodnota" value={m.value} onChange={e => { const ms = [...formFillData.measurements]; ms[i] = {...ms[i], value: e.target.value}; setFormFillData(p => ({...p, measurements: ms})); }} className="flex-1 bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 font-bold" />
                          <button onClick={() => setFormFillData(p => ({...p, measurements: p.measurements.filter((_, j) => j !== i)}))} className="text-zinc-700 hover:text-red-500 transition-all font-black text-lg">×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Dátumy</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Prevzaté dňa</label>
                    {formViewOnly
                      ? <p className="p-3 text-white text-sm font-bold">{formFillData.date_received ? new Date(formFillData.date_received).toLocaleDateString('sk-SK') : '—'}</p>
                      : <input type="date" value={formFillData.date_received} onChange={e => setFormFillData(p => ({...p, date_received: e.target.value}))} style={{colorScheme:'dark'}} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                    }
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Odovzdané dňa</label>
                    {formViewOnly
                      ? <p className="p-3 text-white text-sm font-bold">{formFillData.date_returned ? new Date(formFillData.date_returned).toLocaleDateString('sk-SK') : '—'}</p>
                      : <input type="date" value={formFillData.date_returned} onChange={e => setFormFillData(p => ({...p, date_returned: e.target.value}))} style={{colorScheme:'dark'}} className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 font-bold" />
                    }
                  </div>
                </div>
              </section>

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

      {/* ── ULOŽENÉ FORMULÁRE V ZÁKAZKE ── */}
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
              <div className="flex items-center gap-2">
                {zakazka && zakazka.status !== 'Dokončené' && zakazka.status !== 'Archivované' && (
                  <button onClick={() => handleDeleteForm(f.id)} className="text-[9px] font-black uppercase text-zinc-700 hover:text-red-500 transition-all px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-red-800">
                    🗑 Vymazať
                  </button>
                )}
                <button onClick={() => {
                  setActiveFormTemplate({ id: f.template_id, name: f.template_name, pdf_url: null });
                  setFormFillData(f.filled_data);
                  setFormViewOnly(true);
                  setShowFormFill(true);
                }} className="text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500">
                  🖨️ Otvoriť / Tlačiť
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
