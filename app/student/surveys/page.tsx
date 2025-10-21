'use client';

import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';
import { SurveyCardSkel } from '../_shared';

type Survey = { id: string; title: string; issuer: string; open_at?: string; close_at?: string; link?: string };

export default function StudentSurveysPage() {
  const { studentId } = useStudentCtx();
  const url = `/api/student/surveys${studentId ? `?student_id=${studentId}` : ''}`;
  const { data, loading, error } = useCachedJson<Survey[]>(url, 60_000);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Khảo sát dành cho bạn</h2>

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:6}).map((_,i)=><SurveyCardSkel key={i} />)}
        </div>
      )}

      {!loading && error && <div className="text-sm text-red-600">Lỗi tải dữ liệu: {error}</div>}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data||[]).map(s=>(
            <a key={s.id} href={s.link || '#'} target="_blank"
               className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition">
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs text-slate-600 mt-1">{s.issuer}</div>
              {(s.open_at || s.close_at) && (
                <div className="text-xs text-slate-600 mt-1">
                  {s.open_at && <>Mở: {new Date(s.open_at).toLocaleString()} · </>}
                  {s.close_at && <>Đóng: {new Date(s.close_at).toLocaleString()}</>}
                </div>
              )}
            </a>
          ))}
          {(data||[]).length===0 && <div className="text-sm text-slate-500">Hiện chưa có khảo sát.</div>}
        </div>
      )}
    </section>
  );
}
