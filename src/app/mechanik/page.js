'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MechanikPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' alebo 'completed'
  const router = useRouter();

  useEffect(() => {
    checkUserAndFetchJobs();
  }, []);

  const checkUserAndFetchJobs = async () => {
    setLoading(true);
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (!authUser || authError) {
      router.push('/mechanik/login');
      return;
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (employeeError || employee?.role !== 'mechanik') {
      await supabase.auth.signOut();
      router.push('/mechanik/login');
      return;
    }

    setUser(authUser);

    const { data, error } = await supabase
      .from('job_tickets')
      .select('*')
      .eq('assigned_worker_id', authUser.id)
      .neq('status', 'Archivované')
      .order('updated_at', { ascending: false });

    if (!error) setJobs(data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/mechanik/login');
  };

  const pendingJobs = jobs.filter(j => j.status === 'Prebieha');
  const completedJobs = jobs.filter(j => j.status === 'Dokončené');

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
      
      {/* NOVÁ PRIORITNÁ HLAVIČKA */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 border-l-8 border-red-600 pl-8 py-4 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] italic">
              Prihlásený mechanik
            </p>
          </div>
          
          {/* ZVÄČŠENÝ E-MAIL (Meno mechanika) */}
          <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none text-white break-all mb-4">
            {user?.email?.split('@')[0]} <span className="text-zinc-700 text-2xl md:text-3xl not-italic">@{user?.email?.split('@')[1]}</span>
          </h1>

          {/* ZMENŠENÉ "MOJA PRÁCA" */}
          <div className="bg-red-600/10 border border-red-600/20 w-fit px-4 py-1 rounded-lg">
            <p className="text-red-600 text-[11px] font-black uppercase tracking-[0.2em] italic">
              Moja Práca / Panel rozhrania
            </p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="bg-zinc-900 border border-zinc-800 px-8 py-4 rounded-2xl text-[10px] uppercase font-black text-zinc-400 hover:bg-white hover:text-black transition-all shadow-xl active:scale-95"
        >
          Odhlásiť sa
        </button>
      </header>

      {/* PREPÍNAČ ZÁLOŽIEK */}
      <div className="flex gap-2 mb-10 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Aktuálne Práce ({pendingJobs.length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'completed' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Dokončené ({completedJobs.length})
        </button>
      </div>
      
      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6 italic ml-2">
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
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">{job.customer_name}</p>
                  <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest italic">
                    🕒 Posledná zmena: {new Date(job.updated_at || job.created_at).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}