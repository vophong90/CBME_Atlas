import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseServer'


const SurveySchema = z.object({
title: z.string().min(1),
intro: z.string().optional(),
status: z.enum(['active','inactive']).default('inactive')
})


export async function GET() {
const sb = await createServerClient()
const { data, error } = await sb.from('surveys').select('*').order('created_at', { ascending: false })
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ surveys: data ?? [] })
}


export async function POST(req: Request) {
const body = await req.json().catch(() => ({}))
const parsed = SurveySchema.safeParse(body)
if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
const sb = await createServerClient()
const { data, error } = await sb.from('surveys').insert({ ...parsed.data }).select().single()
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ survey: data })
}
