export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

const ROLE_LABELS: Record<string, string> = {
  lecturer: 'Giảng viên',
  student: 'Sinh viên',
  support: 'Hỗ trợ',
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }   // 👈 params là Promise
) {
  const { id } = await ctx.params;           // 👈 lấy id từ params
  const surveyId = id;

  const sb = await createServerClient();

  // 1) Assignments
  const asgRes = await sb
    .from('survey_assignments')
    .select(
      'id,survey_id,assigned_to,role,department,cohort,unit,invited_at,last_reminded_at,created_at'
    )
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: true });

  if (asgRes.error) {
    return NextResponse.json({ error: asgRes.error.message }, { status: 500 });
  }

  const assignments = (asgRes.data ?? []) as {
    id: string;
    survey_id: string;
    assigned_to: string;
    role: 'lecturer' | 'student' | 'support' | null;
    department: string | null; // có thể là id bộ môn
    cohort: string | null;     // có thể là id framework
    unit: string | null;       // có thể là id đơn vị
    invited_at: string | null;
    last_reminded_at: string | null;
  }[];

  const assigneeIds = Array.from(
    new Set(assignments.map((a) => a.assigned_to))
  ).filter(Boolean) as string[];
  const deptIds = Array.from(
    new Set(assignments.map((a) => a.department).filter(Boolean))
  ) as string[];
  const cohortIds = Array.from(
    new Set(assignments.map((a) => a.cohort).filter(Boolean))
  ) as string[];
  const unitIds = Array.from(
    new Set(assignments.map((a) => a.unit).filter(Boolean))
  ) as string[];

  // 2) Responses
  const respRes = await sb
    .from('survey_responses')
    .select('respondent_id,is_submitted,submitted_at')
    .eq('survey_id', surveyId);

  if (respRes.error && respRes.error.code !== '42P01') {
    return NextResponse.json({ error: respRes.error.message }, { status: 500 });
  }

  const respMap = new Map<
    string,
    { is_submitted: boolean; submitted_at: string | null }
  >();
  for (const r of (respRes.data ?? []) as any[]) {
    respMap.set(r.respondent_id, {
      is_submitted: !!r.is_submitted,
      submitted_at: r.submitted_at ?? null,
    });
  }

  // 3) Enrich tên/email từ view (nếu có)
  let pMap = new Map<
    string,
    { email: string | null; name: string | null; role: string | null }
  >();
  if (assigneeIds.length > 0) {
    const partsRes = await sb
      .from('qa_participants_view')
      .select('user_id,email,name,role,department_id,unit_id,framework_id')
      .in('user_id', assigneeIds as any);

    if (!partsRes.error) {
      pMap = new Map(
        (partsRes.data ?? []).map((p: any) => [
          p.user_id,
          {
            email: p.email ?? null,
            name: p.name ?? null,
            role: p.role ?? null,
          },
        ])
      );
    }
  }

  // 4) Map tên Bộ môn (departments)
  let deptNameMap = new Map<string, string>();
  if (deptIds.length > 0) {
    const dres = await sb
      .from('departments')
      .select('id,name')
      .in('id', deptIds as any);
    if (!dres.error) {
      deptNameMap = new Map(
        (dres.data ?? []).map((d: any) => [d.id, d.name ?? d.id])
      );
    }
  }

  // 5) Map nhãn Khung (curriculum_frameworks)
  let fwLabelMap = new Map<string, string>();
  if (cohortIds.length > 0) {
    const fres = await sb
      .from('curriculum_frameworks')
      .select('id,doi_tuong,chuyen_nganh,nien_khoa')
      .in('id', cohortIds as any);
    if (!fres.error) {
      fwLabelMap = new Map(
        (fres.data ?? []).map((f: any) => {
          const label = [f.nien_khoa, f.doi_tuong, f.chuyen_nganh]
            .filter(Boolean)
            .join(' • ');
          return [f.id, label || f.id];
        })
      );
    }
  }

  // 6) Map tên Unit (nếu có bảng units)
  let unitNameMap = new Map<string, string>();
  if (unitIds.length > 0) {
    const ures = await sb.from('units').select('id,name').in('id', unitIds as any);
    if (!ures.error && ures.data) {
      unitNameMap = new Map(
        (ures.data ?? []).map((u: any) => [u.id, u.name ?? u.id])
      );
    }
  }

  // 7) Gộp ra output có nhãn tiếng Việt
  const out = assignments.map((a) => {
    const p = pMap.get(a.assigned_to);
    const r = respMap.get(a.assigned_to);

    const role_label = a.role ? ROLE_LABELS[a.role] ?? a.role : '-';
    const department_name = a.department
      ? deptNameMap.get(a.department) ?? a.department
      : null;
    const cohort_label = a.cohort
      ? fwLabelMap.get(a.cohort) ?? a.cohort
      : null;
    const unit_name = a.unit
      ? unitNameMap.get(a.unit) ?? a.unit
      : null;

    // org_label: cột "Bộ môn / Khung" tùy vào vai trò
    const org_label =
      a.role === 'lecturer'
        ? department_name || '-'
        : a.role === 'student'
        ? cohort_label || '-'
        : unit_name || department_name || cohort_label || '-';

    return {
      ...a,
      email: p?.email ?? null,
      name: p?.name ?? null,
      is_submitted: r?.is_submitted ?? false,
      submitted_at: r?.submitted_at ?? null,
      role_label,
      department_name,
      cohort_label,
      unit_name,
      org_label,
    };
  });

  const total = out.length;
  const submitted = out.filter((x) => x.is_submitted).length;
  const pending = total - submitted;

  return NextResponse.json({ total, submitted, pending, assignments: out });
}
