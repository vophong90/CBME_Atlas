import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

function parseCsv(text: string) {
  return text.trim().split(/\r?\n/).map(l => l.split(',').map(c => c.trim()))
}

export async function POST(req: Request) {
  const fd = await req.formData()
  const framework_id = String(fd.get('framework_id') || '')
  const kind = String(fd.get('kind') || '')
  const file = fd.get('file') as File | null
  if (!framework_id || !file) {
    return NextResponse.json({ error: 'Thiếu framework_id hoặc file' }, { status: 400 })
  }

  const rows = parseCsv(await file.text())

  try {
    if (kind === 'plo') {
      const payload = rows.map(([code, description]) => ({ framework_id, code, description }))
      const { error } = await supabaseAdmin.from('plos').insert(payload)
      if (error) throw error
    } else if (kind === 'pi') {
      const payload = rows.map(([code, description]) => ({ framework_id, code, description }))
      const { error } = await supabaseAdmin.from('pis').insert(payload)
      if (error) throw error
    } else if (kind === 'plo_pi') {
      const payload = rows.map(([plo_code, pi_code]) => ({ framework_id, plo_code, pi_code }))
      const { error } = await supabaseAdmin.from('plo_pi_links').insert(payload)
      if (error) throw error
    } else if (kind === 'plo_clo') {
      const payload = rows.map(([plo_code, course_code, clo_code, level]) =>
        ({ framework_id, plo_code, course_code, clo_code, level }))
      const { error } = await supabaseAdmin.from('plo_clo_links').insert(payload)
      if (error) throw error
    } else if (kind === 'pi_clo') {
      const payload = rows.map(([pi_code, course_code, clo_code, level]) =>
        ({ framework_id, pi_code, course_code, clo_code, level }))
      const { error } = await supabaseAdmin.from('pi_clo_links').insert(payload)
      if (error) throw error
    } else {
      return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload lỗi' }, { status: 400 })
  }
}
