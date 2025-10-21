import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'


export async function GET(req: Request) {
const { searchParams } = new URL(req.url)
const role = searchParams.get('role') // lecturer | student | support
const department_id = searchParams.get('department_id')
const framework_id = searchParams.get('framework_id')
const unit_id = searchParams.get('unit_id')
const sb = createServerClient()


let q = sb.from('qa_participants_view').select('*')
if (role) q = q.eq('role', role)
if (department_id) q = q.eq('department_id', department_id)
if (framework_id) q = q.eq('framework_id', framework_id)
if (unit_id) q = q.eq('unit_id', unit_id)


const { data, error } = await q.limit(2000)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ participants: data ?? [] })
}
