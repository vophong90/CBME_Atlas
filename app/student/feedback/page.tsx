'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';

type FeedbackTargetKind = 'course' | 'faculty';

type CourseItem = { code: string; name: string | null; department: { id: string; name: string } | null };
type TeacherItem = { user_id: string; full_name: string; department_id?: string | null; department_name?: string | null };

export default function StudentFeedbackPage() {
  const { studentId } = useStudentCtx();

  const coursesUrl  = `/api/student/courses${studentId ? `?student_id=${studentId}` : ''}`;
  const teachersUrl = `/api/student/teachers${studentId ? `?student_id=${studentId}` : ''}`;

  const { data: coursesResp,  loading: loadingCourses }  = useCachedJson<{items: CourseItem[]}>(coursesUrl,  120_000);
  const { data: teachersResp, loading: loadingTeachers } = useCachedJson<{items: TeacherItem[]}>(teachersUrl, 120_000);

  const courseList  = coursesResp?.items || [];
  const teacherList = teachersResp?.items || [];

  const [fbKind, setFbKind] = useState<FeedbackTargetKind>('course');
  const [fbText, setFbText] = useState('');
  const [fbCourse, setFbCourse] = useState('');   // course_code
  const [fbTeacher, setFbTeacher] = useState(''); // teacher user_id
  const [canSend, setCanSend] = useState(false);
  const [moderationMsg, setModerationMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const target = useMemo(() => (fbKind === 'course' ? fbCourse : fbTeacher), [fbKind, fbCourse, fbTeacher]);
  const textLen = fbText.trim().length;
  const tooShort = textLen > 0 && textLen < 10;

  useEffect(() => {
    setCanSend(false);
    setModerationMsg('');
  }, [fbKind, fbCourse, fbTeacher, fbText]);

  async function moderateFeedback(text: string, kind: FeedbackTargetKind, target: string) {
    setChecking(true);
    setModerationMsg('Đang kiểm tra nội dung góp ý…');
    setCanSend(false);
    try {
      const res = await fetch('/api/student/feedback/moderate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, kind, target }),
      });
      const js = await res.json();
      const ok = !!js.ok;
      setCanSend(ok);
      setModerationMsg(ok ? '✅ Nội dung phù hợp, bạn có thể gửi.' : `❌ ${js.reason || 'Nội dung chưa phù hợp.'}`);
    } catch {
      setCanSend(false);
      setModerationMsg('❌ Không kiểm tra được nội dung, vui lòng thử lại.');
    } finally {
      setChecking(false);
    }
  }

  async function submitFeedback() {
    if (!canSend || !studentId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          kind: fbKind,
          target,
          text: fbText,
        }),
      });
      const js = await res.json();
      if (!res.ok || !js?.ok) {
        alert(js?.error || 'Gửi góp ý thất bại');
        return;
      }
      setFbText('');
      setFbCourse('');
      setFbTeacher('');
      setCanSend(false);
      setModerationMsg('✅ Đã gửi góp ý. Cảm ơn bạn!');
    } finally {
      setSubmitting(false);
    }
  }

  const disableCheck =
    checking ||
    !target ||
    !fbText.trim() ||
    tooShort ||
    (fbKind === 'course' ? loadingCourses : loadingTeachers);

  return (
    <section className="space-y-4">
      {/* Tiêu đề trang */}
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">Phản hồi học phần và giảng viên</h2>
        <p className="text-sm text-slate-600">Hệ thống sẽ kiểm duyệt nội dung trước khi gửi.</p>
      </header>

      {/* Card toàn khung: phần chọn + phần nhập */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
        {/* Phần trên: chọn đối tượng nhận góp ý */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Gửi cho</label>
            <select
              value={fbKind}
              onChange={(e) => setFbKind(e.target.value as FeedbackTargetKind)}
              className="w-full rounded-md border px-2 py-2 text-sm"
            >
              <option value="course">Học phần</option>
              <option value="faculty">Giảng viên</option>
            </select>
          </div>

          {fbKind === 'course' ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Chọn học phần</label>
              {loadingCourses ? (
                <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
              ) : (
                <select
                  value={fbCourse}
                  onChange={(e) => setFbCourse(e.target.value)}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">— Chọn học phần —</option>
                  {courseList.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} – {c.name || 'Không tên'}
                      {c.department ? ` · ${c.department.name}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-500">
                Góp ý học phần sẽ được gửi về Bộ môn quản lý học phần đó.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Chọn giảng viên</label>
              {loadingTeachers ? (
                <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
              ) : (
                <select
                  value={fbTeacher}
                  onChange={(e) => setFbTeacher(e.target.value)}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">— Chọn giảng viên —</option>
                  {teacherList.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.full_name}
                      {t.department_name ? ` · ${t.department_name}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-500">
                Góp ý giảng viên sẽ được chuyển vào hộp thư giảng viên.
              </p>
            </div>
          )}
        </div>

        {/* Phần dưới: nội dung góp ý + hành động */}
        <div className="space-y-3">
          <label className="text-sm font-semibold">Nội dung góp ý</label>
          <textarea
            className="w-full min-h-[200px] rounded-2xl border border-slate-300 p-3 outline-none focus:ring"
            placeholder="Nhập góp ý lịch sự, cụ thể, có gợi ý cải thiện…"
            value={fbText}
            onChange={(e) => setFbText(e.target.value)}
            maxLength={1000}
          />

          <div className="flex flex-wrap items-center justify-between text-xs">
            <span className={tooShort ? 'text-amber-700' : 'text-slate-500'}>
              {textLen}/1000 ký tự {tooShort ? '(nội dung quá ngắn)' : ''}
            </span>
            <span className="text-slate-500">
              {fbKind === 'course'
                ? fbCourse
                  ? `Học phần: ${fbCourse}`
                  : 'Chưa chọn học phần'
                : fbTeacher
                ? 'Đã chọn giảng viên'
                : 'Chưa chọn giảng viên'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                if (!target) {
                  setModerationMsg('❌ Vui lòng chọn đối tượng nhận góp ý.');
                  return;
                }
                if (!fbText.trim()) {
                  setModerationMsg('❌ Vui lòng nhập nội dung góp ý.');
                  return;
                }
                if (tooShort) {
                  setModerationMsg('❌ Nội dung quá ngắn (≥ 10 ký tự).');
                  return;
                }
                moderateFeedback(fbText, fbKind, target);
              }}
              disabled={disableCheck}
              className={[
                'px-3 py-2 rounded-xl text-sm font-semibold border',
                disableCheck
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                  : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 active:scale-[0.99]',
              ].join(' ')}
            >
              {checking ? 'Đang kiểm tra…' : 'Kiểm tra nội dung'}
            </button>

            <button
              onClick={submitFeedback}
              disabled={!canSend || submitting}
              className={[
                'px-4 py-2 rounded-xl text-sm font-semibold',
                !canSend || submitting
                  ? 'bg-slate-300 text-white cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]',
              ].join(' ')}
            >
              {submitting ? 'Đang gửi…' : 'Gửi góp ý'}
            </button>

            <span className="text-sm">
              {moderationMsg ? (
                <span
                  className={
                    moderationMsg.startsWith('✅')
                      ? 'text-emerald-700'
                      : moderationMsg.startsWith('❌')
                      ? 'text-amber-700'
                      : 'text-slate-600'
                  }
                >
                  {moderationMsg}
                </span>
              ) : (
                <span className="text-slate-500">Chưa kiểm tra nội dung.</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
