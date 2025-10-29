// app/360-eval/evaluate/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type GroupCode = 'self' | 'peer' | 'faculty' | 'supervisor' | 'patient';

type Row = { key: string; label: string };
type Col = { key: string; label: string };
type Rubric = {
  id: string;
  title: string;
  definition: { rows: Row[]; columns: Col[] };
};

type StudentOpt = { user_id: string; label: string };

/* ================= Helpers ================= */
function slugKey(s: string, prefix: string, i: number) {
  const base = (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `${prefix}${i + 1}`;
}

function normalizeRubric(raw: any): Rubric | null {
  if (!raw) return null;
  const def = raw.definition || {};
  const colsSrc = Array.isArray(def.columns) ? def.columns : [];
  const rowsSrc = Array.isArray(def.rows) ? def.rows : [];

  const columns: Col[] = colsSrc.map((c: any, i: number) => ({
    key: String(c?.key ?? slugKey(String(c?.label ?? ''), 'c', i)),
    label: String(c?.label ?? c?.key ?? `Level ${i + 1}`),
  }));

  const rows: Row[] = rowsSrc.map((r: any, i: number) => ({
    key: String(r?.key ?? r?.id ?? slugKey(String(r?.label ?? ''), 'r', i)),
    label: String(r?.label ?? r?.key ?? r?.id ?? `Criterion ${i + 1}`),
  }));

  if (!columns.length || !rows.length) return null;

  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Rubric'),
    definition: { rows, columns },
  };
}

/** Robust JSON fetch: báo lỗi nếu server trả HTML/không phải JSON */
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

