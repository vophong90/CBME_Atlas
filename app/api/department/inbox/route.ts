// app/api/department/inbox/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET ?course_code=CS101[,CS102]&from=2025-01-01T00:00&to=2025-01-31T23:59
 * Trả về góp ý đã duyệt (moderation_status='pass') nhìn được bởi Bộ môn (visibility in ('department','both'))
 * map fields cho UI: { id, created_at, student_id, target, text }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cc  = (searchParams.get('course_code') || '').trim();
    const from = (searchParams.get('from') || '').trim();
    const to   = (searchParams.get('to')   || '').trim();

    if (!cc) return NextResponse.json({ error: 'Thiếu course_code' }, { status: 400 });
    const codes = cc.split(',').map(s => s.trim()).filter(Boolean);
    if (!codes.length) return NextResponse.json({ error: 'course_code rỗng' }, { status: 400 });

    const db = createServiceClient(); // service-role

    // Chỉ lấy góp ý đã duyệt & Bộ môn nhìn thấy
    let q = db
      .from('feedbacks')
      .select('id, created_at, user_id, course_code, message, moderation_status, visibility, to_teacher_id, target_type')
      .in('course_code', codes)
      .eq('moderation_status', 'pass')
      .in('visibility', ['department', 'both'])
      .order('created_at', { ascending: false });

    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);

    const { data: fb, error } = await q;
    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Join mềm: lấy MSSV từ students.user_id (nếu có)
    const userIds = Array.from(new Set((fb ?? []).map(x => x.user_id).filter(Boolean)));
    let mssvByUserId = new Map<string, string>();
    if (userIds.length) {
      const { data: students } = await db
        .from('students')
        .select('user_id, mssv')
        .in('user_id', userIds);
      if (students) mssvByUserId = new Map(students.map(s => [s.user_id, s.mssv || '']));
    }

    // Chuẩn hoá trả về theo UI
    const out = (fb || []).map(r => ({
      id: String(r.id),
      created_at: r.created_at,
      student_id: mssvByUserId.get(r.user_id) || null, // UI hiển thị "SV: ...", nếu null sẽ là "Ẩn danh"
      target: r.course_code,                            // UI đang đọc m.target
      text: r.message,                                  // UI đang đọc m.text
      // Có thể cần thêm meta nếu sau này lọc theo loại:
      // target_type: r.target_type, to_teacher_id: r.to_teacher_id
    }));

    return NextResponse.json({ data: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
