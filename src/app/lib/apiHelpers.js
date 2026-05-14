import { supabase } from './supabase';

export async function fetchWithAuth(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
  });
}
