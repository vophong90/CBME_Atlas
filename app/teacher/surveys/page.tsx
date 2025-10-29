export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const sb = createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: authErr?.message ?? 'Unauthorized' }, { status: 401 });
    }

    // 1) Lấy assignments của GV hiện tại
    const aRes = await sb
      .from('survey_assignments')
      .select('survey_id, role, department, cohort, unit, invited_at')
      .eq('assigned_to', user.id);

    if (aRes.error && aRes.error.code !== '42P01') {
      return NextResponse.json({ error: aRes.error.message }, { status: 500 });
    }
    const assignments = (aRes.data ?? []) as Array<{
      survey_id: string;
      role: string | null;
      department: string | null; // id bộ môn
      cohort: string | null;
      unit: string | null;
      invited_at: string | null;
    }>;

    const surveyIds = assignments.map(a => a.survey_id);
    if (!surveyIds.length) return NextResponse.json({ items: [] });

    // 2) Map department_id -> name (nếu có bảng departments)
    const deptIds = Array.from(
      new Set(assignments.map(a => a.department).filter((v): v is string => !!v))
    );
    let deptMap = new Map<string, string>();
    if (deptIds.length) {
      const { data: depts, error: deptErr } = await sb
        .from('departments')
        .select('id,name')
        .in('id', deptIds);
      if (!deptErr && depts) {
        deptMap = new Map((depts as any[]).map(d => [d.id as string, (d.name as string) ?? '']));
      }
    }

    // 3) Thông tin survey
    const sRes = await sb
      .from('surveys')
      .select('id, title, status, created_at, updated_at') // không include open_at/close_at nếu chưa có cột
      .in('id', surveyIds);
    if (sRes.error) return NextResponse.json({ error: sRes.error.message }, { status: 500 });
    const surveys = sRes.data ?? [];

    // 4) Response của chính GV
    const rRes = await sb
      .from('survey_responses')
      .select('id, survey_id, is_submitted, submitted_at')
      .eq('respondent_id', user.id)
      .in('survey_id', surveyIds);
    if (rRes.error && rRes.error.code !== '42P01') {
      return NextResponse.json({ error: rRes.error.message }, { status: 500 });
    }
    const respBySurvey = new Map((rRes.data ?? []).map((r: any) => [r.survey_id, r]));

    // 5) Tổng hợp
    const items = (surveys as any[]).map((s) => {
      const asg = assignments.find(a => a.survey_id === s.id) ?? null;
      const department_name =
        asg?.department ? (deptMap.get(asg.department) ?? null) : null;

      const is_active = s.status === 'active';
      const resp = asg ? respBySurvey.get(s.id) : null;
      const is_submitted = !!resp?.is_submitted;
      const can_answer = is_active && !is_submitted;

      return {
        survey: {
          id: s.id,
          title: s.title,
          status: s.status,
          created_at: s.created_at,
          updated_at: s.updated_at,
          open_at: null,
          close_at: null,
        },
        assignment: asg
          ? {
              invited_at: asg.invited_at,
              role: asg.role,
              department: asg.department,         // id
              department_name,                     // tên hiển thị
              cohort: asg.cohort,
              unit: asg.unit,
            }
          : null,
        response: resp
          ? {
              id: resp.id,
              is_submitted: resp.is_submitted,
              submitted_at: resp.submitted_at,
            }
          : null,
        is_active,
        is_submitted,
        can_answer,
        link: null,
      };
    })
    // Active trước, chưa nộp trước
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (a.is_submitted !== b.is_submitted) return a.is_submitted ? 1 : -1;
      return new Date(b.survey.created_at).getTime() - new Date(a.survey.created_at).getTime();
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
