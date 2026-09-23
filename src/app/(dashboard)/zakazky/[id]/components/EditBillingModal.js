'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';

// Úprava fakturačných údajov priamo na zákazke.
// Zápis ide do job_tickets (z nich sa berú údaje pri vystavení faktúry) a voliteľne
// aj do karty klienta. Už vystavené faktúry sa nemenia — tie majú vlastnú kópiu
// údajov v company_details, takže staré doklady zostávajú pre účtovníctvo nedotknuté.
export default function EditBillingModal({ zakazka, jobId, ensureAuth, onComplete, onClose }) {
  const [form, setForm] = useState({
    customer_name: zakazka.customer_name || '',
    company_name: zakazka.company_name || '',
    customer_phone: zakazka.customer_phone || '',
    customer_email: zakazka.customer_email || '',
    address: zakazka.address || '',
    zip: zakazka.zip || '',
    city: zakazka.city || '',
    ico: zakazka.ico || '',
    dic: zakazka.dic || '',
    ic_dph: zakazka.ic_dph || '',
  });
  const [ajDoKarty, setAjDoKarty] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const orNull = v => (v || '').trim() || null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!await ensureAuth()) return;
    setSaving(true);
    try {
      const payload = {
        customer_name: (form.customer_name || '').trim(),
        company_name: orNull(form.company_name),
        customer_phone: orNull(form.customer_phone),
        customer_email: orNull(form.customer_email),
        address: orNull(form.address),
        zip: orNull(form.zip),
        city: orNull(form.city),
        ico: orNull(form.ico),
        dic: orNull(form.dic),
        ic_dph: orNull(form.ic_dph),
      };
      const { error } = await supabase.from('job_tickets').update(payload).eq('id', jobId);
      if (error) throw error;

      if (ajDoKarty) {
        const klientPayload = {
          full_name: payload.customer_name,
          company_name: payload.company_name,
          phone: payload.customer_phone,
          email: payload.customer_email,
          address: payload.address,
          city: payload.city,
          zip: payload.zip,
          ico: payload.ico,
          dic: payload.dic,
          ic_dph: payload.ic_dph,
        };
        // Klient môže žiť v user_profiles aj v customers — skúsime obe.
        if (zakazka.customer_id) {
          await supabase.from('user_profiles').update(klientPayload).eq('id', zakazka.customer_id);
          await supabase.from('customers').update(klientPayload).eq('id', zakazka.customer_id);
        } else if (payload.customer_email) {
          await supabase.from('user_profiles').update(klientPayload).eq('email', payload.customer_email);
          await supabase.from('customers').update(klientPayload).eq('email', payload.customer_email);
        }
      }

      onComplete();
      onClose();
    } catch (err) {
      alert('Chyba pri ukladaní: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full bg-black border border-zinc-800 p-3.5 rounded-xl text-white text-sm font-bold outline-none focus:border-red-600";

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Fakturačné <span className="text-blue-500">údaje</span></h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Použijú sa na novej faktúre tejto zákazky</p>
          </div>
          <button type="button" onClick={onClose} className="bg-zinc-800 hover:bg-white hover:text-black p-3 rounded-full transition-all">✕</button>
        </div>

        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          <input type="text" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Meno odberateľa" className={input} />
          <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Obchodné meno (firma)" className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="Telefón" className={input} />
            <input type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="E-mail" className={input} />
          </div>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Ulica a číslo" className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="PSČ" className={input} />
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mesto" className={input} />
          </div>
          <input type="text" value={form.ico} onChange={e => set('ico', e.target.value)} placeholder="IČO" className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.dic} onChange={e => set('dic', e.target.value)} placeholder="DIČ" className={input} />
            <input type="text" value={form.ic_dph} onChange={e => set('ic_dph', e.target.value)} placeholder="IČ DPH" className={input} />
          </div>

          <button type="button" onClick={() => setAjDoKarty(v => !v)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${ajDoKarty ? 'bg-blue-600/10 border-blue-600' : 'bg-black border-zinc-800'}`}>
            <span className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[11px] ${ajDoKarty ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-transparent'}`}>✓</span>
            <span className="text-[10px] uppercase tracking-widest font-black text-zinc-300">Uložiť aj do karty klienta</span>
          </button>

          <p className="text-[9px] text-zinc-600 leading-relaxed uppercase tracking-widest px-1">
            Už vystavené faktúry sa nezmenia — každá má vlastnú kópiu údajov z času vystavenia.
          </p>
        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Zrušiť</button>
          <button type="submit" disabled={saving} className="flex-[2] bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">
            {saving ? 'Ukladám...' : 'Uložiť údaje'}
          </button>
        </div>
      </form>
    </div>
  );
}
