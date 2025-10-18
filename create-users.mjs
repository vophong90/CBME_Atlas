import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

// ⚠️ điền inform
const SUPABASE_URL = 'https://<PROJECT-REF>.supabase.co'
const SERVICE_ROLE = '<SERVICE_ROLE_KEY>' // chỉ dùng local
const DOMAIN_SV = 'sv.yhct.edu.vn'

// CSV đơn giản: MSSV,HoTen
const csv = fs.readFileSync('./students.csv','utf8').trim().split('\n').map(l => l.split(','))
const supa = createClient(SUPABASE_URL, SERVICE_ROLE)

for (const [mssv, hoten] of csv) {
  const email = `${mssv}@${DOMAIN_SV}`.toLowerCase()
  const password = 'Pass@2025' // mật khẩu mặc định
  const { data, error } = await supa.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: 'student', student_code: mssv, full_name: hoten, must_change_password: true }
  })
  if (error) console.error(mssv, error.message)
  else console.log('created', mssv, data.user.id)
}
