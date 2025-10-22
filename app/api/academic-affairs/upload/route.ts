//app/api/academic-affairs/upload/route.ts
description: description ?? null,
}));
const { error } = await db.from('plos').insert(payload);
if (error) throw error;


} else if (kind === 'pi') {
// 2 cột: code, description
const payload = rows.map(([code, description]) => ({
framework_id,
code,
description: description ?? null,
}));
const { error } = await db.from('pis').insert(payload);
if (error) throw error;


} else if (kind === 'courses') {
// 2-3 cột: course_code, course_name, [credits]
const payload = rows.map(([course_code, course_name, credits]) => ({
framework_id,
course_code,
course_name: course_name ?? null,
credits: (credits !== undefined && credits !== null && String(credits).trim() !== '') ? Number(credits) : null,
}));
const { error } = await db.from('courses').insert(payload);
if (error) throw error;


} else if (kind === 'plo_pi') {
// 2 cột: plo_code, pi_code
const payload = rows.map(([plo_code, pi_code]) => ({
framework_id,
plo_code,
pi_code,
}));
const { error } = await db.from('plo_pi_links').insert(payload);
if (error) throw error;


} else if (kind === 'plo_clo') {
// 4 cột: plo_code, course_code, clo_code, level
const payload = rows.map(([plo_code, course_code, clo_code, level]) => ({
framework_id,
plo_code,
course_code,
clo_code,
level: level ?? null,
}));
const { error } = await db.from('plo_clo_links').insert(payload);
if (error) throw error;


} else if (kind === 'pi_clo') {
// 4 cột: pi_code, course_code, clo_code, level
const payload = rows.map(([pi_code, course_code, clo_code, level]) => ({
framework_id,
pi_code,
course_code,
clo_code,
level: level ?? null,
}));
const { error } = await db.from('pi_clo_links').insert(payload);
if (error) throw error;


} else {
return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 });
}


return NextResponse.json({ ok: true });
} catch (e: any) {
return NextResponse.json({ error: e?.message || 'Upload lỗi' }, { status: 400 });
}
}

