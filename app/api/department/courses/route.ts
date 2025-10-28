export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const sb = getSupabaseFromRequest(req); // RLS theo session
    const { data: me, error: e0 } = await sb
      .from('staff')
      .select('department_id')
      .eq('user_id', (await sb.auth.getUser()).data.user?.id || '')
      .maybeSingle();

    if (e0) return NextResponse.json({ error: e0.message }, { status: 400 });
    if (!me?.department_id) {
      return NextResponse.json({ items: [] });
    }

    const deptId = me.department_id;

    const { data, error } = await sb
      .from('courses')
      .select('framework_id, course_code, course_name')
      .eq('department_id', deptId)
      .order('course_code');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r) => ({
      framework_id: r.framework_id,
      code: r.course_code,
      name: r.course_name,
    }));

    return NextResponse.json({ items, department_id: deptId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
