// app/api/360/submit/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer'; // SERVICE ROLE!

export async function POST(req: Request) {
  try {
    const sb = createServiceClient(); // bypass RLS
    const { request_id, rubric_id, overall_comment, items } = await req.json();

    if (!request_id || !rubric_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Thiếu request_id/rubric_id/items' }, { status: 400 });
    }

    // Kiểm tra request hợp lệ + map sang rubric của form
    const { data: row, error: rerr } = await sb
      .from('evaluation_requests')
      .select('id, form_id')
      .eq('id', request_id)
      .single();
    if (rerr || !row) return NextResponse.json({ error: 'Request không tồn tại' }, { status: 400 });

    const { data: frm, error: ferr } = await sb
      .from('eval360_forms')
      .select('id, rubric_id')
      .eq('id', row.form_id)
      .single();
    if (ferr || !frm) return NextResponse.json({ error: 'Form không tồn tại' }, { status: 400 });
    if (frm.rubric_id !== rubric_id) {
      return NextResponse.json({ error: 'Rubric không khớp với form' }, { status: 400 });
    }

    // Ghi submission (tùy schema dự án của bạn: ví dụ evaluation_submissions + evaluation_submission_items)
    const { data: sub, error: serr } = await sb
      .from('evaluation_submissions')
      .insert({
        request_id,
        rubric_id,
        overall_comment: overall_comment ?? null,
      })
      .select('id')
      .single();
    if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });

    // Ghi từng item
    const detailRows = items.map((it: any) => ({
      submission_id: sub.id,
      item_key: String(it.item_key),
      selected_level: String(it.selected_level),
      score: it.score ?? null,
      comment: it.comment ?? null,
    }));

    const { error: derr } = await sb.from('evaluation_submission_items').insert(detailRows);
    if (derr) return NextResponse.json({ error: derr.message }, { status: 400 });

    return NextResponse.json({ ok: true, submission_id: sub.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
