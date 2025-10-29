// app/360-eval/forms/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/** ===== Types ===== */
type FormRow = {
  id: string;
  title: string;
  group_code: 'self'|'peer'|'faculty'|'supervisor'|'patient';
  rubric_id: string;
  framework_id?: string|null;
  course_code?: string|null;
  status: 'active'|'inactive';
  created_at?: string;
  updated_at?: string;
};

type RubricOpt = { id: string; title: string };

type FrameworkOpt = { id: string; label: string };
type CourseOpt    = { course_code: string; course_name?: string|null };

type RubricColumn = { key: string; label: string };
type RubricRow    = { id: string; label: string; clo_ids?: string[] };
type RubricDef    = { columns: RubricColumn[]; rows: RubricRow[] };

function truthy(x: any) { return x === true || x === 'true' || x === 1 || x === '1'; }
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
  { key: 'na',  label: 'Not achieved' },
  { key: 'ach', label: 'Achieved' },
  { key: 'good',label: 'Good' },
];

export default function Eval360FormsPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const allowed = useMemo(() => canSeeQA(profile), [profile]);

  // ===== List & filters =====
  const [items, setItems] = useState<FormRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [groupFilter,  setGroupFilter]  = useState<'all'|FormRow['group_code']>('all');

  // ===== Form meta (create/edit) =====
  const [editingId, setEditingId] = useState<string|undefined>();
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
    { id: crypto.randomUUID(), label: 'Professionalism' },
  ]);

  // framework/course (để lưu rubric mới nếu schema rubrics yêu cầu)
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [courses, setCourses]       = useState<CourseOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode]   = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Redirect nếu không đủ quyền
  useEffect(() => {
    if (loading) return;
    if (!allowed) router.replace('/360-eval/evaluate');
  }, [loading, allowed, router]);

  // Load dropdown rubrics (để "use existing")
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/rubrics/list');
        const d = await r.json();
        setRubrics((d.items || []).map((x: any) => ({ id: x.id, title: x.title as string })));
      } catch { setRubrics([]); }
    })();
  }, []);

  // Load frameworks
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/frameworks');
        const d = await r.json();
        // Backend trả { items: [{id, label}] } hoặc { items: [{id, doi_tuong, ...}] }
        const items = (d.items || []).map((x: any) => ({
          id: x.id,
          label: x.label ?? `${x.doi_tuong} • ${x.chuyen_nganh} • ${x.nien_khoa}`,
        }));
        setFrameworks(items);
      } catch { setFrameworks([]); }
    })();
  }, []);

  // Load courses theo framework (API của bạn)
  useEffect(() => {
    (async () => {
      if (!frameworkId) { setCourses([]); setCourseCode(''); return; }
      try {
        const r = await fetch(`/api/academic-affairs/courses/list?framework_id=${encodeURIComponent(frameworkId)}`);
        const d = await r.json();
        setCourses((d.items || []) as CourseOpt[]);
      } catch { setCourses([]); }
    })();
  }, [frameworkId]);

  async function loadList() {
    setLoadingList(true);
    setErr('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (groupFilter  !== 'all') params.set('group_code', groupFilter);
      // === đổi forms -> form (số ít)
      const url = `/api/360/form${params.toString() ? `?${params.toString()}` : ''}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Không tải được danh sách biểu mẫu');
      setItems(d.items || []);
    } catch (e: any) {
      setItems([]); setErr(e?.message || 'Lỗi tải danh sách');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { if (allowed) loadList(); }, [allowed, statusFilter, groupFilter]);

  function resetForm() {
    setEditingId(undefined);
    setTitle(''); setGroup('peer'); setStatus('active');
    setUseExistingRubric(true);
    setRubricId('');
    setRbTitle(''); setRbThreshold(70);
    setRbCols(DEFAULT_COLS);
    setRbRows([{ id: crypto.randomUUID(), label: 'Professionalism' }]);
    setFrameworkId(''); setCourseCode('');
    setErr('');
  }

  function editRow(it: FormRow) {
    setEditingId(it.id);
    setTitle(it.title);
    setGroup(it.group_code);
    setStatus(it.status);
    // khi sửa form cũ, mặc định dùng rubric hiện có
    setUseExistingRubric(true);
    setRubricId(it.rubric_id);
    setFrameworkId(it.framework_id || '');
    setCourseCode(it.course_code || '');
    setErr('');
  }

  // ===== Rubric builder helpers =====
  function addCol() {
    const key = `lv${rbCols.length+1}`;
    setRbCols([...rbCols, { key, label: `Level ${rbCols.length+1}` }]);
  }
  function delCol(idx: number) {
    if (rbCols.length <= 1) return;
    const next = rbCols.slice(); next.splice(idx,1); setRbCols(next);
  }
  function addRow() {
    setRbRows([...rbRows, { id: crypto.randomUUID(), label: `Criterion ${rbRows.length+1}` }]);
  }
  function delRow(idx: number) {
    const next = rbRows.slice(); next.splice(idx,1);
    setRbRows(next.length ? next : [{ id: crypto.randomUUID(), label: 'Criterion' }]);
  }

  async function save() {
    try {
      if (!title.trim()) return setErr('Thiếu tiêu đề biểu mẫu.');
      if (useExistingRubric) {
        if (!rubricId) return setErr('Chưa chọn rubric.');
      } else {
        // tạo rubric mới → (nếu schema rubrics yêu cầu framework/course) thì bật 2 dòng dưới:
        if (!rbTitle.trim()) return setErr('Thiếu tiêu đề rubric.');
        if (!frameworkId || !courseCode) return setErr('Vui lòng chọn Khung CTĐT và Học phần để lưu rubric.');
        if (!rbCols.length || !rbRows.length) return setErr('Rubric phải có ít nhất 1 cột & 1 tiêu chí.');
      }

      setSaving(true); setErr('');

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
          framework_id: frameworkId,
          course_code: courseCode,
          definition: def,
        };
      }

      // === đổi forms -> form (số ít)
      const r = await fetch('/api/360/form', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Lỗi lưu biểu mẫu');

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
      // === đổi forms -> form (số ít)
      const r = await fetch(`/api/360/form?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Lỗi xoá biểu mẫu');
      if (editingId === id) resetForm();
      await loadList();
    } catch (e: any) {
      setErr(e?.message || 'Lỗi xoá');
    }
  }

  if (loading)    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Đang tải quyền…</div>;
  if (!allowed)   return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Bạn không có quyền.</div>;

  return (
    <div className="space-y-4">
      {/* Builder card */}
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold mb-2">{editingId ? 'Sửa biểu mẫu 360°' : 'Tạo biểu mẫu 360°'}</div>

        {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Tiêu đề biểu mẫu"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={group}
            onChange={(e)=>setGroup(e.target.value as FormRow['group_code'])}
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
            onChange={(e)=>setStatus(e.target.value as FormRow['status'])}
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
                <input
                  type="radio"
                  checked={useExistingRubric}
                  onChange={()=>setUseExistingRubric(true)}
                />
                Dùng rubric có sẵn
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!useExistingRubric}
                  onChange={()=>setUseExistingRubric(false)}
                />
                Tạo rubric mới (độc lập cho 360)
              </label>
            </div>

            {useExistingRubric ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <select
                  value={rubricId}
                  onChange={(e)=>setRubricId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">— Chọn rubric —</option>
                  {rubrics.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={rbTitle}
                    onChange={(e)=>setRbTitle(e.target.value)}
                    placeholder="Tiêu đề rubric"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rbThreshold}
                    onChange={(e)=>setRbThreshold(Number(e.target.value))}
                    placeholder="Ngưỡng đạt (%)"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <div className="text-xs text-slate-500 flex items-center">Ngưỡng tổng thể để coi là đạt</div>
                </div>

                {/* Framework & Course (bắt buộc nếu schema rubrics cần) */}
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={frameworkId}
                    onChange={(e)=>setFrameworkId(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    title="Khung CTĐT"
                  >
                    <option value="">— Chọn Khung CTĐT —</option>
                    {frameworks.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <select
                    value={courseCode}
                    onChange={(e)=>setCourseCode(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    title="Học phần"
                    disabled={!frameworkId}
                  >
                    <option value="">{frameworkId ? '— Chọn học phần —' : 'Chọn khung trước'}</option>
                    {courses.map(c => (
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
                          onChange={(e)=>{
                            const next = [...rbCols]; next[idx] = { ...c, key: e.target.value.trim() || `lv${idx+1}` };
                            setRbCols(next);
                          }}
                          className="w-40 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="key"
                          title="Khoá (ví dụ: na/ach/good)"
                        />
                        <input
                          value={c.label}
                          onChange={(e)=>{
                            const next = [...rbCols]; next[idx] = { ...c, label: e.target.value };
                            setRbCols(next);
                          }}
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="Nhãn hiển thị"
                        />
                        <button onClick={()=>delCol(idx)} className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50">Xoá</button>
                      </div>
                    ))}
                    <button onClick={addCol} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">+ Thêm mức</button>
                  </div>
                </div>

                {/* Rows builder */}
                <div>
                  <div className="mb-2 text-sm font-semibold">Tiêu chí (dòng)</div>
                  <div className="space-y-2">
                    {rbRows.map((r, idx) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <div className="text-xs rounded border px-2 py-1">{idx+1}</div>
                        <input
                          value={r.label}
                          onChange={(e)=>{
                            const next = [...rbRows]; next[idx] = { ...r, label: e.target.value };
                            setRbRows(next);
                          }}
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                          placeholder="Nội dung tiêu chí"
                        />
                        <button onClick={()=>delRow(idx)} className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50">Xoá</button>
                      </div>
                    ))}
                    <button onClick={addRow} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">+ Thêm tiêu chí</button>
                  </div>
                </div>

                {/* Mini preview */}
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1 text-left">Tiêu chí</th>
                        {rbCols.map(c => <th key={c.key} className="border px-2 py-1 text-center">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rbRows.map(r => (
                        <tr key={r.id}>
                          <td className="border px-2 py-1">{r.label}</td>
                          {rbCols.map(c => <td key={c.key} className="border px-2 py-1 text-center">○</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-60">
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border px-4 py-2">Huỷ</button>
            )}
          </div>
        </div>
      </div>

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
              onChange={(e)=>setStatusFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng</option>
            </select>
            <select
              value={groupFilter}
              onChange={(e)=>setGroupFilter(e.target.value as any)}
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
                  <th className="border px-3 py-2 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td className="border px-3 py-2">{it.title}</td>
                    <td className="border px-3 py-2 text-center">{it.group_code}</td>
                    <td className="border px-3 py-2 text-center">{it.status}</td>
                    <td className="border px-3 py-2 text-right">
                      <button onClick={()=>editRow(it)} className="mr-2 rounded border px-2 py-1 hover:bg-slate-50">Sửa</button>
                      <button onClick={()=>remove(it.id)} className="rounded border px-2 py-1 text-red-600 hover:bg-red-50">Xoá</button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td className="border px-3 py-4 text-center text-slate-500" colSpan={4}>Chưa có biểu mẫu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
