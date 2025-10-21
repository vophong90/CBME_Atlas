'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Survey = { id: string; title: string; status: string };
type Question = { id: string; text: string; type: 'single' | 'multi' | 'text' };
type CountRow = { option: string; count: number };

export default function ResultsPage() {
  const supabase = getSupabase();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQ, setSelectedQ] = useState('');
  const [counts, setCounts] = useState<CountRow[]>([]);
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
        setToast({ type: 'error', text: e.message ?? 'Không tải được khảo sát' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!surveyId) {
        setQuestions([]); setSelectedQ(''); return;
      }
      setLoading(true);
      setToast(null);
      try {
        const { data, error } = await supabase
          .from('survey_questions')
          .select('id,text,type')
          .eq('survey_id', surveyId)
          .order('id', { ascending: true });
        if (error?.code === '42P01') {
          setQuestions([]); setSelectedQ(''); // bảng chưa có
        } else if (error) {
          throw error;
        } else {
          const arr = (data ?? []) as Question[];
          setQuestions(arr);
          setSelectedQ(arr[0]?.id ?? '');
        }
      } catch (e: any) {
        setToast({ type: 'error', text: e.message ?? 'Không tải được câu hỏi' });
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId, supabase]);

  async function loadCounts() {
    if (!selectedQ) return;
    setLoading(true);
    setToast(null);
    try {
      // Giả định có bảng survey_answers(options text). Tuỳ DB của bạn, đổi cho khớp.
      const { data, error } = await supabase
        .from('survey_answers')
        .select('option')
        .eq('question_id', selectedQ);
      if (error?.code === '42P01') {
        setCounts([]); // bảng chưa có => để trống
      } else if (error) {
        throw error;
      } else {
        const a = (data ?? []) as { option: string }[];
        const map = new Map<string, number>();
        for (const r of a) map.set(r.option ?? '-', (map.get(r.option ?? '-') ?? 0) + 1);
        setCounts([...map.entries()].map(([option, count]) => ({ option, count })));
      }
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tổng hợp được kết quả' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQ]);

  const total = useMemo(() => counts.reduce((s, r) => s + r.count, 0), [counts]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kết quả khảo sát</h1>
        <p className="text-sm text-gray-600">Tổng hợp đơn giản theo câu hỏi.</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
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
          <div>
            <label className="text-sm">Câu hỏi</label>
            <select className="w-full border rounded px-3 py-2" value={selectedQ} onChange={(e) => setSelectedQ(e.target.value)}>
              {!questions.length && <option value="">— (Chưa có bảng câu hỏi) —</option>}
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bảng kết quả */}
        <div className="overflow-auto">
          <table className="min-w-[480px] w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Lựa chọn</th>
                <th className="py-2 pr-3 w-32">Số phiếu</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((r) => (
                <tr key={r.option} className="border-b">
                  <td className="py-2 pr-3">{r.option}</td>
                  <td className="py-2 pr-3">{r.count}</td>
                </tr>
              ))}
              {counts.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={2}>
                    Chưa có dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
            {counts.length > 0 && (
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2 pr-3">Tổng</td>
                  <td className="py-2 pr-3">{total}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <button onClick={loadCounts} disabled={loading || !selectedQ} className={`px-3 py-2 rounded text-white ${loading || !selectedQ ? 'bg-gray-400' : 'bg-black'}`}>
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>

        {toast && <div className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{toast.text}</div>}

        <div className="text-xs text-gray-500">* Tuỳ cấu trúc DB thực tế, đổi truy vấn cho khớp bảng trả lời.</div>
      </div>
    </div>
  );
}
