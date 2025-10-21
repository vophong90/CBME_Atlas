export const runtime = 'nodejs';           // XLSX cần Node, không chạy ở Edge
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const surveyId = params.id;

  // Lấy Supabase server client (tương thích nhiều cách export)
  let sb: any = null;
  try {
    const mod: any = await import('@/lib/supabaseServer');
    if (typeof mod.createServerClient === 'function') sb = mod.createServerClient();
    else if (mod.supabaseAdmin) sb = mod.supabaseAdmin;
    else if (typeof mod.getSupabase === 'function') sb = mod.getSupabase();
  } catch {
    return NextResponse.json({ error: 'Không tải được Supabase server client' }, { status: 500 });
  }
  if (!sb) {
    return NextResponse.json({ error: 'Supabase server client không khả dụng' }, { status: 500 });
  }

  // Dynamic import để tránh lỗi bundle
  const xlsxMod: any = await import('xlsx');
  const XLSX = xlsxMod.default ?? xlsxMod;

  // 1) Lấy survey, câu hỏi, responses
  const [surveyRes, qsRes, respRes] = await Promise.all([
    sb.from('surveys').select('id,title,status,created_at').eq('id', surveyId).single(),
    sb
      .from('survey_questions')
      .select('id,text,qtype,options,sort_order')
      .eq('survey_id', surveyId)
      .order('sort_order', { ascending: true }),
    sb.from('survey_responses').select('id,respondent_id,is_submitted,submitted_at').eq('survey_id', surveyId),
  ]);

  if (surveyRes.error) {
    const code = surveyRes.error.code === 'PGRST116' ? 404 : 500; // not found
    return NextResponse.json({ error: surveyRes.error.message }, { status: code });
  }
  if (!surveyRes.data) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  const questions = (qsRes.error && qsRes.error.code === '42P01') ? [] : (qsRes.data ?? []);
  if (qsRes.error && qsRes.error.code !== '42P01') {
    return NextResponse.json({ error: qsRes.error.message }, { status: 500 });
  }

  const responses = (respRes.error && respRes.error.code === '42P01') ? [] : (respRes.data ?? []);
  if (respRes.error && respRes.error.code !== '42P01') {
    return NextResponse.json({ error: respRes.error.message }, { status: 500 });
  }

  // 2) Lấy answers theo các response_id (nếu có)
  let answers: Array<{ response_id: string; question_id: string; option: string | null; free_text: string | null }> = [];
  const responseIds = responses.map((r: any) => r.id);
  if (responseIds.length > 0) {
    const ansRes = await sb
      .from('survey_answers')
      .select('response_id,question_id,option,free_text')
      .in('response_id', responseIds);

    if (ansRes.error && ansRes.error.code !== '42P01') {
      return NextResponse.json({ error: ansRes.error.message }, { status: 500 });
    }
    answers = (ansRes.data ?? []) as any[];
  }

  // 3) Chuẩn bị dữ liệu sheet Responses: mỗi dòng = 1 response
  const qOrder = questions.map((q: any) => q.id);
  const qLabel = new Map<string, string>(questions.map((q: any) => [q.id, q.text]));

  const rows: any[] = [];
  for (const r of responses) {
    const row: any = {
      response_id: r.id,
      respondent_id: r.respondent_id,
      is_submitted: r.is_submitted,
      submitted_at: r.submitted_at,
    };
    const ansForResp = answers.filter((a) => a.response_id === r.id);
    for (const qid of qOrder) {
      const q = questions.find((qq: any) => qq.id === qid);
      const label = qLabel.get(qid) ?? qid;
      if (q?.qtype === 'text') {
        const a = ansForResp.find((a) => a.question_id === qid && a.free_text != null);
        row[label] = a?.free_text ?? '';
      } else {
        const vals = ansForResp
          .filter((a) => a.question_id === qid && a.option != null)
          .map((a) => String(a.option));
        row[label] = vals.join('; ');
      }
    }
    rows.push(row);
  }

  // 4) Tạo workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Responses');

  const questionSheet = questions.map((q: any) => ({
    sort_order: q.sort_order,
    text: q.text,
    qtype: q.qtype,
    options: q.options ? JSON.stringify(q.options) : '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionSheet), 'Questions');

  // 5) Trả file .xlsx
  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `survey_${surveyId}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
