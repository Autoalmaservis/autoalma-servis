'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function PrijemPage() {
  const [spz, setSpz] = useState('');
  const [model, setModel] = useState('');
  const [meno, setMeno] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const ulozZakazku = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase
      .from('job_tickets')
      .insert([
        { 
          plate_number: spz, 
          car_model: model, 
          customer_name: meno,
          status: 'Otvorená'
        }
      ]);

    if (error) {
      setMessage('Chyba: ' + error.message);
    } else {
      setMessage('Zákazka úspešne vytvorená!');
      setSpz(''); setModel(''); setMeno('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <Link href="/" className="text-red-500 hover:underline mb-8 inline-block">← Späť na katalóg</Link>
      
      <h1 className="text-3xl font-bold mb-8 uppercase tracking-tighter text-red-600">
        Príjem vozidla do servisu
      </h1>

      <form onSubmit={ulozZakazku} className="max-w-md bg-zinc-900 p-6 rounded-lg border border-zinc-800">
        <div className="mb-4">
          <label className="block text-zinc-400 text-sm mb-1">ŠPZ vozidla</label>
          <input 
            type="text" required value={spz} onChange={(e) => setSpz(e.target.value.toUpperCase())}
            className="w-full bg-black border border-zinc-700 p-2 rounded focus:border-red-600 outline-none"
            placeholder="BA123XY"
          />
        </div>

        <div className="mb-4">
          <label className="block text-zinc-400 text-sm mb-1">Model auta</label>
          <input 
            type="text" required value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full bg-black border border-zinc-700 p-2 rounded focus:border-red-600 outline-none"
            placeholder="Škoda Octavia"
          />
        </div>

        <div className="mb-6">
          <label className="block text-zinc-400 text-sm mb-1">Meno zákazníka</label>
          <input 
            type="text" required value={meno} onChange={(e) => setMeno(e.target.value)}
            className="w-full bg-black border border-zinc-700 p-2 rounded focus:border-red-600 outline-none"
            placeholder="Ján Novák"
          />
        </div>

        <button 
          type="submit" disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors disabled:bg-zinc-700"
        >
          {loading ? 'Ukladám...' : 'VYTVORIŤ ZÁKAZKU'}
        </button>

        {message && <p className="mt-4 text-center text-sm text-zinc-400">{message}</p>}
      </form>
    </div>
  );
}