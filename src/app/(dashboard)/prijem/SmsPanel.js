'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function SmsPanel({ phone, plate, customerName, userId }) {
  const [loading, setLoading] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // 1. FIXNÝ ÚVOD
  const baseMessage = `Vazeny zakaznik p. ${customerName || 'klient'}, Vase vozidlo ${plate || '---'}: `;
  
  // 2. FIXNÝ KONIEC
  const footerMessage = `\nS pozdravom Autoalma - spolahlivy servis pre Vase vozidlo.`;

  const handleSend = async () => {
    if (!phone) return alert("Chýba telefónne číslo!");
    
    // POSKLADANIE FINÁLNEJ SPRÁVY (Úvod + tvoj stred + Koniec)
    const finalMessage = baseMessage + customText + footerMessage;

    setLoading(true);
    try {
      if (isScheduled) {
        const sendDateTime = `${scheduledDate}T${scheduledTime}:00`;
        const { error } = await supabase.from('scheduled_sms').insert([{
          user_id: userId,
          customer_phone: phone,
          customer_name: customerName,
          plate_number: plate,
          message: finalMessage,
          scheduled_for: new Date(sendDateTime).toISOString(),
          status: 'pending'
        }]);
        if (error) throw error;
        alert(`SMS naplánovaná na ${scheduledDate}`);
      } else {
        // Zápis do histórie SMS
        await supabase.from('scheduled_sms').insert([{
          user_id: userId,
          customer_phone: phone,
          customer_name: customerName,
          plate_number: plate,
          message: finalMessage,
          scheduled_for: new Date().toISOString(),
          status: 'sent'
        }]);

        // Zápis do Zvončeka (Notifikácie)
        if (userId) {
          await supabase.from('notifications').insert([{
            user_id: userId,
            title: 'Správa zo servisu',
            content: finalMessage,
            is_read: false,
            type: 'info'
          }]);
        }

        console.log("REÁLNY TEXT ODOSLANÝ NA MOBIL:", finalMessage);
        alert("Správa bola odoslaná aj s automatickým podpisom.");
      }
      setCustomText('');
    } catch (err) {
      alert("Chyba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 p-8 rounded-[3.5rem] shadow-2xl mb-10">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800/50 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">📱</span>
          <h3 className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] italic">Inteligentný SMS Terminál</h3>
        </div>
        <div className="bg-black/50 px-4 py-2 rounded-2xl border border-zinc-800 flex items-center gap-3 shadow-inner">
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{phone || 'Chýba číslo'}</span>
           <div className={`w-2 h-2 rounded-full ${phone ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. NÁHĽAD (KOMPLETNÁ SPRÁVA TAK AKO PRÍDE) */}
        <div className="space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-black ml-2 tracking-widest italic text-blue-500">Celkový náhľad správy</p>
          <div className="bg-black/60 p-5 rounded-3xl border border-zinc-800 h-[180px] overflow-y-auto shadow-inner">
            <p className="text-[11px] leading-relaxed italic">
              <span className="text-zinc-500 font-bold">{baseMessage}</span>
              <span className="text-white font-black mx-1">{customText || '... sem príde Váš text ...'}</span>
              <span className="text-zinc-500 font-bold">{footerMessage}</span>
            </p>
          </div>
        </div>

        {/* 2. EDITOR (TU PÍŠEŠ IBA STRED) */}
        <div className="space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-black ml-2 tracking-widest italic">Váš text (stred správy)</p>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Napr.: je pripravené na vyzdvihnutie po servisnej prehliadke."
            className="w-full bg-black border border-zinc-800 p-6 rounded-3xl text-white text-xs outline-none focus:border-blue-600 h-[180px] resize-none shadow-2xl uppercase font-bold transition-all placeholder:text-zinc-800"
          />
        </div>

        {/* 3. PLÁNOVANIE A TLAČIDLO */}
        <div className="flex flex-col justify-between gap-4 h-[218px]">
          <div className={`p-5 rounded-3xl border transition-all h-full flex flex-col justify-center ${isScheduled ? 'bg-blue-600/5 border-blue-600/30' : 'bg-black/20 border-zinc-800 shadow-inner'}`}>
            <label className="flex items-center gap-3 cursor-pointer group mb-3">
              <input 
                type="checkbox" 
                checked={isScheduled} 
                onChange={(e) => setIsScheduled(e.target.checked)} 
                className="w-5 h-5 accent-blue-600 rounded-lg" 
              />
              <span className="text-[10px] font-black uppercase text-zinc-400 group-hover:text-white transition-colors">Plánovať odoslanie</span>
            </label>

            {isScheduled && (
              <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-black border border-zinc-800 p-3 rounded-xl text-[10px] text-white outline-none focus:border-blue-600 font-bold" />
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-black border border-zinc-800 p-3 rounded-xl text-[10px] text-white outline-none focus:border-blue-600 font-bold" />
              </div>
            )}
            {!isScheduled && <p className="text-[9px] text-zinc-700 italic px-4 text-center">Klientovi príde SMS aj notifikácia do Garáže.</p>}
          </div>

          <button
            onClick={handleSend}
            disabled={loading || !customText || (isScheduled && !scheduledDate)}
            className={`w-full py-6 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.4em] transition-all shadow-xl flex items-center justify-center gap-3 ${
              isScheduled 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-blue-400' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
            } disabled:opacity-20`}
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isScheduled ? '📅 Naplánovať' : '🚀 Odoslať teraz')}
          </button>
        </div>

      </div>
    </div>
  );
}