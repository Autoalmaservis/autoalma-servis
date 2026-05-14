import { createClient } from '@supabase/supabase-js';

export async function getCompanySettings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data } = await supabase
    .from('business_settings')
    .select('id, value')
    .in('id', ['company_name', 'company_phone', 'company_email', 'company_web']);
  const get = (key, fallback) => data?.find(r => r.id === key)?.value || fallback;
  return {
    name:  get('company_name',  'AutoAlma Servis'),
    phone: get('company_phone', '0940 449 449'),
    email: get('company_email', 'autoalma@autoalma.sk'),
    web:   get('company_web',   'autoalma.sk'),
  };
}
