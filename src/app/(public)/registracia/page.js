'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trackRegistrationSuccess } from '@/app/lib/analytics';

const GDPR_VERSION = '1.0';

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
    gdpr: false,
    gdprMarketing: false,
  });
  const [gdprExpanded, setGdprExpanded] = useState(false);

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
          referral_source: formData.referral_source,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_consent_version: GDPR_VERSION,
          gdpr_marketing: formData.gdprMarketing,
        }]);

      if (profileError) {
        console.error("Detail chyby profilu:", profileError);
        alert("Účet vytvorený, ale profil v databáze zlyhal. Prosím, kontaktujte nás.");
      } else {
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim(),
            name: formData.full_name,
            createdByAdmin: false,
          }),
        }).catch(() => {});

        trackRegistrationSuccess(clientType);
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

          {/* GDPR SEKCIA */}
          <div className="space-y-3 mt-4">

            {/* Povinný súhlas */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-red-600">Ochrana osobných údajov (GDPR)</p>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox" id="gdpr" required
                  checked={formData.gdpr}
                  onChange={(e) => setFormData({...formData, gdpr: e.target.checked})}
                  className="w-5 h-5 accent-red-600 cursor-pointer mt-0.5 shrink-0"
                />
                <label htmlFor="gdpr" className="text-xs text-zinc-300 font-bold leading-relaxed cursor-pointer">
                  Súhlasím so spracúvaním mojich osobných údajov prevádzkovateľom{' '}
                  <span className="text-white font-black">Autoalma s.r.o., Tilgnerova 712/3, 841 04 Bratislava (IČO: 46044876)</span>{' '}
                  na účely vedenia zákazníckej evidencie a informovania o priebehu opravy vozidla (SMS, e-mail).
                  Právny základ: čl. 6 ods. 1 písm. b) nariadenia GDPR (plnenie zmluvy).{' '}
                  <span className="text-white font-black">Tento súhlas je povinný</span> pre vytvorenie účtu. *
                </label>
              </div>

              {/* Voliteľný marketingový súhlas */}
              <div className="flex items-start gap-3 pt-3 border-t border-zinc-800">
                <input
                  type="checkbox" id="gdprMarketing"
                  checked={formData.gdprMarketing}
                  onChange={(e) => setFormData({...formData, gdprMarketing: e.target.checked})}
                  className="w-5 h-5 accent-red-600 cursor-pointer mt-0.5 shrink-0"
                />
                <label htmlFor="gdprMarketing" className="text-xs text-zinc-500 font-bold leading-relaxed cursor-pointer">
                  Súhlasím so zasielaním upomienok na servisné prehliadky a sezónnych akcií.
                  Právny základ: čl. 6 ods. 1 písm. a) GDPR (súhlas). <span className="text-zinc-600">Voliteľné — môžete kedykoľvek odvolať.</span>
                </label>
              </div>

              {/* Expandovateľné podrobnosti */}
              <button
                type="button"
                onClick={() => setGdprExpanded(v => !v)}
                className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-2"
              >
                {gdprExpanded ? '▲' : '▼'} {gdprExpanded ? 'Skryť podrobnosti' : 'Zobraziť podrobnosti o spracúvaní údajov'}
              </button>

              {gdprExpanded && (
                <div className="text-[10px] text-zinc-500 font-bold leading-relaxed space-y-2 border-t border-zinc-800 pt-4">
                  <p><span className="text-zinc-300 font-black">Prevádzkovateľ:</span> Autoalma s.r.o., Tilgnerova 712/3, 841 04 Bratislava, autoalma@autoalma.sk</p>
                  <p><span className="text-zinc-300 font-black">Účel a právny základ:</span> Vedenie evidencie zákazníkov a vozidiel, informovanie o oprave (čl. 6 ods. 1 písm. b) GDPR — plnenie zmluvy). Marketingové správy len so súhlasom (čl. 6 ods. 1 písm. a) GDPR).</p>
                  <p><span className="text-zinc-300 font-black">Príjemcovia:</span> Údaje nie sú poskytované tretím stranám mimo EÚ. Spracúvajú ich len oprávnení zamestnanci servisu.</p>
                  <p><span className="text-zinc-300 font-black">Doba uchovávania:</span> Po dobu trvania zmluvného vzťahu a 3 roky po jeho ukončení, alebo po dobu vyžadovanú zákonom (napr. účtovné doklady 10 rokov).</p>
                  <p><span className="text-zinc-300 font-black">Vaše práva:</span> Právo na prístup (čl. 15), opravu (čl. 16), vymazanie (čl. 17), obmedzenie spracúvania (čl. 18), prenosnosť (čl. 20) a námietku (čl. 21). Súhlas môžete kedykoľvek odvolať na <span className="text-white">autoalma@autoalma.sk</span> bez vplyvu na zákonnosť predchádzajúceho spracúvania.</p>
                  <p><span className="text-zinc-300 font-black">Dozorný orgán:</span> Úrad na ochranu osobných údajov SR, Hraničná 12, 820 07 Bratislava, <span className="text-white">dataprotection.gov.sk</span></p>
                </div>
              )}
            </div>
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