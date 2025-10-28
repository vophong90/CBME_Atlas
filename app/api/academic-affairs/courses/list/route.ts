export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const db = createServiceClient(); // service-role
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id');
    const q = (searchParams.get('q') || '').trim();

    let query = db
      .from('courses')
      .select(`
        framework_id,
        course_code,
        course_name,
        department_id,
        departments:department_id ( id, code, name )
      `)
      .order('course_code');

    if (framework_id) query = query.eq('framework_id', framework_id);
    if (q) {
      query = query.or(`course_code.ilike.%${q}%,course_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r) => ({
      framework_id: r.framework_id,
      code: r.course_code,
      name: r.course_name,
      department: r.departments ? { id: r.departments.id, name: r.departments.name } : null,
      department_id: r.department_id ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
