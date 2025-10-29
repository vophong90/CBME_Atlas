'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

type Survey = { id: string; title: string; status: 'draft'|'active'|'inactive'|'archived' };
type ResultItem = {
  question_id: string;
  text: string;
  qtype: 'single' | 'multi' | 'text';
  sort_order: number;
  total: number; // tổng bản ghi câu trả lời (option hoặc free_text)
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

  // Tải khảo sát
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

  // Tải kết quả đã tổng hợp từ API server
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
    () => surveys.find(s => s.id === surveyId)?.title || 'Survey',
    [surveys, surveyId]
  );

  // ===== Excel export (mỗi câu một sheet) =====
  async function exportExcel() {
    try {
      if (!items.length) {
        setToast({ type: 'error', text: 'Chưa có dữ liệu để xuất' });
        return;
      }
      const XLSX = await import('xlsx'); // dynamic import để tránh nặng bundle SSR
      const wb = XLSX.utils.book_new();

      // Sheet tổng (danh mục câu hỏi)
      const summaryRows = items.map((q, i) => ({
        STT: i + 1,
        QuestionID: q.question_id,
        Text: q.text,
        Type: q.qtype,
        SortOrder: q.sort_order,
        TotalRecords: q.total,
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Mỗi câu một sheet
      items.forEach((q, i) => {
        const safeName = `Q${i + 1}`.slice(0, 31); // Excel sheet name ≤31 kí tự
        if (q.choices?.length > 0) {
          // câu lựa chọn
          const rows = q.choices.map((c) => ({
            Option: c.value,
            Count: c.count,
            Percent: c.percent,
          }));
          // thêm tổng
          rows.push({ Option: 'Total (records)', Count: q.total, Percent: 100 });
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, safeName);
        } else {
          // câu tự luận
          const rows = q.texts.length
            ? q.texts.map((t, idx) => ({ No: idx + 1, Text: t }))
            : [{ No: '', Text: '(Không có trả lời)' }];
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, safeName);
        }
      });

      const filename = `${sanitizeFileName(surveyTitle)}_results.xlsx`;
      XLSX.writeFile(wb, filename);
      setToast({ type: 'success', text: 'Đã xuất Excel' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Xuất Excel thất bại' });
    }
  }

  function sanitizeFileName(s: string) {
    return s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kết quả khảo sát</h1>
          <p className="text-sm text-gray-600">Bảng tần số & tỷ lệ %, kèm biểu đồ cột cho câu lựa chọn; danh sách câu trả lời tự luận.</p>
        </div>
        <button
          onClick={exportExcel}
          disabled={!items.length}
          className={`px-3 py-2 rounded text-white ${!items.length ? 'bg-gray-400' : 'bg-black'}`}
          title="Xuất toàn bộ kết quả ra Excel (mỗi câu một sheet)"
        >
          Xuất Excel
        </button>
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

        {loading && <div className="text-sm text-gray-600">Đang tải kết quả…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-gray-500">Chưa có dữ liệu.</div>
        )}

        <div className="space-y-8">
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

              {/* Bảng tổng hợp */}
              {q.choices?.length > 0 ? (
                <div className="mt-3 overflow-auto">
                  <table className="min-w-[520px] w-full border-collapse">
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
                          </td>
                          <td className="py-2 pr-3">{c.count}</td>
                          <td className="py-2 pr-3">{c.percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="text-sm text-gray-700 mb-2">
                    Câu trả lời tự do ({q.texts.length})
                  </div>
                  <ul className="space-y-2 max-h-64 overflow-auto pr-2">
                    {q.texts.length === 0 && (
                      <li className="rounded border bg-gray-50 p-2 text-sm text-gray-500">(Không có trả lời)</li>
                    )}
                    {q.texts.map((t, i) => (
                      <li key={i} className="rounded border bg-gray-50 p-2 text-sm">{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Biểu đồ cột (chỉ cho câu lựa chọn) */}
              {q.choices?.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Biểu đồ tỷ lệ (%)</div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={q.choices.map((c) => ({
                          label: c.value,
                          percent: Math.max(0, Math.min(100, c.percent)),
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 32 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          tick={{ fontSize: 12 }}
                          height={50}
                        />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v: any) => [`${v}%`, 'Tỷ lệ']} />
                        <Bar dataKey="percent" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
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
          * Ghi chú: với câu nhiều lựa chọn, % đang tính trên tổng số **bản ghi trả lời** (mỗi option/free-text là 1 bản ghi).
          Nếu bạn muốn % theo số **người** trả lời, mình sẽ điều chỉnh API để tính theo distinct response_id.
        </div>
      </div>
    </div>
  );
}
