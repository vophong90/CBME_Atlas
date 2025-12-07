import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { createServerClient } from '@/lib/supabaseServer';

const Body = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }   // nếu muốn chuẩn Next hơn có thể bỏ Promise, nhưng tạm để cũng được
) {
  const { id } = await ctx.params;           // lấy id từ params

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  // ⭐⭐ PHẢI await
  const sb = await createServerClient();

  const { data: rows, error: e1 } = await sb
    .from('qa_participants_view')
    .select('user_id, user_email, user_name, role')
    .in('user_id', parsed.data.user_ids);

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  const recs =
    rows?.map((r) => ({
      survey_id: id,
      user_id: r.user_id,
      user_email: r.user_email,
      user_name: r.user_name,
      user_role: r.role,
      token: randomBytes(24).toString('hex'),
    })) ?? [];

  const { error } = await sb
    .from('survey_assignments')
    .upsert(recs, { onConflict: 'survey_id,user_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: recs.length });
}
