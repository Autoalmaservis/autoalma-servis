'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { createWorker } from 'tesseract.js';

// Kalendár pluginy
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function Home() {
  // --- DATA ---
  const [sluzby, setSluzby] = useState([]);
  const [zakazky, setZakazky] = useState([]);
  const [klienti, setKlienti] = useState([]);
  const [events, setEvents] = useState([]);
  const [vybranaZakazka, setVybranaZakazka] = useState(null);
  const [polozkyZakazky, setPolozkyZakazky] = useState([]);

  // --- NAVIGÁCIA ---
  const [aktivnaZalozka, setAktivnaZalozka] = useState('dielna'); 
  const [zobrazitDetail, setZobrazitDetail] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // --- FORMULÁRE PRÍJEM ---
  const [spz, setSpz] = useState('');
  const [zakaznik, setZakaznik] = useState('');
  const [telefon, setTelefon] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [hladatSluzbu, setHladatSluzbu] = useState('');

  // --- KALENDÁR LOGIKA ---
  const [modalKalendar, setModalKalendar] = useState(false);
  const [krokRezervacie, setKrokRezervacie] = useState(1);
  const [novyEvent, setNovyEvent] = useState({ id: null, title: '', start: '', end: '', customer_note: '' });
  const [naskenovaneDataZKalendara, setNaskenovaneDataZKalendara] = useState(null);

  const DPH_PERCENTO = 0.23;

  // --- INICIALIZÁCIA ---
  useEffect(() => {
    ziskajZakladneData();
    nacinajKalendar();
    ziskajKlientov();
  }, []);

  const ziskajZakladneData = async () => {
    const { data: za } = await supabase.from('job_tickets').select('*').order('created_at', { ascending: false });
    setZakazky(za || []);
    const { data: sl } = await supabase.from('services_catalog').select('*').order('name', { ascending: true });
    setSluzby(sl || []);
  };

  const ziskajKlientov = async () => {
    const { data } = await supabase.from('job_tickets').select('customer_name, customer_phone, plate_number, car_brand_model, id');
    if (!data) return;
    const zoskupeni = data.reduce((acc, current) => {
      const meno = current.customer_name;
      if (!acc[meno]) acc[meno] = { meno, telefon: current.customer_phone, auta: [] };
      if (!acc[meno].auta.find(a => a.spz === current.plate_number)) {
        acc[meno].auta.push({ spz: current.plate_number, model: current.car_brand_model, ticket_id: current.id });
      }
      return acc;
    }, {});
    setKlienti(Object.values(zoskupeni));
  };

  const nacinajKalendar = async () => {
    const { data } = await supabase.from('calendar_events').select('*');
    if (data) {
      setEvents(data.map(e => ({ 
        id: e.id, title: e.title, start: e.start_datetime, end: e.end_datetime, extendedProps: { note: e.customer_note } 
      })));
    }
  };

  // --- FUNKCIE PRE KALENDÁR ---
  useEffect(() => {
    const checkVehicle = async () => {
      if (novyEvent.title.length > 4) {
        const { data } = await supabase.from('job_tickets').select('*').eq('plate_number', novyEvent.title.toUpperCase()).limit(1);
        if (data && data.length > 0) setNaskenovaneDataZKalendara(data[0]);
        else setNaskenovaneDataZKalendara(null);
      }
    };
    checkVehicle();
  }, [novyEvent.title]);

  const handleDateSelect = (selectInfo) => {
    setNovyEvent({ id: null, title: '', start: selectInfo.startStr, end: selectInfo.endStr, customer_note: '' });
    setKrokRezervacie(1);
    setModalKalendar(true);
  };

  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    setNovyEvent({ id: ev.id, title: ev.title, start: ev.startStr, end: ev.endStr, customer_note: ev.extendedProps.note || '' });
    setKrokRezervacie(2);
    setModalKalendar(true);
  };

  const ulozitRezervaciu = async () => {
    const eventData = { title: novyEvent.title, start_datetime: novyEvent.start, end_datetime: novyEvent.end, customer_note: novyEvent.customer_note };
    let res;
    if (novyEvent.id) res = await supabase.from('calendar_events').update(eventData).eq('id', novyEvent.id);
    else res = await supabase.from('calendar_events').insert([eventData]);
    if (!res.error) { setModalKalendar(false); nacinajKalendar(); }
  };

  const zmazatRezervaciu = async () => {
    if (confirm("Zmazať termín?")) {
      await supabase.from('calendar_events').delete().eq('id', novyEvent.id);
      setModalKalendar(false); nacinajKalendar();
    }
  };

  // --- OSTATNÉ FUNKCIE ---
  const spracujTechnicak = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsScanning(true);
    const worker = await createWorker('slk');
    try {
      const { data: { text } } = await worker.recognize(file);
      const T = text.toUpperCase();
      const vMatch = T.match(/[A-Z0-9]{17}/);
      if (vMatch) setVin(vMatch[0]);
      alert("Skenovanie úspešné!");
    } catch (err) { alert("Chyba skenovania"); }
    finally { await worker.terminate(); setIsScanning(false); }
  };

  const prijemVozidla = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('job_tickets').insert([{ 
        plate_number: spz.toUpperCase(), customer_name: zakaznik, car_brand_model: model, vin_number: vin, customer_phone: telefon
    }]).select();
    if (!error) { 
      setSpz(''); setZakaznik(''); ziskajZakladneData(); ziskajKlientov(); 
      otvorDetail(data[0]); 
    }
  };

  const otvorDetail = async (zakazka) => {
    setVybranaZakazka(zakazka);
    const { data } = await supabase.from('ticket_items').select('*').eq('ticket_id', zakazka.id);
    setPolozkyZakazky(data || []);
    setZobrazitDetail(true);
  };

  const sumaBezDph = polozkyZakazky.reduce((sum, p) => sum + Number(p.price_at_time || 0), 0);
  const sumaSDph = sumaBezDph * (1 + DPH_PERCENTO);

  // --- RENDER MODALU KALENDÁRA ---
  const renderKalendarModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black italic uppercase text-red-600">{novyEvent.id ? 'Upraviť termín' : 'Nová rezervácia'}</h2>
          <button onClick={() => setModalKalendar(false)} className="text-zinc-500 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <input value={novyEvent.title} onChange={e => setNovyEvent({...novyEvent, title: e.target.value.toUpperCase()})} placeholder="ŠPZ" className="w-full bg-black border-2 border-zinc-800 p-5 rounded-2xl text-3xl font-black outline-none focus:border-red-600 uppercase" />
            {naskenovaneDataZKalendara ? (
              <div className="bg-green-950/20 border border-green-900/50 p-5 rounded-2xl">
                <p className="text-[10px] font-black text-green-500 uppercase italic">Vozidlo známe ✅</p>
                <p className="text-sm font-bold uppercase">{naskenovaneDataZKalendara.car_brand_model}</p>
                <p className="text-[10px] opacity-50">{naskenovaneDataZKalendara.customer_name}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setKrokRezervacie(2)} className="flex-grow bg-zinc-800 p-4 rounded-xl text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all">✏️ Manuálne</button>
                <label htmlFor="modalScan" className="flex-grow bg-zinc-800 p-4 rounded-xl text-[10px] font-black uppercase text-center cursor-pointer hover:bg-white hover:text-black transition-all">📷 Sken TP</label>
                <input type="file" id="modalScan" hidden onChange={spracujTechnicak} />
              </div>
            )}
            {krokRezervacie === 2 && !naskenovaneDataZKalendara && (
                <div className="space-y-2 animate-in fade-in">
                    <input value={zakaznik} onChange={e => setZakaznik(e.target.value)} placeholder="Meno zákazníka" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-xs outline-none" />
                    <input value={model} onChange={e => setModel(e.target.value)} placeholder="Model auta" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-xs outline-none" />
                </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest">Požiadavka / Závada</label>
            <textarea value={novyEvent.customer_note} onChange={e => setNovyEvent({...novyEvent, customer_note: e.target.value})} placeholder="Popis práce..." className="w-full bg-black border-2 border-zinc-800 p-5 rounded-2xl text-sm outline-none focus:border-red-600 h-full min-h-[180px] resize-none" />
          </div>
        </div>
        <div className="mt-8 flex gap-4">
          {novyEvent.id && <button onClick={zmazatRezervaciu} className="text-red-500 text-[10px] font-black uppercase underline">Zmazať</button>}
          <div className="flex-grow" />
          <button onClick={ulozitRezervaciu} className="bg-red-600 px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-900/40">Uložiť termín</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-600">
      
      {modalKalendar && renderKalendarModal()}

      <header className="border-b border-zinc-900 bg-black/40 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-black italic text-red-600 uppercase tracking-tighter cursor-pointer" onClick={() => {setZobrazitDetail(false); setAktivnaZalozka('dielna')}}>AutoAlma <span className="text-white">Servis</span></h1>
            <nav className="flex gap-2">
                {['dielna', 'kalendar', 'klienti', 'archiv'].map(tab => (
                    <button key={tab} onClick={() => {setZobrazitDetail(false); setAktivnaZalozka(tab)}} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase transition-all ${aktivnaZalozka === tab && !zobrazitDetail ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>{tab}</button>
                ))}
            </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* ZOBRAZENIE PODĽA ZÁLOŽKY */}
        {!zobrazitDetail && aktivnaZalozka === 'dielna' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
            <div className="lg:col-span-5">
                <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black italic uppercase text-red-600 tracking-tight">Príjem vozidla</h2>
                        <input type="file" accept="image/*" onChange={spracujTechnicak} id="scanMain" className="hidden" />
                        <label htmlFor="scanMain" className="bg-red-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase cursor-pointer hover:bg-red-700 transition-all">{isScanning ? 'Skenujem...' : '📷 Sken TP'}</label>
                    </div>
                    <form onSubmit={prijemVozidla} className="space-y-4">
                        <input value={spz} onChange={e => setSpz(e.target.value.toUpperCase())} placeholder="ŠPZ" className="w-full bg-black border border-zinc-800 p-5 rounded-3xl text-4xl font-black outline-none focus:border-red-600 uppercase" />
                        <input value={zakaznik} onChange={e => setZakaznik(e.target.value)} placeholder="Meno zákazníka" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-sm outline-none focus:border-red-600" />
                        <button className="w-full bg-red-600 py-6 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-900/30">Otvoriť zákazku</button>
                    </form>
                </section>
            </div>
            <div className="lg:col-span-7">
                <h2 className="text-2xl font-black uppercase italic mb-8 px-4">V dielni</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {zakazky.filter(z => z.status !== 'Hotové').map(z => (
                        <div key={z.id} onClick={() => otvorDetail(z)} className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-[2rem] hover:border-red-600 cursor-pointer transition-all shadow-xl group">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-3xl font-black italic tracking-tighter group-hover:text-red-500 transition-colors">{z.plate_number}</span>
                                <span className="text-[8px] font-black px-3 py-1 rounded-full uppercase bg-red-950 text-red-500">{z.status}</span>
                            </div>
                            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{z.customer_name}</div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {!zobrazitDetail && aktivnaZalozka === 'kalendar' && (
          <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl">
            <FullCalendar
                 plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                 initialView="timeGridWeek"
                 headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                 events={events}
                 selectable={true}
                 select={handleDateSelect}
                 eventClick={handleEventClick}
                 locale="sk"
                 slotMinTime="07:00:00"
                 slotMaxTime="19:00:00"
                 height="auto"
            />
          </div>
        )}

        {!zobrazitDetail && aktivnaZalozka === 'klienti' && (
            <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-black uppercase italic mb-8">Zoznam klientov</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {klienti.map((k, index) => (
                        <div key={index} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem]">
                            <h3 className="text-xl font-black uppercase tracking-tight text-red-500">{k.meno}</h3>
                            <p className="text-[10px] font-mono text-zinc-500 mt-1 mb-6">{k.telefon || 'Bez mobilu'}</p>
                            <div className="space-y-2">
                                {k.auta.map((auto, aIdx) => (
                                    <div key={aIdx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-zinc-800">
                                        <span className="text-sm font-black italic">{auto.spz}</span>
                                        <button onClick={() => { const z = zakazky.find(z => z.id === auto.ticket_id); if(z) otvorDetail(z); }} className="text-[8px] font-black uppercase bg-zinc-800 px-3 py-2 rounded-lg">História</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {!zobrazitDetail && aktivnaZalozka === 'archiv' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
             {zakazky.filter(z => z.status === 'Hotové').map(z => (
                <div key={z.id} onClick={() => otvorDetail(z)} className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] opacity-50 hover:opacity-100 cursor-pointer transition-all">
                  <div className="text-3xl font-black italic">{z.plate_number}</div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase mt-2">{z.customer_name}</div>
                </div>
             ))}
          </div>
        )}

        {zobrazitDetail && (
            <div className="animate-in slide-in-from-right duration-500">
                <button onClick={() => setZobrazitDetail(false)} className="mb-8 text-zinc-600 uppercase font-black text-[10px] tracking-widest">← Návrat</button>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-7">
                        <section className="bg-zinc-900/50 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl print:bg-white print:text-black">
                            <div className="p-10 border-b border-zinc-800 bg-zinc-800/10 flex justify-between items-start">
                                <div>
                                    <h2 className="text-7xl font-black italic tracking-tighter leading-none print:text-7xl">{vybranaZakazka?.plate_number}</h2>
                                    <p className="text-2xl font-black uppercase text-red-600 mt-2">{vybranaZakazka?.car_brand_model}</p>
                                </div>
                                <select value={vybranaZakazka?.status} onChange={e => { supabase.from('job_tickets').update({ status: e.target.value }).eq('id', vybranaZakazka.id).then(() => { setVybranaZakazka({...vybranaZakazka, status: e.target.value}); ziskajZakladneData(); }); }} className="bg-black border border-zinc-800 p-2 px-6 rounded-full text-[10px] font-black uppercase print:hidden">
                                    <option value="Otvorená">Otvorená</option>
                                    <option value="Rozrobená">Rozrobená</option>
                                    <option value="Hotové">Hotové</option>
                                </select>
                            </div>
                            <div className="p-10 min-h-[400px] space-y-4">
                                {polozkyZakazky.map(p => (
                                    <div key={p.id} className="flex justify-between items-center border-b border-zinc-800 pb-4">
                                        <span className="font-black uppercase text-sm">{p.service_name}</span>
                                        <div className="flex items-center gap-6">
                                            <span className="font-mono font-bold text-red-500">{p.price_at_time?.toFixed(2)} €</span>
                                            <button onClick={async () => { await supabase.from('ticket_items').delete().eq('id', p.id); otvorDetail(vybranaZakazka); }} className="text-zinc-800 hover:text-red-600 print:hidden transition-all">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-10 bg-black/40 border-t border-zinc-800">
                                <div className="flex justify-between items-center mb-2 text-[10px] font-mono text-zinc-500 uppercase">
                                    <span>Základ: {sumaBezDph.toFixed(2)} €</span>
                                    <span>DPH 23%: {(sumaBezDph * 0.23).toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-2xl font-black italic text-red-600 uppercase italic">Spolu:</span>
                                    <span className="text-6xl font-black italic font-mono tracking-tighter">{sumaSDph.toFixed(2)} €</span>
                                </div>
                            </div>
                            <button onClick={() => window.print()} className="w-full bg-zinc-800 py-6 font-black uppercase text-xs tracking-[0.4em] hover:bg-zinc-700 transition-all print:hidden">Tlačiť protokol</button>
                        </section>
                    </div>
                    <div className="lg:col-span-5 space-y-6 print:hidden">
                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] shadow-2xl">
                            <input value={hladatSluzbu} onChange={e => setHladatSluzbu(e.target.value)} placeholder="Hľadať v cenníku..." className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-xs outline-none focus:border-red-600 mb-6" />
                            <div className="space-y-2 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                                {sluzby.filter(s => s.name.toLowerCase().includes(hladatSluzbu.toLowerCase())).map(s => (
                                    <button key={s.id} onClick={async () => {
                                        await supabase.from('ticket_items').insert([{ ticket_id: vybranaZakazka.id, service_name: s.name, price_at_time: s.price_excl_vat }]);
                                        otvorDetail(vybranaZakazka);
                                    }} className="w-full text-left bg-black border border-zinc-800 p-4 rounded-xl hover:border-red-600 flex justify-between items-center group transition-all">
                                        <div className="text-[11px] font-black uppercase group-hover:text-red-500 transition-colors tracking-tight">{s.name}</div>
                                        <div className="text-sm font-black italic">{(s.price_excl_vat * 1.23).toFixed(2)} €</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>

      <style jsx global>{`
        .fc { background: transparent; font-family: inherit; border: none !important; }
        .fc-toolbar-title { font-weight: 900; text-transform: uppercase; font-style: italic; color: #dc2626; font-size: 1.5rem !important; }
        .fc-button { background: #18181b !important; border: 1px solid #27272a !important; text-transform: uppercase !important; font-size: 0.7rem !important; font-weight: 900 !important; border-radius: 50px !important; }
        .fc-button-active { background: #dc2626 !important; border-color: #dc2626 !important; }
        .fc-event { background: #dc2626; border: none; padding: 8px; font-weight: 900; border-radius: 12px; font-size: 0.7rem; cursor: pointer; box-shadow: 0 4px 15px rgba(220,38,38,0.3); }
        .fc-timegrid-slot { height: 4rem !important; border-bottom: 1px solid #18181b !important; }
        .fc-col-header-cell { padding: 15px 0; background: transparent; font-size: 0.7rem; text-transform: uppercase; font-weight: 900; }
        .fc-scrollgrid { border: none !important; }
      `}</style>
    </div>
  );
}