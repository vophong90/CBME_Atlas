import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'


export async function GET(_req: Request, { params }: { params: { id: string } }) {
const sb = createServerClient()
const { data: asg, error } = await sb
.from('survey_assignments')
.select('id, user_id, user_email, user_name, user_role, invited_at, submitted_at, status')
.eq('survey_id', params.id)
.order('user_name')
if (error) return NextResponse.json({ error: error.message }, { status: 500 })


const submitted = (asg ?? []).filter((a) => !!a.submitted_at)
const pending = (asg ?? []).filter((a) => !a.submitted_at)
return NextResponse.json({ total: asg?.length ?? 0, submitted: submitted.length, pending: pending.length, assignments: asg ?? [] })
}
