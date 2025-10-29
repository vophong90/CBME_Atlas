'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Survey = { id: string; title: string; status: 'draft'|'active'|'inactive'|'archived' };

type AssignmentRow = {
  id: string;
  survey_id: string;
  assigned_to: string;
  role: 'lecturer' | 'student' | 'support' | null;
  department: string | null;
  cohort: string | null;
  unit: string | null;
  invited_at: string | null;
  last_reminded_at: string | null;
  // Enriched fields từ view qa_participants_view (nếu có)
  email?: string | null;
  name?: string | null;
  // Trạng thái nộp từ survey_responses
  is_submitted?: boolean;
  submitted_at?: string | null;
};

type ApiProgress = {
  total: number;
  submitted: number;
  pending: number;
  assignments: AssignmentRow[];
};

export default function ProgressPage() {
  const supabase = getSupabase();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending'>('all');

  // Load surveys
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('surveys')
          .select('id,title,status')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const arr = (data ?? []) as Survey[];
        setSurveys(arr);
        if (arr.length && !surveyId) setSurveyId(arr[0].id);
      } catch (e: any) {
        setToast({ type: 'error', text: e.message ?? 'Không tải được danh sách khảo sát' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProgress() {
    if (!surveyId) return;
    setLoading(true);
    setToast(null);
    try {
      const r = await fetch(`/api/qa/surveys/${surveyId}/progress`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `Lỗi ${r.status}`);
      setRows((d.assignments ?? []) as AssignmentRow[]);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được tiến độ' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const totals = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter(r => r.is_submitted).length;
    const pending = total - submitted;
    const pct = total ? Math.round((submitted / total) * 100) : 0;
    return { total, submitted, pending, pct };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'submitted') return rows.filter(r => r.is_submitted);
    if (filter === 'pending') return rows.filter(r => !r.is_submitted);
    return rows;
  }, [rows, filter]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tiến độ khảo sát</h1>
        <p className="text-sm text-gray-600">Danh sách người được mời và trạng thái đã nộp.</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-white">
        {/* Hàng chọn khảo sát + filter */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm">Khảo sát</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
            >
              <option value="">— Chọn khảo sát —</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Bộ lọc trạng thái</label>
            <div className="flex gap-2">
              {(['all','submitted','pending'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={[
                    'flex-1 rounded border px-3 py-2 text-sm',
                    filter === k ? 'bg-black text-white' : 'hover:bg-gray-50'
                  ].join(' ')}
                  disabled={loading}
                  title={
                    k === 'all' ? 'Tất cả'
                    : k === 'submitted' ? 'Đã nộp'
                    : 'Chưa nộp'
                  }
                >
                  {k === 'all' ? 'Tất cả' : k === 'submitted' ? 'Đã nộp' : 'Chưa nộp'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Thanh tiến độ */}
        <div className="space-y-2">
          <div className="font-medium">
            {totals.submitted} / {totals.total} đã nộp ({totals.pct}%)
          </div>
          <div className="w-full h-3 bg-gray-200 rounded">
            <div className="h-3 bg-black rounded" style={{ width: `${totals.pct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProgress}
            disabled={loading || !surveyId}
            className={`px-3 py-2 rounded text-white ${loading || !surveyId ? 'bg-gray-400' : 'bg-black'}`}
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
          {toast && (
            <div className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {toast.text}
            </div>
          )}
        </div>

        {/* Bảng chi tiết */}
        <div className="overflow-auto">
          <table className="min-w-[960px] w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3 w-[280px]">Người được mời</th>
                <th className="py-2 pr-3 w-28">Vai trò</th>
                <th className="py-2 pr-3 w-40">Bộ môn / Khung</th>
                <th className="py-2 pr-3 w-40">Mời lúc</th>
                <th className="py-2 pr-3 w-40">Nhắc gần nhất</th>
                <th className="py-2 pr-3 w-28">Trạng thái</th>
                <th className="py-2 pr-3 w-40">Nộp lúc</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.name || '(Chưa có tên)'}</div>
                    <div className="text-xs text-gray-600">{r.email || r.assigned_to}</div>
                  </td>
                  <td className="py-2 pr-3">{r.role ?? '-'}</td>
                  <td className="py-2 pr-3">
                    {/* Nếu role là lecturer thì ưu tiên hiện department; nếu student thì ưu tiên cohort */}
                    {r.role === 'lecturer'
                      ? (r.department || '-')
                      : r.role === 'student'
                      ? (r.cohort || '-')
                      : (r.unit || r.department || r.cohort || '-')}
                  </td>
                  <td className="py-2 pr-3">{fmt(r.invited_at)}</td>
                  <td className="py-2 pr-3">{fmt(r.last_reminded_at)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs border',
                        r.is_submitted ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-700',
                      ].join(' ')}
                    >
                      {r.is_submitted ? 'Đã nộp' : 'Chưa nộp'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{fmt(r.submitted_at)}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={7}>
                    Không có dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500">
          * Dữ liệu lấy từ <code>survey_assignments</code> và <code>survey_responses</code>. Tên/Email được làm giàu từ <code>qa_participants_view</code> nếu có.
        </div>
      </div>
    </div>
  );
}

function fmt(s: string | null | undefined) {
  if (!s) return '-';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    // YYYY-MM-DD HH:mm
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}
