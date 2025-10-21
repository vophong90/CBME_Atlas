// app/api/360/requests/bulk/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type AnyObject = Record<string, any>;

export async function POST(req: Request) {
  const db = createServiceClient(); // luôn là SupabaseClient (nếu thiếu ENV sẽ throw → rơi vào catch)

  try {
    const body = (await req.json().catch(() => null)) as AnyObject | null;
    if (!body) {
      return NextResponse.json({ error: 'Missing JSON body' }, { status: 400 });
    }

    // Chấp nhận nhiều tên trường để linh hoạt: rows | items | requests
    let rows: any[] =
      (Array.isArray(body.rows) && body.rows) ||
      (Array.isArray(body.items) && body.items) ||
      (Array.isArray(body.requests) && body.requests) ||
      [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows to insert' }, { status: 400 });
    }

    // (Tuỳ yêu cầu) bạn có thể map/chuẩn hoá dữ liệu ở đây
    // rows = rows.map(r => ({ ...r, created_at: new Date().toISOString() }))

    const { data, error } = await db
      .from('evaluation_requests')
      .insert(rows)
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
