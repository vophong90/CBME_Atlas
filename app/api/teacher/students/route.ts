// app/api/teacher/students/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = getSupabaseFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') || '';
  if (!framework_id) {
    return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('students')
    .select('user_id, mssv, full_name')
    .eq('framework_id', framework_id)
    .not('mssv', 'is', null)
    .not('user_id', 'is', null)
    .order('mssv', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data || []).map((s) => ({
    user_id: s.user_id,
    mssv: s.mssv,
    full_name: s.full_name,
    label: `${s.mssv} — ${s.full_name}`,
  }));

  return NextResponse.json({ items });
}
