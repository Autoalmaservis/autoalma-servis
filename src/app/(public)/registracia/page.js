'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegistraciaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState('Osoba'); // Osoba / Firma
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '', 
    full_name: '',
    phone: '',
    company_name: '',
    ico: '',
    dic: '',
    ic_dph: '', 
    address: '',
    city: '',
    zip: '',
    country: 'Slovensko', 
    referral_source: '', 
    gdpr: false
  });

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Heslá sa nezhodujú!");
      return;
    }

    if (!formData.gdpr) {
      alert("Musíte súhlasiť so spracovaním osobných údajov.");
      return;
    }

    setLoading(true);

    // 1. Registrácia do Supabase Auth
    // PRIDANÉ redirectTo: Zabezpečí, že po kliknutí v maile ho to vráti presne na login
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: formData.full_name,
        }
      }
    });

    if (authError) {
      alert("Chyba registrácie: " + authError.message);
      setLoading(false);
      return;
    }

    // DÔLEŽITÉ: Kontrolujeme, či nám Supabase vrátil užívateľa (niektoré nastavenia vracajú null, ak je mail už použitý)
    if (authData?.user) {
      // 2. Uloženie detailných údajov do public.user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: authData.user.id,
          email: formData.email.trim(), 
          full_name: formData.full_name,
          role: 'zakaznik',
          phone: formData.phone,
          company_name: clientType === 'Firma' ? formData.company_name : null,
          ico: clientType === 'Firma' ? formData.ico : null,
          dic: clientType === 'Firma' ? formData.dic : null,
          ic_dph: clientType === 'Firma' ? formData.ic_dph : null,
          address: formData.address,
          city: formData.city,
          zip: formData.zip,
          country: formData.country,
          referral_source: formData.referral_source
        }]);

      if (profileError) {
        console.error("Detail chyby profilu:", profileError);
        alert("Účet vytvorený, ale profil v databáze zlyhal. Prosím, kontaktujte nás.");
      } else {
        // Kontrola, či je vyžadované overenie mailu
        if (authData.session === null) {
            alert("Registrácia úspešná! Skontrolujte si e-mailovú schránku a potvrďte svoju adresu kliknutím na odkaz.");
        } else {
            alert("Registrácia úspešná! Vitajte v AutoAlma.");
        }
        router.push('/login');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-bold">
      <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[3rem] w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in duration-500 my-10">
        
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none font-bold">Registrácia <span className="text-red-600">Zákazníka</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-3 text-zinc-400 italic">Vytvorte si prístup do klientskej zóny AutoAlma</p>
        </header>

        <form onSubmit={handleRegister} className="space-y-6">
          
          <div className="flex bg-black p-1 rounded-2xl border border-zinc-800 mb-8">
            <button type="button" onClick={() => setClientType('Osoba')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientType === 'Osoba' ? 'bg-red-600 text-white shadow-lg font-bold' : 'text-zinc-500 hover:text-white font-bold'}`}>Súkromná Osoba</button>
            <button type="button" onClick={() => setClientType('Firma')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${clientType === 'Firma' ? 'bg-red-600 text-white shadow-lg font-bold' : 'text-zinc-500 hover:text-white font-bold'}`}>Firma / Živnostník</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-red-600 text-[10px] font-black uppercase tracking-widest ml-1 font-bold">Prihlasovacie údaje</h2>
              <input required type="email" placeholder="E-mailová adresa" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all font-bold"/>
              
              <div className="grid grid-cols-2 gap-2">
                <input required type="password" placeholder="Heslo" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all font-bold"/>
                <input required type="password" placeholder="Zopakovať" value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all font-bold"/>
              </div>

              <h2 className="text-red-600 text-[10px] font-black uppercase tracking-widest ml-1 mt-6 font-bold">Kontaktné údaje</h2>
              <input required type="text" placeholder={clientType === 'Firma' ? "Kontaktná osoba" : "Meno a priezvisko"} value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
              <input required type="tel" placeholder="Telefónne číslo" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
              
              <select value={formData.referral_source} onChange={(e) => setFormData({...formData, referral_source: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-zinc-400 outline-none focus:border-red-600 font-bold appearance-none">
                <option value="">Odkiaľ nás poznáte?</option>
                <option value="facebook">Facebook / Instagram</option>
                <option value="google">Google vyhľadávanie</option>
                <option value="recommendation">Od známeho</option>
                <option value="billboard">Reklama v meste</option>
              </select>
            </div>

            <div className="space-y-4">
              {clientType === 'Firma' ? (
                <>
                  <h2 className="text-blue-500 text-[10px] font-black uppercase tracking-widest ml-1 font-bold">Fakturačné údaje</h2>
                  <input required type="text" placeholder="Obchodné meno (Firma)" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-blue-600 font-bold"/>
                  <div className="grid grid-cols-3 gap-2">
                    <input required type="text" placeholder="IČO" value={formData.ico} onChange={(e) => setFormData({...formData, ico: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-blue-600 text-xs font-bold"/>
                    <input type="text" placeholder="DIČ" value={formData.dic} onChange={(e) => setFormData({...formData, dic: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-blue-600 text-xs font-bold"/>
                    <input type="text" placeholder="IČ DPH" value={formData.ic_dph} onChange={(e) => setFormData({...formData, ic_dph: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-blue-600 text-xs font-bold"/>
                  </div>
                </>
              ) : (
                <div className="h-[50px] md:block hidden"></div>
              )}
              
              <h2 className="text-red-600 text-[10px] font-black uppercase tracking-widest ml-1 font-bold">Adresa trvalého bydliska / Sídlo</h2>
              <input required type="text" placeholder="Ulica a súpisné číslo" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
              <div className="grid grid-cols-2 gap-2">
                <input required type="text" placeholder="Mesto" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
                <input required type="text" placeholder="PSČ" value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
              </div>
              <input required type="text" placeholder="Krajina" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-600 font-bold"/>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-black/50 p-5 rounded-2xl border border-zinc-800 mt-4">
            <input type="checkbox" id="gdpr" required checked={formData.gdpr} onChange={(e) => setFormData({...formData, gdpr: e.target.checked})} className="w-5 h-5 accent-red-600 cursor-pointer mt-1" />
            <label htmlFor="gdpr" className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-relaxed cursor-pointer font-bold">
              Súhlasím so spracovaním osobných údajov pre účely servisu vozidiel v súlade s nariadením GDPR. AutoAlma spracúva údaje len pre potreby evidencie a technickej správy.
            </label>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl uppercase text-xs tracking-[0.3em] shadow-xl shadow-red-900/20 transition-all disabled:opacity-50 font-bold">
            {loading ? 'Vytváram Váš profil...' : 'Vstúpiť do AutoAlma'}
          </button>

          <p className="text-center text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-6 font-bold">
            Už ste u nás registrovaný? <Link href="/login" className="text-red-600 hover:underline">Prihláste sa tu</Link>
          </p>
        </form>
      </div>
    </div>
  );
}