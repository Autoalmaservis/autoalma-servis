'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';

const PERIODS = [
  { label: 'Tento týždeň', key: 'week' },
  { label: 'Tento mesiac', key: 'month' },
  { label: 'Minulý mesiac', key: 'last_month' },
  { label: 'Tento rok', key: 'year' },
  { label: 'Vlastné', key: 'custom' },
];

const SK_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from, to;
  switch (period) {
    case 'week': {
      from = new Date(now);
      const day = now.getDay() || 7;
      from.setDate(now.getDate() - day + 1);
      from.setHours(0, 0, 0, 0);
      to = new Date();
      break;
    }
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date();
      break;
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date();
      break;
    case 'custom':
      from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      to = customTo ? new Date(customTo + 'T23:59:59') : new Date();
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date();
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const fmt = (n) => n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtH = (h) => {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

function KpiCard({ icon, label, value, sub, color = 'red' }) {
  const borders = { red: 'border-red-600/30', green: 'border-green-500/30', blue: 'border-blue-500/30', purple: 'border-purple-500/30', amber: 'border-amber-500/30', zinc: 'border-zinc-600/30' };
  const texts   = { red: 'text-red-400', green: 'text-green-400', blue: 'text-blue-400', purple: 'text-purple-400', amber: 'text-amber-400', zinc: 'text-zinc-400' };
  return (
    <div className={`bg-zinc-950 border ${borders[color]} rounded-[1.5rem] p-6 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-[9px] font-black uppercase tracking-widest ${texts[color]}`}>{label}</span>
      </div>
      <p className="text-white font-black text-2xl tracking-tight leading-none">{value}</p>
      {sub && <p className="text-zinc-600 text-[10px] font-bold">{sub}</p>}
    </div>
  );
}

export default function StatistikyPage() {
  const [period, setPeriod]       = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]   = useState('');
  const [selMech, setSelMech]     = useState(null); // null = všetci
  const [loading, setLoading]     = useState(true);

  const [employees, setEmployees] = useState([]);
  const [stats, setStats]         = useState(null);
  const [trend, setTrend]         = useState([]);
  const [mechJobs, setMechJobs]   = useState([]); // zákazky pre vybraného mechanika

  // Načítame zamestnancov raz
  useEffect(() => {
    supabase.from('employees').select('id, name, color').eq('active', true)
      .then(({ data }) => { if (data) setEmployees(data); });
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(period, customFrom, customTo);

    const [
      { data: invoices },
      { data: jobs },
    ] = await Promise.all([
      supabase.from('invoices').select('total_amount, is_official, created_at').gte('created_at', from).lte('created_at', to),
      supabase.from('job_tickets').select('id, assigned_worker_id, mechanic_splits, customer_name, plate_number, created_at, job_items(quantity, unit_price, type)').gte('created_at', from).lte('created_at', to),
    ]);

    // Faktúry
    const officialInv  = (invoices || []).filter(i => i.is_official);
    const draftInv     = (invoices || []).filter(i => !i.is_official);
    const invoiceRevenue = officialInv.reduce((s, i) => s + (i.total_amount || 0), 0);
    const draftRevenue   = draftInv.reduce((s, i) => s + (i.total_amount || 0), 0);

    // Materiál a práca zo zákaziek
    let materialRevenue = 0, laborRevenue = 0;
    (jobs || []).forEach(job => {
      (job.job_items || []).forEach(item => {
        const val = (item.quantity || 0) * (item.unit_price || 0);
        if (item.type === 'Materiál') materialRevenue += val;
        else if (item.type === 'Práca') laborRevenue += val;
      });
    });

    // Hodiny PER MECHANIK — mechanic_splits má prednosť, inak assigned_worker_id
    const empMap = {};
    (employees).forEach(e => {
      empMap[e.id] = { id: e.id, name: e.name, color: e.color, hours: 0, jobCount: 0, jobRevenue: 0 };
    });

    (jobs || []).forEach(job => {
      const totalWorkHours = (job.job_items || []).filter(i => i.type === 'Práca').reduce((s, i) => s + (i.quantity || 0), 0);
      const totalWorkRevenue = (job.job_items || []).filter(i => i.type === 'Práca').reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

      const splits = job.mechanic_splits && job.mechanic_splits.length > 0 ? job.mechanic_splits : null;

      if (splits) {
        splits.forEach(split => {
          const eid = split.employee_id;
          if (!empMap[eid]) empMap[eid] = { id: eid, name: split.name || 'Neznámy', color: '#666', hours: 0, jobCount: 0, jobRevenue: 0 };
          const ratio = totalWorkHours > 0 ? Number(split.hours) / totalWorkHours : 0;
          empMap[eid].hours += Number(split.hours);
          empMap[eid].jobRevenue += totalWorkRevenue * ratio;
          empMap[eid].jobCount += ratio > 0 ? 1 : 0;
        });
      } else {
        if (!job.assigned_worker_id) return;
        if (!empMap[job.assigned_worker_id]) empMap[job.assigned_worker_id] = { id: job.assigned_worker_id, name: 'Neznámy', color: '#666', hours: 0, jobCount: 0, jobRevenue: 0 };
        empMap[job.assigned_worker_id].jobCount += 1;
        empMap[job.assigned_worker_id].hours += totalWorkHours;
        empMap[job.assigned_worker_id].jobRevenue += totalWorkRevenue;
      }
    });

    const mechanicStats = Object.values(empMap).filter(m => m.hours > 0 || m.jobCount > 0).sort((a, b) => b.hours - a.hours);
    const maxHours = Math.max(...mechanicStats.map(m => m.hours), 1);
    const totalHours = mechanicStats.reduce((s, m) => s + m.hours, 0);

    // Zákazky pre vybraného mechanika
    if (selMech) {
      const filtered = (jobs || []).filter(j => {
        const splits = j.mechanic_splits && j.mechanic_splits.length > 0 ? j.mechanic_splits : null;
        return splits ? splits.some(s => s.employee_id === selMech) : j.assigned_worker_id === selMech;
      });
      setMechJobs(filtered.map(j => {
        const splits = j.mechanic_splits && j.mechanic_splits.length > 0 ? j.mechanic_splits : null;
        const split = splits ? splits.find(s => s.employee_id === selMech) : null;
        const totalWH = (j.job_items || []).filter(i => i.type === 'Práca').reduce((s, i) => s + (i.quantity || 0), 0);
        const totalWR = (j.job_items || []).filter(i => i.type === 'Práca').reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
        const hours = split ? Number(split.hours) : totalWH;
        const ratio = totalWH > 0 ? hours / totalWH : 0;
        return { ...j, workHours: hours, workRevenue: totalWR * ratio };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } else {
      setMechJobs([]);
    }

    setStats({
      invoiceRevenue, draftRevenue, materialRevenue, laborRevenue,
      invoiceCount: officialInv.length,
      draftCount: draftInv.length,
      jobCount: (jobs || []).length,
      totalHours, mechanicStats, maxHours,
      avgInvoice: officialInv.length ? invoiceRevenue / officialInv.length : 0,
    });

    // Trend — posledných 6 mesiacov
    const trendFrom = new Date();
    trendFrom.setMonth(trendFrom.getMonth() - 5);
    trendFrom.setDate(1);
    trendFrom.setHours(0, 0, 0, 0);
    const { data: trendData } = await supabase
      .from('invoices').select('total_amount, created_at').eq('is_official', true).gte('created_at', trendFrom.toISOString());

    const byMonth = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = { label: SK_MONTHS[d.getMonth()], total: 0 };
    }
    (trendData || []).forEach(inv => {
      const key = inv.created_at.slice(0, 7);
      if (byMonth[key]) byMonth[key].total += (inv.total_amount || 0);
    });
    const arr = Object.values(byMonth);
    const maxT = Math.max(...arr.map(m => m.total), 1);
    setTrend(arr.map(m => ({ ...m, pct: m.total / maxT })));

    setLoading(false);
  }, [period, customFrom, customTo, selMech, employees]);

  useEffect(() => {
    if (employees.length > 0 || true) fetchStats();
  }, [fetchStats]);

  const periodLabel = (() => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    const f = new Date(from).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' });
    const t = new Date(to).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${f} – ${t}`;
  })();

  const selMechData = stats?.mechanicStats?.find(m => m.id === selMech);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">

      {/* HEADER */}
      <div className="mb-8">
        <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mb-1">Prehľad</p>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Štatistiky</h1>
        <p className="text-zinc-600 text-xs font-bold mt-1">{periodLabel}</p>
      </div>

      {/* FILTRE */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 mb-8 space-y-5">

        {/* OBDOBIE */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">Obdobie</p>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${period === p.key ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-black border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-4 mt-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Od</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="bg-black border border-zinc-800 focus:border-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm outline-none transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Do</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="bg-black border border-zinc-800 focus:border-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm outline-none transition-all" />
              </div>
            </div>
          )}
        </div>

        {/* MECHANIK */}
        {employees.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">Mechanik</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelMech(null)}
                className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${!selMech ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-black border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'}`}>
                Všetci
              </button>
              {employees.map(emp => (
                <button key={emp.id} onClick={() => setSelMech(selMech === emp.id ? null : emp.id)}
                  className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 ${selMech === emp.id ? 'text-white shadow-lg' : 'bg-black border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'}`}
                  style={selMech === emp.id ? { background: emp.color || '#dc2626', boxShadow: `0 4px 15px ${emp.color || '#dc2626'}33` } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: emp.color || '#666' }} />
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-32 text-center text-zinc-600 animate-pulse font-black uppercase text-xs tracking-widest">Načítavam štatistiky...</div>
      ) : stats && (
        <>
          {/* KPI KARTY */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <KpiCard icon="💰" color="green" label="Tržby (faktúry)" value={fmt(stats.invoiceRevenue)} sub={`${stats.invoiceCount} faktúr`} />
            <KpiCard icon="📂" color="zinc"  label="Odložené" value={fmt(stats.draftRevenue)} sub={`${stats.draftCount} odložených`} />
            <KpiCard icon="🔩" color="blue"  label="Materiál" value={fmt(stats.materialRevenue)} sub="predaný materiál" />
            <KpiCard icon="🔧" color="purple" label="Práce" value={fmt(stats.laborRevenue)} sub="fakturované práce" />
            <KpiCard icon="📋" color="amber" label="Zákazky" value={stats.jobCount.toString()} sub={stats.avgInvoice > 0 ? `∅ ${fmt(stats.avgInvoice)}` : ''} />
            <KpiCard
              icon="⏱️" color="red" label={selMech ? `Hodiny — ${selMechData?.name || ''}` : 'Hodiny spolu'}
              value={selMech ? fmtH(selMechData?.hours || 0) : fmtH(stats.totalHours)}
              sub={selMech ? `${selMechData?.jobCount || 0} zákaziek` : `${stats.mechanicStats.length} mechanikov`}
            />
          </div>

          {/* DETAIL MECHANIKA */}
          {selMech && selMechData && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7 mb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl"
                  style={{ background: selMechData.color || '#dc2626' }}>
                  {selMechData.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Detail mechanika</p>
                  <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{selMechData.name}</h2>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Celkom hodín</p>
                  <p className="text-3xl font-black text-white">{fmtH(selMechData.hours)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-black rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Zákazky</p>
                  <p className="text-2xl font-black text-white">{selMechData.jobCount}</p>
                </div>
                <div className="bg-black rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Tržby z práce</p>
                  <p className="text-xl font-black text-amber-400">{fmt(selMechData.jobRevenue)}</p>
                </div>
                <div className="bg-black rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">∅ na zákazku</p>
                  <p className="text-xl font-black text-white">{selMechData.jobCount > 0 ? fmtH(selMechData.hours / selMechData.jobCount) : '—'}</p>
                </div>
              </div>

              {/* ZOZNAM ZÁKAZIEK */}
              {mechJobs.length > 0 ? (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">Zákazky v období</p>
                  <div className="space-y-2">
                    {mechJobs.map((job, i) => (
                      <div key={job.id} className="flex items-center justify-between bg-black rounded-2xl px-5 py-4">
                        <div>
                          <p className="text-white font-black text-sm">{job.customer_name || '—'}</p>
                          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{job.plate_number} · {new Date(job.created_at).toLocaleDateString('sk-SK')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-black text-base">{fmtH(job.workHours)}</p>
                          <p className="text-zinc-600 text-[10px] font-bold">{fmt(job.workRevenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-zinc-700 text-xs font-black uppercase tracking-widest italic py-4">
                  Za toto obdobie nemá záznamy s pracovnými hodinami
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* TREND */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-6">📈 Trend tržieb — posledných 6 mesiacov</p>
              <div className="flex items-end gap-3 h-36">
                {trend.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[8px] font-black text-zinc-600 leading-none">
                      {m.total > 0 ? (m.total >= 1000 ? (m.total / 1000).toFixed(1) + 'k' : m.total.toFixed(0)) : ''}
                    </span>
                    <div className="w-full rounded-t-lg transition-all duration-700"
                      style={{ height: `${Math.max(m.pct * 100, m.total > 0 ? 4 : 1)}%`, background: m.pct > 0 ? 'linear-gradient(to top, #dc2626, #ef4444)' : '#18181b' }} />
                    <span className="text-[9px] font-black uppercase tracking-wide text-zinc-500">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROZDELENIE */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 mb-6">🥧 Rozdelenie príjmov</p>
              {(() => {
                const items = [
                  { label: 'Vystavené faktúry', value: stats.invoiceRevenue, color: '#22c55e' },
                  { label: 'Odložené faktúry',  value: stats.draftRevenue,   color: '#52525b' },
                  { label: 'Materiál',           value: stats.materialRevenue, color: '#3b82f6' },
                  { label: 'Práca',              value: stats.laborRevenue,   color: '#a855f7' },
                ];
                const max = Math.max(...items.map(i => i.value), 1);
                return (
                  <div className="space-y-4">
                    {items.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</span>
                          <span className="text-sm font-black text-white">{fmt(item.value)}</span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* POROVNANIE MECHANIKOV */}
          {stats.mechanicStats.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-6">
                👨‍🔧 Mechanici — odpracované hodiny
                <span className="text-zinc-600 font-bold normal-case ml-2">(z pracovných položiek zákaziek)</span>
              </p>
              <div className="space-y-5">
                {stats.mechanicStats.map((m) => (
                  <button key={m.id} onClick={() => setSelMech(selMech === m.id ? null : m.id)}
                    className={`w-full flex items-center gap-4 rounded-2xl p-3 transition-all text-left ${selMech === m.id ? 'bg-black ring-1 ring-white/10' : 'hover:bg-black/50'}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                      style={{ background: m.color || '#dc2626' }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-black text-white">{m.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-zinc-600">{m.jobCount} zákaziek</span>
                          <span className="text-[10px] font-black text-zinc-500">{fmt(m.jobRevenue)}</span>
                          <span className="text-base font-black text-amber-400">{fmtH(m.hours)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-900 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${(m.hours / stats.maxHours) * 100}%`, background: m.color || '#dc2626' }} />
                      </div>
                    </div>
                    <span className="text-zinc-700 text-xs">→</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-900 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Celkom odpracované</span>
                <span className="text-xl font-black text-white">{fmtH(stats.totalHours)}</span>
              </div>
            </div>
          )}

          {stats.mechanicStats.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-10 text-center text-zinc-700 text-xs font-black uppercase tracking-widest italic">
              Za toto obdobie nie sú žiadne zákazky s pracovnými položkami priradené mechanikovi
            </div>
          )}
        </>
      )}
    </div>
  );
}
