export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const sb = createServerClient(); // RLS theo user
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const activeFilter = (url.searchParams.get('active') ?? 'all').toLowerCase();      // true|false|all
    const submittedFilter = (url.searchParams.get('submitted') ?? 'all').toLowerCase(); // true|false|all

    // 1) assignments của GV (lọc role = 'lecturer')
    const aRes = await sb
      .from('survey_assignments')
      .select('survey_id, role, department, cohort, unit, invited_at')
      .eq('assigned_to', user.id)
      .eq('role', 'lecturer');

    if (aRes.error && aRes.error.code !== '42P01') {
      return NextResponse.json({ error: aRes.error.message }, { status: 500 });
    }
    const assigns = aRes.data ?? [];
    const surveyIds = assigns.map((a: any) => a.survey_id);
    if (surveyIds.length === 0) return NextResponse.json({ items: [] });

    // 2) thông tin survey (tuỳ schema có/không open_at/close_at)
    const sRes = await sb
      .from('surveys')
      .select('id, title, status, created_at, updated_at, open_at, close_at')
      .in('id', surveyIds);

    if (sRes.error) {
      return NextResponse.json({ error: sRes.error.message }, { status: 500 });
    }
    const surveys = sRes.data ?? [];

    // 3) response của chính GV
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

    // 4) tổng hợp + lọc
    const items = (surveys as any[])
      .map((s) => {
        const resp = respBySurvey.get(s.id);
        const is_active = s.status === 'active';
        const is_submitted = !!resp?.is_submitted;
        const can_answer = is_active && !is_submitted;

        return {
          survey: {
            id: s.id,
            title: s.title,
            status: s.status,
            created_at: s.created_at,
            updated_at: s.updated_at,
            open_at: s.open_at ?? null,
            close_at: s.close_at ?? null,
          },
          assignment: assigns.find((a: any) => a.survey_id === s.id) ?? null,
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
          link: `/teacher/surveys/${s.id}`, // trang làm khảo sát của GV (bạn có thể thêm sau)
        };
      })
      .filter((it) => {
        if (activeFilter === 'true' && !it.is_active) return false;
        if (activeFilter === 'false' && it.is_active) return false;
        if (submittedFilter === 'true' && !it.is_submitted) return false;
        if (submittedFilter === 'false' && it.is_submitted) return false;
        return true;
      })
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
