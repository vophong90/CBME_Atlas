'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type QType = 'single' | 'multi' | 'text';

type Choice = { id: string; label: string };
type OptionsSingleMulti = {
  choices: Choice[];
  other?: boolean;
  shuffle?: boolean;
  max_select?: number | null; // chỉ dùng cho 'multi'
};
type OptionsText = {
  placeholder?: string;
  max_length?: number | null;
};

type QuestionRow = {
  id?: string;
  survey_id: string;
  text: string;
  qtype: QType;
  sort_order: number;
  required: boolean;
  options: OptionsSingleMulti | OptionsText | null;
  _local?: 'new' | 'edit' | undefined; // flag UI
};

function defaultOptions(t: QType): QuestionRow['options'] {
  if (t === 'text') return { placeholder: 'Nhập câu trả lời...', max_length: 500 };
  return { choices: [{ id: crypto.randomUUID(), label: 'Lựa chọn 1' }], other: false, shuffle: false, max_select: null };
}

export default function SurveyBuilder() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const supabase = getSupabase();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<QuestionRow[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const nextOrder = useMemo(
    () => (list.length ? Math.max(...list.map((q) => q.sort_order)) + 1 : 1),
    [list]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setToast(null);
      try {
        const { data, error } = await supabase
          .from('survey_questions')
          .select('*')
          .eq('survey_id', surveyId)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setList((data || []) as QuestionRow[]);
      } catch (e: any) {
        setToast({ type: 'error', text: e.message ?? 'Không tải được câu hỏi' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const add = (t: QType) => {
    setList((prev) => [
      ...prev,
      {
        id: undefined,
        survey_id: String(surveyId),
        text: 'Câu hỏi mới',
        qtype: t,
        sort_order: nextOrder,
        required: false,
        options: defaultOptions(t),
        _local: 'new',
      },
    ]);
  };

  const changeType = (id: string | undefined, t: QType) => {
    setList((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, qtype: t, options: defaultOptions(t), _local: q.id ? 'edit' : q._local }
          : q
      )
    );
  };

  const move = (id: string | undefined, dir: 'up' | 'down') => {
    const arr = [...list];
    const idx = arr.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= arr.length) return;
    const a = arr[idx];
    const b = arr[swapWith];
    const ao = a.sort_order;
    a.sort_order = b.sort_order;
    b.sort_order = ao;
    a._local = a.id ? 'edit' : a._local;
    b._local = b.id ? 'edit' : b._local;
    setList(arr.sort((x, y) => x.sort_order - y.sort_order));
  };

  const remove = (id?: string) => {
    setList((prev) => prev.filter((q) => q.id !== id || id === undefined).filter((q) => q.id !== id));
  };

  // ====== Batch Save via API ======
  const saveAll = async () => {
    setSaving(true);
    setToast(null);
    try {
      const create = list
        .filter((q) => !q.id)
        .map((q) => ({
          text: q.text.trim(),
          qtype: q.qtype,
          sort_order: q.sort_order,
          required: !!q.required,
          options: q.options ?? null,
        }));

      const update = list
        .filter((q) => q.id && q._local === 'edit')
        .map((q) => ({
          id: q.id!,
          text: q.text.trim(),
          qtype: q.qtype,
          sort_order: q.sort_order,
          required: !!q.required,
          options: q.options ?? null,
        }));

      // tìm id đã bị xoá (trên server có nhưng trong list không còn)
      const { data: existing, error: errLoad } = await supabase
        .from('survey_questions')
        .select('id')
        .eq('survey_id', surveyId);
      if (errLoad) throw errLoad;
      const keepIds = new Set(list.filter((q) => q.id).map((q) => q.id));
      const remove = (existing || [])
        .map((r: any) => r.id as string)
        .filter((id: string) => !keepIds.has(id));

      const res = await fetch(`/api/qa/surveys/${surveyId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ create, update, remove }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Không lưu được thay đổi');

      // reload
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      setList((data || []) as QuestionRow[]);
      setToast({ type: 'success', text: 'Đã lưu bảng câu hỏi' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Lỗi khi lưu' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thiết kế bảng câu hỏi</h1>
        <div className="flex gap-2">
          <button onClick={() => add('single')} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white">+ Đơn chọn</button>
          <button onClick={() => add('multi')}  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white">+ Nhiều chọn</button>
          <button onClick={() => add('text')}   className="px-3 py-1.5 rounded-lg bg-brand-600 text-white">+ Tự luận</button>
          <button onClick={saveAll} disabled={saving} className="px-3 py-1.5 rounded-lg border">
            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`p-3 rounded-md ${toast.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {toast.text}
        </div>
      )}
      {loading && <div>Đang tải...</div>}

      <div className="space-y-4">
        {list.map((q) => (
          <div key={q.id ?? `new-${q.sort_order}`} className="rounded-2xl border p-4 shadow-sm bg-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">#{q.sort_order}</div>
              <div className="flex gap-2">
                <button onClick={() => move(q.id, 'up')}   className="px-2 py-1 rounded border">Lên</button>
                <button onClick={() => move(q.id, 'down')} className="px-2 py-1 rounded border">Xuống</button>
                {q.id && (
                  <button onClick={() => remove(q.id)} className="px-2 py-1 rounded border border-red-300 text-red-600">Xoá</button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Nhập nội dung câu hỏi"
                  value={q.text}
                  onChange={(e) =>
                    setList((prev) =>
                      prev.map((x) => (x === q ? { ...x, text: e.target.value, _local: x.id ? 'edit' : x._local } : x))
                    )
                  }
                />
              </div>
              <div className="md:col-span-2">
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={q.qtype}
                  onChange={(e) => changeType(q.id, e.target.value as QType)}
                >
                  <option value="single">Đơn chọn</option>
                  <option value="multi">Nhiều chọn</option>
                  <option value="text">Tự luận</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  min={0}
                  className="w-full border rounded-lg px-3 py-2"
                  value={q.sort_order}
                  onChange={(e) =>
                    setList((prev) =>
                      prev
                        .map((x) => (x === q ? { ...x, sort_order: Number(e.target.value) || 0, _local: x.id ? 'edit' : x._local } : x))
                        .sort((a, b) => a.sort_order - b.sort_order)
                    )
                  }
                />
              </div>
              <div className="md:col-span-1 flex items-center gap-2">
                <input
                  id={`req-${q.id ?? q.sort_order}`}
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) =>
                    setList((prev) =>
                      prev.map((x) => (x === q ? { ...x, required: e.target.checked, _local: x.id ? 'edit' : x._local } : x))
                    )
                  }
                />
                <label htmlFor={`req-${q.id ?? q.sort_order}`} className="text-sm">Bắt buộc</label>
              </div>
            </div>

            {/* Config theo loại */}
            {(q.qtype === 'single' || q.qtype === 'multi') && (
              <div className="mt-3 space-y-3">
                {((q.options as OptionsSingleMulti)?.choices ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="w-5 text-slate-400">{q.qtype === 'single' ? '○' : '☑'}</div>
                    <input
                      className="flex-1 border rounded-lg px-3 py-1.5"
                      value={c.label}
                      onChange={(e) =>
                        setList((prev) =>
                          prev.map((x) => {
                            if (x !== q) return x;
                            const opts = (x.options as OptionsSingleMulti) ?? { choices: [] };
                            return {
                              ...x,
                              options: {
                                ...opts,
                                choices: (opts.choices || []).map((cc) => (cc.id === c.id ? { ...cc, label: e.target.value } : cc)),
                              },
                              _local: x.id ? 'edit' : x._local,
                            };
                          })
                        )
                      }
                    />
                    <button
                      onClick={() =>
                        setList((prev) =>
                          prev.map((x) => {
                            if (x !== q) return x;
                            const opts = (x.options as OptionsSingleMulti) ?? { choices: [] };
                            return {
                              ...x,
                              options: { ...opts, choices: (opts.choices || []).filter((cc) => cc.id !== c.id) },
                              _local: x.id ? 'edit' : x._local,
                            };
                          })
                        )
                      }
                      className="px-2 py-1 rounded border"
                    >
                      Xoá
                    </button>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      setList((prev) =>
                        prev.map((x) =>
                          x !== q
                            ? x
                            : {
                                ...x,
                                options: {
                                  ...(x.options as OptionsSingleMulti),
                                  choices: [
                                    ...(((x.options as OptionsSingleMulti)?.choices) || []),
                                    { id: crypto.randomUUID(), label: 'Lựa chọn mới' },
                                  ],
                                },
                                _local: x.id ? 'edit' : x._local,
                              }
                        )
                      )
                    }
                    className="px-3 py-1.5 rounded-lg border"
                  >
                    + Thêm lựa chọn
                  </button>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean((q.options as OptionsSingleMulti)?.other)}
                      onChange={(e) =>
                        setList((prev) =>
                          prev.map((x) =>
                            x !== q
                              ? x
                              : {
                                  ...x,
                                  options: { ...(x.options as OptionsSingleMulti), other: e.target.checked },
                                  _local: x.id ? 'edit' : x._local,
                                }
                          )
                        )
                      }
                    />
                    Cho phép “Khác…”
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean((q.options as OptionsSingleMulti)?.shuffle)}
                      onChange={(e) =>
                        setList((prev) =>
                          prev.map((x) =>
                            x !== q
                              ? x
                              : {
                                  ...x,
                                  options: { ...(x.options as OptionsSingleMulti), shuffle: e.target.checked },
                                  _local: x.id ? 'edit' : x._local,
                                }
                          )
                        )
                      }
                    />
                    Xáo trộn lựa chọn
                  </label>

                  {q.qtype === 'multi' && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Tối đa chọn:</span>
                      <input
                        type="number"
                        min={0}
                        className="w-20 border rounded-lg px-2 py-1"
                        value={(q.options as OptionsSingleMulti)?.max_select ?? 0}
                        onChange={(e) =>
                          setList((prev) =>
                            prev.map((x) =>
                              x !== q
                                ? x
                                : {
                                    ...x,
                                    options: {
                                      ...(x.options as OptionsSingleMulti),
                                      max_select: Number(e.target.value) || null,
                                    },
                                    _local: x.id ? 'edit' : x._local,
                                  }
                            )
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {q.qtype === 'text' && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Placeholder"
                  value={(q.options as OptionsText)?.placeholder || ''}
                  onChange={(e) =>
                    setList((prev) =>
                      prev.map((x) =>
                        x !== q
                          ? x
                          : {
                              ...x,
                              options: { ...(x.options as OptionsText), placeholder: e.target.value },
                              _local: x.id ? 'edit' : x._local,
                            }
                      )
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm">Giới hạn ký tự:</span>
                  <input
                    type="number"
                    min={0}
                    className="w-28 border rounded-lg px-2 py-1"
                    value={(q.options as OptionsText)?.max_length ?? 0}
                    onChange={(e) =>
                      setList((prev) =>
                        prev.map((x) =>
                          x !== q
                            ? x
                            : {
                                ...x,
                                options: { ...(x.options as OptionsText), max_length: Number(e.target.value) || null },
                                _local: x.id ? 'edit' : x._local,
                              }
                        )
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {!loading && list.length === 0 && (
          <div className="text-sm text-slate-500">Chưa có câu hỏi nào. Bấm các nút phía trên để thêm.</div>
        )}
      </div>
    </div>
  );
}
