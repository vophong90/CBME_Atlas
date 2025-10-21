import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseServer'


const PatchSchema = z.object({
title: z.string().optional(),
intro: z.string().nullable().optional(),
status: z.enum(['active','inactive']).optional()
})


export async function GET(_req: Request, { params }: { params: { id: string } }) {
const sb = createServerClient()
const [{ data: survey }, { data: questions }] = await Promise.all([
sb.from('surveys').select('*').eq('id', params.id).single(),
sb.from('survey_questions').select('*').eq('survey_id', params.id).order('order_no')
])
if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
return NextResponse.json({ survey, questions: questions ?? [] })
}


export async function PATCH(req: Request, { params }: { params: { id: string } }) {
const body = await req.json().catch(() => ({}))
const parsed = PatchSchema.safeParse(body)
if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
const sb = createServerClient()
const { data, error } = await sb.from('surveys').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', params.id).select().single()
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ survey: data })
}


export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
const sb = createServerClient()
const { error } = await sb.from('surveys').delete().eq('id', params.id)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ ok: true })
}
