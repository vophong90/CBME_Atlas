// app/api/academic-affairs/framework/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  const sb = createServiceClient();
  const { data, error } = await sb.from('curriculum_frameworks')
    .select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { doi_tuong, chuyen_nganh, nien_khoa } = body || {};
  if (!doi_tuong || !chuyen_nganh || !nien_khoa)
    return NextResponse.json({ error: 'Thiếu trường bắt buộc' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb.from('curriculum_frameworks').insert({
    doi_tuong, chuyen_nganh, nien_khoa,
  }).select('*').single();
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb.from('curriculum_frameworks').delete().eq('id', id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
