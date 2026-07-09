import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 56);

  const [{ data: emps }, { data: evts }, { data: bloks }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, role').eq('active', true).in('role', ['mechanik', 'diagnostik', 'klampiar', 'lakernik']),
    supabaseAdmin.from('calendar_events').select('start_datetime, employee_id').gte('start_datetime', today.toISOString()).lte('start_datetime', futureDate.toISOString()).neq('plate_number', 'BLOK'),
    supabaseAdmin.from('calendar_events').select('start_datetime, employee_id').gte('start_datetime', today.toISOString()).lte('start_datetime', futureDate.toISOString()).eq('plate_number', 'BLOK'),
  ]);

  const totalCapacity = emps?.length || 0;
  const allEmpIds = emps?.map(e => e.id) || [];

  const roleCap = {};
  emps?.forEach(e => { roleCap[e.role] = (roleCap[e.role] || 0) + 1; });

  const dayBookings = {};
  evts?.forEach(ev => {
    const day = ev.start_datetime.split('T')[0];
    if (!dayBookings[day]) dayBookings[day] = new Set();
    if (ev.employee_id) dayBookings[day].add(ev.employee_id);
  });

  bloks?.forEach(ev => {
    const day = ev.start_datetime.split('T')[0];
    if (!dayBookings[day]) dayBookings[day] = new Set();
    if (ev.employee_id) {
      dayBookings[day].add(ev.employee_id);
    } else {
      allEmpIds.forEach(id => dayBookings[day].add(id));
    }
  });

  const availability = {};
  const cursor = new Date(today);
  while (cursor <= futureDate) {
    const dayStr = cursor.toISOString().split('T')[0];
    const booked = dayBookings[dayStr]?.size || 0;
    availability[dayStr] = { total: totalCapacity, booked, free: Math.max(0, totalCapacity - booked) };
    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({ availability, roleCapacity: roleCap });
}
