'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type GroupCode = 'self'|'peer'|'faculty'|'supervisor'|'patient';

type FormRow = { key: string; label: string };
type FormCol = { key: string; label: string };
type Rubric = {
  id: string;
  title: string;
  definition: { rows: FormRow[]; columns: FormCol[] };
};

type StudentOpt = { user_id: string; label: string };

export default function Eval360DoPage() {
  const { profile } = useAuth();
  const selfUserId = (profile as any)?.user_id ?? (profile as any)?.id ?? null;
  const selfName = profile?.name ?? (profile as any)?.email ?? 'Tôi';

  const [group, setGroup] = useState<GroupCode>('peer');

  // ==== Combobox state ====
  const [inputValue, setInputValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const [loadingSV, setLoadingSV] = useState(false);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [evaluatee, setEvaluatee] = useState<string>(''); // user_id được chọn
  const inputRef = useRef<HTMLInputElement|null>(null);
  const listRef  = useRef<HTMLDivElement|null>(null);

  // ==== Forms / rubric ====
  const [forms, setForms] = useState<Array<{ id: string; title: string; rubric_id: string }>>([]);
  const [rubricId, setRubricId] = useState('');
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // ====== Helper: đóng dropdown khi click ra ngoài ======
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownOpen) return;
      const t = e.target as Node;
      if (inputRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [dropdownOpen]);

  // ====== Nạp forms theo group ======
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/360/forms?group_code=${group}&status=active`);
      const d = await r.json();
      setForms((d.items || []).map((x: any) => ({ id: x.id, title: x.title, rubric_id: x.rubric_id })));
      setRubricId('');
      setRubric(null);
    })();
  }, [group]);

  // ====== Tìm SV (debounce) ======
  useEffect(() => {
    if (group === 'self') return; // self: khóa theo chính mình
    const q = inputValue.trim();
    if (!q) { setStudents([]); return; }
    setLoadingSV(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/360/students?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setStudents((d.items || []) as StudentOpt[]);
        setHighlight((d.items || []).length ? 0 : -1);
      } catch {
        setStudents([]);
        setHighlight(-1);
      } finally {
        setLoadingSV(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [inputValue, group]);

  // ====== “Self” → tự gán evaluatee = current user, khóa input ======
  useEffect(() => {
    if (group === 'self') {
      if (selfUserId) {
        setEvaluatee(selfUserId);
        setInputValue(selfName);
      } else {
        // nếu chưa có profile trong context, cứ giữ trống để người dùng chọn tay
        setEvaluatee('');
        setInputValue('');
      }
      setDropdownOpen(false);
    } else {
      // rời khỏi self → reset
      setEvaluatee('');
      setInputValue('');
      setStudents([]);
    }
  }, [group, selfUserId, selfName]);

  // ====== Lấy rubric.definition theo rubricId (thử nhiều endpoint để tương thích app cũ) ======
  async function loadRubricDef(id: string) {
    const urls = [
      `/api/_internal/rubric?id=${id}`,
      `/api/rubrics/get?id=${id}`,
      `/api/rubrics/detail?id=${id}`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        const d = await r.json();
        const ru: Rubric | null =
          d?.rubric ??
          d?.data ??
          (d?.item && d?.item.definition ? d.item : null);
        if (ru?.definition?.rows && ru?.definition?.columns) {
          setRubric(ru);
          setAnswers({});
          return;
        }
      } catch {
        // thử endpoint tiếp theo
      }
    }
    // Nếu đến đây vẫn không lấy được:
    setRubric(null);
    console.warn('Không tải được rubric.definition cho id=', id);
  }

  // Khi chọn form → tải rubric
  useEffect(() => {
    if (!rubricId) return;
    loadRubricDef(rubricId);
  }, [rubricId]);

  // ====== Submit ======
  const canSubmit = useMemo(() => {
    const okRows = rubric?.definition?.rows?.length || 0;
    return !!evaluatee && !!rubric && Object.keys(answers).length >= okRows;
  }, [evaluatee, rubric, answers]);

  async function handleSubmit() {
    if (!rubric || !evaluatee) return;
    try {
      setLoadingSubmit(true);
      // 1) tạo evaluation_request ad-hoc cho phiên đánh giá này
      const st = await fetch('/api/360/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ evaluatee_user_id: evaluatee, rubric_id: rubric.id, group_code: group })
      });
      const sd = await st.json();
      if (!st.ok) throw new Error(sd?.error || 'Không tạo được yêu cầu đánh giá');

      // 2) submit điểm
      const items = rubric.definition.rows.map((row) => ({
        item_key: row.key,
        selected_level: answers[row.key],
        score: null,
        comment: null,
      }));

      const sb = await fetch('/api/360/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
      if (group !== 'self') { setEvaluatee(''); setInputValue(''); }
    } catch (e: any) {
      alert(e?.message || 'Lỗi gửi đánh giá');
    } finally {
      setLoadingSubmit(false);
    }
  }

  // ====== Combobox handlers ======
  function onFocusInput() {
    if (group === 'self') return;
    setDropdownOpen(true);
  }
  function onKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) return;
    if (!students.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(students.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < students.length) {
        const s = students[highlight];
        onPickStudent(s);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }
  function onPickStudent(s: StudentOpt) {
    setEvaluatee(s.user_id);
    setInputValue(s.label);
    setDropdownOpen(false);
  }
  function onClearStudent() {
    setEvaluatee('');
    setInputValue('');
    setStudents([]);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Chọn đối tượng & SV */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold">Bạn là</label>
            <select
              value={group}
              onChange={(e)=>setGroup(e.target.value as GroupCode)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="faculty">Giảng viên</option>
              <option value="peer">Sinh viên đánh giá nhau</option>
              <option value="self">Sinh viên tự đánh giá</option>
              <option value="supervisor">Người hướng dẫn</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>

          {/* Combobox chọn SV */}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold">Chọn sinh viên</label>
            <div className="relative mt-1">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e)=>{ setInputValue(e.target.value); setEvaluatee(''); setDropdownOpen(true); }}
                onFocus={onFocusInput}
                onKeyDown={onKeyDownInput}
                placeholder={group==='self' ? 'Bạn đang tự đánh giá' : 'Nhập MSSV hoặc tên để tìm…'}
                disabled={group==='self'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-20 text-sm outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-slate-100"
                aria-autocomplete="list"
                aria-expanded={dropdownOpen}
                aria-controls="sv-combobox-list"
                role="combobox"
              />
              {/* Clear + loading */}
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-2">
                {loadingSV && group!=='self' && (
                  <span className="pointer-events-auto animate-spin rounded-full border-2 border-slate-300 border-t-transparent p-2" />
                )}
              </div>
              {evaluatee && group!=='self' && (
                <button
                  type="button"
                  onClick={onClearStudent}
                  className="absolute inset-y-0 right-2 my-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50"
                  aria-label="Xóa lựa chọn"
                >
                  Xóa
                </button>
              )}

              {/* Dropdown */}
              {dropdownOpen && group!=='self' && (
                <div
                  ref={listRef}
                  id="sv-combobox-list"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  {!students.length && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      {inputValue.trim() ? 'Không tìm thấy. Hãy thử cụ thể hơn.' : 'Nhập MSSV hoặc tên để tìm.'}
                    </div>
                  )}
                  {students.map((s, idx) => (
                    <button
                      key={s.user_id}
                      role="option"
                      aria-selected={evaluatee===s.user_id}
                      onMouseEnter={()=>setHighlight(idx)}
                      onClick={()=>onPickStudent(s)}
                      className={[
                        'block w-full px-3 py-2 text-left text-sm',
                        idx===highlight ? 'bg-brand-50' : 'hover:bg-slate-50',
                        evaluatee===s.user_id ? 'bg-slate-100' : '',
                      ].join(' ')}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {evaluatee && (
              <div className="mt-1 text-xs text-slate-500">
                Đang chọn: <span className="font-medium">{inputValue}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chọn biểu mẫu */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold">Chọn biểu mẫu</label>
        <select
          value={rubricId}
          onChange={(e)=>setRubricId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="">— Chọn —</option>
          {forms.map(f => (
            <option key={f.id} value={f.rubric_id}>{f.title}</option>
          ))}
        </select>
      </div>

      {/* Render rubric */}
      {rubric && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                {rubric.definition.rows.map(row => (
                  <tr key={row.key}>
                    <td className="border px-3 py-2">{row.label}</td>
                    {rubric.definition.columns.map(col => (
                      <td key={col.key} className="border px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`row-${row.key}`}
                          checked={answers[row.key]===col.key}
                          onChange={()=>setAnswers(a=>({ ...a, [row.key]: col.key }))}
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
              onChange={(e)=>setComment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              rows={3}
              placeholder="Những điểm mạnh & cần cải thiện…"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={!canSubmit || loadingSubmit}
              onClick={handleSubmit}
              className="rounded-xl bg-brand-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {loadingSubmit ? 'Đang gửi…' : 'Nộp đánh giá'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
