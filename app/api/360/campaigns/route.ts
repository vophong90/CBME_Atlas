// app/api/360/campaigns/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const supabase = createServiceClient();
    const url = new URL(req.url);
    const form_id = url.searchParams.get('form_id') || '';

    if (!form_id) return NextResponse.json({ error: 'Thiếu form_id' }, { status: 400 });

    // Lấy form để biết rubric_id, framework_id/course_code
    const { data: form, error: formErr } = await supabase
      .from('eval360_forms')
      .select('id, rubric_id, framework_id, course_code, title')
      .eq('id', form_id)
      .maybeSingle();
    if (formErr) throw formErr;
    if (!form) return NextResponse.json({ error: 'Form không tồn tại' }, { status: 404 });

    let { data: camps, error: campsErr } = await supabase
      .from('evaluation_campaigns')
      .select('id, name, rubric_id, framework_id, course_code, start_at, end_at, created_by')
      .eq('rubric_id', form.rubric_id)
      .order('start_at', { ascending: false });
    if (campsErr) throw campsErr;

    // Chỉ giữ campaign khớp khung/học phần nếu campaign có set
    camps = (camps || []).filter(c => {
      if (c.framework_id && String(c.framework_id) !== String(form.framework_id || '')) return false;
      if (c.course_code && String(c.course_code) !== String(form.course_code || '')) return false;
      return true;
    });

    return NextResponse.json({ items: camps || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const form_id    = String(body?.form_id || '');
    const name       = String(body?.name || '');
    const start_at   = String(body?.start_at || '');
    const end_at     = String(body?.end_at || '');
    const created_by = String(body?.created_by || ''); // frontend gửi profile.user_id

    if (!form_id || !name || !start_at || !end_at || !created_by) {
      return NextResponse.json({ error: 'Thiếu trường bắt buộc' }, { status: 400 });
    }

    const { data: form, error: formErr } = await supabase
      .from('eval360_forms')
      .select('id, rubric_id, framework_id, course_code')
      .eq('id', form_id)
      .maybeSingle();
    if (formErr) throw formErr;
    if (!form) return NextResponse.json({ error: 'Form không tồn tại' }, { status: 404 });

    const payload = {
      name,
      rubric_id: form.rubric_id,
      framework_id: form.framework_id,
      course_code: form.course_code,
      start_at,
      end_at,
      created_by,
    };

    const { data: ins, error: insErr } = await supabase
      .from('evaluation_campaigns')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (insErr) throw insErr;

    return NextResponse.json({ id: ins?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = createServiceClient();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'close_now') {
      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('evaluation_campaigns')
        .update({ end_at: nowIso })
        .eq('id', id);
      if (upErr) throw upErr;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
