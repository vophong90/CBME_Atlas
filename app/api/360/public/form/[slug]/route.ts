export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> } // 👈 params giờ là Promise
) {
  const { slug } = await ctx.params;        // 👈 nhớ await

  const sb = createServiceClient();

  // Lấy form
  const { data: form, error: ferr } = await sb
    .from('eval360_forms')
    .select(
      'id, title, group_code, rubric_id, framework_id, course_code, status, public_enabled, public_slug'
    )
    .eq('public_slug', slug)
    .eq('status', 'active')
    .eq('public_enabled', true)
    .single();

  if (ferr || !form) {
    return NextResponse.json(
      { error: 'Form không tồn tại hoặc không mở công khai.' },
      { status: 404 }
    );
  }

  // Lấy rubric định nghĩa
  const { data: rub, error: rerr } = await sb
    .from('rubrics')
    .select('id, title, threshold, definition, framework_id, course_code')
    .eq('id', form.rubric_id)
    .single();

  if (rerr || !rub) {
    return NextResponse.json(
      { error: 'Rubric không tồn tại.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    form: {
      id: form.id,
      title: form.title,
      group_code: form.group_code,
      rubric_id: form.rubric_id,
      framework_id: form.framework_id,
      course_code: form.course_code,
      slug: form.public_slug,
    },
    rubric: rub,
  });
}
