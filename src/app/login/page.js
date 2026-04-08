'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null); // Pre potvrdenie odoslania reset linku
  const [resetMode, setResetMode] = useState(false); // Prepínač pre zabudnuté heslo

  // TVOJ NOVÝ ADMIN ÚČET
  const ADMIN_EMAIL = 'maros.jurkovic@autoalma.sk';
  const ADMIN_PASSWORD = 'Autoalma137.';

  // DETEKCIA ADMINA Z GATEWAY
  useEffect(() => {
    const role = searchParams.get('role');
    if (role === 'admin') {
      setEmail(ADMIN_EMAIL);
      setPassword(ADMIN_PASSWORD);
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (authError) {
      setError("Chyba prihlásenia: " + authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      if (email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase()) {
        router.push('/zakazky'); 
      } else {
        router.push('/garaz');
      }
    }
  };

  // LOGIKA PRE RESET HESLA
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login/update-password`,
    });

    if (resetError) {
      setError("Chyba: " + resetError.message);
    } else {
      setMessage("Inštrukcie na obnovu hesla boli odoslané na Váš e-mail.");
      // Voliteľne: setResetMode(false);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-bold">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl font-bold">
        
        <header className="text-center mb-10 font-bold">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-red-600 font-bold">
            AutoAlma <span className="text-white font-bold">{resetMode ? 'Reset' : 'Login'}</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2 font-bold">
            {resetMode ? 'Zabudli ste prístupové údaje?' : 'Vstúpte do svojho účtu'}
          </p>
        </header>

        <form onSubmit={resetMode ? handleResetPassword : handleLogin} className="space-y-6 font-bold">
          <div className="space-y-1 font-bold">
            <label className="text-[9px] uppercase text-zinc-500 ml-4 font-black">E-mailová adresa</label>
            <input 
              required type="email" placeholder="meno@autoalma.sk" 
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all italic font-bold"
            />
          </div>

          {!resetMode && (
            <div className="space-y-1 font-bold">
              <label className="text-[9px] uppercase text-zinc-500 ml-4 font-black">Prístupové heslo</label>
              <input 
                required type="password" placeholder="••••••••" 
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all font-bold"
              />
            </div>
          )}
          
          {error && (
            <p className="text-[10px] text-red-500 font-black uppercase text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 font-bold">
              {error}
            </p>
          )}

          {message && (
            <p className="text-[10px] text-green-500 font-black uppercase text-center bg-green-500/10 p-3 rounded-xl border border-green-500/20 font-bold">
              {message}
            </p>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl uppercase text-xs tracking-[0.3em] transition-all shadow-xl font-bold"
          >
            {loading ? 'Inicializujem...' : (resetMode ? 'Odoslať link na reset' : 'Prihlásiť sa')}
          </button>

          <div className="flex flex-col gap-4 text-center mt-6">
            <button 
              type="button"
              onClick={() => { setResetMode(!resetMode); setError(null); setMessage(null); }}
              className="text-[10px] text-zinc-500 font-black uppercase tracking-widest hover:text-white transition-all italic underline underline-offset-4"
            >
              {resetMode ? '← Späť na prihlásenie' : 'Zabudli ste heslo?'}
            </button>

            {!resetMode && (
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest font-bold">
                Nemáte účet? <Link href="/registracia" className="text-red-600 hover:underline">Zaregistrujte sa</Link>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center font-black text-red-600 uppercase">Načítavam systém...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}