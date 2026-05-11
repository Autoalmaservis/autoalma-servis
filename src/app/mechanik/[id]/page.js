'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function PracovnyList() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [items, setItems] = useState([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  // --- STAVY PRE FOTODOKUMENTÁCIU ---
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  // --- STAVY PRE NAHLÁSENIE ZISTENIA ---
  const [showFinding, setShowFinding] = useState(false);
  const [findingText, setFindingText] = useState('');
  const [sendingFinding, setSendingFinding] = useState(false);

  // Zisťujeme, či je zákazka už uzavretá (Audit podľa statusu v DB)
  const isLocked = job?.status === 'Dokončené' || job?.status === 'Archivované' || job?.status === 'Čaká na schválenie';

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    // Načítame info o zákazke
    const { data: j } = await supabase.from('job_tickets').select('*').eq('id', id).single();
    // Načítame úlohy (stĺpec task_description podľa schémy)
    const { data: t } = await supabase.from('job_tasks').select('*').eq('job_id', id).order('created_at', { ascending: true });
    // Načítame materiál
    const { data: i } = await supabase.from('job_items').select('*').eq('job_id', id);
    
    // NAČÍTAME AJ FOTKY
    fetchPhotos();

    setJob(j); 
    setTasks(t || []); 
    setItems(i || []);
    setLoading(false);
  };

  // --- DOPLNENÉ FUNKCIE PRE SPRÁVU FOTIEK ---
  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase.from('job_photos').select('*').eq('job_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPhotos(data);
    } catch (err) { console.error("Chyba fotiek:", err.message); }
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || isLocked) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('job_photos').insert([{
        job_id: id,
        url: publicUrl,
        storage_path: filePath
      }]);

      if (dbError) throw dbError;
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri nahrávaní fotky: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (isLocked || !confirm("Naozaj vymazať túto fotku?")) return;
    try {
      await supabase.storage.from('service-images').remove([photo.storage_path]);
      await supabase.from('job_photos').delete().eq('id', photo.id);
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri mazaní: " + err.message);
    }
  };

  const handleToggle = async (taskId, status) => {
    // Ak je zákazka dokončená, blokujeme zmeny
    if (isLocked) return;

    // V DB je is_completed typ text alebo boolean (podľa schémy v CSV je to 'text', ošetríme oba prípady)
    const newStatus = !status;
    const { error } = await supabase
      .from('job_tasks')
      .update({ is_completed: newStatus })
      .eq('id', taskId);
    
    if (!error) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (isLocked || !newMaterial.trim()) return;
    
    // Zápis do job_items podľa schémy
    const { error } = await supabase.from('job_items').insert([{ 
      job_id: id, 
      name: newMaterial.toUpperCase(), 
      quantity: qty, 
      unit: 'ks', 
      type: 'Materiál', 
      unit_price: 0 // Technik neskôr nacení
    }]);
    
    if (!error) {
      setNewMaterial(''); 
      setQty(1); 
      // Refresh len zoznamu položiek
      const { data: i } = await supabase.from('job_items').select('*').eq('job_id', id);
      setItems(i || []);
    }
  };

  const handleSendFinding = async () => {
    if (!findingText.trim()) return;
    setSendingFinding(true);
    try {
      await supabase.from('job_tasks').insert([{
        job_id: id,
        task_description: `⚠️ ZISTENIE: ${findingText.trim()}`,
        is_completed: false,
      }]);

      const plate = job?.plate_number || '';
      const customer = job?.customer_name || '';
      const smsMsg = `AutoAlma Servis: Mechanik nahlásil nové zistenie na zákazke ${plate} (${customer}): "${findingText.trim()}" — zákazka pokračuje.`;

      const { data: phoneSetting } = await supabase.from('business_settings').select('value').eq('id', 'company_phone').maybeSingle();
      const receptionPhone = phoneSetting?.value || '0940449449';

      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: receptionPhone, message: smsMsg }),
      });

      setFindingText('');
      setShowFinding(false);
      loadData();
      alert('Zistenie bolo nahlásené a SMS odoslaná na recepciu.');
    } catch (err) {
      alert('Chyba: ' + err.message);
    } finally {
      setSendingFinding(false);
    }
  };

  const finishJob = async () => {
    if (confirm("Naozaj chceš túto zákazku uzavrieť? Po odovzdaní už nebudeš môcť meniť zoznam prác ani pridávať materiál.")) {
      const { error } = await supabase
        .from('job_tickets')
        .update({ 
          status: 'Čaká na schválenie', 
          updated_at: new Date() 
        })
        .eq('id', id);
      
      if (!error) {
        router.push('/mechanik');
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-bold">
      <div className="text-red-600 font-black animate-pulse uppercase tracking-widest italic">Načítavam pracovný list...</div>
    </div>
  );

  if (!job) return <div className="p-10 text-center text-white font-bold uppercase">Zákazka nenájdená</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10 pb-20 font-sans text-white bg-black min-h-screen font-bold">
      
      <button 
        onClick={() => router.push('/mechanik')} 
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all uppercase font-black text-[10px] tracking-widest group"
      >
        <span className="bg-zinc-900 p-2 rounded-lg group-hover:bg-red-600 transition-all">←</span> 
        Moje opravy
      </button>

      {/* KARTA VOZIDLA */}
      <div className={`p-8 rounded-[3rem] border shadow-2xl transition-all ${isLocked ? 'bg-zinc-900/20 border-zinc-800' : 'bg-zinc-900/50 border-zinc-800'}`}>
        <div className="flex justify-between items-start">
          <div>
            <span className="bg-white text-black px-4 py-1 rounded-lg font-black text-xl tracking-widest shadow-xl uppercase">{job.plate_number}</span>
            <h1 className="text-4xl font-black uppercase italic mt-4 tracking-tighter leading-none">{job.car_brand_model}</h1>
            <div className="flex items-center gap-3 mt-2">
                <p className="text-red-600 font-bold uppercase text-[10px] tracking-[0.2em] italic">Zákazník: {job.customer_name}</p>
                {isLocked && <span className="bg-green-600/20 text-green-500 text-[8px] px-2 py-0.5 rounded border border-green-600/30 font-black uppercase tracking-widest">🔒 Uzavreté</span>}
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Aktuálne KM</p>
             <p className="text-xl font-black italic">{job.mileage || '---'} KM</p>
          </div>
        </div>
      </div>

      {/* CHECKLIST ÚKONOV */}
      <section>
        <h3 className="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em] mb-4 italic ml-2">Servisný checklist</h3>
        <div className="grid gap-3">
          {tasks.map(t => (
            <div 
              key={t.id} 
              onClick={() => handleToggle(t.id, t.is_completed === true || t.is_completed === 'true')} 
              className={`p-6 rounded-3xl border transition-all flex items-center justify-between group ${
                isLocked ? 'cursor-default opacity-60' : 'cursor-pointer'
              } ${
                (t.is_completed === true || t.is_completed === 'true')
                ? 'bg-green-600/10 border-green-600/30 text-green-500' 
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-blue-600/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                  (t.is_completed === true || t.is_completed === 'true') ? 'bg-green-600 border-green-600 shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'border-zinc-700 bg-black'
                }`}>
                  {(t.is_completed === true || t.is_completed === 'true') && <span className="text-white text-sm font-black">✓</span>}
                </div>
                <span className={`uppercase text-sm tracking-tight ${(t.is_completed === true || t.is_completed === 'true') ? 'line-through opacity-50' : ''}`}>
                  {t.task_description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MATERIÁL A DIELY */}
      <section className="bg-zinc-900/20 p-8 rounded-[3rem] border border-zinc-800">
        <h3 className="text-[10px] font-black uppercase text-orange-500 tracking-[0.3em] mb-6 italic ml-2">Závady na vozidle</h3>
        
        {!isLocked && (
            <form onSubmit={handleAddMaterial} className="flex gap-2 mb-8">
              <input 
                type="text" 
                value={newMaterial} 
                onChange={e => setNewMaterial(e.target.value)} 
                placeholder="Napíš závady ...." 
                className="flex-grow bg-black border border-zinc-800 p-5 rounded-2xl outline-none focus:border-orange-500 text-xs uppercase font-bold" 
              />
              <input 
                type="number" 
                value={qty} 
                onChange={e => setQty(e.target.value)} 
                className="w-20 bg-black border border-zinc-800 p-5 rounded-2xl text-center font-black" 
              />
              <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-8 rounded-2xl font-black transition-all shadow-lg">+</button>
            </form>
        )}
        
        <div className="grid gap-2">
          {items.filter(item => item.type === 'Materiál').map(i => (
            <div key={i.id} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-zinc-800/50">
              <span className="text-xs uppercase font-bold text-zinc-300">{i.name}</span>
              <span className="text-[10px] font-black bg-zinc-800 px-3 py-1 rounded-lg text-orange-400">{i.quantity} {i.unit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* --- SEKCIJA: FOTODOKUMENTÁCIA S AKTÍVNOU KAMEROU --- */}
      <section className="bg-zinc-900/20 p-8 rounded-[3rem] border border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em] italic ml-2">Fotodokumentácia opravy</h3>
          {!isLocked && (
            <label className="bg-zinc-800 hover:bg-red-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg">
              {uploading ? 'Nahrávam...' : '📸 Odfotiť / Nahrať'}
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={handleUploadPhoto} 
                disabled={uploading} 
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-3xl overflow-hidden border border-zinc-800 bg-black shadow-xl">
              <img src={photo.url} alt="Servis" className="w-full h-full object-cover" />
              {!isLocked && (
                <button 
                  onClick={() => deletePhoto(photo)}
                  className="absolute top-2 right-2 bg-red-600/80 p-2 rounded-xl text-white backdrop-blur-sm"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          {photos.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-600 italic text-[10px] font-black uppercase tracking-widest border border-dashed border-zinc-800 rounded-3xl">
              Zatiaľ žiadne fotky
            </div>
          )}
        </div>
      </section>

      {/* NAHLÁSENIE ZISTENIA */}
      {!isLocked && (
        <section className="bg-yellow-950/30 border border-yellow-800/40 p-8 rounded-[3rem]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-[10px] font-black uppercase text-yellow-400 tracking-[0.3em] italic">Nahlásiť nové zistenie</h3>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Zákazka pokračuje — recepcia dostane SMS</p>
            </div>
            <button
              onClick={() => setShowFinding(v => !v)}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showFinding ? 'bg-zinc-800 text-zinc-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'}`}
            >
              {showFinding ? 'Zrušiť' : '⚠️ Nahlásiť zistenie'}
            </button>
          </div>

          {showFinding && (
            <div className="space-y-3 mt-4">
              <textarea
                value={findingText}
                onChange={e => setFindingText(e.target.value)}
                placeholder="Popíš čo si zistil na vozidle... (napr. prasklá hadica chladenia, korózia na podvozku...)"
                rows={4}
                className="w-full bg-black border border-yellow-800/50 focus:border-yellow-500 p-5 rounded-2xl outline-none text-sm font-bold text-white resize-none placeholder:text-zinc-600"
              />
              <button
                onClick={handleSendFinding}
                disabled={sendingFinding || !findingText.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-all disabled:opacity-40 shadow-lg"
              >
                {sendingFinding ? 'Odosielam...' : '📤 Odoslať zistenie + SMS na recepciu'}
              </button>
            </div>
          )}

          {/* Predchádzajúce zistenia v tejto zákazke */}
          {tasks.filter(t => t.task_description?.startsWith('⚠️ ZISTENIE:')).length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Nahlásené zistenia</p>
              {tasks.filter(t => t.task_description?.startsWith('⚠️ ZISTENIE:')).map(t => (
                <div key={t.id} className="bg-yellow-950/40 border border-yellow-900/30 px-4 py-3 rounded-xl">
                  <p className="text-xs font-bold text-yellow-300">{t.task_description.replace('⚠️ ZISTENIE: ', '')}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* STATUS TLAČIDLO */}
      {isLocked ? (
          <div className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-black py-8 rounded-[2.5rem] text-center uppercase tracking-widest italic border-dashed font-bold">
              Zákazka je v stave "{job.status}" a nie je možné ju meniť
          </div>
      ) : (
          <button
            onClick={finishJob}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-8 rounded-[2.5rem] uppercase italic tracking-widest shadow-2xl transition-all text-xl"
          >
            DOKONČENÉ - ODOVZDAŤ NA KONTROLU
          </button>
      )}
    </div>
  );
}