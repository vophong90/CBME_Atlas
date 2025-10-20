'use client';

import { useEffect, useMemo, useState } from 'react';

// ===== Types =====
type Level = '1' | '2' | '3' | '4';
type Achieve = 'achieved' | 'not_yet';

type PI = { code: string; description: string };
type PLO = { code: string; description: string };
type CourseCLO = { course_code: string; clo_code: string; level: Level };

type PIProgressItem = {
  pi: PI;
  items: Array<CourseCLO & { status: Achieve }>;
};

type PLOProgressItem = {
  plo: PLO;
  items: Array<CourseCLO & { status: Achieve }>;
};

type FeedbackTargetKind = 'course' | 'faculty';
type Survey = { id: string; title: string; issuer: string; open_at?: string; close_at?: string; link?: string };

// ===== Helpers =====
function weightOf(level: Level): number {
  const map: Record<Level, number> = { '1': 1, '2': 2, '3': 3, '4': 4 };
  return map[level] ?? 1;
}
function ratioFrom(items: Array<CourseCLO & { status: Achieve }>) {
  const total = items.reduce((s, it) => s + weightOf(it.level), 0);
  const got = items
    .filter((it) => it.status === 'achieved')
    .reduce((s, it) => s + weightOf(it.level), 0);
  const pct = total > 0 ? Math.round((got / total) * 100) : 0;
  return { total, got, pct };
}

