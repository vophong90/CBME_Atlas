export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type AssignItem = {
  framework_id: string;
  course_code: string;
  department_id: string | null; // null = bỏ gán
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { items?: AssignItem[] };
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'Thiếu items' }, { status: 400 });

    const db = createServiceClient(); // service-role

    // Validate courses tồn tại trước khi update
    for (const it of items) {
      if (!it.framework_id || !it.course_code) {
        return NextResponse.json({ error: 'Thiếu framework_id/course_code' }, { status: 400 });
      }
    }

    // Thực hiện batch update
    const updates = items.map((it) =>
      db.from('courses')
        .update({ department_id: it.department_id })
        .eq('framework_id', it.framework_id)
        .eq('course_code', it.course_code)
    );

    const results = await Promise.all(updates);
    const firstErr = results.find((r) => (r as any).error)?.error;
    if (firstErr) return NextResponse.json({ error: firstErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, updated: items.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
