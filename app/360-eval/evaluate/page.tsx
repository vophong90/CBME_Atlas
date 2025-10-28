'use client';

import { useEffect, useMemo, useState } from 'react';

type GroupCode = 'self'|'peer'|'faculty'|'supervisor'|'patient';

type FormRow = { key: string; label: string };
type FormCol = { key: string; label: string };
type Rubric = {
  id: string;
  title: string;
  definition: { rows: FormRow[]; columns: FormCol[] };
};

export default function Eval360DoPage() {
  const [group, setGroup] = useState<GroupCode>('peer');
  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<Array<{ user_id: string; label: string }>>([]);
  const [evaluatee, setEvaluatee] = useState<string>('');
  const [forms, setForms] = useState<Array<{ id: string; title: string; rubric_id: string }>>([]);
  const [rubricId, setRubricId] = useState('');
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  // nạp biểu mẫu theo group
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/360/forms?group_code=${group}&status=active`);
      const d = await r.json();
      setForms((d.items || []).map((x: any) => ({ id: x.id, title: x.title, rubric_id: x.rubric_id })));
      setRubricId('');
      setRubric(null);
    })();
  }, [group]);

  // tìm SV
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!studentQuery.trim()) { setStudents([]); return; }
      const r = await fetch(`/api/360/students?q=${encodeURIComponent(studentQuery.trim())}`);
      const d = await r.json();
      setStudents((d.items || []).map((x: any) => ({ user_id: x.user_id, label: x.label })));
    }, 300);
    return () => clearTimeout(t);
  }, [studentQuery]);

  // nạp nội dung rubric khi chọn biểu mẫu
  useEffect(() => {
    (async () => {
      if (!rubricId) return;
      const rr = await fetch(`/api/rubrics/list`);
      const all = await rr.json();
      const row = (all.items || []).find((x: any) => x.id === rubricId);
      if (!row) return;
      // lấy definition của rubric trực tiếp từ table rubrics
      const r2 = await fetch(`/api/_raw/rubric?id=${rubricId}`).catch(()=>null); // nếu bạn đã có endpoint nội bộ; nếu chưa, có thể query thẳng ở đây
    })();
  }, [rubricId]);

  // endpoint thô để lấy rubric.definition (nhanh gọn: tạo tạm dưới)
  // Bạn có thể thay bằng call Supabase phía client; ở đây gọi tắt:
  async function loadRubricDef(id: string) {
    const r = await fetch(`/api/_internal/rubric?id=${id}`);
    const d = await r.json();
    setRubric(d.rubric || null);
    setAnswers({});
  }

  // Khi chọn form, tải rubric
  useEffect(() => {
    if (!rubricId) return;
    loadRubricDef(rubricId);
  }, [rubricId]);

  const canSubmit = useMemo(() => {
    return !!evaluatee && !!rubric && Object.keys(answers).length >= (rubric?.definition?.rows?.length || 0);
  }, [evaluatee, rubric, answers]);

  async function handleSubmit() {
    if (!rubric || !evaluatee) return;
    try {
      setLoading(true);
      // 1) tạo evaluation_request ad-hoc
      const st = await fetch('/api/360/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ evaluatee_user_id: evaluatee, rubric_id: rubric.id, group_code: group })
      });
      const sd = await st.json();
      if (!st.ok) throw new Error(sd?.error || 'Không tạo được request');

      // 2) submit điểm
      const items = rubric.definition.rows.map((row) => ({
        item_key: row.key,
        selected_level: answers[row.key],
        score: null,
        comment: null,
      }));

      const sb = await fetch('/api/360/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          request_id: sd.request_id,
          rubric_id: rubric.id,
          overall_comment: comment || null,
          items
        })
      });
      const sbd = await sb.json();
      if (!sb.ok) throw new Error(sbd?.error || 'Nộp thất bại');
      alert('Đã nộp đánh giá 360° thành công!');
      setAnswers({});
      setComment('');
      setEvaluatee('');
      setStudentQuery('');
    } catch (e: any) {
      alert(e?.message || 'Lỗi gửi đánh giá');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Chọn đối tượng & SV */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold">Bạn là</label>
            <select value={group} onChange={(e)=>setGroup(e.target.value as GroupCode)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
              <option value="faculty">Giảng viên</option>
              <option value="peer">Sinh viên đánh giá nhau</option>
              <option value="self">Sinh viên tự đánh giá</option>
              <option value="supervisor">Người hướng dẫn</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold">Chọn sinh viên</label>
            <input
              value={studentQuery}
              onChange={(e)=>{ setStudentQuery(e.target.value); setEvaluatee(''); }}
              placeholder="Nhập MSSV hoặc tên để tìm…"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
            {!!students.length && (
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-white">
                {students.map(s => (
                  <button
                    key={s.user_id}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${evaluatee===s.user_id?'bg-slate-100':''}`}
                    onClick={()=>setEvaluatee(s.user_id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chọn biểu mẫu */}
      <div className="rounded-xl border bg-white p-4">
        <label className="text-xs font-semibold">Chọn biểu mẫu</label>
        <select value={rubricId} onChange={(e)=>setRubricId(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
          <option value="">— Chọn —</option>
          {forms.map(f => (
            <option key={f.id} value={f.rubric_id}>{f.title}</option>
          ))}
        </select>
      </div>

      {/* Render rubric */}
      {rubric && (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 font-semibold">{rubric.title}</div>
          <div className="overflow-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left w-1/3">Tiêu chí</th>
                  {rubric.definition.columns.map(col => (
                    <th key={col.key} className="border px-3 py-2 text-center">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rubric.definition.rows.map(row => (
                  <tr key={row.key}>
                    <td className="border px-3 py-2">{row.label}</td>
                    {rubric.definition.columns.map(col => (
                      <td key={col.key} className="border px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`row-${row.key}`}
                          checked={answers[row.key]===col.key}
                          onChange={()=>setAnswers(a=>({ ...a, [row.key]: col.key }))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold">Nhận xét tổng quát</label>
            <textarea
              value={comment}
              onChange={(e)=>setComment(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              placeholder="Những điểm mạnh & cần cải thiện…"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? 'Đang gửi…' : 'Nộp đánh giá'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
