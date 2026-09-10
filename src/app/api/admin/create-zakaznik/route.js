import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: profile } = await sb.from('user_profiles').select('role').eq('id', data.user.id).single();
  return profile?.role === 'admin';
}

export async function POST(request) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { full_name, email, phone, clientType, company_name, ico, dic, ic_dph, address, city, zip, vehicle } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'E-mail je povinný' }, { status: 400 });
  }

  const sb = adminClient();
  const emailNorm = email.toLowerCase().trim();

  // Účet vzniká s náhodným heslom, ktoré sa nikde nezobrazí ani neodošle.
  // Zákazník si svoje heslo nastaví sám cez odkaz v uvítacom e-maile —
  // servis ho tak nikdy nepozná a nemôže dôjsť k nedorozumeniu.
  const docasneHeslo = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  // Vytvor auth usera BEZ odoslania emailu — obchádza rate limit
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: emailNorm,
    password: docasneHeslo,
    email_confirm: true,
    user_metadata: { full_name: full_name || emailNorm },
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  if (!authData?.user) return NextResponse.json({ error: 'Nepodarilo sa vytvoriť účet' }, { status: 500 });

  const userId = authData.user.id;

  const { error: profileError } = await sb.from('user_profiles').insert([{
    id: userId,
    full_name: full_name || null,
    email: emailNorm,
    phone: phone || null,
    role: 'zakaznik',
    company_name: company_name || null,
    ico: ico || null,
    dic: dic || null,
    ic_dph: ic_dph || null,
    address: address || null,
    city: city || null,
    zip: zip || null,
  }]);

  if (profileError) {
    // Upraceme auth usera aby nevznikol "visací" účet bez profilu
    await sb.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: `Profil: ${profileError.message}` }, { status: 400 });
  }

  if (vehicle?.license_plate) {
    await sb.from('vehicles').insert([{
      owner_id: userId,
      owner_name: full_name || null,
      owner_email: emailNorm,
      license_plate: vehicle.license_plate.toUpperCase(),
      brand_model: vehicle.brand_model || null,
      vin_number: vehicle.vin ? vehicle.vin.toUpperCase() : null,
      year_produced: vehicle.year_produced || null,
      engine_volume: vehicle.engine_volume || null,
      engine_power: vehicle.engine_power || null,
      fuel_type: vehicle.fuel_type || 'Diesel',
      mileage: vehicle.mileage || 0,
    }]).catch(() => {});
  }

  // Odkaz na nastavenie hesla — platí obmedzený čas, posiela sa v uvítacom e-maile.
  // Ak sa vygenerovať nepodarí, klient je aj tak vytvorený; zákazník použije
  // "Zabudnuté heslo" na prihlasovacej stránke.
  let setPasswordUrl = null;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://autoalma.sk';
    const { data: linkData } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email: emailNorm,
      options: { redirectTo: `${base}/login/update-password` },
    });
    setPasswordUrl = linkData?.properties?.action_link || null;
  } catch {
    setPasswordUrl = null;
  }

  return NextResponse.json({ ok: true, userId, email: emailNorm, setPasswordUrl });
}
