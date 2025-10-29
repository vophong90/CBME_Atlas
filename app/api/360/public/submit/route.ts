export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

type SubmitBody = {
  slug: string;
  target_mssv: string;
  answers: Record<string, string>; // { rowId: columnKey }
  note?: string;
  rater_name?: string;
  rater_relation?: string;
  consent?: boolean;
};

export async function POST(req: Request) {
  const sb = createServiceClient();
  const ua = req.headers.get('user-agent') || '';

  const body = await req.json().catch(() => ({})) as SubmitBody;
  const { slug, target_mssv, answers, note, rater_name, rater_relation, consent } = body || {};

  if (!slug || !target_mssv || !answers || typeof answers !== 'object')
    return NextResponse.json({ error: 'Thiếu slug/target_mssv/answers' }, { status: 400 });
  if (!consent)
    return NextResponse.json({ error: 'Bạn cần đồng ý đồng thuận (consent)' }, { status: 400 });

  // 1) Tìm form công khai
  const { data: form, error: ferr } = await sb
    .from('eval360_forms')
    .select('id, title, group_code, rubric_id, framework_id, course_code, status, public_enabled, public_slug')
    .eq('public_slug', slug)
    .eq('status', 'active')
    .eq('public_enabled', true)
    .single();

  if (ferr || !form) return NextResponse.json({ error: 'Form không tồn tại/đang đóng.' }, { status: 404 });

  // 2) Lấy rubric định nghĩa
  const { data: rub, error: rerr } = await sb
    .from('rubrics')
    .select('id, title, threshold, definition, framework_id, course_code')
    .eq('id', form.rubric_id)
    .single();

  if (rerr || !rub) return NextResponse.json({ error: 'Rubric không tồn tại.' }, { status: 404 });

  // 3) Tra MSSV -> student_id
  const { data: stu } = await sb
    .from('students')
    .select('id, mssv, framework_id')
    .eq('mssv', target_mssv)
    .maybeSingle();

  if (!stu) return NextResponse.json({ error: 'Không tìm thấy MSSV.' }, { status: 400 });

  // 4) Tra course_id nếu có course_code
  let course_id: string | null = null;
  if (form.course_code && form.framework_id) {
    const { data: course } = await sb
      .from('courses')
      .select('id')
      .eq('framework_id', form.framework_id)
      .eq('course_code', form.course_code)
      .maybeSingle();
    course_id = course?.id ?? null;
  }

  // 5) Tạo observation (kind = 'eval360', rater_id = null, note kèm tên người chấm/quan hệ)
  const combinedNote = [
    note?.trim() || '',
    rater_name ? `Rater: ${rater_name}` : '',
    rater_relation ? `Relation: ${rater_relation}` : ''
  ].filter(Boolean).join(' | ');

  const { data: obs, error: oerr } = await sb
    .from('observations')
    .insert({
      student_id: stu.id,
      course_id: course_id,      // có thể null
      rubric_id: form.rubric_id,
      rater_id: null,
      observed_at: new Date().toISOString(),
      note: combinedNote || null,
      kind: 'eval360'
    })
    .select('id, observed_at')
    .single();

  if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });

  // 6) Ghi điểm từng tiêu chí → observation_item_scores
  // rub.definition = { columns: [{key,label},...], rows: [{id,label},...] }
  const colIndex: Record<string, { rank: number; label: string }> = {};
  (rub.definition?.columns || []).forEach((c: any, i: number) => {
    colIndex[String(c.key)] = { rank: i + 1, label: String(c.label || c.key) };
  });

  const scoreRows = (rub.definition?.rows || []).map((row: any) => {
    const selectedKey = answers[row.id] as string | undefined;
    const meta = selectedKey ? colIndex[selectedKey] : undefined;
    return {
      observation_id: obs.id,
      rubric_item_id: row.id,                 // dùng id của row trong rubric.definition
      level_rank: meta?.rank ?? null,
      level_label: meta?.label ?? null,
      selected_level: selectedKey ?? null,
      item_key: row.id,
      raw_score: null,
      score: null,
      comment: null
    };
  });

  if (scoreRows.length) {
    const { error: serr } = await sb.from('observation_item_scores').insert(scoreRows);
    if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });
  }

  // 7) Log submission công khai
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || '';
  const ip_hash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : null;

  await sb.from('eval360_public_submissions').insert({
    form_id: form.id,
    rubric_id: form.rubric_id,
    target_mssv,
    answers,
    note: combinedNote || null,
    rater_name: rater_name || null,
    rater_relation: rater_relation || null,
    consent: !!consent,
    ip_hash,
    user_agent: ua
  });

  return NextResponse.json({
    ok: true,
    observation_id: obs.id,
    observed_at: obs.observed_at
  });
}
