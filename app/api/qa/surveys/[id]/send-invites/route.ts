import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseServer'


const Body = z.object({ assignment_ids: z.array(z.string().uuid()).min(1), message: z.string().min(1) })


async function sendEmail(to: string, subject: string, html: string) {
if (process.env.RESEND_API_KEY) {
const r = await fetch('https://api.resend.com/emails', {
method: 'POST',
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html })
})
if (!r.ok) throw new Error(`Resend error ${r.status}`)
return
}
throw new Error('No email provider configured')
}


export async function POST(req: Request, { params }: { params: { id: string } }) {
const parsed = Body.safeParse(await req.json())
if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
const sb = createServerClient()
const { data: rows, error } = await sb
.from('survey_assignments')
.select('id, user_email, user_name, token')
.in('id', parsed.data.assignment_ids)
.eq('survey_id', params.id)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })


const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
const subject = 'Mời tham gia khảo sát đảm bảo chất lượng'


for (const r of rows ?? []) {
const link = `${baseUrl}/survey/${params.id}?t=${r.token}`
const html = `<p>Chào ${r.user_name ?? ''},</p><p>${parsed.data.message}</p><p><a href="${link}">Bấm vào đây để mở khảo sát</a></p>`
await sendEmail(r.user_email, subject, html)
}


await sb.from('survey_assignments').update({ invited_at: new Date().toISOString(), status: 'invited' }).in('id', parsed.data.assignment_ids)
return NextResponse.json({ sent: rows?.length ?? 0 })
}
