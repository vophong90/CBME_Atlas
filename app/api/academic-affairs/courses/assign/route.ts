export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type AssignItem = {
  framework_id: string;
  course_code: string;         // nếu DB dùng cột 'code', xem ghi chú bên dưới
  department_id: string | null;
};

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({} as any));

    // Chấp nhận cả { items: [...] } lẫn body đơn lẻ
    let items: AssignItem[] = [];
    if (Array.isArray(raw?.items)) {
      items = raw.items;
    } else if (raw?.framework_id && typeof raw?.course_code === 'string') {
      items = [{
        framework_id: raw.framework_id,
        course_code: raw.course_code,
        department_id: raw?.department_id ?? null,
      }];
    }

    if (!items.length) {
      return NextResponse.json({ error: 'Thiếu items' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role

    // Validate input
    for (const it of items) {
      if (!it.framework_id || !it.course_code) {
        return NextResponse.json({ error: 'Thiếu framework_id/course_code' }, { status: 400 });
      }
    }

    const results = await Promise.all(
      items.map((it) =>
        db
          .from('courses')
          .update({ department_id: it.department_id })
          .eq('framework_id', it.framework_id)
          .eq('course_code', it.course_code) // ← đổi sang 'code' nếu cần
      )
    );

    const bad = results.find((r: any) => r?.error);
    if (bad?.error) {
      return NextResponse.json({ error: bad.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, updated: items.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
