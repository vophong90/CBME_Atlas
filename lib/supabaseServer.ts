// lib/getSupabaseServer.ts

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export function createServiceClient() {
  return supabaseAdmin;
}

export function getSupabase() {
  const cookieStore = cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
}
