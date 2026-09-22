import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// createBrowserClient (@supabase/ssr) ukladá reláciu do cookies namiesto localStorage,
// takže ju vidí aj server (src/proxy.js) a vie chrániť dashboard/mechanik/garaz routes
// ešte pred vykreslením stránky. API klienta je rovnaké ako pri createClient.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // createBrowserClient má štandardne flowType 'pkce', ktorý vracia overovací
    // odkaz ako ?code=… a vyžaduje, aby sa e-mail otvoril v tom istom prehliadači,
    // kde sa obnova hesla vyžiadala. Pôvodný klient používal 'implicit' (token
    // v kotve URL) a stránka /login/update-password s ním počíta — necháme ho,
    // aby odkaz fungoval aj na inom zariadení (zákazník si ho otvorí v mobile).
    flowType: 'implicit',
  }
})

// Jednorazová migrácia: staršia verzia držala reláciu v localStorage pod kľúčom
// sb-<ref>-auth-token. Ak ju tam prehliadač ešte má a v cookies nič nie je,
// prenesieme ju, aby sa používateľ nemusel znovu prihlasovať.
if (typeof window !== 'undefined') {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    const legacyKey = `sb-${ref}-auth-token`
    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy) {
      window.localStorage.removeItem(legacyKey)
      const parsed = JSON.parse(legacy)
      if (parsed?.access_token && parsed?.refresh_token) {
        supabase.auth.getSession().then(async ({ data }) => {
          if (data?.session) return
          const { data: restored, error } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          })
          if (error || !restored?.user) return
          // Proxy ho mohol medzitým poslať na /login — pošleme ho tam, kam patrí podľa roly
          // (rovnaká logika ako v /login po prihlásení), inak iba obnovíme stránku.
          const path = window.location.pathname
          if (path === '/login' || path === '/mechanik/login') {
            const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', restored.user.id).maybeSingle()
            const role = profile?.role?.toLowerCase()
            let dest = '/'
            if (role === 'admin') dest = '/dashboard'
            else if (role === 'mechanik') dest = '/mechanik'
            else if (role === 'zakaznik' || role === 'klient') dest = '/garaz'
            else {
              const { data: emp } = await supabase.from('employees').select('id').eq('id', restored.user.id).maybeSingle()
              if (emp) dest = '/mechanik'
            }
            window.location.replace(dest)
          } else {
            window.location.reload()
          }
        }).catch(() => {})
      }
    }
  } catch (e) {
    // localStorage nedostupné (private mode) — používateľ sa jednoducho prihlási znova
  }
}
