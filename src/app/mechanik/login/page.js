'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MechanikLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    // 1. Prihlásenie cez Supabase Auth
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError("Nesprávne údaje");
      return;
    }

    // 2. Kontrola, či je to naozaj mechanik
    const { data: employee, error: roleError } = await supabase
      .from('employees')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (employee?.role === 'mechanik') {
      router.push('/mechanik'); // Úspech -> na nástenku mechanika
    } else {
      await supabase.auth.signOut();
      setError("Tento účet nemá prístup do sekcie mechanik.");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black uppercase italic italic tracking-tighter">AutoAlma <span className="text-red-600">Dielňa</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2">Vstup pre zamestnancov</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="E-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-red-600 transition-all font-bold"
            required
          />
          <input 
            type="password" 
            placeholder="Heslo" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-red-600 transition-all font-bold"
            required
          />
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest transition-all shadow-xl">
            Prihlásiť sa do práce
          </button>
        </form>
      </div>
    </div>
  );
}