'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const nd = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ChangeCustomerModal({ zakazka, jobId, ensureAuth, onComplete, onClose }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [changingCustomer, setChangingCustomer] = useState(false);

  const fetchCustomersList = async () => {
    setLoadingCustomers(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, company_name, email, phone, ico, dic, ic_dph, address, city, zip')
      .or('role.eq.zakaznik,role.eq.klient')
      .order('full_name', { ascending: true });
    const mapped = (data || []).map(p => ({
      ...p,
      name: p.company_name || p.full_name || p.email || 'Neznámy',
    }));
    setCustomersList(mapped);
    setLoadingCustomers(false);
  };

  const handleChangeCustomer = async (cust) => {
    if (!await ensureAuth()) return;
    setChangingCustomer(true);
    const { error } = await supabase.from('job_tickets').update({
      customer_name: cust.name,
      customer_phone: cust.phone || null,
      customer_email: cust.email || null,
      customer_id: cust.id,
      company_name: cust.company_name || null,
      ico: cust.ico || null,
      dic: cust.dic || null,
      ic_dph: cust.ic_dph || null,
      address: cust.address || null,
      city: cust.city || null,
      zip: cust.zip || null,
    }).eq('id', jobId);
    setChangingCustomer(false);
    if (!error) {
      onComplete();
      onClose();
    } else {
      alert('Chyba: ' + error.message);
    }
  };

  useEffect(() => { fetchCustomersList(); }, []);

  const q = nd(customerSearch);
  const filtered = q
    ? customersList.filter(c =>
        nd(c.name).includes(q) ||
        nd(c.company_name).includes(q) ||
        nd(c.city).includes(q) ||
        (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.ico || '').includes(q)
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Zmeniť <span className="text-blue-500">odberateľa</span></h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Aktuálny: {zakazka.customer_name}</p>
          </div>
          <button onClick={onClose} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
        </div>

        <input
          type="text"
          placeholder="Hľadaj podľa mena, firmy alebo telefónu..."
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          className="w-full bg-black border border-zinc-700 focus:border-blue-500 p-4 rounded-2xl text-white text-sm outline-none font-bold mb-4 shrink-0"
          autoFocus
        />

        <div className="overflow-y-auto space-y-2 flex-1 pr-1">
          {loadingCustomers ? (
            <p className="text-center text-zinc-600 text-[10px] uppercase tracking-widest py-8 animate-pulse">Načítavam klientov...</p>
          ) : !q ? (
            <p className="text-center text-zinc-600 text-[10px] uppercase tracking-widest py-8">Začni písať pre vyhľadávanie...</p>
          ) : !filtered.length ? (
            <p className="text-center text-zinc-600 text-[10px] uppercase tracking-widest py-8">Žiadny zákazník nenájdený</p>
          ) : filtered.map(cust => (
            <button
              key={cust.id}
              onClick={() => handleChangeCustomer(cust)}
              disabled={changingCustomer}
              className="w-full flex items-start justify-between bg-zinc-800 hover:bg-blue-600 border border-zinc-700 hover:border-blue-500 p-4 rounded-2xl transition-all text-left group disabled:opacity-40"
            >
              <div className="min-w-0">
                <p className="font-black uppercase text-sm group-hover:text-white truncate">{cust.name}</p>
                {cust.company_name && <p className="text-[10px] text-zinc-400 group-hover:text-blue-200 uppercase tracking-widest">{cust.company_name}</p>}
                <p className="text-[9px] text-zinc-600 group-hover:text-blue-300 mt-0.5">
                  {cust.phone}{cust.email ? ` · ${cust.email}` : ''}{cust.city ? ` · ${cust.city}` : ''}
                </p>
                {cust.ico && <p className="text-[9px] text-zinc-700 group-hover:text-blue-400 mt-0.5">IČO: {cust.ico}</p>}
              </div>
              <span className="text-zinc-600 group-hover:text-white ml-3 shrink-0 text-lg">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
