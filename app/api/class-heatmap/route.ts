import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const course_code = searchParams.get('course_code') ?? 'IMMU101'

  const { data, error } = await supabase
    .from('clo_heatmap_course')
    .select('*')
    .eq('course_code', course_code)
    .order('clo_code', { ascending: true })

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok:true, course_code, items: data || [] })
}
