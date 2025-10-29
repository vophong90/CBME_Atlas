// app/360-eval/results/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

function truthy(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1';
}
function canSeeQA(profile: any): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'qa') return true;
  const arr = Array.isArray(profile.roles) ? profile.roles : [];
  if (arr.includes('admin') || arr.includes('qa')) return true;
  if (truthy(profile.is_admin) || truthy(profile.is_qa)) return true;
  // alias dự phòng
  if (truthy((profile as any)?.admin) || truthy((profile as any)?.qa)) return true;
  return false;
}

export default function Eval360ResultsPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const allowed = useMemo(() => canSeeQA(profile), [profile]);

  const [mssv, setMssv] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [student, setStudent] = useState<{ mssv: string; full_name: string } | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Redirect nếu không đủ quyền (sau khi auth đã load)
  useEffect(() => {
    if (loading) return;
    if (!allowed) router.replace('/360-eval/evaluate');
  }, [loading, allowed, router]);

  async function search() {
    if (!mssv.trim()) return;
    setLoadingList(true);
    setErrorMsg('');
    try {
      const r = await fetch(`/api/360/results?mssv=${encodeURIComponent(mssv.trim())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Không tải được kết quả');
      setStudent(d.student || null);
      setRows(d.items || []);
    } catch (e: any) {
      setStudent(null);
      setRows([]);
      setErrorMsg(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoadingList(false);
    }
  }

  function clearAll() {
    setMssv('');
    setStudent(null);
    setRows([]);
    setErrorMsg('');
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Đang kiểm tra quyền truy cập…</div>;
  }
  if (!allowed) {
    // layout đã redirect; đây là dự phòng
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Bạn không có quyền truy cập.</div>;
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={mssv}
          onChange={(e) => setMssv(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
          placeholder="Nhập MSSV…"
          className="w-64 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={search}
          disabled={loadingList || !mssv.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {loadingList ? 'Đang tải…' : 'Tìm'}
        </button>
        <button onClick={clearAll} className="rounded-lg border px-4 py-2 text-sm">
          Xoá
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>
      )}

      {student && (
        <div className="text-sm text-slate-600">
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
            {loadingList ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="border px-3 py-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length ? (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="border px-3 py-2">
                    {r.observed_at
                      ? new Date(r.observed_at).toLocaleString('vi-VN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="border px-3 py-2 text-center">{r.group_code || '—'}</td>
                  <td className="border px-3 py-2">{r.rater_name || '—'}</td>
                  <td className="border px-3 py-2">{r.rubric_title || '—'}</td>
                  <td className="border px-3 py-2 whitespace-pre-wrap">{r.note || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border px-3 py-4 text-center text-slate-500" colSpan={5}>
                  Chưa có kết quả
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
