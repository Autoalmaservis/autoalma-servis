export default function DeleteModal({ onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 no-print font-bold">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] max-sm w-full text-center shadow-2xl">
        <h3 className="text-xl font-black uppercase italic mb-4 tracking-tighter text-white font-bold">Vymazať zákazku?</h3>
        <div className="flex flex-col gap-3 font-black">
          <button onClick={onConfirm} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all italic font-black">Definitívne vymazať</button>
          <button onClick={onClose} className="w-full bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl uppercase text-[10px] hover:text-white transition-all italic tracking-widest font-black">Zrušiť</button>
        </div>
      </div>
    </div>
  );
}
