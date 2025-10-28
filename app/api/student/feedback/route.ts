export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/student/feedback
 * Body: { student_id: string, kind: 'course'|'faculty', target: string, text: string }
 *  - course: target = course_code
 *  - faculty: target = teacher_user_id
 *
 * Steps:
 *  1) Insert feedbacks (chuẩn hóa theo schema có sẵn).
 *  2) Nếu course → tìm department_id và insert department_inbox.
 *  3) Nếu faculty → insert teacher_inbox.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      student_id?: string | null;
      kind?: 'course' | 'faculty' | string;
      target?: string;
      text?: string;
    };

    const student_id = (body.student_id || '').trim();
    const kind = (body.kind || '').trim() as 'course' | 'faculty';
    const target = (body.target || '').trim(); // course_code or teacher_user_id
    const text = String(body.text ?? '').trim();

    if (!student_id || !kind || !target || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }

    const db = createServiceClient();

    // 0) Lấy SV -> user_id, framework_id
    const { data: st, error: eSt } = await db
      .from('students')
      .select('id, user_id, framework_id, mssv')
      .eq('id', student_id)
      .maybeSingle();

    if (eSt) return NextResponse.json({ error: eSt.message }, { status: 400 });
    if (!st?.user_id) return NextResponse.json({ error: 'Không tìm thấy sinh viên' }, { status: 400 });

    // 1) Insert feedbacks (theo schema đã cho: user_id, target_type, to_teacher_id, message, course_code, moderation_status)
    let feedbackInsert: any = {
      user_id: st.user_id,
      sender_role: 'student',
      message: text,
      moderation_status: 'pass', // đã kiểm duyệt trước khi gửi
      target_type: kind === 'course' ? 'department' : 'teacher',
    };

    if (kind === 'course') {
      feedbackInsert.course_code = target; // target là course_code
    } else {
      // faculty
      feedbackInsert.to_teacher_id = target; // target là user_id của giảng viên
      feedbackInsert.to_user_id = target;
    }

    const { data: fbRow, error: eFb } = await db
      .from('feedbacks')
      .insert(feedbackInsert)
      .select('id, course_code, to_teacher_id')
      .maybeSingle();

    if (eFb) {
      if (eFb.code === '42P01') return NextResponse.json({ error: 'Bảng feedbacks chưa tồn tại' }, { status: 400 });
      return NextResponse.json({ error: eFb.message }, { status: 400 });
    }
    if (!fbRow?.id) return NextResponse.json({ error: 'Không tạo được feedback' }, { status: 400 });

    // 2) Điều tuyến vào inbox phù hợp
    if (kind === 'course') {
      // Tìm department theo course_code + framework_id của SV
      const { data: course, error: eCourse } = await db
        .from('courses')
        .select('id, course_code, department_id')
        .eq('framework_id', st.framework_id)
        .eq('course_code', target)
        .maybeSingle();

      if (eCourse) return NextResponse.json({ error: eCourse.message }, { status: 400 });
      if (!course?.department_id) {
        // Nếu chưa gán bộ môn, coi như không định tuyến được nhưng feedback vẫn đã lưu
        return NextResponse.json({ ok: true, routed: false, reason: 'Chưa gán bộ môn cho học phần' });
      }

      const { error: eDeptInbox } = await db.from('department_inbox').insert({
        feedback_id: fbRow.id,
        department_id: course.department_id,
        message: text,
        course_code: target,
        status: 'unread',
      });

      if (eDeptInbox) return NextResponse.json({ error: eDeptInbox.message }, { status: 400 });

      return NextResponse.json({ ok: true, routed: true, inbox: 'department' });
    } else {
      // faculty -> teacher_inbox
      const teacherId = fbRow.to_teacher_id;
      if (!teacherId) return NextResponse.json({ ok: true, routed: false, reason: 'Thiếu to_teacher_id' });

      const { error: eTin } = await db.from('teacher_inbox').insert({
        feedback_id: fbRow.id,
        teacher_id: teacherId,
        message: text,
        status: 'unread',
      });

      if (eTin) return NextResponse.json({ error: eTin.message }, { status: 400 });

      return NextResponse.json({ ok: true, routed: true, inbox: 'teacher' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
