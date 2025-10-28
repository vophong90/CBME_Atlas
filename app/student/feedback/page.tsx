'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';

type FeedbackTargetKind = 'course' | 'faculty';

export default function StudentFeedbackPage() {
  const { studentId } = useStudentCtx();

  const coursesUrl  = `/api/student/courses${studentId ? `?student_id=${studentId}` : ''}`;
  const teachersUrl = `/api/student/teachers${studentId ? `?student_id=${studentId}` : ''}`;

  const { data: courseList,  loading: loadingCourses }  = useCachedJson<string[]>(coursesUrl,  120_000);
  const { data: teacherList, loading: loadingTeachers } = useCachedJson<string[]>(teachersUrl, 120_000);

  const [fbKind, setFbKind] = useState<FeedbackTargetKind>('course');
  const [fbText, setFbText] = useState('');
  const [fbCourse, setFbCourse] = useState('');
  const [fbTeacher, setFbTeacher] = useState('');
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
      if (!res.ok) {
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
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">Phản hồi học phần và giảng viên</h2>
        <p className="text-sm text-slate-600">
          Vui lòng góp ý lịch sự, mang tính xây dựng. Hệ thống sẽ kiểm duyệt trước khi gửi.
        </p>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
          <label className="text-sm font-semibold">Gửi cho</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={fbKind}
              onChange={(e) => setFbKind(e.target.value as FeedbackTargetKind)}
              className="border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="course">Học phần</option>
              <option value="faculty">Giảng viên</option>
            </select>

            {fbKind === 'course' ? (
              loadingCourses ? (
                <div className="h-9 w-56 animate-pulse rounded bg-slate-200" />
              ) : (
                <select
                  value={fbCourse}
                  onChange={(e) => setFbCourse(e.target.value)}
                  className="min-w-[220px] flex-1 rounded-md border px-2 py-1.5 text-sm"
                >
                  <option value="">— Chọn học phần —</option>
                  {(courseList || []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )
            ) : loadingTeachers ? (
              <div className="h-9 w-56 animate-pulse rounded bg-slate-200" />
            ) : (
              <select
                value={fbTeacher}
                onChange={(e) => setFbTeacher(e.target.value)}
                className="min-w-[220px] flex-1 rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">— Chọn giảng viên —</option>
                {(teacherList || []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="text-sm font-semibold self-start md:self-center">Nội dung góp ý</label>
          <div className="space-y-2">
            <textarea
              className="w-full min-h-[160px] rounded-2xl border border-slate-300 p-3 outline-none focus:ring"
              placeholder="Nhập góp ý lịch sự, cụ thể, có gợi ý cải thiện…"
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={tooShort ? 'text-amber-700' : 'text-slate-500'}>
                {textLen}/1000 ký tự {tooShort ? '(nội dung quá ngắn)' : ''}
              </span>
              <span className="text-slate-500">
                {fbKind === 'course'
                  ? fbCourse
                    ? `Học phần: ${fbCourse}`
                    : 'Chưa chọn học phần'
                  : fbTeacher
                  ? `Giảng viên: ${fbTeacher}`
                  : 'Chưa chọn giảng viên'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
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
    </section>
  );
}
