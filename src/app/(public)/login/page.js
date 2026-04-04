'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Chyba prihlásenia: " + error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Po úspešnom prihlásení skontrolujeme rolu
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role === 'admin') {
        router.push('/'); // Admin ide na dashboard
      } else {
        router.push('/garaz'); // Zákazník ide do garáže
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
        
        <header className="text-center mb-10">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-red-600">AutoAlma <span className="text-white">Login</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2">Vstúpte do svojho účtu</p>
        </header>

        <form onSubmit={handleLogin} className="space-y-6">
          <input 
            required type="email" placeholder="E-mail" 
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all"
          />
          <input 
            required type="password" placeholder="Heslo" 
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all"
          />
          
          <button 
            type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl uppercase text-xs tracking-[0.3em] transition-all shadow-xl"
          >
            {loading ? 'Overujem...' : 'Prihlásiť sa'}
          </button>

          <p className="text-center text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-6">
            Nemáte účet? <Link href="/registracia" className="text-red-600 hover:underline">Zaregistrujte sa</Link>
          </p>
        </form>
      </div>
    </div>
  );
}