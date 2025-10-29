'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Item = {
  survey: {
    id: string;
    title: string;
    status: 'draft' | 'active' | 'inactive' | 'archived';
    created_at?: string;
    updated_at?: string;
    open_at?: string | null;   // API có thể trả null
    close_at?: string | null;  // API có thể trả null
  };
  assignment: {
    invited_at?: string | null;
    role?: string | null;
    role_vi?: string | null;           // 👈 API enrich
    department?: string | null;        // có thể là ID hoặc tên
    department_name?: string | null;   // 👈 API enrich: tên Bộ môn
    cohort?: string | null;            // có thể là ID hoặc label
    cohort_name?: string | null;       // 👈 API enrich: nhãn Khung/Khóa
    unit?: string | null;
  } | null;
  response: {
    id: string;
    is_submitted: boolean;
    submitted_at?: string | null;
  } | null;
  is_active: boolean;
  is_submitted: boolean;
  can_answer: boolean;
  link?: string | null;
};

function CardSkel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
      <div className="h-4 w-1/2 bg-slate-200 rounded" />
      <div className="mt-2 h-3 w-1/3 bg-slate-200 rounded" />
      <div className="mt-4 h-8 w-24 bg-slate-200 rounded" />
    </div>
  );
}

function viStatus(s: Item['survey']['status']) {
  switch (s) {
    case 'active': return 'Đang mở';
    case 'inactive': return 'Tạm ngưng';
    case 'archived': return 'Lưu trữ';
    default: return 'Nháp';
  }
}

function viRole(code?: string | null) {
  switch (code) {
    case 'lecturer': return 'Giảng viên';
    case 'student':  return 'Sinh viên';
    case 'support':  return 'Hỗ trợ';
    default:         return code ?? '';
  }
}

export default function TeacherSurveysPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/teacher/surveys'); // có thể thêm ?active=true|false|all&submitted=true|false|all
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Không tải được khảo sát');
        setItems(j.items || []);
      } catch (e: any) {
        setErr(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Khảo sát dành cho giảng viên</h2>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkel key={i} />)}
        </div>
      )}

      {!loading && err && <div className="text-sm text-red-600">Lỗi: {err}</div>}

      {!loading && !err && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const href = it.link || `/teacher/surveys/${it.survey.id}`;
            const deptLabel   = it.assignment?.department_name || it.assignment?.department || '';
            const cohortLabel = it.assignment?.cohort_name     || it.assignment?.cohort     || '';
            const roleLabel   = it.assignment?.role_vi || viRole(it.assignment?.role);

            return (
              <div key={it.survey.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-semibold">{it.survey.title}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Trạng thái: {viStatus(it.survey.status)}
                </div>

                {(it.survey.open_at || it.survey.close_at) && (
                  <div className="text-xs text-slate-600 mt-1">
                    {it.survey.open_at && <>Mở: {new Date(it.survey.open_at).toLocaleString()} · </>}
                    {it.survey.close_at && <>Đóng: {new Date(it.survey.close_at).toLocaleString()}</>}
                  </div>
                )}

                {roleLabel && (
                  <div className="text-xs text-slate-600 mt-1">Vai trò: {roleLabel}</div>
                )}
                {deptLabel && (
                  <div className="text-xs text-slate-600 mt-0.5">Bộ môn: {deptLabel}</div>
                )}
                {cohortLabel && (
                  <div className="text-xs text-slate-600 mt-0.5">Khung/Khóa: {cohortLabel}</div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  {it.is_submitted ? (
                    <Link href={href} className="px-3 py-2 rounded border">
                      Xem lại
                    </Link>
                  ) : (
                    <Link
                      href={href}
                      className={`px-3 py-2 rounded text-white ${it.can_answer ? 'bg-black hover:opacity-90' : 'bg-gray-400 cursor-not-allowed'}`}
                      aria-disabled={!it.can_answer}
                    >
                      {it.can_answer ? 'Làm khảo sát' : 'Chưa thể làm'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-sm text-slate-500">Hiện chưa có khảo sát được mời.</div>
          )}
        </div>
      )}
    </section>
  );
}
