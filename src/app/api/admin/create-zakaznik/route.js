import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createMailTransport } from '@/app/lib/mailer';

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

  const { full_name, email, password, phone, clientType, company_name, ico, dic, ic_dph, address, city, zip, vehicle } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email a heslo sú povinné' }, { status: 400 });
  }

  const sb = adminClient();
  const emailNorm = email.toLowerCase().trim();

  // Vytvor auth usera BEZ odoslania emailu — obchádza rate limit
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: emailNorm,
    password,
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

  // Notifikácia adminovi o novom zákazníkovi
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = createMailTransport();
      await transporter.sendMail({
        from: `"AutoAlma Servis" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject: `Nový zákazník: ${full_name || emailNorm}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:10px;border:1px solid #e5e5e5">
            <div style="border-bottom:3px solid #ef4444;padding-bottom:12px;margin-bottom:18px">
              <p style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.3em;margin:0 0 4px">AutoAlma Servis</p>
              <h1 style="color:#111;font-size:20px;margin:0;font-style:italic;text-transform:uppercase">👤 Nový zákazník v systéme</h1>
            </div>
            <table style="width:100%;font-size:13px;color:#333;border-collapse:collapse">
              ${full_name ? `<tr><td style="padding:5px 0;color:#999;width:110px">Meno</td><td style="padding:5px 0"><strong>${full_name}</strong></td></tr>` : ''}
              <tr><td style="padding:5px 0;color:#999">E-mail</td><td style="padding:5px 0">${emailNorm}</td></tr>
              ${phone ? `<tr><td style="padding:5px 0;color:#999">Telefón</td><td style="padding:5px 0">${phone}</td></tr>` : ''}
              ${company_name ? `<tr><td style="padding:5px 0;color:#999">Firma</td><td style="padding:5px 0">${company_name}</td></tr>` : ''}
              ${vehicle?.license_plate ? `<tr><td style="padding:5px 0;color:#999">Vozidlo</td><td style="padding:5px 0">${vehicle.license_plate.toUpperCase()}${vehicle.brand_model ? ` · ${vehicle.brand_model}` : ''}</td></tr>` : ''}
            </table>
            <p style="color:#ccc;font-size:10px;text-align:center;margin-top:20px">AutoAlma Servis · autoalma.sk</p>
          </div>`,
      });
    } catch (e) {
      console.error('admin notify email error:', e.message);
    }
  }

  return NextResponse.json({ ok: true, userId, email: emailNorm });
}
