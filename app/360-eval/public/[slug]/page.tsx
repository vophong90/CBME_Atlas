'use client';

import { useEffect, useMemo, useState } from 'react';

type Column = { key: string; label: string };
type Row    = { id: string; label: string };
type Rubric = { id: string; title: string; threshold?: number|null; definition: { columns: Column[]; rows: Row[] } };
type Form   = { id: string; title: string; group_code: string; rubric_id: string; slug: string };

export default function PublicRunner({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [form, setForm] = useState<Form|null>(null);
  const [rubric, setRubric] = useState<Rubric|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [mssv, setMssv] = useState('');
  const [raterName, setRaterName] = useState('');
  const [raterRel, setRaterRel] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const allAnswered = useMemo(() => {
    const total = rubric?.definition?.rows?.length || 0;
    const picked = Object.keys(answers).length;
    return total > 0 && picked === total;
  }, [answers, rubric]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/360/public/form/${encodeURIComponent(slug)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tải được biểu mẫu.');
        setForm(d.form);
        setRubric(d.rubric);
      } catch (e: any) {
        setErr(e?.message || 'Lỗi tải biểu mẫu.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  function pick(rowId: string, colKey: string) {
    setAnswers(a => ({ ...a, [rowId]: colKey }));
  }

  async function submit() {
    try {
      setSaving(true);
      setErr('');
      if (!mssv.trim()) throw new Error('Vui lòng nhập MSSV của người được đánh giá.');
      if (!consent) throw new Error('Bạn cần đồng ý đồng thuận (consent).');
      if (!rubric) throw new Error('Thiếu rubric.');

      const r = await fetch('/api/360/public/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          target_mssv: mssv.trim(),
          answers,
          note: note.trim() || undefined,
          rater_name: raterName.trim() || undefined,
          rater_relation: raterRel.trim() || undefined,
          consent: true
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gửi kết quả thất bại');

      alert('Cám ơn bạn đã hoàn thành đánh giá!');
      // reset tối thiểu
      setMssv(''); setRaterName(''); setRaterRel(''); setNote(''); setConsent(false); setAnswers({});
    } catch (e: any) {
      setErr(e?.message || 'Lỗi gửi kết quả.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-xl border bg-white p-4">Đang tải…</div>;
  if (err) return <div className="rounded-xl border bg-white p-4 text-red-600">{err}</div>;
  if (!form || !rubric) return <div className="rounded-xl border bg-white p-4">Không tìm thấy biểu mẫu.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Nhóm: {form.group_code}</div>
        <h1 className="text-xl font-semibold">{form.title}</h1>
        <p className="text-sm text-slate-600">Vui lòng chọn 1 mức cho mỗi tiêu chí.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input value={mssv} onChange={(e)=>setMssv(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"
                 placeholder="MSSV người được đánh giá (bắt buộc)" />
          <input value={raterName} onChange={(e)=>setRaterName(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"
                 placeholder="Tên người chấm (không bắt buộc)" />
          <input value={raterRel} onChange={(e)=>setRaterRel(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"
                 placeholder="Mối quan hệ/Vai trò (không bắt buộc)" />
          <input value={note} onChange={(e)=>setNote(e.target.value)} className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
                 placeholder="Ghi chú thêm (không bắt buộc)" />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
            Tôi đồng ý tham gia đánh giá và đồng ý với điều khoản bảo mật/thông tin.
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Tiêu chí</th>
              {rubric.definition.columns.map(c =>
                <th key={c.key} className="border px-2 py-1 text-center">{c.label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rubric.definition.rows.map(r => (
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.label}</td>
                {rubric.definition.columns.map(c => (
                  <td key={c.key} className="border px-2 py-1 text-center">
                    <input
                      type="radio"
                      name={`row-${r.id}`}
                      checked={answers[r.id] === c.key}
                      onChange={()=>pick(r.id, c.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          disabled={!allAnswered || !mssv.trim() || !consent || saving}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? 'Đang gửi…' : 'Gửi đánh giá'}
        </button>
        {!allAnswered && <div className="text-sm text-slate-500 self-center">Vui lòng chọn đủ tất cả tiêu chí.</div>}
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
    </div>
  );
}
