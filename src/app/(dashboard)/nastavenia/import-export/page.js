'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ImportExportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  // --- POMOCNÁ FUNKCIA NA EXPORT ---
  const exportTable = async (tableName, fileName) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableName);
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
      
      setStatus({ type: 'success', msg: `Export ${tableName} prebehol úspešne.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- POMOCNÁ FUNKCIA NA IMPORT (Všeobecná) ---
  const handleImport = async (e, tableName, onConflictField) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        const { error } = await supabase.from(tableName).upsert(data, { onConflict: onConflictField });
        if (error) throw error;

        setStatus({ type: 'success', msg: `Úspešne naimportovaných ${data.length} záznamov do ${tableName}.` });
      } catch (err) {
        setStatus({ type: 'error', msg: `Chyba pri importe: ${err.message}` });
      } finally {
        setLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 md:p-12 min-h-screen bg-black text-white font-bold">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Dátové <span className="text-red-600">Centrum</span></h1>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-2 italic">Hromadný Import / Export systému AutoAlma</p>
          </div>
          <button onClick={() => router.back()} className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl text-zinc-400 hover:text-white transition-all text-[10px] uppercase font-black">← Späť</button>
        </header>

        {status.msg && (
          <div className={`mb-8 p-5 rounded-2xl border font-black uppercase text-[10px] tracking-widest animate-pulse ${status.type === 'success' ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-red-600/10 border-red-600 text-red-500'}`}>
            {status.type === 'success' ? '✅' : '❌'} {status.msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* SEKCIJA: KLIENTI */}
          <DataCard 
            title="Partneri / Klienti" 
            desc="Správa klientskych profilov a adries."
            onExport={() => exportTable('user_profiles', 'Export_Partneri')}
            onImport={(e) => handleImport(e, 'user_profiles', 'email')}
            loading={loading}
          />

          {/* SEKCIJA: VOZIDLÁ */}
          <DataCard 
            title="Vozidlá" 
            desc="Technické údaje a priradenia k majiteľom."
            onExport={() => exportTable('vehicles', 'Export_Vozidla')}
            onImport={(e) => handleImport(e, 'vehicles', 'license_plate')}
            loading={loading}
          />

          {/* SEKCIJA: FAKTÚRY */}
          <DataCard 
            title="Faktúry" 
            desc="Archív vystavených dokladov (Iba Export)."
            onExport={() => exportTable('invoices', 'Export_Faktury')}
            onImport={null} // Faktúry z bezpečnostných dôvodov neimportujeme
            loading={loading}
          />

        </div>

        <div className="mt-12 bg-zinc-900/30 border border-zinc-800 p-8 rounded-[3rem] italic">
          <h3 className="text-red-600 font-black uppercase text-[10px] tracking-widest mb-4">⚠️ Dôležité inštrukcie</h3>
          <ul className="text-[11px] text-zinc-500 space-y-2 uppercase font-black leading-relaxed">
            <li>• Pri importe musí byť v Exceli prvý riadok s presnými názvami stĺpcov ako v DB.</li>
            <li>• Import klientov prebieha podľa emailu (ak email existuje, údaje sa aktualizujú).</li>
            <li>• Import vozidiel prebieha podľa ŠPZ.</li>
            <li>• Pred hromadným importom odporúčame spraviť Export (zálohu) aktuálneho stavu.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// POMOCNÝ KOMPONENT PRE KARTU
function DataCard({ title, desc, onExport, onImport, loading }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-white">{title}</h3>
        <p className="text-[10px] text-zinc-600 uppercase font-black leading-tight mb-8 tracking-widest">{desc}</p>
      </div>
      <div className="space-y-3">
        <button 
          onClick={onExport}
          disabled={loading}
          className="w-full bg-zinc-800 hover:bg-white hover:text-black py-4 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest"
        >
          Exportovať (.xlsx)
        </button>
        {onImport && (
          <label className="block">
            <input type="file" className="hidden" accept=".xlsx" onChange={onImport} disabled={loading} />
            <div className="w-full bg-red-600 hover:bg-red-500 text-center py-4 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest cursor-pointer shadow-lg shadow-red-900/20">
              Importovať (.xlsx)
            </div>
          </label>
        )}
      </div>
    </div>
  );
}