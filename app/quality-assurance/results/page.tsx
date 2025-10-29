'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Survey = { id: string; title: string; status: 'draft'|'active'|'inactive'|'archived' };
type ResultItem = {
  question_id: string;
  text: string;
  qtype: 'single' | 'multi' | 'text';
  sort_order: number;
  total: number;
  choices: Array<{ value: string; count: number; percent: number }>;
  texts: string[];
};

export default function ResultsPage() {
  const supabase = getSupabase();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [items, setItems] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tải danh sách khảo sát
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
        setToast({ type: 'error', text: e.message ?? 'Không tải được khảo sát' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gọi API tổng hợp kết quả
  useEffect(() => {
    (async () => {
      if (!surveyId) {
        setItems([]);
        return;
      }
      setLoading(true);
      setToast(null);
      try {
        const r = await fetch(`/api/qa/surveys/${surveyId}/results`, { credentials: 'include' });
        if (!r.ok) {
          const msg = await r.json().catch(() => ({}));
          throw new Error(msg?.error || `Lỗi ${r.status}`);
        }
        const d = await r.json();
        setItems((d?.questions ?? []) as ResultItem[]);
      } catch (e: any) {
        setToast({ type: 'error', text: e.message ?? 'Không tải được kết quả' });
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  const surveyTitle = useMemo(
    () => surveys.find(s => s.id === surveyId)?.title || '',
    [surveys, surveyId]
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kết quả khảo sát</h1>
        <p className="text-sm text-gray-600">Tổng hợp theo từng câu hỏi (dựa trên các phiếu đã nộp).</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-white">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
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
        </div>

        {/* Danh sách câu hỏi + kết quả */}
        {loading && <div className="text-sm text-gray-600">Đang tải kết quả…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-gray-500">Chưa có dữ liệu.</div>
        )}

        <div className="space-y-6">
          {items.map((q, idx) => (
            <div key={q.question_id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  Câu {idx + 1}. {q.text}
                </div>
                <div className="text-xs text-gray-500">
                  Loại: {q.qtype} • Tổng bản ghi: {q.total}
                </div>
              </div>

              {/* Chỉ hiển thị bảng lựa chọn nếu có choices */}
              {q.choices?.length > 0 && (
                <div className="mt-3 overflow-auto">
                  <table className="min-w-[480px] w-full border-collapse">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Lựa chọn</th>
                        <th className="py-2 pr-3 w-24">Số phiếu</th>
                        <th className="py-2 pr-3 w-24">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.choices.map((c) => (
                        <tr key={c.value} className="border-b align-top">
                          <td className="py-2 pr-3">
                            <div className="whitespace-pre-wrap">{c.value}</div>
                            <div className="mt-1 h-2 w-full rounded bg-gray-100">
                              <div
                                className="h-2 rounded bg-black"
                                style={{ width: `${Math.min(100, Math.max(0, c.percent))}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3">{c.count}</td>
                          <td className="py-2 pr-3">{c.percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Hiển thị text answers (nếu có) */}
              {q.texts?.length > 0 && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer select-none text-sm text-gray-700 group-open:font-medium">
                    Câu trả lời tự do ({q.texts.length})
                  </summary>
                  <ul className="mt-2 space-y-2 max-h-64 overflow-auto pr-2">
                    {q.texts.map((t, i) => (
                      <li key={i} className="rounded border bg-gray-50 p-2 text-sm">
                        {t}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>

        {toast && (
          <div className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {toast.text}
          </div>
        )}

        <div className="text-xs text-gray-500">
          * Ghi chú: với câu nhiều lựa chọn, tỷ lệ (%) tính trên tổng số lựa chọn được chọn (không phải số người).
        </div>
      </div>
    </div>
  );
}
