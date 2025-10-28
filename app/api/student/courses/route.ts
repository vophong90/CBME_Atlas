export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const db = createServiceClient();
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id');
    const framework_id = searchParams.get('framework_id');

    let fw = framework_id;

    if (!fw && student_id) {
      const { data: st, error: e1 } = await db
        .from('students')
        .select('framework_id')
        .eq('id', student_id)
        .maybeSingle();
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      fw = st?.framework_id ?? null;
    }

    if (!fw) return NextResponse.json({ items: [] });

    const { data, error } = await db
      .from('courses')
      .select(`
        framework_id,
        course_code,
        course_name,
        department_id,
        departments:department_id ( id, name )
      `)
      .eq('framework_id', fw)
      .order('course_code');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r) => ({
      code: r.course_code,
      name: r.course_name,
      department: r.departments ? { id: r.departments.id, name: r.departments.name } : null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
