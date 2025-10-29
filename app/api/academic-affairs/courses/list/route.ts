export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const framework_id = url.searchParams.get('framework_id');
    const q           = (url.searchParams.get('q') || '').trim();
    const page        = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const pageSize    = Math.max(1, Number(url.searchParams.get('page_size') || '20'));
    const from        = (page - 1) * pageSize;
    const to          = from + pageSize - 1;

    const db = createServiceClient();

    // Đọc từ VIEW để luôn có thông tin bộ môn đã gán
    let query = db
      .from('v_courses_with_department')
      .select(
        `id, framework_id, code, name, department_id, department_name`,
        { count: 'exact' }
      )
      .order('code', { ascending: true });

    if (framework_id) query = query.eq('framework_id', framework_id);
    if (q)            query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);

    const { data, error, count } = await query.range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      framework_id: r.framework_id,
      department_id: r.department_id,
      department: r.department_id ? { id: r.department_id, name: r.department_name } : null,
    }));

    return NextResponse.json({ items, total: count ?? 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
