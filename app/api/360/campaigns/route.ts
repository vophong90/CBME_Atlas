// app/api/360/campaigns/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// Kiểu payload mở (tuỳ cột bạn có trong bảng evaluation_campaigns)
type UpsertPayload = Record<string, any>;

/**
 * GET /api/360/campaigns?id=...&limit=...&q=...
 * - Nếu có id: trả về 1 campaign
 * - Nếu không: trả danh sách (có thể filter q, limit)
 */
export async function GET(req: Request) {
  const db = createServiceClient(); // luôn có, nếu thiếu ENV sẽ throw và vào catch

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const q = url.searchParams.get('q')?.trim();
    const limit = Number(url.searchParams.get('limit') ?? '100');

    if (id) {
      const { data, error } = await db
        .from('evaluation_campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item: data });
    }

    let query = db.from('evaluation_campaigns').select('*').order('created_at', { ascending: false }).limit(limit);
    if (q) {
      // tuỳ DB, có thể đổi sang ilike nhiều cột
      query = query.ilike('name', `%${q}%`);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/360/campaigns
 * body: { id?: string, ...payload }
 * - Có id  -> UPDATE + return row
 * - Không  -> INSERT + return row
 */
export async function POST(req: Request) {
  const db = createServiceClient();

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string } & UpsertPayload;
    const { id, ...payload } = body || {};

    if (!payload || Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    if (id) {
      const { data, error } = await db
        .from('evaluation_campaigns')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    } else {
      const { data, error } = await db
        .from('evaluation_campaigns')
        .insert(payload)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/360/campaigns?id=...
 */
export async function DELETE(req: Request) {
  const db = createServiceClient();

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await db.from('evaluation_campaigns').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
