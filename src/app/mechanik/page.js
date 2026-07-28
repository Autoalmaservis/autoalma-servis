'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MechanikPage() {
  const [jobs, setJobs] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const router = useRouter();

  // Kalendár
  const [calEvents, setCalEvents] = useState([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selDay, setSelDay] = useState('');

  // Voľno / BLOK
  const [bloks, setBloks] = useState([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockNote, setBlockNote] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Zmena hesla
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState('');

  // Moje Hodiny
  const [mechHoursPeriod, setMechHoursPeriod] = useState('week');
  const [mechHoursFrom, setMechHoursFrom] = useState('');
  const [mechHoursTo, setMechHoursTo] = useState('');
  const [mechHoursJobs, setMechHoursJobs] = useState([]);
  const [mechHoursLoading, setMechHoursLoading] = useState(false);
  const [hoursSelJob, setHoursSelJob] = useState(null);
  const [hoursModalDetail, setHoursModalDetail] = useState(null);
  const [hoursModalLoading, setHoursModalLoading] = useState(false);

  useEffect(() => { init(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'hodiny' && user && mechHoursPeriod !== 'custom') {
      fetchMyHours(mechHoursPeriod, '', '');
    }
  }, [activeTab, mechHoursPeriod, user?.id]);

  const init = async () => {
    setLoading(true);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (!authUser || authError) { router.push('/mechanik/login'); return; }

    const { data: emp, error: empErr } = await supabase
      .from('employees').select('role, name, color').eq('id', authUser.id).single();

    if (empErr || emp?.role !== 'mechanik') {
      await supabase.auth.signOut();
      router.push('/mechanik/login');
      return;
    }

    setUser(authUser);
    setEmployee(emp);

    const { data } = await supabase
      .from('job_tickets').select('*').eq('assigned_worker_id', authUser.id)
      .neq('status', 'Archivované').order('updated_at', { ascending: false });
    if (data) setJobs(data);

    await fetchCalendarData(authUser.id);
    setLoading(false);
  };

  const fetchCalendarData = async (uid) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [{ data: evts }, { data: blokData }] = await Promise.all([
      supabase.from('calendar_events')
        .select('id, title, start_datetime, end_datetime, plate_number, status')
        .eq('employee_id', uid).neq('plate_number', 'BLOK')
        .gte('start_datetime', `${todayStr}T00:00:00`)
        .order('start_datetime'),
      supabase.from('calendar_events')
        .select('id, start_datetime, issue_description')
        .eq('employee_id', uid).eq('plate_number', 'BLOK')
        .gte('start_datetime', `${todayStr}T00:00:00`)
        .order('start_datetime'),
    ]);
    if (evts) setCalEvents(evts);
    if (blokData) setBloks(blokData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/mechanik/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwStatus('Heslá sa nezhodujú'); return; }
    if (pwNew.length < 6) { setPwStatus('Heslo musí mať aspoň 6 znakov'); return; }
    setPwLoading(true);
    setPwStatus('');
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) {
      setPwStatus('Chyba: ' + error.message);
    } else {
      setPwStatus('Heslo úspešne zmenené ✓');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    }
    setPwLoading(false);
  };

  const createBlok = async (e) => {
    e.preventDefault();
    if (!blockStart) return;
    setBlockLoading(true);

    const start = new Date(blockStart + 'T12:00:00');
    const end = blockEnd ? new Date(blockEnd + 'T12:00:00') : new Date(blockStart + 'T12:00:00');
    const rows = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        const ds = cursor.toISOString().split('T')[0];
        rows.push({
          title: `VOĽNO – ${blockNote || 'Dovolenka'}`,
          plate_number: 'BLOK',
          employee_id: user.id,
          start_datetime: `${ds}T00:00:00`,
          end_datetime: `${ds}T23:59:59`,
          issue_description: blockNote || 'Voľno / Dovolenka',
          status: 'Blokované',
          is_confirmed: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (rows.length > 0) await supabase.from('calendar_events').insert(rows);
    setBlockStart(''); setBlockEnd(''); setBlockNote('');
    await fetchCalendarData(user.id);
    setBlockLoading(false);
  };

  const deleteBlok = async (id) => {
    if (!confirm('Zrušiť toto voľno?')) return;
    await supabase.from('calendar_events').delete().eq('id', id);
    await fetchCalendarData(user.id);
  };

  const fetchMyHours = async (period, customFrom, customTo) => {
    if (!user) return;
    setMechHoursLoading(true);
    const today = new Date();
    let fromDate, toDate;
    if (period === 'week') {
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      fromDate = monday.toISOString().split('T')[0];
      toDate = today.toISOString().split('T')[0];
    } else if (period === 'month') {
      fromDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-01`;
      toDate = today.toISOString().split('T')[0];
    } else {
      fromDate = customFrom;
      toDate = customTo;
    }
    if (!fromDate || !toDate) { setMechHoursLoading(false); return; }
    const { data } = await supabase
      .from('job_tickets')
      .select('id, customer_name, plate_number, car_brand_model, created_at, job_number, job_items(name, quantity, unit_price, unit, type)')
      .eq('assigned_worker_id', user.id)
      .in('status', ['Dokončené', 'Archivované'])
      .gte('created_at', `${fromDate}T00:00:00`)
      .lte('created_at', `${toDate}T23:59:59`)
      .order('created_at', { ascending: false });
    if (data) {
      const computed = data.map(job => {
        const workItems = (job.job_items || []).filter(i => i.type === 'Práca');
        const totalHours = workItems.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
        const totalRevenue = workItems.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0);
        return { ...job, totalHours, totalRevenue, workItems };
      }).filter(j => j.totalHours > 0);
      setMechHoursJobs(computed);
    }
    setMechHoursLoading(false);
  };

  const openHoursModal = async (job) => {
    setHoursSelJob(job);
    setHoursModalDetail(null);
    setHoursModalLoading(true);
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_description, is_completed')
      .eq('job_id', job.id);
    setHoursModalDetail({ tasks: tasks || [] });
    setHoursModalLoading(false);
  };

  const pendingJobs = jobs.filter(j => j.status === 'Prebieha');
  const completedJobs = jobs.filter(j => j.status === 'Dokončené');

  // Mapy pre kalendár
  const eventDayMap = {};
  calEvents.forEach(ev => {
    const d = ev.start_datetime?.split('T')[0];
    if (d) eventDayMap[d] = (eventDayMap[d] || 0) + 1;
  });
  const blokDaySet = new Set(bloks.map(b => b.start_datetime?.split('T')[0]).filter(Boolean));
  const selDayEvents = calEvents.filter(ev => ev.start_datetime?.startsWith(selDay));
  const selDayBloks = bloks.filter(b => b.start_datetime?.startsWith(selDay));

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center font-black text-red-600 animate-pulse uppercase tracking-[0.2em]">
        Overujem prístup do dielne...
      </div>
    </div>
  );

  const displayedJobs = activeTab === 'pending' ? pendingJobs : completedJobs;

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-black text-white font-bold">

      {/* HLAVIČKA */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-l-8 border-red-600 pl-8 py-4 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <p className="text-zinc-300 text-[10px] font-black uppercase tracking-[0.4em] italic">Prihlásený mechanik</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none text-white mb-3">
            {employee?.name || user?.email?.split('@')[0]}
          </h1>
          <div className="bg-red-600/10 border border-red-600/20 w-fit px-4 py-1 rounded-lg">
            <p className="text-red-600 text-[11px] font-black uppercase tracking-[0.2em] italic">Moja Práca · Panel dielne</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="bg-zinc-900 border border-zinc-800 px-8 py-4 rounded-2xl text-[10px] uppercase font-black text-zinc-400 hover:bg-white hover:text-black transition-all shadow-xl active:scale-95">
          Odhlásiť sa
        </button>
      </header>

      {/* ZÁLOŽKY */}
      <div className="flex flex-wrap gap-2 mb-10 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800">
        {[
          { key: 'pending',   label: `🔧 Aktuálne (${pendingJobs.length})` },
          { key: 'completed', label: `✓ Dokončené (${completedJobs.length})` },
          { key: 'hodiny',    label: '⏱️ Moje Hodiny' },
          { key: 'kalendar',  label: '📅 Kalendár' },
          { key: 'volno',     label: '🏖️ Voľno' },
          { key: 'heslo',     label: '🔑 Heslo' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 min-w-[130px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t.key ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-300 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: AKTUÁLNE / DOKONČENÉ ===== */}
      {(activeTab === 'pending' || activeTab === 'completed') && (
        <>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 mb-6 italic ml-2">
            {activeTab === 'pending' ? 'Vozidlá v poradovníku' : 'História tvojich opráv'}
          </h2>
          <div className="grid gap-6">
            {displayedJobs.length > 0 ? displayedJobs.map(job => (
              <Link href={`/mechanik/${job.id}`} key={job.id} className="block group">
                <div className={`bg-zinc-900/40 border p-8 rounded-[2.5rem] group-hover:border-red-600 transition-all flex justify-between items-center shadow-xl ${activeTab === 'completed' ? 'border-zinc-800 opacity-80' : 'border-zinc-800'}`}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="bg-white text-black px-4 py-1 rounded-lg font-black text-2xl tracking-widest uppercase">{job.plate_number}</span>
                      {activeTab === 'completed' && <span className="text-[8px] bg-green-600/20 text-green-500 border border-green-600/30 px-2 py-1 rounded-md uppercase font-black">Odovzdané</span>}
                    </div>
                    <h3 className="text-2xl font-black uppercase italic mt-4 tracking-tighter">{job.car_brand_model}</h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-zinc-300 text-[10px] uppercase font-bold">{job.customer_name}</p>
                      <p className="text-zinc-400 text-[9px] uppercase font-black tracking-widest italic">
                        🕒 {new Date(job.updated_at || job.created_at).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className={`p-5 rounded-3xl transition-all shadow-lg ${activeTab === 'completed' ? 'bg-green-600/20 text-green-500' : 'bg-zinc-800 group-hover:bg-red-600 text-white'}`}>
                    <span className="text-2xl">{activeTab === 'completed' ? '✓' : '🔧'}</span>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="text-center py-24 border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30">
                <p className="uppercase font-black tracking-widest text-xs">
                  {activeTab === 'pending' ? 'V poradovníku nemáš žiadne autá' : 'Zatiaľ si nedokončil žiadnu prácu'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== TAB: MOJE HODINY ===== */}
      {activeTab === 'hodiny' && (
        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic ml-2">Prehľad tvojich hodín a zákaziek</p>

          {/* Výber obdobia */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'week',   label: 'Tento týždeň' },
                { key: 'month',  label: 'Tento mesiac' },
                { key: 'custom', label: 'Vlastné' },
              ].map(p => (
                <button key={p.key} onClick={() => setMechHoursPeriod(p.key)}
                  className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${mechHoursPeriod === p.key ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {mechHoursPeriod === 'custom' && (
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Od</label>
                  <input type="date" value={mechHoursFrom} onChange={e => setMechHoursFrom(e.target.value)}
                    className="bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black outline-none text-sm transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Do</label>
                  <input type="date" value={mechHoursTo} onChange={e => setMechHoursTo(e.target.value)}
                    className="bg-black border border-zinc-800 focus:border-red-600 p-3 rounded-xl text-white font-black outline-none text-sm transition-all" />
                </div>
                <button onClick={() => fetchMyHours('custom', mechHoursFrom, mechHoursTo)}
                  disabled={!mechHoursFrom || !mechHoursTo || mechHoursLoading}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                  Hľadať
                </button>
              </div>
            )}
          </div>

          {/* Súhrn */}
          {!mechHoursLoading && mechHoursJobs.length > 0 && (() => {
            const totalH = mechHoursJobs.reduce((s, j) => s + j.totalHours, 0);
            const totalR = mechHoursJobs.reduce((s, j) => s + j.totalRevenue, 0);
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4 text-center">
                  <p className="text-blue-400 text-[9px] font-black uppercase tracking-widest mb-1">Celkom hodín</p>
                  <p className="text-blue-300 text-2xl font-black">{totalH.toFixed(1)}</p>
                </div>
                <div className="bg-green-600/10 border border-green-600/30 rounded-2xl p-4 text-center">
                  <p className="text-green-400 text-[9px] font-black uppercase tracking-widest mb-1">Tržba za prácu</p>
                  <p className="text-green-300 text-2xl font-black">{totalR.toFixed(0)} €</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-1">Zákaziek</p>
                  <p className="text-white text-2xl font-black">{mechHoursJobs.length}</p>
                </div>
              </div>
            );
          })()}

          {/* Loading */}
          {mechHoursLoading && (
            <div className="text-center py-16 text-red-600 font-black uppercase tracking-widest animate-pulse text-xs">
              Načítavam zákazky...
            </div>
          )}

          {/* Zoznam zákaziek */}
          {!mechHoursLoading && (
            <div className="space-y-3">
              {mechHoursJobs.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-[2rem] opacity-30">
                  <p className="uppercase font-black tracking-widest text-xs">
                    {mechHoursPeriod === 'custom' && (!mechHoursFrom || !mechHoursTo)
                      ? 'Vyber obdobie a klikni Hľadať'
                      : 'Žiadne zákazky v tomto období'}
                  </p>
                </div>
              ) : mechHoursJobs.map(job => (
                <button key={job.id} onClick={() => openHoursModal(job)}
                  className="w-full text-left bg-zinc-900/40 border border-zinc-800 hover:border-red-600/40 p-5 rounded-[1.5rem] transition-all group hover:bg-zinc-900">
                  <div className="flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-white text-black px-3 py-0.5 rounded-lg font-black text-sm tracking-widest uppercase shrink-0">{job.plate_number}</span>
                        <p className="text-zinc-400 text-[9px] font-black uppercase">
                          {new Date(job.created_at).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                      <p className="text-white font-black uppercase italic text-sm leading-tight">{job.car_brand_model}</p>
                      <p className="text-zinc-400 text-[10px] font-bold mt-0.5">{job.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-blue-300 font-black text-lg">{job.totalHours.toFixed(1)} hod</p>
                        <p className="text-green-400 font-black text-[10px]">{job.totalRevenue.toFixed(2)} €</p>
                      </div>
                      <div className="w-8 h-8 bg-zinc-800 group-hover:bg-red-600 rounded-xl flex items-center justify-center transition-all">
                        <span className="text-white text-xs font-black">›</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: MÔJ KALENDÁR ===== */}
      {activeTab === 'kalendar' && (
        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic ml-2">Prehľad tvojich pridelených prác a voľna</p>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            {/* Navigácia mesiaca */}
            <div className="flex justify-between items-center mb-5">
              <button onClick={() => setCalMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-xl text-sm hover:bg-zinc-700 transition-all">←</button>
              <span className="text-sm font-black uppercase tracking-widest">
                {calMonth.toLocaleString('sk-SK', { month: 'long', year: 'numeric' }).toUpperCase()}
              </span>
              <button onClick={() => setCalMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-xl text-sm hover:bg-zinc-700 transition-all">→</button>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 mb-5">
              <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-zinc-300"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mám prácu</span>
              <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-zinc-300"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Voľno / Dovolenka</span>
              <span className="flex items-center gap-1.5 text-[8px] font-black uppercase text-zinc-300"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Práca + Voľno</span>
            </div>

            {/* Dni týždňa */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Po','Ut','St','Št','Pi','So','Ne'].map(d => (
                <div key={d} className="text-center text-[8px] text-zinc-400 font-black">{d}</div>
              ))}
            </div>

            {/* Mriežka dní */}
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const yr = calMonth.getFullYear();
                const mo = calMonth.getMonth();
                const daysInMonth = new Date(yr, mo + 1, 0).getDate();
                const firstDay = (new Date(yr, mo, 1).getDay() + 6) % 7;
                const todayStr = new Date().toISOString().split('T')[0];
                const cells = [];

                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);

                for (let d = 1; d <= daysInMonth; d++) {
                  const ds = `${yr}-${String(mo + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isToday   = ds === todayStr;
                  const isPast    = ds < todayStr;
                  const hasEvent  = !!eventDayMap[ds];
                  const isBlokt   = blokDaySet.has(ds);
                  const isSel     = selDay === ds;

                  let cls = 'border border-transparent text-zinc-800 cursor-default';
                  if (!isPast) cls = 'bg-zinc-900/60 border border-zinc-800 text-zinc-300 cursor-pointer hover:opacity-80';
                  if (isToday)              cls = 'bg-zinc-800 border border-zinc-600 text-white cursor-pointer';
                  if (hasEvent && !isPast)  cls = 'bg-red-600/20 border border-red-600/40 text-red-300 cursor-pointer hover:bg-red-600/30';
                  if (isBlokt && !isPast)   cls = 'bg-blue-600/20 border border-blue-600/40 text-blue-300 cursor-pointer hover:bg-blue-600/30';
                  if (hasEvent && isBlokt && !isPast) cls = 'bg-purple-600/20 border border-purple-600/40 text-purple-300 cursor-pointer hover:bg-purple-600/30';
                  if (isSel)                cls = 'bg-white border border-white text-black cursor-pointer';

                  cells.push(
                    <button key={d} type="button" disabled={isPast}
                      onClick={() => setSelDay(selDay === ds ? '' : ds)}
                      className={`rounded-xl py-2 flex flex-col items-center justify-center transition-all ${cls}`}>
                      <span className="text-[11px] font-black">{d}</span>
                      <div className="flex gap-0.5 mt-0.5">
                        {hasEvent && !isSel && <span className="w-1 h-1 rounded-full bg-red-400" />}
                        {isBlokt  && !isSel && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                      </div>
                    </button>
                  );
                }
                return cells;
              })()}
            </div>
          </div>

          {/* DETAIL VYBRANÉHO DŇA */}
          {selDay && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 mb-4">
                {new Date(selDay + 'T12:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
              </p>

              {selDayBloks.map(b => (
                <div key={b.id} className="bg-blue-600/10 border border-blue-600/30 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏖️</span>
                    <span className="text-blue-300 font-black uppercase text-xs">{b.issue_description || 'Voľno / Dovolenka'}</span>
                  </div>
                  <span className="text-[9px] text-blue-500 font-black uppercase bg-blue-600/10 border border-blue-600/20 px-2 py-1 rounded-lg">Blokovaný deň</span>
                </div>
              ))}

              {selDayEvents.map(ev => (
                <div key={ev.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-white font-black uppercase text-sm italic leading-tight">{ev.title}</p>
                      <p className="text-zinc-300 text-[9px] uppercase mt-1 font-bold">
                        🕒 {new Date(ev.start_datetime).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                        {ev.end_datetime && ` – ${new Date(ev.end_datetime).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${ev.status === 'Dokončené' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {ev.status || 'Čaká'}
                    </span>
                  </div>
                </div>
              ))}

              {selDayEvents.length === 0 && selDayBloks.length === 0 && (
                <p className="text-center text-zinc-400 text-xs italic py-6">Žiadne záznamy pre tento deň</p>
              )}
            </div>
          )}

          {/* ZOZNAM NADCHÁDZAJÚCICH PRÁC */}
          {calEvents.length > 0 && !selDay && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic ml-2">Nadchádzajúce pridelené práce</p>
              {calEvents.slice(0, 10).map(ev => (
                <div key={ev.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-red-600/20 border border-red-600/30 px-3 py-2 rounded-xl text-center shrink-0">
                      <p className="text-red-400 font-black text-[10px] uppercase">
                        {new Date(ev.start_datetime).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-zinc-300 text-[9px] font-bold">
                        {new Date(ev.start_datetime).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-white font-black uppercase text-xs italic truncate">{ev.title}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${ev.status === 'Dokončené' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                    {ev.status || 'Čaká'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: VOĽNO / DOVOLENKA ===== */}
      {activeTab === 'volno' && (
        <div className="space-y-8">

          {/* FORMULÁR */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-6 italic">Zablokovať voľno / dovolenku</p>
            <form onSubmit={createBlok} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-300 block mb-2">Dátum od</label>
                  <input required type="date" value={blockStart}
                    onChange={e => { setBlockStart(e.target.value); if (!blockEnd) setBlockEnd(e.target.value); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-black border border-zinc-800 focus:border-red-600 p-4 rounded-2xl text-white font-black outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-300 block mb-2">
                    Dátum do <span className="text-zinc-400 font-bold normal-case">(pre viac dní)</span>
                  </label>
                  <input type="date" value={blockEnd} onChange={e => setBlockEnd(e.target.value)}
                    min={blockStart || new Date().toISOString().split('T')[0]}
                    className="w-full bg-black border border-zinc-800 focus:border-red-600 p-4 rounded-2xl text-white font-black outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">
                  Dôvod <span className="text-zinc-400 font-bold normal-case">(voliteľné)</span>
                </label>
                <input type="text" value={blockNote} onChange={e => setBlockNote(e.target.value)}
                  placeholder="napr. Dovolenka, Lekár, Voľno..."
                  className="w-full bg-black border border-zinc-800 focus:border-red-600 p-4 rounded-2xl text-white font-black outline-none transition-all placeholder:text-zinc-500 placeholder:font-bold" />
              </div>

              {/* Náhľad počtu dní */}
              {blockStart && blockEnd && blockStart !== blockEnd && (() => {
                const s = new Date(blockStart + 'T12:00:00');
                const en = new Date(blockEnd + 'T12:00:00');
                let workDays = 0;
                const c = new Date(s);
                while (c <= en) { if (c.getDay() !== 0 && c.getDay() !== 6) workDays++; c.setDate(c.getDate() + 1); }
                return (
                  <div className="bg-blue-600/10 border border-blue-600/20 px-4 py-3 rounded-xl">
                    <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">
                      Bude zablokovaných <span className="text-white text-sm">{workDays}</span> pracovných dní
                    </p>
                  </div>
                );
              })()}

              <button type="submit" disabled={blockLoading || !blockStart}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-xl">
                {blockLoading ? 'Blokujem dni...' : '🏖️ Zablokovať voľno'}
              </button>
            </form>
          </div>

          {/* ZOZNAM NAPLÁNOVANÉHO VOĽNA */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic ml-2">
              Naplánované voľno <span className="text-zinc-400">({bloks.length} dní)</span>
            </p>
            {bloks.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-zinc-900 rounded-[2rem] opacity-30">
                <p className="uppercase font-black text-xs tracking-widest">Žiadne naplánované voľno</p>
              </div>
            ) : (
              bloks.map(b => (
                <div key={b.id} className="bg-zinc-950 border border-zinc-900 hover:border-blue-600/30 p-4 md:px-6 rounded-2xl flex items-center justify-between group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600/10 border border-blue-600/20 px-3 py-2 rounded-xl text-center shrink-0">
                      <p className="text-blue-400 font-black text-[10px] uppercase">
                        {new Date(b.start_datetime).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-zinc-400 text-[8px] font-bold uppercase">
                        {new Date(b.start_datetime).toLocaleDateString('sk-SK', { weekday: 'short' }).toUpperCase()}
                      </p>
                    </div>
                    <span className="text-white font-black uppercase text-xs">{b.issue_description || 'Voľno / Dovolenka'}</span>
                  </div>
                  <button onClick={() => deleteBlok(b.id)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-600 hover:border-red-600 transition-all opacity-0 group-hover:opacity-100 text-xs">
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===== HODINY MODAL ===== */}
      {hoursSelJob && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4"
          onClick={() => { setHoursSelJob(null); setHoursModalDetail(null); }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-600 mb-1">Detail zákazky</p>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{hoursSelJob.plate_number}</h2>
                <p className="text-zinc-300 text-sm font-black uppercase italic mt-1">{hoursSelJob.car_brand_model}</p>
              </div>
              <button onClick={() => { setHoursSelJob(null); setHoursModalDetail(null); }}
                className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-red-600 transition-all flex items-center justify-center text-zinc-300 hover:text-white shrink-0">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Zákazník</p>
                <p className="text-white font-black text-sm">{hoursSelJob.customer_name}</p>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Dátum</p>
                <p className="text-white font-black text-sm">
                  {new Date(hoursSelJob.created_at).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Odpracované hodiny</p>
                <p className="text-blue-300 font-black text-2xl">{hoursSelJob.totalHours.toFixed(1)} hod</p>
              </div>
              <div className="bg-green-600/10 border border-green-600/30 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-green-400 mb-1">Tržba za prácu</p>
                <p className="text-green-300 font-black text-2xl">{hoursSelJob.totalRevenue.toFixed(2)} €</p>
              </div>
            </div>

            {hoursSelJob.workItems.length > 0 && (
              <div className="mb-6">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3">Vykonané práce</p>
                <div className="space-y-2">
                  {hoursSelJob.workItems.map((item, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center gap-3">
                      <p className="text-white text-xs font-black flex-1 min-w-0">{item.name}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-blue-300 text-[10px] font-black">{parseFloat(item.quantity || 0).toFixed(1)} hod</span>
                        <span className="text-green-300 text-[10px] font-black">{(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hoursModalLoading ? (
              <div className="text-center py-6 text-zinc-500 text-[10px] font-black uppercase animate-pulse">Načítavam úkony...</div>
            ) : hoursModalDetail?.tasks?.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3">Úkony zákazky</p>
                <div className="space-y-1.5">
                  {hoursModalDetail.tasks.map((t, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border ${t.is_completed ? 'border-green-600/20 bg-green-600/5' : 'border-zinc-800 bg-zinc-950'}`}>
                      <span className={`shrink-0 font-black ${t.is_completed ? 'text-green-400' : 'text-zinc-600'}`}>{t.is_completed ? '✓' : '○'}</span>
                      <p className={`text-xs font-bold ${t.is_completed ? 'text-green-300' : 'text-zinc-300'}`}>{t.task_description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: ZMENA HESLA ===== */}
      {activeTab === 'heslo' && (
        <div className="max-w-md mx-auto">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Zmena <span className="text-red-600">hesla</span></h2>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-8">Nové heslo bude aktívne okamžite</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Nové heslo</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  placeholder="Minimálne 6 znakov"
                  required
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Potvrdiť nové heslo</label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  placeholder="Zopakujte heslo"
                  required
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all font-mono"
                />
              </div>
              {pwStatus && (
                <p className={`text-[10px] font-black uppercase tracking-widest ${pwStatus.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {pwStatus}
                </p>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest transition-all disabled:opacity-40 mt-4"
              >
                {pwLoading ? 'Meníme...' : 'Zmeniť heslo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
