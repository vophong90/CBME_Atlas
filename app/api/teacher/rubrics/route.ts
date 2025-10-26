// app/api/teacher/rubrics/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = getSupabaseFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = (url.searchParams.get('framework_id') || '').trim();
  const course_code  = (url.searchParams.get('course_code')  || '').trim();

  let q = supabase
    .from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold')
    .order('created_at', { ascending: false });

  if (framework_id) q = q.eq('framework_id', framework_id);
  if (course_code)  q = q.ilike('course_code', course_code); // so khớp case-insensitive

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data || []).map(r => ({
    id: r.id,
    name: r.title,                // UI cần 'name'
    definition: r.definition,
    framework_id: r.framework_id,
    course_code: r.course_code,
    threshold: r.threshold,
  }));
  return NextResponse.json({ items });
}
