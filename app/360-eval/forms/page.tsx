// app/360-eval/forms/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/** ===== Types ===== */
type FormRow = {
  id: string;
  title: string;
  group_code: 'self' | 'peer' | 'faculty' | 'supervisor' | 'patient';
  rubric_id: string;
  framework_id?: string | null;
  course_code?: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
};

type RubricOpt = { id: string; title: string };

type FrameworkOpt = { id: string; label: string };
type CourseOpt = { course_code: string; course_name?: string | null };

type RubricColumn = { key: string; label: string };
type RubricRow = { id: string; label: string; clo_ids?: string[] };
type RubricDef = { columns: RubricColumn[]; rows: RubricRow[] };

type Campaign = {
  id: number;
  name: string;
  start_at: string;
  end_at: string;
  framework_id?: string | null;
  course_code?: string | null;
  rubric_id: string;
};

function truthy(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1';
}
function canSeeQA(profile: any): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'qa') return true;
  const arr = Array.isArray(profile.roles) ? profile.roles : [];
  if (arr.includes('admin') || arr.includes('qa')) return true;
  if (truthy(profile.is_admin) || truthy(profile.is_qa)) return true;
  if (truthy((profile as any).admin) || truthy((profile as any).qa)) return true;
  return false;
}

/** ===== Helpers ===== */
const DEFAULT_COLS: RubricColumn[] = [
  { key: 'na', label: 'Not achieved' },
  { key: 'ach', label: 'Achieved' },
  { key: 'good', label: 'Good' },
];

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Non-JSON response from ${url}: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Chuẩn hoá mảng items trả về từ API courses */
function normalizeCourses(d: any): CourseOpt[] {
  const arr = d?.items ?? d?.data ?? d?.rows ?? d?.courses ?? [];
  const out = (Array.isArray(arr) ? arr : [])
    .map((x: any) => {
      const code = x?.course_code ?? x?.code ?? x?.courseCode ?? x?.id ?? '';
      const name = x?.course_name ?? x?.name ?? x?.title ?? x?.label ?? null;
      return code ? { course_code: code, course_name: name } : null;
    })
    .filter(Boolean) as CourseOpt[];
  return out;
}

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function Eval360FormsPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const allowed = useMemo(() => canSeeQA(profile), [profile]);
  const selfUserId = (profile as any)?.user_id || '';

  // ===== List & filters =====
  const [items, setItems] = useState<FormRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | FormRow['group_code']>('all');

  // ===== Form meta (create/edit) =====
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<FormRow['group_code']>('peer');
  const [status, setStatus] = useState<FormRow['status']>('active');

  // ===== Rubric mode: pick existing OR build new =====
  const [useExistingRubric, setUseExistingRubric] = useState(true);
  const [rubrics, setRubrics] = useState<RubricOpt[]>([]);
  const [rubricId, setRubricId] = useState('');

  // builder (new rubric)
  const [rbTitle, setRbTitle] = useState('');
  const [rbThreshold, setRbThreshold] = useState<number>(70);
  const [rbCols, setRbCols] = useState<RubricColumn[]>(DEFAULT_COLS);
  const [rbRows, setRbRows] = useState<RubricRow[]>([
    { id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()), label: 'Professionalism' },
  ]);

  // framework/course
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // ===== Campaign Manager state =====
  const [selectedForm, setSelectedForm] = useState<FormRow | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campLoading, setCampLoading] = useState(false);
  const [campErr, setCampErr] = useState('');
  const [campName, setCampName] = useState('');
  const [campStart, setCampStart] = useState('');
  const [campEnd, setCampEnd] = useState('');

  // Redirect nếu không đủ quyền
  useEffect(() => {
    if (loading) return;
    if (!allowed) router.replace('/360-eval/evaluate');
  }, [loading, allowed, router]);

  // Load dropdown rubrics (để "use existing")
  useEffect(() => {
    (async () => {
      try {
        const d = await fetchJson('/api/rubrics/list');
        setRubrics((d.items || []).map((x: any) => ({ id: x.id, title: x.title as string })));
      } catch {
        setRubrics([]);
      }
    })();
  }, []);

  // Load frameworks
  useEffect(() => {
    (async () => {
      try {
        const d = await fetchJson('/api/frameworks');
        const items = (d.items || []).map((x: any) => ({
          id: x.id,
          label: x.label ?? `${x.doi_tuong} • ${x.chuyen_nganh} • ${x.nien_khoa}`,
        }));
        setFrameworks(items);
      } catch {
        setFrameworks([]);
      }
    })();
  }, []);

  // Load courses theo framework (robust)
  useEffect(() => {
    (async () => {
      setCourses([]);
      setCourseCode('');

      const candidateUrls = frameworkId
        ? [
            `/api/academic-affairs/courses/list?framework_id=${encodeURIComponent(frameworkId)}`,
            `/api/academic-affairs/courses/list?frameworkId=${encodeURIComponent(frameworkId)}`,
            `/api/academic-affairs/courses/list?id=${encodeURIComponent(frameworkId)}`,
            `/api/academic-affairs/courses/list`,
          ]
        : [`/api/academic-affairs/courses/list`];

      for (const url of candidateUrls) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const d = await r.json().catch(() => ({}));
          const norm = normalizeCourses(d);
          if (norm.length) {
            setCourses(norm);
            return;
          }
          setCourses([]);
        } catch {
          continue;
        }
      }
    })();
  }, [frameworkId]);

  async function loadList() {
    setLoadingList(true);
    setErr('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (groupFilter !== 'all') params.set('group_code', groupFilter);
      const url = `/api/360/form${params.toString() ? `?${params.toString()}` : ''}`;
      const d = await fetchJson(url);
      setItems(d.items || []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || 'Lỗi tải danh sách');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (allowed) loadList();
  }, [allowed, statusFilter, groupFilter]);

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setGroup('peer');
    setStatus('active');
    setUseExistingRubric(true);
    setRubricId('');
    setRbTitle('');
    setRbThreshold(70);
    setRbCols(DEFAULT_COLS);
    setRbRows([
      { id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()), label: 'Professionalism' },
    ]);
    setFrameworkId('');
    setCourseCode('');
    setErr('');
  }

  function editRow(it: FormRow) {
    setEditingId(it.id);
    setTitle(it.title);
    setGroup(it.group_code);
    setStatus(it.status);
    setUseExistingRubric(true);
    setRubricId(it.rubric_id);
    setFrameworkId(it.framework_id || '');
    setCourseCode(it.course_code || '');
    setErr('');
  }

  // ===== Rubric builder helpers =====
  function addCol() {
    const key = `lv${rbCols.length + 1}`;
    setRbCols([...rbCols, { key, label: `Level ${rbCols.length + 1}` }]);
  }
  function delCol(idx: number) {
    if (rbCols.length <= 1) return;
    const next = rbCols.slice();
    next.splice(idx, 1);
    setRbCols(next);
  }
  function addRow() {
    const id =
      typeof crypto !== 'undefined' && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : String(Date.now());
    setRbRows([...rbRows, { id, label: `Criterion ${rbRows.length + 1}` }]);
  }
  function delRow(idx: number) {
    const next = rbRows.slice();
    next.splice(idx, 1);
    setRbRows(
      next.length
        ? next
        : [
            {
              id:
                typeof crypto !== 'undefined' && (crypto as any).randomUUID
                  ? (crypto as any).randomUUID()
                  : String(Date.now()),
              label: 'Criterion',
            },
          ]
    );
  }

  async function save() {
    try {
      if (!title.trim()) return setErr('Thiếu tiêu đề biểu mẫu.');
      if (useExistingRubric) {
        if (!rubricId) return setErr('Chưa chọn rubric.');
      } else {
        if (!rbTitle.trim()) return setErr('Thiếu tiêu đề rubric.');
        if (!rbCols.length || !rbRows.length) return setErr('Rubric phải có ít nhất 1 cột & 1 tiêu chí.');
        // Nếu muốn ràng buộc rubric với học phần:
        if (!frameworkId || !courseCode) return setErr('Vui lòng chọn Khung CTĐT và Học phần để lưu rubric.');
      }

      setSaving(true);
      setErr('');

      const body: any = {
        id: editingId,
        title: title.trim(),
        group_code: group,
        status,
      };

      if (useExistingRubric) {
        body.rubric_id = rubricId;
      } else {
        const def: RubricDef = { columns: rbCols, rows: rbRows };
        body.new_rubric = {
          title: rbTitle.trim(),
          threshold: rbThreshold,
          framework_id: frameworkId || null,
          course_code: courseCode || null,
          definition: def,
        };
      }

      const d = await fetchJson('/api/360/form', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadList();
    } catch (e: any) {
      setErr(e?.message || 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Xoá biểu mẫu này?')) return;
    try {
      await fetchJson(`/api/360/form?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      await loadList();
    } catch (e: any) {
      setErr(e?.message || 'Lỗi xoá');
    }
  }

  /** ===== Campaign Manager: actions ===== */
  function openCampaignManager(it: FormRow) {
    setSelectedForm(it);
    loadCampaigns(it.id);
  }

  async function loadCampaigns(formId: string) {
    setCampLoading(true);
    setCampErr('');
    try {
      const d = await fetchJson(`/api/360/campaigns?form_id=${encodeURIComponent(formId)}`);
      setCampaigns(d.items || []);
      const now = new Date();
      const after7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setCampName('Đợt đánh giá ' + now.toLocaleDateString('vi-VN'));
      setCampStart(isoLocal(now));
      setCampEnd(isoLocal(after7));
    } catch (e: any) {
      setCampaigns([]);
      setCampErr(e?.message || 'Lỗi tải campaign');
    } finally {
      setCampLoading(false);
    }
  }

  async function createCampaignQuick(days = 7) {
    if (!selectedForm) return;
    try {
      const now = new Date();
      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      await fetchJson('/api/360/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          form_id: selectedForm.id,
          name: `Đợt đánh giá ${now.toLocaleDateString('vi-VN')} (+${days}d)`,
          start_at: now.toISOString(),
          end_at: until.toISOString(),
          created_by: selfUserId,
        }),
      });
      await loadCampaigns(selectedForm.id);
    } catch (e: any) {
      alert(e?.message || 'Không tạo được campaign');
    }
  }

  async function createCampaignManual() {
    if (!selectedForm) return;
    try {
      if (!campName.trim() || !campStart || !campEnd) {
        alert('Điền đủ Tên / Thời gian');
        return;
      }
      await fetchJson('/api/360/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          form_id: selectedForm.id,
          name: campName.trim(),
          start_at: new Date(campStart).toISOString(),
          end_at: new Date(campEnd).toISOString(),
          created_by: selfUserId,
        }),
      });
      await loadCampaigns(selectedForm.id);
    } catch (e: any) {
      alert(e?.message || 'Không tạo được campaign');
    }
  }

  async function closeCampaignNow(id: number) {
    if (!confirm('Đóng campaign này ngay bây giờ?')) return;
    try {
      await fetchJson(`/api/360/campaigns?id=${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'close_now' }),
      });
      if (selectedForm) await loadCampaigns(selectedForm.id);
    } catch (e: any) {
      alert(e?.message || 'Không đóng được campaign');
    }
  }

  if (loading) return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Đang tải quyền…</div>;
  if (!allowed) return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Bạn không có quyền.</div>;

  return (
    <div className="space-y-4">
      {/* Builder card */}
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold mb-2">{editingId ? 'Sửa biểu mẫu 360°' : 'Tạo biểu mẫu 360°'}</div>

        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề biểu mẫu"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as FormRow['group_code'])}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="faculty">Giảng viên</option>
            <option value="peer">Sinh viên đánh giá nhau</option>
            <option value="self">Sinh viên tự đánh giá</option>
            <option value="supervisor">Người hướng dẫn</option>
            <option value="patient">Bệnh nhân</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FormRow['status'])}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="active">Kích hoạt</option>
            <option value="inactive">Ngừng</option>
          </select>

          {/* Rubric mode */}
          <div className="md:col-span-3 mt-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold">Rubric</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={useExistingRubric} onChange={() => setUseExistingRubric(true)} />
                Dùng rubric có sẵn
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!useExistingRubric} onChange={() => setUseExistingRubric(false)} />
                Tạo rubric mới (độc lập cho 360)
              </label>
            </div>

            {useExistingRubric ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <select
                  value={rubricId}
                  onChange={(e) => setRubricId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">— Chọn rubric —</option>
                  {rubrics.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={rbTitle}
                    onChange={(e) => setRbTitle(e.target.value)}
                    placeholder="Tiêu đề rubric"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rbThreshold}
                    onChange={(e) => setRbThreshold(Number(e.target.value))}
                    placeholder="Ngưỡng đạt (%)"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <div className="text-xs text-slate-500 flex items-center">Ngưỡng tổng thể để coi là đạt</div>
                </div>

                {/* Framework & Course */}
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={frameworkId}
                    onChange={(e) => setFrameworkId(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    title="Khung CTĐT"
                  >
                    <option value="">— Chọn Khung CTĐT —</option>
                    {frameworks.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    title="Học phần"
                  >
                    <option value="">{frameworkId ? '— Chọn học phần —' : '— Tất cả học phần (nếu API hỗ trợ) —'}</option>
                    {courses.map((c) => (
                      <option key={c.course_code} value={c.course_code}>
                        {c.course_code} — {c.course_name || ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Columns builder */}
                <div>
                  <div className="mb-2 text-sm font-semibold">Mức đánh giá (cột)</div>
                  <div className="space-y-2">
                    {rbCols.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={c.key}
                          onChange={(e) => {
                            const next = [...rbCols];
                            next[idx] = { ...c, key: e.target.value.trim() || `lv${idx + 1}` };
                            setRbCols(next);
                          }}
                          className="w-40 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="key"
                          title="Khoá (ví dụ: na/ach/good)"
                        />
                        <input
                          value={c.label}
                          onChange={(e) => {
                            const next = [...rbCols];
                            next[idx] = { ...c, label: e.target.value };
                            setRbCols(next);
                          }}
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="Nhãn hiển thị"
                        />
                        <button
                          onClick={() => delCol(idx)}
                          className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Xoá
                        </button>
                      </div>
                    ))}
                    <button onClick={addCol} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">
                      + Thêm mức
                    </button>
                  </div>
                </div>

                {/* Rows builder */}
                <div>
                  <div className="mb-2 text-sm font-semibold">Tiêu chí (dòng)</div>
                  <div className="space-y-2">
                    {rbRows.map((r, idx) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <div className="text-xs rounded border px-2 py-1">{idx + 1}</div>
                        <input
                          value={r.label}
                          onChange={(e) => {
                            const next = [...rbRows];
                            next[idx] = { ...r, label: e.target.value };
                            setRbRows(next);
                          }}
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="Nội dung tiêu chí"
                        />
                        <button
                          onClick={() => delRow(idx)}
                          className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Xoá
                        </button>
                      </div>
                    ))}
                    <button onClick={addRow} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">
                      + Thêm tiêu chí
                    </button>
                  </div>
                </div>

                {/* Mini preview */}
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1 text-left">Tiêu chí</th>
                        {rbCols.map((c) => (
                          <th key={c.key} className="border px-2 py-1 text-center">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rbRows.map((r) => (
                        <tr key={r.id}>
                          <td className="border px-2 py-1">{r.label}</td>
                          {rbCols.map((c) => (
                            <td key={c.key} className="border px-2 py-1 text-center">
                              ○
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border px-4 py-2">
                Huỷ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Manager Panel */}
      {selectedForm && (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 font-semibold">
            Campaigns — <span className="text-brand-700">{selectedForm.title}</span>
          </div>

          {campErr && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{campErr}</div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => createCampaignQuick(1)}
              className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
            >
              Mở ngay 24h
            </button>
            <button
              onClick={() => createCampaignQuick(7)}
              className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
            >
              Mở ngay 7 ngày
            </button>
            <button
              onClick={() => createCampaignQuick(30)}
              className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
            >
              Mở ngay 30 ngày
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              placeholder="Tên campaign"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={campStart}
              onChange={(e) => setCampStart(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Bắt đầu"
            />
            <input
              type="datetime-local"
              value={campEnd}
              onChange={(e) => setCampEnd(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Kết thúc"
            />
            <div className="md:col-span-3">
              <button onClick={createCampaignManual} className="rounded-lg bg-brand-600 px-4 py-2 text-white">
                Tạo campaign
              </button>
              <button onClick={() => setSelectedForm(null)} className="ml-2 rounded-lg border px-4 py-2">
                Đóng panel
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-auto">
            {campLoading ? (
              <div className="text-sm text-slate-500">Đang tải…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-3 py-2 text-left">Tên</th>
                    <th className="border px-3 py-2 text-left">Bắt đầu</th>
                    <th className="border px-3 py-2 text-left">Kết thúc</th>
                    <th className="border px-3 py-2 w-48"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const now = Date.now();
                    const st = new Date(c.start_at).getTime();
                    const en = new Date(c.end_at).getTime();
                    const open = st <= now && now < en;
                    const future = now < st;
                    return (
                      <tr key={c.id}>
                        <td className="border px-3 py-2">{c.name}</td>
                        <td className="border px-3 py-2">{new Date(c.start_at).toLocaleString('vi-VN')}</td>
                        <td className="border px-3 py-2">{new Date(c.end_at).toLocaleString('vi-VN')}</td>
                        <td className="border px-3 py-2 text-right">
                          <span
                            className={`mr-2 inline-block rounded px-2 py-0.5 text-xs ${
                              open
                                ? 'bg-green-100 text-green-700'
                                : future
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {open ? 'Đang mở' : future ? 'Sắp tới' : 'Đã đóng'}
                          </span>
                          {open && (
                            <button
                              onClick={() => closeCampaignNow(c.id)}
                              className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Đóng ngay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!campaigns.length && (
                    <tr>
                      <td className="border px-3 py-4 text-center text-slate-500" colSpan={4}>
                        Chưa có campaign
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* List + Filters */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-sm font-semibold">Danh sách biểu mẫu 360°</div>
            <div className="text-xs text-slate-500">Lọc theo trạng thái & nhóm</div>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng</option>
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">Tất cả nhóm</option>
              <option value="faculty">Giảng viên</option>
              <option value="peer">Sinh viên đánh giá nhau</option>
              <option value="self">Sinh viên tự đánh giá</option>
              <option value="supervisor">Người hướng dẫn</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>
        </div>

        {loadingList ? (
          <div className="text-sm text-slate-500">Đang tải…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left">Tiêu đề</th>
                  <th className="border px-3 py-2">Nhóm</th>
                  <th className="border px-3 py-2">Trạng thái</th>
                  <th className="border px-3 py-2 w-56"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="border px-3 py-2">{it.title}</td>
                    <td className="border px-3 py-2 text-center">{it.group_code}</td>
                    <td className="border px-3 py-2 text-center">{it.status}</td>
                    <td className="border px-3 py-2 text-right">
                      <button
                        onClick={() => openCampaignManager(it)}
                        className="mr-2 rounded border px-2 py-1 hover:bg-slate-50"
                      >
                        Campaigns
                      </button>
                      <button onClick={() => editRow(it)} className="mr-2 rounded border px-2 py-1 hover:bg-slate-50">
                        Sửa
                      </button>
                      <button
                        onClick={() => remove(it.id)}
                        className="rounded border px-2 py-1 text-red-600 hover:bg-red-50"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="border px-3 py-4 text-center text-slate-500" colSpan={4}>
                      Chưa có biểu mẫu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
