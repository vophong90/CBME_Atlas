'use client';

import { useEffect, useState } from 'react';
import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';

type FeedbackTargetKind = 'course' | 'faculty';

export default function StudentFeedbackPage() {
  const { studentId } = useStudentCtx();

  const coursesUrl = `/api/student/courses${studentId ? `?student_id=${studentId}` : ''}`;
  const teachersUrl = `/api/student/teachers${studentId ? `?student_id=${studentId}` : ''}`;

  const { data: courseList, loading: loadingCourses } = useCachedJson<string[]>(coursesUrl, 120_000);
  const { data: teacherList, loading: loadingTeachers } = useCachedJson<string[]>(teachersUrl, 120_000);

  const [fbKind, setFbKind] = useState<FeedbackTargetKind>('course');
  const [fbText, setFbText] = useState('');
  const [fbCourse, setFbCourse] = useState('');
  const [fbTeacher, setFbTeacher] = useState('');
  const [canSend, setCanSend] = useState(false);
  const [moderationMsg, setModerationMsg] = useState('');

  async function moderateFeedback(text: string, kind: FeedbackTargetKind, target: string) {
    setModerationMsg('Đang kiểm tra nội dung góp ý…'); setCanSend(false);
    try {
      const res = await fetch('/api/student/feedback/moderate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, kind, target }),
      });
      const js = await res.json();
      setCanSend(!!js.ok);
      setModerationMsg(js.ok ? '✅ Nội dung phù hợp, bạn có thể gửi.' : `❌ ${js.reason || 'Nội dung chưa phù hợp.'}`);
    } catch {
      setCanSend(false); setModerationMsg('❌ Không kiểm tra được nội dung, vui lòng thử lại.');
    }
  }

  async function submitFeedback() {
    if (!canSend) return;
    const target = fbKind === 'course' ? fbCourse : fbTeacher;
    const res = await fetch('/api/student/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ student_id: studentId || undefined, kind: fbKind, target, text: fbText }),
    });
    const js = await res.json();
    if (!res.ok) { alert(js?.error || 'Gửi góp ý thất bại'); return; }
    setFbText(''); setFbCourse(''); setFbTeacher(''); setCanSend(false);
    setModerationMsg('✅ Đã gửi góp ý. Cảm ơn bạn!');
  }

  useEffect(()=>{ setCanSend(false); setModerationMsg(''); }, [fbKind, fbCourse, fbTeacher, fbText]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Phản hồi tiết học & Giảng viên</h2>
      <p className="text-sm text-slate-600">
        Góp ý mang tính xây dựng (không tục tĩu, xúc phạm, đe doạ, thưa kiện…). Hệ thống sẽ kiểm duyệt trước khi gửi.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold">Gửi cho</label>
            <select value={fbKind} onChange={(e)=>setFbKind(e.target.value as FeedbackTargetKind)}
                    className="border rounded-md px-2 py-1 text-sm">
              <option value="course">Học phần</option>
              <option value="faculty">Giảng viên</option>
            </select>

            {fbKind==='course' ? (
              loadingCourses ? <div className="h-8 w-56 rounded bg-slate-200 animate-pulse" /> : (
                <select value={fbCourse} onChange={(e)=>setFbCourse(e.target.value)}
                        className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[200px]">
                  <option value="">— Chọn học phần —</option>
                  {(courseList||[]).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              )
            ) : (
              loadingTeachers ? <div className="h-8 w-56 rounded bg-slate-200 animate-pulse" /> : (
                <select value={fbTeacher} onChange={(e)=>setFbTeacher(e.target.value)}
                        className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[200px]">
                  <option value="">— Chọn giảng viên —</option>
                  {(teacherList||[]).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              )
            )}
          </div>

          <textarea className="w-full rounded-2xl border border-slate-300 p-3 min-h-[140px] outline-none focus:ring"
                    placeholder="Nhập góp ý lịch sự, cụ thể, có gợi ý cải thiện…"
                    value={fbText} onChange={e=>setFbText(e.target.value)} />

          <div className="flex items-center gap-2">
            <button onClick={()=>{
                      const target = fbKind==='course'? fbCourse: fbTeacher;
                      if (!target) { setModerationMsg('❌ Vui lòng chọn đối tượng nhận góp ý.'); return; }
                      if (!fbText.trim()) { setModerationMsg('❌ Vui lòng nhập nội dung góp ý.'); return; }
                      moderateFeedback(fbText, fbKind, target);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm">
              Kiểm tra nội dung
            </button>
            <span className="text-sm">{moderationMsg}</span>
          </div>

          <button onClick={submitFeedback} disabled={!canSend}
                  className={!canSend
                    ? 'px-4 py-2 rounded-xl font-semibold bg-slate-300 text-white cursor-not-allowed'
                    : 'px-4 py-2 rounded-xl font-semibold bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]'}>
            Gửi góp ý
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700 bg-slate-50">
          <h3 className="font-semibold mb-2">Nguyên tắc góp ý</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tập trung vào hoạt động dạy – học, không công kích cá nhân.</li>
            <li>Ngôn từ lịch sự, tôn trọng; có ví dụ cụ thể và gợi ý cải thiện.</li>
            <li>Không thưa kiện/đe doạ/bêu rếu; không đưa thông tin cá nhân.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
