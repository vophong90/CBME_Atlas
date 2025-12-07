export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type Question = {
  id: string;
  text: string;
  qtype: 'single' | 'multi' | 'text';
  sort_order: number;
};

type AnswerRow = {
  response_id: string;
  question_id: string;
  option: string | null;
  free_text: string | null;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }   // 👈 params là Promise
) {
  const { id } = await ctx.params;           // 👈 lấy id
  const surveyId = id;

  const sb = createServerClient(); // RLS theo user hiện tại

  // 1) Survey
  const surveyRes = await sb
    .from('surveys')
    .select('id,title,status,created_by,created_at')
    .eq('id', surveyId)
    .single();

  if (surveyRes.error) {
    const status = surveyRes.error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: surveyRes.error.message }, { status });
  }
  const survey = surveyRes.data;

  // 2) Questions
  const qsRes = await sb
    .from('survey_questions')
    .select('id,text,qtype,sort_order')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: true });

  if (qsRes.error && qsRes.error.code !== '42P01') {
    return NextResponse.json({ error: qsRes.error.message }, { status: 500 });
  }
  const questions = (qsRes.data ?? []) as Question[];

  // 3) Chỉ lấy responses đã nộp
  const respRes = await sb
    .from('survey_responses')
    .select('id')
    .eq('survey_id', surveyId)
    .eq('is_submitted', true);

  if (respRes.error && respRes.error.code !== '42P01') {
    return NextResponse.json({ error: respRes.error.message }, { status: 500 });
  }
  const responseIds: string[] = (respRes.data ?? []).map((r: any) => r.id);

  // 4) Answers theo responseIds
  let answers: AnswerRow[] = [];
  if (responseIds.length > 0) {
    const ansRes = await sb
      .from('survey_answers')
      .select('response_id,question_id,option,free_text')
      .in('response_id', responseIds);
    if (ansRes.error && ansRes.error.code !== '42P01') {
      return NextResponse.json({ error: ansRes.error.message }, { status: 500 });
    }
    answers = (ansRes.data ?? []) as AnswerRow[];
  }

  // 5) Tổng hợp
  type Agg = { total: number; choices: Map<string, number>; texts: string[] };

  const byQ = new Map<string, Agg>();
  for (const q of questions)
    byQ.set(q.id, { total: 0, choices: new Map(), texts: [] });

  for (const a of answers) {
    const agg =
      byQ.get(a.question_id) ??
      { total: 0, choices: new Map<string, number>(), texts: [] };
    // mỗi bản ghi answer (option hoặc free_text) tính là 1 lần trả lời cho câu đó
    agg.total += 1;
    if (a.option != null && a.option !== '') {
      agg.choices.set(a.option, (agg.choices.get(a.option) ?? 0) + 1);
    }
    if (a.free_text != null && a.free_text.trim() !== '') {
      agg.texts.push(a.free_text);
    }
    byQ.set(a.question_id, agg);
  }

  const out = questions.map((q) => {
    const item = byQ.get(q.id);
    if (!item) {
      return {
        question_id: q.id,
        text: q.text,
        qtype: q.qtype,
        sort_order: q.sort_order,
        total: 0,
        choices: [] as Array<{ value: string; count: number; percent: number }>,
        texts: [] as string[],
      };
    }
    const total = Math.max(item.total, 1);

    const entries = Array.from<[string, number]>(item.choices.entries());
    const choices = entries.map(([value, count]) => ({
      value,
      count,
      percent: +((100 * count) / total).toFixed(1),
    }));

    return {
      question_id: q.id,
      text: q.text,
      qtype: q.qtype,
      sort_order: q.sort_order,
      total: item.total,
      choices,
      texts: item.texts,
    };
  });

  return NextResponse.json({ survey, questions: out });
}
