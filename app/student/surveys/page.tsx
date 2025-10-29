'use client';

import Link from 'next/link';
import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';
import { SurveyCardSkel } from '../_shared';

type Item = {
  survey: {
    id: string;
    title: string;
    status: 'draft' | 'active' | 'inactive' | 'archived';
    created_at: string;
    updated_at: string;
  };
  assignment: {
    survey_id: string;
    role?: string | null;
    department?: string | null;
    cohort?: string | null;
    unit?: string | null;
    invited_at?: string | null;
  } | null;
  response: {
    id: string;
    is_submitted: boolean;
    submitted_at: string | null;
  } | null;
  is_active: boolean;
  is_submitted: boolean;
  can_answer: boolean;
};

type ApiResp = { items: Item[] };

const STATUS_LABEL: Record<Item['survey']['status'], string> = {
  draft: 'Nháp',
  active: 'Đang hoạt động',
  inactive: 'Tạm dừng',
  archived: 'Lưu trữ',
};

export default function StudentSurveysPage() {
  const { studentId } = useStudentCtx();
  const url = `/api/student/surveys${studentId ? `?student_id=${studentId}` : ''}`;
  const { data, loading, error } = useCachedJson<ApiResp>(url, 60_000);

  const items = data?.items ?? [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Khảo sát dành cho bạn</h2>

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SurveyCardSkel key={i} />
          ))}
        </div>
      )}

      {!loading && error && <div className="text-sm text-red-600">Lỗi tải dữ liệu: {error}</div>}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const tag =
              it.is_submitted ? (
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-green-700 border-green-200 bg-green-50">
                  Đã nộp
                </span>
              ) : it.is_active ? (
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-blue-700 border-blue-200 bg-blue-50">
                  {STATUS_LABEL[it.survey.status]}
                </span>
              ) : (
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-slate-700 border-slate-200 bg-slate-50">
                  {STATUS_LABEL[it.survey.status]}
                </span>
              );

            return (
              <Link
                key={it.survey.id}
                href={`/student/surveys/${it.survey.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition block"
              >
                <div className="font-semibold">{it.survey.title}</div>
                <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                  {tag}
                  {it.assignment?.invited_at && (
                    <span className="text-slate-500">
                      Mời: {new Date(it.assignment.invited_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {it.is_submitted ? (
                  <div className="mt-3 text-xs text-slate-600">Bạn đã nộp khảo sát này.</div>
                ) : it.is_active ? (
                  <div className="mt-3 text-xs text-slate-600">Nhấp để làm khảo sát.</div>
                ) : (
                  <div className="mt-3 text-xs text-slate-600">Khảo sát không còn hiệu lực.</div>
                )}
              </Link>
            );
          })}
          {items.length === 0 && (
            <div className="text-sm text-slate-500">Hiện chưa có khảo sát.</div>
          )}
        </div>
      )}
    </section>
  );
}
