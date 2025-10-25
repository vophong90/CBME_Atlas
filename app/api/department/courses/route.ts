// app/api/department/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const db = createServiceClient();
  try {
    const { searchParams } = req.nextUrl;
    const framework_id = searchParams.get('framework_id') || '';
    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    const { data, error } = await db
      .from('courses')
      .select('course_code,course_name')
      .eq('framework_id', framework_id)
      .order('course_code', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
