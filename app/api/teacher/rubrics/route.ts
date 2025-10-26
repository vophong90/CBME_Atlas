// app/api/teacher/rubrics/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // DEV: bypass auth
  const db = createServiceClient();

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') ?? undefined;
  const course_code  = url.searchParams.get('course_code')  ?? undefined;

  let q = db.from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold')
    .order('created_at', { ascending: false });

  if (framework_id) q = q.eq('framework_id', framework_id);
  if (course_code)  q = q.ilike('course_code', course_code); // không phân biệt hoa thường

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data ?? []).map(r => ({
    id: r.id,
    name: r.title,                 // UI đang dùng 'name'
    definition: r.definition,
    framework_id: r.framework_id,
    course_code: r.course_code,
    threshold: r.threshold,
  }));
  return NextResponse.json({ items });
}
