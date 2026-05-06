'use client';
import { useState } from 'react';

export default function ImageGallery({ images }) {
  const [lightbox, setLightbox] = useState(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {images.map((url, i) => (
          <div
            key={i}
            onClick={() => setLightbox(url)}
            className="relative rounded-2xl overflow-hidden border border-zinc-900 hover:border-blue-500/30 cursor-zoom-in transition-all group"
          >
            <img src={url} alt="" className="w-full object-cover aspect-video group-hover:scale-[1.02] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all" />
          </div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[600] bg-black/97 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white text-xl transition-all">✕</button>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
