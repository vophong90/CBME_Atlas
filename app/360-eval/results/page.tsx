'use client';
import { useState } from 'react';

export default function Eval360ResultsPage() {
  const [mssv, setMssv] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [student, setStudent] = useState<{ mssv: string; full_name: string }|null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!mssv.trim()) return;
    setLoading(true);
    const r = await fetch(`/api/360/results?mssv=${encodeURIComponent(mssv.trim())}`);
    const d = await r.json();
    setStudent(d.student || null);
    setRows(d.items || []);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex gap-2">
        <input value={mssv} onChange={(e)=>setMssv(e.target.value)} placeholder="Nhập MSSV…"
               className="w-64 rounded-lg border px-3 py-2 text-sm" />
        <button onClick={search} className="rounded-lg bg-brand-600 px-4 py-2 text-white">Tìm</button>
      </div>

      {loading ? 'Đang tải…' : (
        <>
          {student && (
            <div className="mb-2 text-sm text-slate-600">
              Kết quả của: <b>{student.full_name}</b> — MSSV: <b>{student.mssv}</b>
            </div>
          )}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2">Thời gian</th>
                  <th className="border px-3 py-2">Nhóm đánh giá</th>
                  <th className="border px-3 py-2">Người chấm</th>
                  <th className="border px-3 py-2">Rubric</th>
                  <th className="border px-3 py-2">Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="border px-3 py-2">{new Date(r.observed_at).toLocaleString('vi-VN')}</td>
                    <td className="border px-3 py-2 text-center">{r.group_code}</td>
                    <td className="border px-3 py-2">{r.rater_name || '—'}</td>
                    <td className="border px-3 py-2">{r.rubric_title || '—'}</td>
                    <td className="border px-3 py-2">{r.note || ''}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="border px-3 py-4 text-center text-slate-500" colSpan={5}>Chưa có kết quả</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
