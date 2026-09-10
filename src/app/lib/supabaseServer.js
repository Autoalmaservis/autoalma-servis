import { createClient } from '@supabase/supabase-js';

// Supabase klient pre SERVEROVÉ komponenty.
// Rozdiel oproti /lib/supabase.js: neukladá reláciu ani ju neobnovuje,
// takže sa dá bezpečne volať pri generovaní stránky na serveri.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
