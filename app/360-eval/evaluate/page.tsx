// app/360-eval/evaluate/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type GroupCode = 'self'|'peer'|'faculty'|'supervisor'|'patient';

type AnyRow = { id?: string; key?: string; label: string };
type AnyCol = { key: string; label: string };
type Rubric = {
  id: string;
  title: string;
  definition: { rows: AnyRow[]; columns: AnyCol[] };
};

type StudentOpt = { user_id: string; label: string };

function rowId(r: AnyRow): string {
  return (r.id || r.key || '').toString();
}

// =============== Async combobox SV ===============
function AsyncStudentCombobox({
  value,
  onChange,
  disabled,
  placeholder = 'Nhập MSSV hoặc tên để tìm…',
}: {
  value: string | null;
  onChange: (val: { user_id: string; label: string } | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<StudentOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);
        const url = q.trim()
          ? `/api/360/students?q=${encodeURIComponent(q.trim())}`
          : `/api/360/students`;
        const r = await fetch(url, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tải được danh sách');
        const items: StudentOpt[] = (d.items || []).map((x: any) => ({
          user_id: x.user_id,
          label: x.label,
        }));
        setOpts(items);
      } catch (e: any) {
        setErr(e?.message || 'Lỗi tải dữ liệu');
        setOpts([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!value) { setSelectedLabel(''); return; }
    const match = opts.find(o => o.user_id === value);
    if (match) setSelectedLabel(match.label);
  }, [value, opts]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60"
      >
        <span className={selectedLabel ? '' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <svg className="ml-2 h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 9l6 6 6-6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow">
          <div className="p-2">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              autoFocus
              placeholder="Tìm nhanh theo MSSV/họ tên…"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-auto border-t">
            {loading && <div className="px-3 py-2 text-sm text-slate-500">Đang tìm…</div>}
            {err && !loading && <div className="px-3 py-2 text-sm text-red-600">{err}</div>}
            {!loading && !err && opts.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-500">Không có kết quả</div>
            )}
            {!loading && !err && opts.map(o => (
              <button
                key={o.user_id}
                onClick={() => { onChange(o); setSelectedLabel(o.label); setOpen(false); }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${value===o.user_id?'bg-slate-100':''}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {value && (
            <div className="border-t p-2">
              <button
                onClick={() => { onChange(null); setSelectedLabel(''); setQ(''); }}
                className="text-xs text-red-600 hover:underline"
              >
                Xóa lựa chọn
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Page ====================
export default function Eval360DoPage() {
  const { profile } = useAuth();
  const selfUserId = (profile as any)?.user_id ?? null;
  const selfName   = profile?.name ?? (profile as any)?.email ?? 'Tôi';

  const [group, setGroup] = useState<GroupCode>('peer');
  const [evaluatee, setEvaluatee] = useState<{ user_id: string; label: string } | null>(null);

  // lấy form theo group_code từ API mới: /api/360/form
  const [forms, setForms] = useState<Array<{ id: string; title: string; rubric_id: string }>>([]);
  const [rubricId, setRubricId] = useState('');
  const [rubric, setRubric] = useState<Rubric | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  // auto-self
  useEffect(() => {
    if (group === 'self' && selfUserId) {
      setEvaluatee({ user_id: selfUserId, label: `${selfName} (Tự đánh giá)` });
    } else {
      setEvaluatee(null);
    }
  }, [group, selfUserId, selfName]);

  // list forms (đúng route mới)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/360/form?group_code=${group}&status=active`, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tải được biểu mẫu');
        setForms((d.items || []).map((x: any) => ({ id: x.id, title: x.title, rubric_id: x.rubric_id })));
      } catch {
        setForms([]);
      } finally {
        setRubricId('');
        setRubric(null);
        setAnswers({});
      }
    })();
  }, [group]);

  // load rubric.definition (giữ fallback đa endpoint như trước)
  async function loadRubricDef(id: string) {
    const tryUrls = [
      `/api/rubrics/get?id=${id}`,
      `/api/_internal/rubric?id=${id}`,
      `/api/_raw/rubric?id=${id}`,
    ];
    for (const u of tryUrls) {
      try {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) continue;
        const d = await r.json();
        const rb: Rubric | null = d.rubric || d.data || d.item || null;
        if (rb?.definition?.rows && rb?.definition?.columns) {
          // chuẩn hoá rows: luôn có id dùng để chấm
          rb.definition.rows = rb.definition.rows.map((row: AnyRow) => ({
            ...row,
            id: rowId(row),
          }));
          setRubric(rb);
          setAnswers({});
          return;
        }
      } catch { /* next */ }
    }
    alert('Không tải được rubric.definition');
  }

  useEffect(() => {
    if (!rubricId) return;
    loadRubricDef(rubricId);
  }, [rubricId]);

  const canSubmit = useMemo(() => {
    const need = rubric?.definition?.rows?.length || 0;
    return !!evaluatee?.user_id && !!rubric && Object.keys(answers).length >= need;
  }, [evaluatee, rubric, answers]);

  async function handleSubmit() {
    if (!rubric || !evaluatee?.user_id) return;
    try {
      setLoading(true);
      // giữ nguyên flow start → submit nội bộ như code cũ của bạn
      const st = await fetch('/api/360/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          evaluatee_user_id: evaluatee.user_id,
          rubric_id: rubric.id,
          group_code: group
        })
      });
      const sd = await st.json();
      if (!st.ok) throw new Error(sd?.error || 'Không tạo được request');

      const items = rubric.definition.rows.map((row) => {
        const rid = rowId(row);
        return {
          item_key: rid,                         // dùng ID chuẩn hoá (id||key)
          selected_level: answers[rid],          // col.key
          score: null,
          comment: null,
        };
      });

      const sb = await fetch('/api/360/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          request_id: sd.request_id,
          rubric_id: rubric.id,
          overall_comment: comment || null,
          items
        })
      });
      const sbd = await sb.json();
      if (!sb.ok) throw new Error(sbd?.error || 'Nộp thất bại');

      alert('Đã nộp đánh giá 360° thành công!');
      setAnswers({});
      setComment('');
      if (group !== 'self') setEvaluatee(null);
      setRubricId('');
      setRubric(null);
    } catch (e: any) {
      alert(e?.message || 'Lỗi gửi đánh giá');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Chọn nhóm & SV */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold">Bạn là</label>
            <select
              value={group}
              onChange={(e)=>setGroup(e.target.value as GroupCode)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="faculty">Giảng viên</option>
              <option value="peer">Sinh viên đánh giá nhau</option>
              <option value="self">Sinh viên tự đánh giá</option>
              <option value="supervisor">Người hướng dẫn</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold">Chọn sinh viên</label>
            <AsyncStudentCombobox
              value={evaluatee?.user_id ?? null}
              onChange={(v)=>setEvaluatee(v)}
              disabled={group === 'self'}
              placeholder={group === 'self' ? 'Tự đánh giá: hệ thống tự chọn bạn' : 'Nhập MSSV hoặc tên để tìm…'}
            />
          </div>
        </div>
      </div>

      {/* Chọn biểu mẫu */}
      <div className="rounded-xl border bg-white p-4">
        <label className="text-xs font-semibold">Chọn biểu mẫu</label>
        <select
          value={rubricId}
          onChange={(e)=>setRubricId(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Chọn —</option>
          {forms.map(f => (
            <option key={f.id} value={f.rubric_id}>{f.title}</option>
          ))}
        </select>
      </div>

      {/* Render rubric */}
      {rubric && (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 font-semibold">{rubric.title}</div>
          <div className="overflow-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left w-1/3">Tiêu chí</th>
                  {rubric.definition.columns.map(col => (
                    <th key={col.key} className="border px-3 py-2 text-center">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rubric.definition.rows.map(row => {
                  const rid = rowId(row);
                  return (
                    <tr key={rid}>
                      <td className="border px-3 py-2">{row.label}</td>
                      {rubric.definition.columns.map(col => (
                        <td key={col.key} className="border px-3 py-2 text-center">
                          <input
                            type="radio"
                            name={`row-${rid}`}
                            checked={answers[rid]===col.key}
                            onChange={()=>setAnswers(a=>({ ...a, [rid]: col.key }))}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold">Nhận xét tổng quát</label>
            <textarea
              value={comment}
              onChange={(e)=>setComment(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              placeholder="Những điểm mạnh & cần cải thiện…"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? 'Đang gửi…' : 'Nộp đánh giá'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
