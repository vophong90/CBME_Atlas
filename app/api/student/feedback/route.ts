export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      student_id?: string | null; // dùng để map ra auth.user_id nếu cần
      kind?: 'course'|'faculty';
      target?: string; // course_code | teacher_user_id
      text?: string;
    };

    const kind = (body.kind || '').trim() as 'course'|'faculty';
    const target = (body.target || '').trim();
    const text = String(body.text ?? '').trim();
    if (!kind || !target || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role
    let target_type: 'department'|'teacher';
    let to_teacher_id: string | null = null;
    let course_code: string | null = null;

    if (kind === 'course') {
      target_type = 'department';
      course_code = target;
    } else {
      target_type = 'teacher';
      to_teacher_id = target;
    }

    // Lấy user_id gửi: ưu tiên lấy từ students.user_id nếu truyền student_id
    let userId: string | null = null;
    if (body.student_id) {
      const { data: st, error: eSt } = await db
        .from('students')
        .select('user_id')
        .eq('id', body.student_id)
        .maybeSingle();
      if (eSt) return NextResponse.json({ error: eSt.message }, { status: 400 });
      userId = st?.user_id ?? null;
    }

    // Nếu không có, fallback = null (tuỳ bạn ràng buộc — có thể bắt buộc user_id)
    if (!userId) {
      return NextResponse.json({ error: 'Không xác định được người gửi' }, { status: 400 });
    }

    // Tạo 1 feedback
    const { data: fb, error: eFb } = await db
      .from('feedbacks')
      .insert({
        user_id: userId,
        sender_role: 'student',
        target_type,
        to_teacher_id,
        message: text,
        course_code,
        visibility: target_type === 'department' ? 'department' : 'student',
        moderation_status: 'pass', // do bạn đã kiểm duyệt ở /moderate
      })
      .select('id, course_code, to_teacher_id')
      .single();

    if (eFb) return NextResponse.json({ error: eFb.message }, { status: 400 });

    // Đẩy vào inbox phù hợp (nếu thiếu trigger)
    if (target_type === 'department' && course_code) {
      const { data: c, error: eC } = await db
        .from('courses')
        .select('department_id')
        .eq('course_code', course_code)
        .maybeSingle();
      if (eC) return NextResponse.json({ error: eC.message }, { status: 400 });

      if (c?.department_id) {
        await db.from('department_inbox').insert({
          feedback_id: fb.id,
          department_id: c.department_id,
          message: text,
          course_code: course_code,
          status: 'unread',
        });
      }
    } else if (target_type === 'teacher' && to_teacher_id) {
      await db.from('teacher_inbox').insert({
        feedback_id: fb.id,
        teacher_id: to_teacher_id,
        message: text,
        course_code: course_code,
        status: 'unread',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
