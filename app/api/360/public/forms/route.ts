export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('eval360_forms')
    .select('id, title, group_code, rubric_id, framework_id, course_code, status, public_enabled, public_slug, updated_at')
    .eq('status', 'active')
    .eq('public_enabled', true)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Chỉ trả về các thông tin cần thiết cho list
  return NextResponse.json({
    items: (data || []).map(f => ({
      title: f.title,
      group_code: f.group_code,
      slug: f.public_slug,
      updated_at: f.updated_at
    }))
  });
}
