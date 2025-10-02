import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const student_code = searchParams.get('student_code') ?? 'SV001'

  // lookup student id
  const { data: stu, error: eStu } = await supabase
    .from('students').select('id').eq('student_code', student_code).single()
  if (eStu || !stu) return NextResponse.json({ ok:false, message:'Student not found' }, { status: 404 })

  const [{ data: plo }, { data: pi }] = await Promise.all([
    supabase.from('student_plo_rollup').select('*').eq('student_id', stu.id),
    supabase.from('student_pi_rollup').select('*').eq('student_id', stu.id)
  ])

  return NextResponse.json({ ok:true, student_code, plo: plo||[], pi: pi||[] })
}
