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

  const { name, email, password, role, color, hourly_rate } = await request.json();
  if (!name || !email || !password) {
    return Response.json({ error: 'Meno, email a heslo sú povinné' }, { status: 400 });
  }

  const sb = adminClient();
  const emailNorm = email.toLowerCase().trim();

  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
  });
  if (authError) return Response.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  const { error: empError } = await sb.from('employees').insert([{
    id: userId,
    name: name.trim(),
    role: role || 'mechanik',
    color: color || '#dc2626',
    email: emailNorm,
    active: true,
    hourly_rate: parseFloat(hourly_rate) || 0,
  }]);

  if (empError) {
    await sb.auth.admin.deleteUser(userId);
    return Response.json({ error: empError.message }, { status: 400 });
  }

  await sb.from('user_profiles').upsert([{
    id: userId,
    email: emailNorm,
    role: 'mechanik',
  }]);

  return Response.json({ ok: true, id: userId });
}
