// app/quality-assurance/targeting/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type Role = 'lecturer' | 'student' | 'support';

type Person = {
  id: string;
  name: string;
  email: string;
  extra?: string;
};

function TargetingContent() {
  const supabase = getSupabase();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('surveyId') ?? '';

  const [role, setRole] = useState<Role>('lecturer');
  const [dept, setDept] = useState('');
  const [cohort, setCohort] = useState('');
  const [unit, setUnit] = useState('');

  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const departments = ['YHCT Nội', 'YHCT Ngoại', 'Châm cứu', 'Dược cổ truyền'];
  const cohorts = ['Khung 2022', 'Khung 2024'];
  const units = ['Phòng Khảo thí', 'Phòng Đảm bảo chất lượng'];

  useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true);
      setToast(null);
      setSelectAll(false);
      setSelected({});
      try {
        // Thử lấy từ bảng profiles (nếu có)
        let loaded: Person[] = [];
        const tableCandidates =
          role === 'lecturer'
            ? ['profiles', 'teacher.profiles']
            : role === 'student'
            ? ['profiles', 'student.profiles']
            : ['profiles', 'support.profiles'];

        for (const tbl of tableCandidates) {
          const name = tbl.includes('.') ? tbl.split('.')[1] : tbl;
          const { data, error } = await supabase
            .from(name)
            .select('id,name,email,department,cohort,unit')
            .limit(2000);

          // Nếu không có bảng → thử bảng khác
          if ((error as any)?.code === '42P01') continue;
          if (error) throw error;

          if (data && data.length > 0) {
            loaded = (data as any[]).map((r) => ({
              id: r.id,
              name: r.name ?? r.email ?? r.id,
              email: r.email ?? '',
              extra:
                role === 'lecturer'
                  ? r.department ?? ''
                  : role === 'student'
                  ? r.cohort ?? ''
                  : r.unit ?? '',
            }));
            break;
          }
        }

        // Fallback mock nếu không có bảng nào ở trên
        if (loaded.length === 0) {
          loaded =
            role === 'lecturer'
              ? [
                  { id: 'lec1', name: 'BS. Nguyễn A', email: 'nguyena@example.com', extra: 'YHCT Nội' },
                  { id: 'lec2', name: 'ThS. Trần B', email: 'tranb@example.com', extra: 'Châm cứu' },
                ]
              : role === 'student'
              ? [
                  { id: 'stu1', name: 'SV. Lê C', email: 'lec@example.com', extra: 'Khung 2022' },
                  { id: 'stu2', name: 'SV. Phạm D', email: 'phamd@example.com', extra: 'Khung 2024' },
                ]
              : [
                  { id: 'sup1', name: 'NV. Võ E', email: 'voe@example.com', extra: 'Phòng Khảo thí' },
                  { id: 'sup2', name: 'NV. Hồ F', email: 'hof@example.com', extra: 'Phòng Đảm bảo chất lượng' },
                ];
        }

        // Lọc theo combobox
        const filtered = loaded.filter((p) => {
          if (role === 'lecturer' && dept) return p.extra === dept;
          if (role === 'student' && cohort) return p.extra === cohort;
          if (role === 'support' && unit) return p.extra === unit;
          return true;
        });

        if (!abort) setPeople(filtered);
      } catch (e: any) {
        if (!abort) setToast({ type: 'error', text: e?.message ?? 'Không tải được danh sách' });
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, dept, cohort, unit]); // tránh đưa supabase vào deps để không re-run không cần thiết

  const rows = useMemo(() => people, [people]);
  const selectedCount = useMemo(() => rows.filter((r) => selected[r.id]).length, [rows, selected]);

  function toggleAll() {
    const next = !selectAll;
    setSelectAll(next);
    const map: Record<string, boolean> = {};
    rows.forEach((r) => (map[r.id] = next));
    setSelected(map);
  }
  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function send() {
    if (!surveyId) {
      setToast({ type: 'error', text: 'Thiếu surveyId trên URL (?surveyId=...)' });
      return;
    }
    const recipients = rows.filter((r) => selected[r.id]).map((r) => r.email).filter(Boolean);
    if (recipients.length === 0) {
      setToast({ type: 'error', text: 'Chưa chọn người nhận nào' });
      return;
    }
    setLoading(true);
    setToast(null);
    try {
      // Gọi route API của bạn
      const res = await fetch(`/api/qa/surveys/${surveyId}/send-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      setToast({ type: 'success', text: `Đã gửi ${recipients.length} email.` });
    } catch (e: any) {
      setToast({ type: 'error', text: e?.message ?? 'Gửi email thất bại' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Duyệt đối tượng vào khảo sát</h1>
        <p className="text-sm text-gray-600">Chọn nhóm đối tượng, lọc và gửi thư mời/nhắc tham gia khảo sát.</p>
      </div>

      {/* Chọn vai trò */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="lecturer" checked={role === 'lecturer'} onChange={() => setRole('lecturer')} />
          <span>Giảng viên</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} />
          <span>Sinh viên</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="support" checked={role === 'support'} onChange={() => setRole('support')} />
          <span>Bộ phận hỗ trợ</span>
        </label>

        <div className="ml-auto text-sm text-gray-500">
          Survey ID: <code>{surveyId || '(chưa có)'}</code>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-3">
        {role === 'lecturer' && (
          <select className="border rounded px-3 py-2" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">— Chọn bộ môn —</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        {role === 'student' && (
          <select className="border rounded px-3 py-2" value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">— Chọn khung CTĐT —</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {role === 'support' && (
          <select className="border rounded px-3 py-2" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">— Chọn đơn vị —</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bảng danh sách */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Danh sách ({rows.length}) • Đã chọn {selectedCount}</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={selectAll} onChange={toggleAll} />
            <span>Chọn tất cả</span>
          </label>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[640px] w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3 w-10">#</th>
                <th className="py-2 pr-3">Họ tên</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">{role === 'lecturer' ? 'Bộ môn' : role === 'student' ? 'Khung CTĐT' : 'Đơn vị'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3">
                    <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleOne(p.id)} />
                  </td>
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3">{p.email}</td>
                  <td className="py-2 pr-3">{p.extra || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={4}>
                    Không có dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Soạn email */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="font-medium">Soạn email mời/nhắc</div>
        <textarea
          className="w-full border rounded p-2"
          rows={8}
          placeholder="Nội dung email mời/nhắc tham gia khảo sát…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={send}
          disabled={loading || selectedCount === 0}
          className={`px-3 py-2 rounded text-white ${loading || selectedCount === 0 ? 'bg-gray-400' : 'bg-black'}`}
        >
          {loading ? 'Đang gửi…' : 'Gửi email cho mục đã chọn'}
        </button>
        <div className="text-xs text-gray-500">
          Gửi qua endpoint <code>/api/qa/surveys/[id]/send-invites</code>, cấu hình SMTP/Resend ở ENV.
        </div>
        {toast && (
          <div className={`mt-2 text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Đang tải tham số…</div>}>
      <TargetingContent />
    </Suspense>
  );
}
