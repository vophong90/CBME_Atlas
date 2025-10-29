'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type QType = 'single' | 'multi' | 'text';

type Survey = {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
};

type Question = {
  id: string;
  text: string;
  qtype: QType;
  required: boolean;
  sort_order: number;
  options: string[] | null; // lấy từ jsonb
};

type AnswerRow = {
  response_id: string;
  question_id: string;
  option: string | null;
  free_text: string | null;
};

type FormState = Record<
  string,
  { single?: string; multi?: string[]; text?: string }
>;

export default function StudentDoSurveyPage() {
  const supabase = getSupabase();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const surveyId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<FormState>({});

  async function ensureResponseRow(uid: string) {
    // 1) tìm response hiện hữu
    const q1 = await supabase
      .from('survey_responses')
      .select('id,is_submitted,submitted_at')
      .eq('survey_id', surveyId)
      .eq('respondent_id', uid)
      .maybeSingle();

    if (q1.error && q1.error.code !== 'PGRST116') throw q1.error;

    if (q1.data) {
      setResponseId(q1.data.id);
      setIsSubmitted(!!q1.data.is_submitted);
      return q1.data.id as string;
    }

    // 2) chưa có → tạo
    const ins = await supabase.from('survey_responses').insert([
      {
        survey_id: surveyId,
        respondent_id: uid,
        is_submitted: false,
      },
    ]).select('id').single();

    if (ins.error) throw ins.error;
    setResponseId(ins.data.id);
    setIsSubmitted(false);
    return ins.data.id as string;
  }

  async function load() {
    setLoading(true);
    setToast(null);
    try {
      // Lấy user
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Không xác thực được người dùng');

      // 1) Survey
      const sRes = await supabase
        .from('surveys')
        .select('id,title,status')
        .eq('id', surveyId)
        .single();
      if (sRes.error) throw sRes.error;
      setSurvey(sRes.data as Survey);

      // 2) Tạo/tìm survey_responses
      const rid = await ensureResponseRow(uid);

      // 3) Câu hỏi
      const qRes = await supabase
        .from('survey_questions')
        .select('id,text,qtype,required,sort_order,options')
        .eq('survey_id', surveyId)
        .order('sort_order', { ascending: true });
      if (qRes.error && qRes.error.code !== '42P01') throw qRes.error;

      const qs = (qRes.data ?? []).map((q: any) => ({
        id: q.id,
        text: q.text,
        qtype: q.qtype as QType,
        required: !!q.required,
        sort_order: q.sort_order ?? 0,
        options: Array.isArray(q.options) ? q.options : q.options?.options ?? null, // phòng trường hợp options dạng {options:[...]}
      })) as Question[];

      setQuestions(qs);

      // 4) Câu trả lời cũ (nếu có)
      const aRes = await supabase
        .from('survey_answers')
        .select('response_id,question_id,option,free_text')
        .eq('response_id', rid);

      if (aRes.error && aRes.error.code !== '42P01') throw aRes.error;

      const formInit: FormState = {};
      const rows = (aRes.data ?? []) as AnswerRow[];
      for (const q of qs) {
        const arr = rows.filter((r) => r.question_id === q.id);
        if (q.qtype === 'single') {
          const opt = arr.find((r) => r.option != null)?.option ?? '';
          formInit[q.id] = { single: opt || '' };
        } else if (q.qtype === 'multi') {
          const opts = arr.filter((r) => r.option != null).map((r) => r.option!) ?? [];
          formInit[q.id] = { multi: opts };
        } else {
          const txt = arr.find((r) => r.free_text != null)?.free_text ?? '';
          formInit[q.id] = { text: txt || '' };
        }
      }
      setForm(formInit);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được khảo sát' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  function setSingle(qid: string, v: string) {
    setForm((f) => ({ ...f, [qid]: { ...(f[qid] || {}), single: v } }));
  }
  function toggleMulti(qid: string, v: string) {
    setForm((f) => {
      const now = new Set([...(f[qid]?.multi || [])]);
      if (now.has(v)) now.delete(v);
      else now.add(v);
      return { ...f, [qid]: { ...(f[qid] || {}), multi: [...now] } };
    });
  }
  function setText(qid: string, v: string) {
    setForm((f) => ({ ...f, [qid]: { ...(f[qid] || {}), text: v } }));
  }

  const requiredErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const q of questions) {
      if (!q.required) continue;
      const ans = form[q.id] || {};
      if (q.qtype === 'single' && !ans.single) errs[q.id] = 'Câu này là bắt buộc.';
      if (q.qtype === 'multi' && (!ans.multi || ans.multi.length === 0)) errs[q.id] = 'Câu này là bắt buộc.';
      if (q.qtype === 'text' && !ans.text?.trim()) errs[q.id] = 'Câu này là bắt buộc.';
    }
    return errs;
  }, [questions, form]);

  async function persistAnswers() {
    if (!responseId) throw new Error('Thiếu response id');
    // Xoá & chèn mới cho từng câu (đơn giản, an toàn với các unique index)
    for (const q of questions) {
      const del = await supabase
        .from('survey_answers')
        .delete()
        .eq('response_id', responseId)
        .eq('question_id', q.id);
      if (del.error && del.error.code !== 'PGRST116') throw del.error;

      const ans = form[q.id] || {};
      if (q.qtype === 'single') {
        if (ans.single) {
          const ins = await supabase.from('survey_answers').insert([
            { response_id: responseId, question_id: q.id, option: ans.single },
          ]);
          if (ins.error) throw ins.error;
        }
      } else if (q.qtype === 'multi') {
        const opts = ans.multi || [];
        if (opts.length > 0) {
          const rows = opts.map((opt: string) => ({
            response_id: responseId,
            question_id: q.id,
            option: opt,
          }));
          const ins = await supabase.from('survey_answers').insert(rows);
          if (ins.error) throw ins.error;
        }
      } else {
        const txt = (ans.text || '').trim();
        if (txt) {
          const ins = await supabase.from('survey_answers').insert([
            { response_id: responseId, question_id: q.id, free_text: txt },
          ]);
          if (ins.error) throw ins.error;
        }
      }
    }
  }

  async function onSaveDraft() {
    setSaving(true);
    setToast(null);
    try {
      if (isSubmitted) {
        setToast({ type: 'error', text: 'Phiếu đã gửi, không thể sửa.' });
        return;
      }
      await persistAnswers();
      setToast({ type: 'success', text: 'Đã lưu nháp.' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Lưu nháp thất bại' });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    setToast(null);
    try {
      if (isSubmitted) {
        setToast({ type: 'error', text: 'Phiếu đã gửi, không thể gửi lại.' });
        return;
      }
      // kiểm tra bắt buộc
      const errs = Object.keys(requiredErrors);
      if (errs.length > 0) {
        const firstQ = errs[0];
        const idx = questions.findIndex((q) => q.id === firstQ);
        setToast({
          type: 'error',
          text: `Còn ${errs.length} câu bắt buộc chưa trả lời. Vui lòng kiểm tra từ câu ${idx + 1}.`,
        });
        setSubmitting(false);
        return;
      }
      // lưu & đánh dấu submit
      await persistAnswers();
      const upd = await supabase
        .from('survey_responses')
        .update({ is_submitted: true, submitted_at: new Date().toISOString() })
        .eq('id', responseId!);
      if (upd.error) throw upd.error;

      setIsSubmitted(true);
      setToast({ type: 'success', text: 'Đã gửi nộp khảo sát. Cảm ơn bạn!' });
      // tuỳ ý: router.refresh();
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Gửi nộp thất bại' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {survey?.title || 'Khảo sát'}
        </h1>
        {survey?.status && (
          <div className="mt-1 text-sm text-slate-600">
            Trạng thái: <b>{survey.status === 'active' ? 'Đang hoạt động' :
            survey.status === 'inactive' ? 'Tạm dừng' :
            survey.status === 'archived' ? 'Lưu trữ' : 'Nháp'}</b>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-slate-600">Đang tải…</div>}

      {!loading && questions.length === 0 && (
        <div className="text-sm text-slate-600">Chưa cấu hình bảng câu hỏi.</div>
      )}

      {!loading && questions.length > 0 && (
        <form className="space-y-5">
          {questions.map((q, i) => {
            const err = requiredErrors[q.id];
            return (
              <div key={q.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-slate-500">{i + 1}.</div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {q.text}{' '}
                      {q.required && <span className="text-red-600">*</span>}
                    </div>

                    {/* SINGLE */}
                    {q.qtype === 'single' && (
                      <div className="mt-2 space-y-2">
                        {(q.options ?? []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              disabled={isSubmitted}
                              checked={(form[q.id]?.single || '') === opt}
                              onChange={() => setSingle(q.id, opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* MULTI */}
                    {q.qtype === 'multi' && (
                      <div className="mt-2 space-y-2">
                        {(q.options ?? []).map((opt) => {
                          const checked = (form[q.id]?.multi || []).includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={isSubmitted}
                                checked={checked}
                                onChange={() => toggleMulti(q.id, opt)}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* TEXT */}
                    {q.qtype === 'text' && (
                      <div className="mt-2">
                        <textarea
                          className="w-full rounded border p-2"
                          rows={4}
                          disabled={isSubmitted}
                          value={form[q.id]?.text || ''}
                          onChange={(e) => setText(q.id, e.target.value)}
                        />
                      </div>
                    )}

                    {err && (
                      <div className="mt-2 text-xs text-red-600">{err}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || submitting || isSubmitted}
              onClick={onSaveDraft}
              className={`px-3 py-2 rounded border ${saving || submitting || isSubmitted ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-slate-50'}`}
            >
              Lưu nháp
            </button>
            <button
              type="button"
              disabled={submitting || isSubmitted}
              onClick={onSubmit}
              className={`px-3 py-2 rounded text-white ${submitting || isSubmitted ? 'bg-gray-400' : 'bg-black'}`}
            >
              {isSubmitted ? 'Đã gửi' : (submitting ? 'Đang gửi…' : 'Gửi nộp')}
            </button>
            {isSubmitted && (
              <div className="text-sm text-green-700">Bạn đã gửi khảo sát này.</div>
            )}
          </div>

          {toast && (
            <div className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {toast.text}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
