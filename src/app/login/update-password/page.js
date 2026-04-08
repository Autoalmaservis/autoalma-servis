'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const router = useRouter();

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError("Chyba pri aktualizácii: " + error.message);
    } else {
      setMessage("Heslo bolo úspešne zmenené. Teraz sa môžete prihlásiť.");
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-bold">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
        
        <header className="text-center mb-10">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-red-600">
            AutoAlma <span className="text-white">Nové Heslo</span>
          </h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-2">
            Zadajte svoje nové prístupové heslo
          </p>
        </header>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] uppercase text-zinc-500 ml-4 font-black">Nové heslo</label>
            <input 
              required 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-red-600 transition-all font-bold"
            />
          </div>

          {error && <p className="text-[10px] text-red-500 text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 uppercase">{error}</p>}
          {message && <p className="text-[10px] text-green-500 text-center bg-green-500/10 p-3 rounded-xl border border-green-500/20 uppercase">{message}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl uppercase text-xs tracking-[0.3em] transition-all shadow-xl"
          >
            {loading ? 'Aktualizujem...' : 'Uložiť nové heslo'}
          </button>
        </form>
      </div>
    </div>
  );
}