// ===== Page =====
export default function StudentPage() {
  const [tab, setTab] = useState<'pi' | 'plo' | 'feedback' | 'surveys'>('pi');
  const [loading, setLoading] = useState(false);

  // Cho phép nhập thủ công student_id để test (backend thực tế có thể lấy từ session)
  const [studentId, setStudentId] = useState<string>('');

  // PI/PLO progress
  const [piProgress, setPiProgress] = useState<PIProgressItem[]>([]);
  const [piFilter, setPiFilter] = useState<'all' | 'achieved' | 'not_yet' | 'not_learned'>('all');
  const [activePI, setActivePI] = useState<PIProgressItem | null>(null);

  const [ploProgress, setPloProgress] = useState<PLOProgressItem[]>([]);
  const [ploFilter, setPloFilter] = useState<'all' | 'achieved' | 'not_yet' | 'not_learned'>('all');
  const [activePLO, setActivePLO] = useState<PLOProgressItem | null>(null);

  // Feedback
  const [fbKind, setFbKind] = useState<FeedbackTargetKind>('course');
  const [fbText, setFbText] = useState('');
  const [fbCourse, setFbCourse] = useState<string>('');
  const [fbTeacher, setFbTeacher] = useState<string>('');
  const [canSend, setCanSend] = useState(false);
  const [moderationMsg, setModerationMsg] = useState<string>('');
  const [courseList, setCourseList] = useState<string[]>([]);
  const [teacherList, setTeacherList] = useState<string[]>([]);

  // Surveys
  const [surveys, setSurveys] = useState<Survey[]>([]);

  // ===== Fetchers =====
  async function loadPI() {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/pi-progress${studentId ? `?student_id=${studentId}` : ''}`);
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tải tiến độ PI');
      setPiProgress(js.data || []);
    } catch (e: any) {
      alert(e?.message || 'Lỗi tải tiến độ PI');
    } finally {
      setLoading(false);
    }
  }

  async function loadPLO() {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/plo-progress${studentId ? `?student_id=${studentId}` : ''}`);
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tải tiến độ PLO');
      setPloProgress(js.data || []);
    } catch (e: any) {
      alert(e?.message || 'Lỗi tải tiến độ PLO');
    } finally {
      setLoading(false);
    }
  }

  async function loadLists() {
    const [rc, rt] = await Promise.all([
      fetch('/api/student/courses' + (studentId ? `?student_id=${studentId}` : '')),
      fetch('/api/student/teachers' + (studentId ? `?student_id=${studentId}` : '')),
    ]);
    const jc = await rc.json();
    const jt = await rt.json();
    if (rc.ok) setCourseList(jc.data || []);
    if (rt.ok) setTeacherList(jt.data || []);
  }

  async function loadSurveys() {
    const res = await fetch('/api/student/surveys' + (studentId ? `?student_id=${studentId}` : ''));
    const js = await res.json();
    if (res.ok) setSurveys(js.data || []);
  }

  async function moderateFeedback(text: string, kind: FeedbackTargetKind, target: string) {
    setModerationMsg('Đang kiểm tra nội dung góp ý…');
    setCanSend(false);
    try {
      const res = await fetch('/api/student/feedback/moderate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, kind, target }),
      });
      const js = await res.json();
      setCanSend(!!js.ok);
      setModerationMsg(js.ok ? '✅ Nội dung phù hợp, bạn có thể gửi.' : `❌ ${js.reason || 'Nội dung chưa phù hợp.'}`);
    } catch {
      setCanSend(false);
      setModerationMsg('❌ Không kiểm tra được nội dung, vui lòng thử lại.');
    }
  }

  async function submitFeedback() {
    if (!canSend) return;
    const target = fbKind === 'course' ? fbCourse : fbTeacher;
    try {
      const res = await fetch('/api/student/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId || undefined,
          kind: fbKind,
          target,
          text: fbText,
        }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Gửi góp ý thất bại');
      setFbText('');
      setFbCourse('');
      setFbTeacher('');
      setCanSend(false);
      setModerationMsg('✅ Đã gửi góp ý. Cảm ơn bạn!');
    } catch (e: any) {
      alert(e?.message || 'Gửi góp ý thất bại');
    }
  }

  useEffect(() => {
    if (tab === 'pi') loadPI();
    if (tab === 'plo') loadPLO();
    if (tab === 'feedback') loadLists();
    if (tab === 'surveys') loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, studentId]);

  // ===== Filters =====
  const piFiltered = useMemo(() => {
    return piProgress.filter((row) => {
      const stat = ratioFrom(row.items);
      if (piFilter === 'achieved') return stat.pct === 100;
      if (piFilter === 'not_yet') return stat.pct > 0 && stat.pct < 100;
      if (piFilter === 'not_learned') return stat.pct === 0 && row.items.length > 0;
      return true;
    });
  }, [piProgress, piFilter]);

  const ploFiltered = useMemo(() => {
    return ploProgress.filter((row) => {
      const stat = ratioFrom(row.items);
      if (ploFilter === 'achieved') return stat.pct === 100;
      if (ploFilter === 'not_yet') return stat.pct > 0 && stat.pct < 100;
      if (ploFilter === 'not_learned') return stat.pct === 0 && row.items.length > 0;
      return true;
    });
  }, [ploProgress, ploFilter]);

  // ===== UI Components =====
  function ProgressRow(props: {
    code: string;
    title?: string;
    items: Array<CourseCLO & { status: Achieve }>;
    onClick?: () => void;
  }) {
    const { pct, got, total } = ratioFrom(props.items);
    return (
      <button
        onClick={props.onClick}
        className="w-full text-left rounded-lg border p-3 hover:bg-gray-50 transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">{props.code}</div>
          <div className="text-sm text-gray-600">{got}/{total} (≈ {pct}%)</div>
        </div>
        {props.title && <div className="text-xs text-gray-500 mt-0.5">{props.title}</div>}
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
      </button>
    );
  }

  function DetailModal(props: {
    kind: 'PI' | 'PLO';
    open: boolean;
    onClose: () => void;
    title: string;
    desc: string;
    items: Array<CourseCLO & { status: Achieve }>;
  }) {
    const [stateFilter, setStateFilter] = useState<'all' | 'achieved' | 'not_yet'>('all');
    const filtered = props.items.filter((it) =>
      stateFilter === 'all' ? true : it.status === stateFilter
    );
    return props.open ? (
      <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{props.kind} {props.title}</h3>
            <button onClick={props.onClose} className="text-sm text-gray-600 hover:underline">Đóng</button>
          </div>
          <p className="text-sm text-gray-700 mt-1">{props.desc}</p>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm">Lọc:</span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="achieved">Đạt</option>
              <option value="not_yet">Chưa đạt</option>
            </select>
          </div>

          <div className="mt-3 max-h-[50vh] overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Học phần</th>
                  <th className="px-3 py-2 text-left border-b">CLO</th>
                  <th className="px-3 py-2 text-left border-b">Level</th>
                  <th className="px-3 py-2 text-left border-b">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, idx) => (
                  <tr key={idx} className="odd:bg-gray-50">
                    <td className="px-3 py-2 border-b">{it.course_code}</td>
                    <td className="px-3 py-2 border-b">{it.clo_code}</td>
                    <td className="px-3 py-2 border-b">{it.level}</td>
                    <td className="px-3 py-2 border-b">
                      {it.status === 'achieved' ? 'Đạt' : 'Chưa đạt'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                      Không có mục phù hợp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : null;
  }

  // ===== Render =====
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('pi')}
          className={tab === 'pi' ? 'px-4 py-2 rounded-lg bg-brand-600 text-white' : 'px-4 py-2 rounded-lg border'}
        >
          1) Theo dõi tiến độ PI
        </button>
        <button
          onClick={() => setTab('plo')}
          className={tab === 'plo' ? 'px-4 py-2 rounded-lg bg-brand-600 text-white' : 'px-4 py-2 rounded-lg border'}
        >
          2) Theo dõi tiến độ PLO
        </button>
        <button
          onClick={() => setTab('feedback')}
          className={tab === 'feedback' ? 'px-4 py-2 rounded-lg bg-brand-600 text-white' : 'px-4 py-2 rounded-lg border'}
        >
          3) Phản hồi tiết học & Giảng viên
        </button>
        <button
          onClick={() => setTab('surveys')}
          className={tab === 'surveys' ? 'px-4 py-2 rounded-lg bg-brand-600 text-white' : 'px-4 py-2 rounded-lg border'}
        >
          4) Khảo sát
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">SV:</span>
          <input
            placeholder="student_id (tùy chọn)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* PI */}
      {tab === 'pi' && (
        <section className="rounded-xl border bg-white p-5 shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Theo dõi tiến độ PI</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm">Lọc:</span>
              <select
                value={piFilter}
                onChange={(e) => setPiFilter(e.target.value as any)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="achieved">PI đã đạt</option>
                <option value="not_yet">Đang học (chưa đạt 100%)</option>
                <option value="not_learned">Chưa học</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {piFiltered.map((row) => (
              <ProgressRow
                key={row.pi.code}
                code={row.pi.code}
                title={row.pi.description}
                items={row.items}
                onClick={() => setActivePI(row)}
              />
            ))}
            {!loading && piFiltered.length === 0 && (
              <div className="text-sm text-gray-500">Không có dữ liệu.</div>
            )}
          </div>

          <DetailModal
            kind="PI"
            open={!!activePI}
            onClose={() => setActivePI(null)}
            title={activePI?.pi.code || ''}
            desc={activePI?.pi.description || ''}
            items={activePI?.items || []}
          />
        </section>
      )}

      {/* PLO */}
      {tab === 'plo' && (
        <section className="rounded-xl border bg-white p-5 shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Theo dõi tiến độ PLO</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm">Lọc:</span>
              <select
                value={ploFilter}
                onChange={(e) => setPloFilter(e.target.value as any)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="achieved">PLO đã đạt</option>
                <option value="not_yet">Đang học (chưa đạt 100%)</option>
                <option value="not_learned">Chưa học</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ploFiltered.map((row) => (
              <ProgressRow
                key={row.plo.code}
                code={row.plo.code}
                title={row.plo.description}
                items={row.items}
                onClick={() => setActivePLO(row)}
              />
            ))}
            {!loading && ploFiltered.length === 0 && (
              <div className="text-sm text-gray-500">Không có dữ liệu.</div>
            )}
          </div>

          <DetailModal
            kind="PLO"
            open={!!activePLO}
            onClose={() => setActivePLO(null)}
            title={activePLO?.plo.code || ''}
            desc={activePLO?.plo.description || ''}
            items={activePLO?.items || []}
          />
        </section>
      )}

      {/* Feedback */}
      {tab === 'feedback' && (
        <section className="rounded-xl border bg-white p-5 shadow space-y-4">
          <h2 className="text-lg font-semibold">Phản hồi tiết học & Giảng viên</h2>
          <p className="text-sm text-gray-600">
            GPT sẽ kiểm duyệt: chỉ chấp nhận góp ý mang tính xây dựng (không tục tĩu, xúc phạm, đe doạ, thưa kiện…).
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-semibold">Gửi cho</label>
                <select
                  value={fbKind}
                  onChange={(e) => {
                    setFbKind(e.target.value as FeedbackTargetKind);
                    setCanSend(false);
                    setModerationMsg('');
                  }}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value="course">Học phần</option>
                  <option value="faculty">Giảng viên</option>
                </select>

                {fbKind === 'course' ? (
                  <select
                    value={fbCourse}
                    onChange={(e) => {
                      setFbCourse(e.target.value);
                      setCanSend(false);
                      setModerationMsg('');
                    }}
                    className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[200px]"
                  >
                    <option value="">— Chọn học phần —</option>
                    {courseList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={fbTeacher}
                    onChange={(e) => {
                      setFbTeacher(e.target.value);
                      setCanSend(false);
                      setModerationMsg('');
                    }}
                    className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[200px]"
                  >
                    <option value="">— Chọn giảng viên —</option>
                    {teacherList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </div>

              <textarea
                className="w-full border rounded-lg p-3 min-h-[140px]"
                placeholder="Nhập góp ý lịch sự, cụ thể, có gợi ý cải thiện…"
                value={fbText}
                onChange={(e) => {
                  setFbText(e.target.value);
                  setCanSend(false);
                  setModerationMsg('');
                }}
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const target = fbKind === 'course' ? fbCourse : fbTeacher;
                    if (!target) {
                      setModerationMsg('❌ Vui lòng chọn đối tượng nhận góp ý.');
                      return;
                    }
                    if (!fbText.trim()) {
                      setModerationMsg('❌ Vui lòng nhập nội dung góp ý.');
                      return;
                    }
                    moderateFeedback(fbText, fbKind, target);
                  }}
                  className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm hover:bg-black"
                >
                  Kiểm tra nội dung
                </button>
                <span className="text-sm">{moderationMsg}</span>
              </div>

              <button
                onClick={submitFeedback}
                disabled={!canSend}
                className={
                  !canSend
                    ? 'px-4 py-2 rounded-lg font-semibold bg-gray-300 text-white cursor-not-allowed'
                    : 'px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700'
                }
              >
                Gửi góp ý
              </button>
            </div>

            <div className="rounded-lg border p-3 text-sm text-gray-700">
              <h3 className="font-semibold mb-2">Nguyên tắc góp ý</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tập trung vào hoạt động dạy – học, không công kích cá nhân.</li>
                <li>Ngôn từ lịch sự, tôn trọng; có ví dụ cụ thể và gợi ý cải thiện.</li>
                <li>Không thưa kiện/đe doạ/bêu rếu; không thông tin cá nhân.</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Surveys */}
      {tab === 'surveys' && (
        <section className="rounded-xl border bg-white p-5 shadow space-y-4">
          <h2 className="text-lg font-semibold">Khảo sát dành cho bạn</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {surveys.map((s) => (
              <a
                key={s.id}
                href={s.link || '#'}
                target="_blank"
                className="rounded-xl border p-4 hover:bg-gray-50 transition"
              >
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-gray-600 mt-1">{s.issuer}</div>
                {(s.open_at || s.close_at) && (
                  <div className="text-xs text-gray-600 mt-1">
                    {s.open_at && <>Mở: {new Date(s.open_at).toLocaleString()} · </>}
                    {s.close_at && <>Đóng: {new Date(s.close_at).toLocaleString()}</>}
                  </div>
                )}
              </a>
            ))}
            {surveys.length === 0 && (
              <div className="text-sm text-gray-500">Hiện chưa có khảo sát.</div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
