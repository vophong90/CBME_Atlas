// app/student/rubrics/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { useStudentCtx } from '../context';

/** ================== Types ================== */
type Observation = {
  id: string;
  student_id: string;
  course_id: string;
  rubric_id: string;
  rater_id: string | null;
  observed_at: string;
  note: string | null;
  artifact_url: string | null;
  pdf_url: string | null;
  kind: 'teacher' | 'eval360' | 'draft' | 'submitted' | string;
};

type Course = {
  id: string;
  course_code: string;
  course_name: string | null;
};

type Rubric = {
  id: string;
  title: string;
  threshold: number;
  definition: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<{ id?: string; key?: string; label: string }>;
  };
};

type ItemScore = {
  observation_id: string;
  rubric_item_id: string;
  level_rank: number | null;
  level_label: string | null;
  raw_score: number | string | null;
  item_key: string | null;
  selected_level: string | null;
  score: number | string | null;
  comment: string | null;
};

type CLOAgg = {
  observation_id: string;
  clo_id: string;
  derived_level_rank: number;
  derived_level_label: string;
};

/** ================== Page ================== */
export default function StudentRubricsPage() {
  const supabase = getSupabase();
  const { studentId, mssv } = useStudentCtx();

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [studentRowId, setStudentRowId] = useState<string | null>(null);

  const [observations, setObservations] = useState<Observation[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [rubricMap, setRubricMap] = useState<Record<string, Rubric>>({});

  const [selectedObsId, setSelectedObsId] = useState<string>('');
  const [itemScores, setItemScores] = useState<ItemScore[]>([]);
  const [cloAgg, setCloAgg] = useState<CLOAgg[]>([]);

  /** ----- Helper: label tiếng Việt cho kind ----- */
  const kindLabel = (k: string) =>
    k === 'teacher'
      ? 'Giảng viên'
      : k === 'eval360'
      ? 'Đánh giá 360'
      : k === 'submitted'
      ? 'Đã nộp'
      : k === 'draft'
      ? 'Nháp'
      : k;

  /** ----- Step 0: Xác định student.id khi context chưa có ----- */
  useEffect(() => {
    (async () => {
      setErrorMsg(null);
      try {
        if (studentId) {
          setStudentRowId(studentId);
          return;
        }
        if (mssv) {
          const { data, error } = await supabase
            .from('students')
            .select('id')
            .eq('mssv', mssv)
            .maybeSingle();
          if (error) throw error;
          setStudentRowId(data?.id ?? null);
        } else {
          setStudentRowId(null);
        }
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Không xác định được sinh viên.');
        setStudentRowId(null);
      }
    })();
  }, [studentId, mssv, supabase]);

  /** ----- Step 1: Tải danh sách các lần chấm (observations) của SV ----- */
  useEffect(() => {
    if (!studentRowId) {
      setLoadingList(false);
      return;
    }
    (async () => {
      setLoadingList(true);
      setErrorMsg(null);
      try {
        // Lấy tất cả observation đã chấm (loại bỏ draft)
        const { data: obs, error: eObs } = await supabase
          .from('observations')
          .select(
            'id, student_id, course_id, rubric_id, rater_id, observed_at, note, artifact_url, pdf_url, kind'
          )
          .eq('student_id', studentRowId)
          .neq('kind', 'draft')
          .order('observed_at', { ascending: false });
        if (eObs) throw eObs;

        const observations = (obs || []) as Observation[];
        setObservations(observations);

        // Lấy course và rubric tương ứng
        const courseIds = Array.from(new Set(observations.map((o) => o.course_id).filter(Boolean)));
        const rubricIds = Array.from(new Set(observations.map((o) => o.rubric_id).filter(Boolean)));

        if (courseIds.length > 0) {
          const { data: cData, error: eC } = await supabase
            .from('courses')
            .select('id, course_code, course_name')
            .in('id', courseIds);
          if (eC) throw eC;
          const cmap: Record<string, Course> = {};
          (cData || []).forEach((c: any) => (cmap[c.id] = c));
          setCourseMap(cmap);
        } else {
          setCourseMap({});
        }

        if (rubricIds.length > 0) {
          const { data: rData, error: eR } = await supabase
            .from('rubrics')
            .select('id, title, threshold, definition')
            .in('id', rubricIds);
          if (eR) throw eR;
          const rmap: Record<string, Rubric> = {};
          (rData || []).forEach((r: any) => (rmap[r.id] = r));
          setRubricMap(rmap);
        } else {
          setRubricMap({});
        }
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Lỗi tải danh sách rubric.');
      } finally {
        setLoadingList(false);
      }
    })();
  }, [studentRowId, supabase]);

  /** ----- Step 2: Khi chọn 1 observation → tải chi tiết điểm ----- */
  useEffect(() => {
    if (!selectedObsId) {
      setItemScores([]);
      setCloAgg([]);
      return;
    }
    (async () => {
      setLoadingDetail(true);
      setErrorMsg(null);
      try {
        const [{ data: items, error: e1 }, { data: aggs, error: e2 }] = await Promise.all([
          supabase
            .from('observation_item_scores')
            .select(
              'observation_id, rubric_item_id, level_rank, level_label, raw_score, item_key, selected_level, score, comment'
            )
            .eq('observation_id', selectedObsId),
          supabase
            .from('observation_clo_results')
            .select('observation_id, clo_id, derived_level_rank, derived_level_label')
            .eq('observation_id', selectedObsId),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setItemScores((items || []) as ItemScore[]);
        setCloAgg((aggs || []) as CLOAgg[]);
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Lỗi tải chi tiết rubric.');
        setItemScores([]);
        setCloAgg([]);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedObsId, supabase]);

  /** ----- Chọn observation đầu tiên mặc định ----- */
  useEffect(() => {
    if (observations.length > 0 && !selectedObsId) {
      setSelectedObsId(observations[0].id);
    }
  }, [observations, selectedObsId]);

  /** ----- Derive detail for selected observation ----- */
  const selectedObs = useMemo(
    () => observations.find((o) => o.id === selectedObsId) || null,
    [observations, selectedObsId]
  );
  const selectedRubric = selectedObs ? rubricMap[selectedObs.rubric_id] : undefined;
  const selectedCourse = selectedObs ? courseMap[selectedObs.course_id] : undefined;

  /** ----- Build label map from rubric definition ----- */
  const itemLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    if (selectedRubric?.definition?.rows) {
      for (const r of selectedRubric.definition.rows) {
        if (r.id) map[r.id] = r.label;
        if (r.key) map[r.key] = r.label;
      }
    }
    return map;
  }, [selectedRubric]);

  /** ----- Tính tổng điểm ----- */
  const totalScore = useMemo(
    () =>
      itemScores.reduce((acc, it) => acc + (it.score != null ? Number(it.score) : 0), 0),
    [itemScores]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Rubric đã được chấm</h2>
            <p className="text-sm text-slate-600">
              Danh sách các lần đánh giá bằng rubric dành cho bạn. Chọn một dòng để xem chi tiết điểm và nhận xét.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {loadingList ? 'Đang tải…' : `${observations.length} lần chấm`}
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        {/* Danh sách rubric/observations */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Thời gian</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Học phần</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Rubric</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Loại</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-700">Tệp</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-700">Xem</th>
              </tr>
            </thead>
            <tbody>
              {observations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    Chưa có lần chấm nào.
                  </td>
                </tr>
              ) : (
                observations.map((o) => {
                  const c = courseMap[o.course_id];
                  const r = rubricMap[o.rubric_id];
                  const active = o.id === selectedObsId;
                  return (
                    <tr
                      key={o.id}
                      className={[
                        'transition',
                        active ? 'bg-brand-50/60' : 'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">
                        {new Date(o.observed_at).toLocaleString()}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="font-medium text-slate-800">
                          {c ? `${c.course_code} — ${c.course_name || ''}` : '—'}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="text-slate-800">{r ? r.title : '—'}</div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {kindLabel(o.kind)}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {o.artifact_url ? (
                            <a
                              href={o.artifact_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-700 hover:underline"
                            >
                              Artifact
                            </a>
                          ) : null}
                          {o.pdf_url ? (
                            <a
                              href={o.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-700 hover:underline"
                            >
                              PDF
                            </a>
                          ) : null}
                          {!o.artifact_url && !o.pdf_url ? <span className="text-slate-400">—</span> : null}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right">
                        <button
                          onClick={() => setSelectedObsId(o.id)}
                          className={[
                            'rounded-lg px-3 py-1.5 text-sm font-semibold',
                            active
                              ? 'bg-brand-600 text-white shadow'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {active ? 'Đang xem' : 'Xem'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chi tiết rubric đã chọn */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Kết quả chi tiết</h3>
            <p className="text-sm text-slate-600">
              Hiển thị toàn bộ bảng điểm rubric, gồm mức đánh giá và nhận xét của giảng viên.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {selectedObs ? (
              <>
                {selectedCourse ? (
                  <span className="mr-3">
                    Học phần:{' '}
                    <span className="font-medium">
                      {selectedCourse.course_code} — {selectedCourse.course_name || ''}
                    </span>
                  </span>
                ) : null}
                {selectedRubric ? (
                  <span>
                    Rubric: <span className="font-medium">{selectedRubric.title}</span>
                  </span>
                ) : null}
              </>
            ) : (
              'Chọn một dòng ở bảng trên'
            )}
          </div>
        </div>

        {/* Tổng quan điểm */}
        {selectedRubric && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Tổng điểm</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{Number(totalScore).toFixed(2)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Ngưỡng đạt (threshold)</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {Number(selectedRubric.threshold).toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Kết luận</div>
              <div
                className={[
                  'mt-1 inline-flex rounded-lg px-2 py-1 text-sm font-semibold',
                  Number(totalScore) >= Number(selectedRubric.threshold)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700',
                ].join(' ')}
              >
                {Number(totalScore) >= Number(selectedRubric.threshold) ? 'Đạt' : 'Chưa đạt'}
              </div>
            </div>
          </div>
        )}

        {/* Bảng điểm theo tiêu chí */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-1/3 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                  Tiêu chí
                </th>
                <th className="w-1/6 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                  Mức đã chọn
                </th>
                <th className="w-1/6 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                  Điểm
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                  Nhận xét của GV
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingDetail && selectedObs ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Đang tải chi tiết…
                  </td>
                </tr>
              ) : !selectedObs ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Chọn một lần chấm ở bảng phía trên để xem chi tiết.
                  </td>
                </tr>
              ) : itemScores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Chưa có mục điểm nào cho lần chấm này.
                  </td>
                </tr>
              ) : (
                itemScores.map((it) => {
                  const label =
                    (it.rubric_item_id && itemLabelById[it.rubric_item_id]) ||
                    (it.item_key && itemLabelById[it.item_key]) ||
                    it.item_key ||
                    it.rubric_item_id;
                  const level = it.level_label || it.selected_level || '—';
                  const score =
                    it.score != null
                      ? Number(it.score).toFixed(2)
                      : it.raw_score != null
                      ? Number(it.raw_score).toFixed(2)
                      : '—';
                  return (
                    <tr key={`${it.observation_id}_${it.rubric_item_id}`} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-800">{label}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{level}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{score}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                        {it.comment || <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ghi chú / đính kèm */}
        {selectedObs && (selectedObs.note || selectedObs.pdf_url || selectedObs.artifact_url) ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Ghi chú của giảng viên</div>
              <div className="mt-1 text-sm text-slate-800">
                {selectedObs.note || <span className="text-slate-400">—</span>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Tệp đính kèm</div>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                {selectedObs.artifact_url ? (
                  <a className="text-brand-700 hover:underline" href={selectedObs.artifact_url} target="_blank" rel="noreferrer">
                    Artifact minh chứng
                  </a>
                ) : (
                  <span className="text-slate-400">Không có artifact</span>
                )}
                {selectedObs.pdf_url ? (
                  <a className="text-brand-700 hover:underline" href={selectedObs.pdf_url} target="_blank" rel="noreferrer">
                    Bản PDF kết quả
                  </a>
                ) : (
                  <span className="text-slate-400">Không có PDF</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Tổng hợp theo CLO (nếu có) */}
        {selectedObs && cloAgg.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-800">Tổng hợp mức đạt theo CLO</div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-40 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      CLO
                    </th>
                    <th className="w-40 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      Mức
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      Nhãn mức
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cloAgg.map((g) => (
                    <tr key={`${g.observation_id}_${g.clo_id}`} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-800">{g.clo_id}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{g.derived_level_rank}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{g.derived_level_label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
