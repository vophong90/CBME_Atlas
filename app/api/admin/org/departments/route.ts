// app/api/admin/org/departments/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET ?q=...  -> list departments (code/name ilike)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  try {
    let query = supabaseAdmin.from('departments').select('id,code,name,is_active').order('name');
    if (q) {
      query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}

// POST { code, name, is_active? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, is_active = true } = body || {};
    if (!code || !name) return NextResponse.json({ error: 'Missing code/name' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert({ code, name, is_active })
      .select('id,code,name,is_active')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}

// PUT { id, code?, name?, is_active? }
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, code, name, is_active } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const updates: any = {};
    if (code !== undefined) updates.code = code;
    if (name !== undefined) updates.name = name;
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    const { data, error } = await supabaseAdmin
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select('id,code,name,is_active')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}

// DELETE ?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const { error } = await supabaseAdmin.from('departments').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // tất cả staff đang tham chiếu tới department này sẽ tự động SET NULL do FK ON DELETE SET NULL
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
