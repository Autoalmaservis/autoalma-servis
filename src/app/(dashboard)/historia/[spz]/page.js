'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function KartaVozidla() {
  const params = useParams();
  const router = useRouter();
  const spz = decodeURIComponent(params.spz || '').toUpperCase().replace(/\s/g, '');

  const [vozidlo, setVozidlo] = useState(null);
  const [zakazky, setZakazky] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otvorene, setOtvorene] = useState({});

  const backUrl = `/historia/${encodeURIComponent(spz)}`;

  useEffect(() => {
    if (!spz) return;
    let alive = true;

    const nacitaj = async () => {
      setLoading(true);

      const [{ data: autoRows }, { data: ticketRows }] = await Promise.all([
        supabase.from('vehicles').select('*').eq('license_plate', spz).limit(1),
        supabase.from('job_tickets').select('*, job_items(*)').eq('plate_number', spz).order('created_at', { ascending: false }),
      ]);
      if (!alive) return;

      const auto = autoRows?.[0] || null;
      const tickets = ticketRows || [];

      // Ak vozidlo nie je v tabuľke vehicles, poskladáme kartu z poslednej zákazky
      if (auto) {
        setVozidlo(auto);
      } else if (tickets.length > 0) {
        const t = tickets[0];
        setVozidlo({
          license_plate: spz,
          brand_model: t.car_brand_model || '',
          vin_number: t.vin_number || '',
          fuel_type: t.fuel_type || '',
          mileage: t.mileage || 0,
          owner_name: t.customer_name || '',
          owner_email: t.customer_email || '',
          _jenZoZakazky: true,
        });
      } else {
        setVozidlo(null);
      }

      setZakazky(tickets.map(t => {
        const subtotal = t.job_items?.reduce((acc, i) => acc + ((parseFloat(i.unit_price) || 0) * (parseFloat(i.quantity) || 0)), 0) || 0;
        return { ...t, total_price: subtotal * 1.23, _bezDph: subtotal };
      }));

      setLoading(false);
    };

    nacitaj();
    return () => { alive = false; };
  }, [spz]);

  const toggle = (id) => setOtvorene(prev => ({ ...prev, [id]: !prev[id] }));

  const celkom = zakazky.reduce((a, z) => a + (z.total_price || 0), 0);
  const poslednaNavsteva = zakazky[0]?.created_at;

  const statusFarba = (s) =>
    s === 'Dokončené' ? 'text-green-500' :
    s === 'Prebieha' ? 'text-amber-500' :
    s === 'Čaká na schválenie' ? 'text-purple-400' : 'text-zinc-400';

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-black text-red-600 uppercase tracking-widest animate-pulse">
      Načítavam kartu vozidla...
    </div>
  );

  return (
    <div className="p-6 md:p-10 min-h-screen bg-black text-white font-bold">

      {/* HEADER */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5 flex-wrap">
          <button
            onClick={() => router.back()}
            className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
          >← Späť</button>
          <span className="bg-white text-black px-6 py-2.5 rounded-2xl font-black text-3xl tracking-widest shadow-2xl uppercase">{spz}</span>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{vozidlo?.brand_model || 'Neznáme vozidlo'}</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1.5 italic">Karta vozidla · História</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/prijem?spz=${encodeURIComponent(spz)}${vozidlo?.owner_name ? `&meno=${encodeURIComponent(vozidlo.owner_name)}` : ''}`}
            className="bg-red-600 hover:bg-red-500 text-white font-black px-7 py-3.5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl italic"
          >📋 Nová zákazka</Link>
          {vozidlo?.owner_name && (
            <Link
              href={`/klienti?q=${encodeURIComponent(vozidlo.owner_name)}`}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all"
            >👤 Karta partnera</Link>
          )}
        </div>
      </header>

      {!vozidlo && zakazky.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[4rem] text-zinc-800 uppercase font-black tracking-[0.4em] text-sm text-center px-10 italic">
          Pre ŠPZ {spz} nie sú žiadne záznamy
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ĽAVÝ STĹPEC — TECHNICKÉ ÚDAJE */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/30 border border-zinc-800 p-7 rounded-[2.5rem] shadow-xl">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-5 flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span> Technické údaje
              </h2>
              <div className="space-y-0 text-[11px] font-black uppercase tracking-widest text-zinc-400 italic">
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Majiteľ:</span> <span className="text-white text-right normal-case not-italic">{vozidlo?.owner_name || '---'}</span></p>
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>VIN:</span> <span className="text-white font-mono text-right break-all">{vozidlo?.vin_number || '---'}</span></p>
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Motor:</span> <span className="text-white">{vozidlo?.engine_volume || '?'} ccm / {vozidlo?.engine_power || '?'} kW</span></p>
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Palivo:</span> <span className="text-white">{vozidlo?.fuel_type || '---'}</span></p>
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Rok:</span> <span className="text-white">{vozidlo?.year_produced || '---'}</span></p>
                <p className="flex justify-between gap-3 py-2.5"><span>Nájazd:</span> <span className="text-white">{vozidlo?.mileage ? `${vozidlo.mileage} km` : '---'}</span></p>
              </div>
              {vozidlo?._jenZoZakazky && (
                <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest mt-5 leading-relaxed">
                  ⚠ Vozidlo nie je v databáze vozidiel — údaje sú prevzaté z poslednej zákazky.
                </p>
              )}
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 p-7 rounded-[2.5rem] shadow-xl">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-5 italic">Súhrn</h2>
              <div className="space-y-0 text-[11px] font-black uppercase tracking-widest text-zinc-400 italic">
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Návštev:</span> <span className="text-white text-lg">{zakazky.length}</span></p>
                <p className="flex justify-between gap-3 border-b border-zinc-800 py-2.5"><span>Celkom:</span> <span className="text-white text-lg">{celkom.toFixed(2)} €</span></p>
                <p className="flex justify-between gap-3 py-2.5"><span>Naposledy:</span> <span className="text-white">{poslednaNavsteva ? new Date(poslednaNavsteva).toLocaleDateString('sk-SK') : '---'}</span></p>
              </div>
            </div>
          </div>

          {/* PRAVÝ STĹPEC — HISTÓRIA */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-black uppercase tracking-tighter italic text-zinc-400 mb-5">
              História zákaziek <span className="text-red-600">({zakazky.length})</span>
            </h2>

            {zakazky.length === 0 ? (
              <p className="text-[10px] uppercase text-zinc-600 font-black tracking-widest py-10 text-center border-2 border-dashed border-zinc-900 rounded-[3rem]">
                Žiadna história návštev
              </p>
            ) : (
              <div className="space-y-4">
                {zakazky.map((z) => {
                  const je = !!otvorene[z.id];
                  return (
                    <div key={z.id} className="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] overflow-hidden hover:border-zinc-700 transition-all">
                      <button onClick={() => toggle(z.id)} className="w-full text-left p-6 flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {new Date(z.created_at).toLocaleDateString('sk-SK')}
                            {z.mileage ? ` · ${z.mileage} km` : ''}
                          </p>
                          <p className={`text-sm font-black uppercase italic mt-1 ${statusFarba(z.status)}`}>{z.status || 'Prebieha'}</p>
                          {z.complaints && (
                            <p className="text-[11px] text-zinc-400 mt-2 font-normal normal-case not-italic leading-relaxed line-clamp-2">{z.complaints}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-white whitespace-nowrap">{z.total_price?.toFixed(2)} €</p>
                          <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mt-1">
                            {je ? '▲ Skryť' : `▼ Položky (${z.job_items?.length || 0})`}
                          </p>
                        </div>
                      </button>

                      {je && (
                        <div className="px-6 pb-6 -mt-1">
                          {z.job_items?.length > 0 ? (
                            <div className="border-t border-zinc-800 pt-4 space-y-2">
                              {z.job_items.map((item, i) => (
                                <div key={i} className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase gap-4">
                                  <span className={`shrink-0 w-16 ${item.type === 'Práca' ? 'text-blue-400' : item.type === 'Úkon' ? 'text-purple-400' : 'text-orange-400'}`}>{item.type}</span>
                                  <span className="flex-1 text-zinc-300 normal-case not-italic font-black break-words">{item.name}</span>
                                  <span className="shrink-0 text-white font-mono">{item.quantity} {item.unit} × {parseFloat(item.unit_price).toFixed(2)}€</span>
                                </div>
                              ))}
                              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right pt-3 border-t border-zinc-800 mt-3">
                                Bez DPH: <span className="text-white">{z._bezDph.toFixed(2)} €</span>
                              </p>
                            </div>
                          ) : (
                            <p className="border-t border-zinc-800 pt-4 text-[10px] uppercase text-zinc-600 font-black tracking-widest">Zákazka nemá položky</p>
                          )}

                          <Link
                            href={`/zakazky/${z.id}?back=${encodeURIComponent(backUrl)}`}
                            className="inline-block mt-5 bg-red-600 hover:bg-red-500 text-white font-black px-6 py-3 rounded-2xl text-[9px] uppercase tracking-[0.2em] transition-all shadow-lg"
                          >→ Otvoriť zákazku</Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
