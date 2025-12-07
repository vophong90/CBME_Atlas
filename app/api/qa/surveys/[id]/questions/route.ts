import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabaseServer';

const QType = z.enum(['single', 'multi', 'text']);

const CreateSchema = z.object({
  text: z.string().min(1),
  qtype: QType,
  sort_order: z.number().int().nonnegative().default(0),
  required: z.boolean().default(false),
  options: z.any().nullable().optional(), // JSONB
});

const UpdateSchema = CreateSchema.extend({
  id: z.string().uuid(),
});

const PatchSchema = z.object({
  create: z.array(CreateSchema).optional().default([]),
  update: z.array(UpdateSchema).optional().default([]),
  remove: z.array(z.string().uuid()).optional().default([]),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }          // 👈 params là Promise
) {
  const { id } = await ctx.params;                  // 👈 lấy id
  const sb = createServerClient();
  const { data, error } = await sb
    .from('survey_questions')
    .select('*')
    .eq('survey_id', id)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questions: data ?? [] });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }          // 👈 params là Promise
) {
  const { id } = await ctx.params;                  // 👈 lấy id

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  const { create, update, remove } = parsed.data;
  const sb = createServerClient();

  // 1) Inserts
  if (create.length) {
    const rows = create.map((q) => ({
      survey_id: id,
      text: q.text,
      qtype: q.qtype,
      sort_order: q.sort_order,
      required: q.required ?? false,
      options: q.options ?? null,
    }));
    const { error } = await sb.from('survey_questions').insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 2) Updates
  for (const q of update) {
    const { error } = await sb
      .from('survey_questions')
      .update({
        text: q.text,
        qtype: q.qtype,
        sort_order: q.sort_order,
        required: q.required ?? false,
        options: q.options ?? null,
      })
      .eq('id', q.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 3) Deletes
  if (remove.length) {
    const { error } = await sb
      .from('survey_questions')
      .delete()
      .in('id', remove);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