/* =============== Combobox async =============== */
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

  // fetch theo q (debounce)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);
        const url = q.trim()
          ? `/api/360/students?q=${encodeURIComponent(q.trim())}`
          : `/api/360/students`;
        const d = await fetchJson(url, { credentials: 'include' });
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

  // cập nhật label khi có value
  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    const match = opts.find((o) => o.user_id === value);
    if (match) setSelectedLabel(match.label);
  }, [value, opts]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
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
              onChange={(e) => setQ(e.target.value)}
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
            {!loading &&
              !err &&
              opts.map((o) => (
                <button
                  key={o.user_id}
                  onClick={() => {
                    onChange(o);
                    setSelectedLabel(o.label);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    value === o.user_id ? 'bg-slate-100' : ''
                  }`}
                >
                  {o.label}
                </button>
              ))}
          </div>
          {value && (
            <div className="border-t p-2">
              <button
                onClick={() => {
                  onChange(null);
                  setSelectedLabel('');
                  setQ('');
                }}
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

/* ==================== Page ==================== */
export default function Eval360DoPage() {
  const { profile } = useAuth(); // có thể null với khách (anon)
  const selfUserId = (profile as any)?.user_id ?? null;
  const selfName = profile?.name ?? (profile as any)?.email ?? 'Tôi';

  const [group, setGroup] = useState<GroupCode>('peer');
  const [evaluatee, setEvaluatee] = useState<{ user_id: string; label: string } | null>(null);

  // Danh sách FORM: id (form_id), title, rubric_id
  const [forms, setForms] = useState<Array<{ id: string; title: string; rubric_id: string }>>([]);
  const [formId, setFormId] = useState<string>(''); // chọn theo form.id
  const [rubric, setRubric] = useState<Rubric | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  // Tự gán evaluatee khi group=self và có selfUserId
  useEffect(() => {
    if (group === 'self' && selfUserId) {
      setEvaluatee({ user_id: selfUserId, label: `${selfName} (Tự đánh giá)` });
    } else {
      setEvaluatee(null);
    }
  }, [group, selfUserId, selfName]);

  // Lấy danh sách form: **/api/360/form** (SINGULAR)
  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const url = `/api/360/form?group_code=${encodeURIComponent(group)}&status=active`;
        const d = await fetchJson(url, { credentials: 'include' });
        setForms(
          (d.items || []).map((x: any) => ({
            id: x.id,
            title: x.title,
            rubric_id: x.rubric_id,
          }))
        );
      } catch (e: any) {
        setForms([]);
        setErr(e?.message || 'Lỗi tải biểu mẫu');
      } finally {
        // reset khi đổi nhóm
        setFormId('');
        setRubric(null);
        setAnswers({});
      }
    })();
  }, [group]);

  // Load rubric theo rubric_id của form được chọn
  async function loadRubricDef(rubricId: string) {
    setErr('');
    try {
      const d = await fetchJson(`/api/rubrics/get?id=${encodeURIComponent(rubricId)}`, {
        credentials: 'include',
      });
      const norm = normalizeRubric(d.item || d.rubric || d.data || d);
      if (!norm) throw new Error('Rubric thiếu hàng/cột');
      setRubric(norm);
      setAnswers({});
    } catch (e: any) {
      setRubric(null);
      setErr(e?.message || 'Không tải được rubric.definition');
    }
  }

  function onPickForm(newFormId: string) {
    setFormId(newFormId);
    const f = forms.find((x) => x.id === newFormId);
    if (f?.rubric_id) {
      loadRubricDef(f.rubric_id);
    } else {
      setRubric(null);
    }
  }

  const canSubmit = useMemo(() => {
    if (!evaluatee?.user_id || !rubric || !formId) return false;
    return rubric.definition.rows.every((row) => !!answers[row.key]);
  }, [evaluatee, rubric, formId, answers]);

  async function handleSubmit() {
    if (!rubric || !evaluatee?.user_id || !formId) return;
    try {
      setLoading(true);
      setErr('');

      // 1) tạo request bằng form_id (API xác định campaign_id phù hợp)
      const st = await fetchJson('/api/360/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          form_id: formId,
          evaluatee_user_id: evaluatee.user_id,
        }),
      });

      // 2) lập danh sách items theo rubric
      const items = rubric.definition.rows.map((row) => ({
        item_key: row.key,
        selected_level: answers[row.key],
        score: null,
        comment: null,
      }));

      // 3) submit kết quả
      await fetchJson('/api/360/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          request_id: st.request_id,
          rubric_id: rubric.id,
          overall_comment: comment || null,
          items,
        }),
      });

      alert('Đã nộp đánh giá 360° thành công!');
      setAnswers({});
      setComment('');
      if (group !== 'self') setEvaluatee(null);
      setFormId('');
      setRubric(null);
      // forms giữ nguyên để người dùng có thể nộp tiếp
    } catch (e: any) {
      setErr(e?.message || 'Lỗi gửi đánh giá');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Chọn đối tượng & SV */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold">Bạn là</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupCode)}
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
              onChange={(v) => setEvaluatee(v)}
              disabled={group === 'self'}
              placeholder={
                group === 'self'
                  ? 'Tự đánh giá: hệ thống tự chọn bạn'
                  : 'Nhập MSSV hoặc tên để tìm…'
              }
            />
            {group === 'self' && !selfUserId && (
              <div className="mt-1 text-xs text-slate-500">
                * Bạn đang ở chế độ khách, nên không thể “Tự đánh giá”. Chọn nhóm khác hoặc đăng nhập.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chọn biểu mẫu (theo form_id) */}
      <div className="rounded-xl border bg-white p-4">
        <label className="text-xs font-semibold">Chọn biểu mẫu</label>
        <select
          value={formId}
          onChange={(e) => onPickForm(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Chọn —</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
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
                  {rubric.definition.columns.map((col) => (
                    <th key={col.key} className="border px-3 py-2 text-center">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rubric.definition.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="border px-3 py-2">{row.label}</td>
                    {rubric.definition.columns.map((col) => (
                      <td key={col.key} className="border px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`row-${row.key}`}
                          checked={answers[row.key] === col.key}
                          onChange={() => setAnswers((a) => ({ ...a, [row.key]: col.key }))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold">Nhận xét tổng quát</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
