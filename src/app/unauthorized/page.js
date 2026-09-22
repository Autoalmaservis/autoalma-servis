import Link from 'next/link';

export const metadata = { title: 'Prístup zamietnutý | AutoAlma' };

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-[2rem] p-10 text-center">
        <p className="text-red-600 font-black uppercase italic tracking-tighter text-4xl mb-4">403</p>
        <h1 className="font-black uppercase italic tracking-tighter text-xl mb-3">Prístup zamietnutý</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Váš účet nemá oprávnenie na túto časť systému.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-3 rounded-[1.5rem] transition-colors">
            Na hlavnú stránku
          </Link>
          <Link href="/login" className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-black uppercase tracking-widest text-xs py-3 rounded-[1.5rem] transition-colors">
            Prihlásiť sa iným účtom
          </Link>
        </div>
      </div>
    </div>
  );
}
