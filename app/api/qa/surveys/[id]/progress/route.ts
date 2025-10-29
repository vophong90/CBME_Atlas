export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const surveyId = params.id;
  const sb = createServerClient();

  // 1) Lấy assignments theo survey
  const asgRes = await sb
    .from('survey_assignments')
    .select('id,survey_id,assigned_to,role,department,cohort,unit,invited_at,last_reminded_at,created_at')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: true });

  if (asgRes.error) {
    // Nếu RLS chặn, trả lỗi rõ ràng
    return NextResponse.json({ error: asgRes.error.message }, { status: 500 });
  }
  const assignments = (asgRes.data ?? []) as {
    id: string;
    survey_id: string;
    assigned_to: string;
    role: 'lecturer'|'student'|'support'|null;
    department: string|null;
    cohort: string|null;
    unit: string|null;
    invited_at: string|null;
    last_reminded_at: string|null;
  }[];

  const assigneeIds = Array.from(new Set(assignments.map(a => a.assigned_to))).filter(Boolean);

  // 2) Lấy responses đã nộp cho survey này
  const respRes = await sb
    .from('survey_responses')
    .select('respondent_id,is_submitted,submitted_at')
    .eq('survey_id', surveyId);

  if (respRes.error && respRes.error.code !== '42P01') {
    return NextResponse.json({ error: respRes.error.message }, { status: 500 });
  }
  const respMap = new Map<string, { is_submitted: boolean; submitted_at: string|null }>();
  for (const r of (respRes.data ?? []) as any[]) {
    respMap.set(r.respondent_id, { is_submitted: !!r.is_submitted, submitted_at: r.submitted_at ?? null });
  }

  // 3) Làm giàu tên/email từ view nếu có (qa_participants_view)
  let pMap = new Map<string, { email: string|null; name: string|null; role: string|null }>();
  if (assigneeIds.length > 0) {
    const partsRes = await sb
      .from('qa_participants_view')
      .select('user_id,email,name,role,department_id,unit_id,framework_id')
      .in('user_id', assigneeIds as any);

    // Nếu view không có cũng không sao, chỉ bỏ qua enrich
    if (!partsRes.error) {
      pMap = new Map(
        (partsRes.data ?? []).map((p: any) => [
          p.user_id,
          { email: p.email ?? null, name: p.name ?? null, role: p.role ?? null },
        ])
      );
    }
  }

  // 4) Gộp dữ liệu
  const out = assignments.map((a) => {
    const p = pMap.get(a.assigned_to);
    const r = respMap.get(a.assigned_to);
    return {
      ...a,
      email: p?.email ?? null,
      name: p?.name ?? null,
      // giữ nguyên role của assignment để thống nhất UI lọc
      is_submitted: r?.is_submitted ?? false,
      submitted_at: r?.submitted_at ?? null,
    };
  });

  const total = out.length;
  const submitted = out.filter(x => x.is_submitted).length;
  const pending = total - submitted;

  return NextResponse.json({ total, submitted, pending, assignments: out });
}
