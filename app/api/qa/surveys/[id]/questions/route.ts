import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseServer'


const QSchema = z.object({
id: z.string().uuid().optional(),
order_no: z.number().int().nonnegative(),
label: z.string().min(1),
type: z.enum(['single','multi','text']),
options: z.any().optional(),
required: z.boolean().optional()
})


export async function PATCH(req: Request, { params }: { params: { id: string } }) {
const body = await req.json().catch(() => ({}))
const { create = [], update = [], remove = [] } = body as any
const sb = createServerClient()


const inserts = (create as any[]).map((q) => ({ ...QSchema.parse(q), survey_id: params.id }))
const updates = (update as any[]).map((q) => QSchema.extend({ id: z.string().uuid() }).parse(q))
const removals = (remove as string[]).filter(Boolean)


if (inserts.length) {
const { error } = await sb.from('survey_questions').insert(inserts)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
}
for (const u of updates) {
const { error } = await sb.from('survey_questions').update({
order_no: u.order_no,
label: u.label,
type: u.type,
options: u.options ?? null,
required: u.required ?? false
}).eq('id', u.id)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
}
if (removals.length) {
const { error } = await sb.from('survey_questions').delete().in('id', removals)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
}
return NextResponse.json({ ok: true })
}
