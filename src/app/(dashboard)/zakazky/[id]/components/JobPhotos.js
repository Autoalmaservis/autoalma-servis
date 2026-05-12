'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function JobPhotos({ jobId }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase.from('job_photos').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPhotos(data);
    } catch (err) { console.error("Chyba fotiek:", err.message); }
  };

  useEffect(() => {
    fetchPhotos();
    const channel = supabase.channel(`job-photos-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_photos', filter: `job_id=eq.${jobId}` }, fetchPhotos)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jobId]);

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${jobId}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('service-images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('job_photos').insert([{ job_id: jobId, url: publicUrl, storage_path: filePath }]);
      if (dbError) throw dbError;
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri nahrávaní: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (!confirm("Naozaj chcete vymazať túto fotografiu?")) return;
    try {
      const { error: storageError } = await supabase.storage.from('service-images').remove([photo.storage_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('job_photos').delete().eq('id', photo.id);
      if (dbError) throw dbError;
      fetchPhotos();
    } catch (err) {
      alert("Chyba pri mazaní fotky: " + err.message);
    }
  };

  return (
    <div className="space-y-4 mb-12 no-print font-bold">
      <div className="flex justify-between items-center">
        <h2 className="text-red-600 font-black uppercase text-[10px] tracking-[0.3em] italic">3. Fotodokumentácia opravy</h2>
        <label className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer inline-block shadow-lg">
          {uploading ? 'Nahrávam...' : '📸 Pridať fotografiu'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square rounded-[2rem] overflow-hidden border border-zinc-800 bg-black shadow-xl">
            <img src={photo.url} alt="Servisná fotka" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => deletePhoto(photo)}
                className="bg-red-600 text-white p-4 rounded-2xl hover:bg-red-500 transition-all shadow-2xl transform translate-y-4 group-hover:translate-y-0 duration-300"
              >
                🗑️ Vymazať
              </button>
            </div>
          </div>
        ))}

        {photos.length === 0 && !uploading && (
          <div className="col-span-full py-12 border-2 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-zinc-600 opacity-50">
            <span className="text-3xl mb-2">📸</span>
            <p className="text-[10px] font-black uppercase tracking-widest italic">Zatiaľ neboli nahrané žiadne fotografie</p>
          </div>
        )}
      </div>
    </div>
  );
}
