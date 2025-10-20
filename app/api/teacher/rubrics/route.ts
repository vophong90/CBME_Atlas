import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') ?? undefined;
  const course_code = url.searchParams.get('course_code') ?? undefined;

  let q = supabase.from('rubrics')
    .select('id,name,framework_id,course_code,definition')
    .order('id', { ascending: false });

  if (framework_id) q = q.eq('framework_id', framework_id);
  if (course_code) q = q.eq('course_code', course_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}
