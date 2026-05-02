'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function NotificationsModal({ userId, isOpen, onClose, onRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
    setLoading(false);
  };

  const handleNotificationClick = async (n) => {
    // Označíme ako prečítanú v DB
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    
    if (n.link) {
      router.push(n.link);
      onClose();
    } else {
      fetchNotifications();
    }
    onRead(); // Aktualizuje počítadlo v hlavnom okne
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-black/20">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Centrum <span className="text-red-600">Upozornení</span></h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Správy a ponuky z vášho servisu</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all font-bold">✕</button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/10">
          {loading ? (
            <div className="py-20 text-center animate-pulse text-zinc-600 uppercase text-[10px] font-black tracking-widest">Načítavam správy...</div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center text-zinc-700 uppercase text-[10px] font-black tracking-widest italic">Vaša schránka je prázdna</div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => handleNotificationClick(n)}
                className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${n.is_read ? 'bg-zinc-900/20 border-zinc-900 opacity-50' : 'bg-zinc-900 border-zinc-700 shadow-xl hover:border-red-600/50'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`text-sm font-black uppercase italic ${n.type === 'success' ? 'text-green-400' : n.type === 'info' ? 'text-blue-400' : n.title.includes('ponuka') ? 'text-blue-400' : 'text-red-400'}`}>
                    {n.title} {!n.is_read && "•"}
                  </h4>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">{new Date(n.created_at).toLocaleDateString('sk-SK')}</span>
                </div>
                <p className="text-sm text-white leading-relaxed font-semibold tracking-wide">{n.content}</p>
                {n.link && !n.is_read && (
                  <div className="mt-4 flex items-center gap-2 text-blue-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Zobraziť detail ponuky ➔
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 text-center">
            <button onClick={onClose} className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all tracking-widest italic">Zavrieť schránku</button>
        </div>
      </div>
    </div>
  );
}