import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await sb.from('user_profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

export async function POST(request) {
  if (!await requireAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, newPassword } = await request.json();
  if (!userId || !newPassword) {
    return Response.json({ error: 'Chýba userId alebo heslo' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: 'Heslo musí mať aspoň 6 znakov' }, { status: 400 });
  }

  const sb = adminClient();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
