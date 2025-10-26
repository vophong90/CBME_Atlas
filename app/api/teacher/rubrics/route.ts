// app/api/teacher/rubrics/route.ts
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') ?? undefined;
  const course_code  = url.searchParams.get('course_code')  ?? undefined;

  let q = supabase
    .from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold,created_at')
    .order('created_at', { ascending: false }); // order hợp lý hơn id (uuid)

  if (framework_id) q = q.eq('framework_id', framework_id);
  if (course_code)  q = q.eq('course_code', course_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Map title -> name cho UI hiện tại
  const items = (data ?? []).map(r => ({
    id: r.id,
    name: r.title,
    framework_id: r.framework_id,
    course_code: r.course_code,
    definition: r.definition,
    threshold: r.threshold ?? 70,
    created_at: r.created_at,
  }));

  return NextResponse.json({ items });
}
