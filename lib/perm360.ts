import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function getUserRoles(userId: string) {
  const sb = createServiceClient();
  const { data: rows, error } = await sb
    .from('user_roles')
    .select('role:role_id(code)')
    .eq('staff_user_id', userId);
  if (error) return [];
  return (rows || []).map(r => r.role?.code).filter(Boolean) as string[];
}

export async function ensureQA(userId?: string) {
  if (!userId) return { ok: false, resp: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const roles = await getUserRoles(userId);
  const ok = roles.includes('admin') || roles.includes('qa');
  if (!ok) return { ok: false, resp: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true, roles };
}
