import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = getSupabaseFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const mssv = url.searchParams.get('mssv') || '';
  if (!mssv) return NextResponse.json({ error: 'mssv is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('students')
    .select('mssv,user_id,full_name,framework_id')
    .ilike('mssv', mssv)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  return NextResponse.json({ student: data });
}
