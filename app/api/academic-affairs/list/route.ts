// app/api/academic-affairs/list/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { searchParams } = new URL(req.url)
  const framework_id = searchParams.get('framework_id') || ''
  const kind = searchParams.get('kind') || ''
  if (!framework_id) return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 })

  let data, count, error

  if (kind === 'plo') {
    ({ data, count, error } = await supabase
      .from('plos')
      .select('id, framework_id, code, description, created_at', { count: 'exact' })
      .eq('framework_id', framework_id))
  } else if (kind === 'pi') {
    ({ data, count, error } = await supabase
      .from('pis')
      .select('id, framework_id, code, description, created_at', { count: 'exact' })
      .eq('framework_id', framework_id))
  } else if (kind === 'plo_pi') {
    ({ data, count, error } = await supabase
      .from('plo_pi_links')
      .select('id, framework_id, plo_code, pi_code, created_at', { count: 'exact' })
      .eq('framework_id', framework_id))
  } else if (kind === 'plo_clo') {
    ({ data, count, error } = await supabase
      .from('plo_clo_links')
      .select('id, framework_id, plo_code, course_code, clo_code, level, created_at', { count: 'exact' })
      .eq('framework_id', framework_id))
  } else if (kind === 'pi_clo') {
    ({ data, count, error } = await supabase
      .from('pi_clo_links')
      .select('id, framework_id, pi_code, course_code, clo_code, level, created_at', { count: 'exact' })
      .eq('framework_id', framework_id))
  } else {
    return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data, count })
}
