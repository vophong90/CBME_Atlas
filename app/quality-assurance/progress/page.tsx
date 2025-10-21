'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Survey = { id: string; title: string; status: string };
type Row = { assignees: number; submitted: number };

export default function ProgressPage() {
  const supabase = getSupabase();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('surveys').select('id,title,status').order('created_at', { ascending: false });
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

  async function compute() {
    if (!surveyId) return;
    setLoading(true);
    setToast(null);
    try {
      // Thử gom theo bảng assignments/responses nếu có
      // total assignees
      let assignees = 0;
      {
        const { data, error } = await supabase.from('survey_assignments').select('id', { count: 'exact', head: true }).eq('survey_id', surveyId);
        if (error?.code !== '42P01' && error) throw error;
        if (!error) assignees = data ? (data as any).length ?? 0 : 0;
      }
      // submitted
      let submitted = 0;
      {
        const { data, error, count } = await supabase
          .from('survey_responses')
          .select('id', { count: 'exact', head: true })
          .eq('survey_id', surveyId)
          .eq('is_submitted', true);
        if (error?.code !== '42P01' && error) throw error;
        if (!error) submitted = count ?? 0;
      }
      setData({ assignees, submitted });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tổng hợp được tiến độ' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const pct = useMemo(() => {
    if (!data) return 0;
    if (!data.assignees) return 0;
    return Math.round((data.submitted / data.assignees) * 100);
  }, [data]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tiến độ khảo sát</h1>
        <p className="text-sm text-gray-600">Số đã nộp / số được mời.</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div>
          <label className="text-sm">Khảo sát</label>
          <select className="w-full border rounded px-3 py-2" value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
            <option value="">— Chọn khảo sát —</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.status})
              </option>
            ))}
          </select>
        </div>

        {data && (
          <div className="space-y-2">
            <div className="font-medium">
              {data.submitted} / {data.assignees} đã nộp ({pct}%)
            </div>
            <div className="w-full h-3 bg-gray-200 rounded">
              <div className="h-3 bg-black rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <button onClick={compute} disabled={loading || !surveyId} className={`px-3 py-2 rounded text-white ${loading || !surveyId ? 'bg-gray-400' : 'bg-black'}`}>
          {loading ? 'Đang cập nhật…' : 'Cập nhật'}
        </button>

        {toast && <div className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{toast.text}</div>}

        <div className="text-xs text-gray-500">
          * Cần các bảng <code>survey_assignments</code> và <code>survey_responses</code> để số liệu chính xác. Nếu chưa có, thanh tiến độ có thể là 0%.
        </div>
      </div>
    </div>
  );
}
