export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function viRole(code?: string | null) {
  switch (code) {
    case 'lecturer': return 'Giảng viên';
    case 'student':  return 'Sinh viên';
    case 'support':  return 'Hỗ trợ';
    default:         return code ?? '';
  }
}

export async function GET(req: Request) {
  try {
    const sb = createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user)    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const activeFilter    = (url.searchParams.get('active') ?? 'all').toLowerCase();     // true|false|all
    const submittedFilter = (url.searchParams.get('submitted') ?? 'all').toLowerCase();  // true|false|all

    // 1) assignments của GV
    const aRes = await sb
      .from('survey_assignments')
      .select('survey_id, role, department, cohort, unit, invited_at')
      .eq('assigned_to', user.id);

    if (aRes.error && aRes.error.code !== '42P01') {
      return NextResponse.json({ error: aRes.error.message }, { status: 500 });
    }
    const assigns = (aRes.data ?? []) as Array<{
      survey_id: string; role?: string | null; department?: string | null; cohort?: string | null; unit?: string | null; invited_at?: string | null;
    }>;
    const surveyIds = assigns.map(a => a.survey_id);
    if (surveyIds.length === 0) return NextResponse.json({ items: [] });

    // 2) surveys (chỉ các cột chắc chắn có)
    const sRes = await sb
      .from('surveys')
      .select('id, title, status, created_at, updated_at')
      .in('id', surveyIds);
    if (sRes.error) {
      return NextResponse.json({ error: sRes.error.message }, { status: 500 });
    }
    const surveys = sRes.data ?? [];

    // 3) responses của chính GV
    const rRes = await sb
      .from('survey_responses')
      .select('id, survey_id, is_submitted, submitted_at, created_at, updated_at')
      .eq('respondent_id', user.id)
      .in('survey_id', surveyIds);
    if (rRes.error && rRes.error.code !== '42P01') {
      return NextResponse.json({ error: rRes.error.message }, { status: 500 });
    }
    const responses = rRes.data ?? [];
    const respBySurvey = new Map(responses.map((r: any) => [r.survey_id, r]));

    // 4) Lookup tên Bộ môn & Khung (nếu assignments đang lưu ID)
    const deptIds   = Array.from(new Set(assigns.map(a => a.department).filter(Boolean))) as string[];
    const cohortIds = Array.from(new Set(assigns.map(a => a.cohort).filter(Boolean))) as string[];

    const deptMap = new Map<string, string>();
    if (deptIds.length) {
      const dRes = await sb.from('departments').select('id, name').in('id', deptIds);
      if (!dRes.error) {
        for (const d of dRes.data ?? []) deptMap.set(d.id, d.name);
      }
    }

    const cohortMap = new Map<string, string>();
    if (cohortIds.length) {
      // Tạo label khung từ các cột có sẵn; đổi lại nếu bạn có cột name riêng
      const cRes = await sb
        .from('curriculum_frameworks')
        .select('id, doi_tuong, chuyen_nganh, nien_khoa')
        .in('id', cohortIds);
      if (!cRes.error) {
        for (const cf of cRes.data ?? []) {
          const label = [cf.doi_tuong, cf.chuyen_nganh, cf.nien_khoa].filter(Boolean).join(' – ');
          cohortMap.set(cf.id, label || cf.id);
        }
      }
    }

    // 5) tổng hợp + lọc
    const items = (surveys as any[])
      .map((s) => {
        const asg  = assigns.find(a => a.survey_id === s.id) ?? null;
        const resp = respBySurvey.get(s.id);
        const is_active    = s.status === 'active';
        const is_submitted = !!resp?.is_submitted;
        const can_answer   = is_active && !is_submitted;

        const department = asg?.department ?? null;
        const cohort     = asg?.cohort ?? null;

        return {
          survey: {
            id: s.id,
            title: s.title,
            status: s.status,
            created_at: s.created_at,
            updated_at: s.updated_at,
            open_at: null,  // thêm vào nếu DB có cột
            close_at: null, // thêm vào nếu DB có cột
          },
          assignment: asg ? {
            invited_at: asg.invited_at ?? null,
            role: asg.role ?? null,
            role_vi: viRole(asg.role),
            department,
            department_name: department ? (deptMap.get(department) ?? department) : null,
            cohort,
            cohort_name: cohort ? (cohortMap.get(cohort) ?? cohort) : null,
            unit: asg.unit ?? null,
          } : null,
          response: resp ? {
            id: resp.id,
            is_submitted: resp.is_submitted,
            submitted_at: resp.submitted_at,
          } : null,
          is_active,
          is_submitted,
          can_answer,
          link: null,
        };
      })
      .filter((it) => {
        if (activeFilter === 'true'  && !it.is_active)    return false;
        if (activeFilter === 'false' &&  it.is_active)    return false;
        if (submittedFilter === 'true'  && !it.is_submitted) return false;
        if (submittedFilter === 'false' &&  it.is_submitted) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_active !== b.is_active)       return a.is_active ? -1 : 1;          // active trước
        if (a.is_submitted !== b.is_submitted) return a.is_submitted ? 1 : -1;       // chưa nộp trước
        return new Date(b.survey.created_at).getTime() - new Date(a.survey.created_at).getTime();
      });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
