'use client';
import { useMemo, useState } from 'react';

/* ===== Types & helpers ===== */
export type Level = '1' | '2' | '3' | '4';
export type Achieve = 'achieved' | 'not_yet';
export type CourseCLO = { course_code: string; clo_code: string; level: Level };
export type PI = { code: string; description: string };
export type PLO = { code: string; description: string };

export function weightOf(level: Level) { return ({ '1':1,'2':2,'3':3,'4':4 } as any)[level] ?? 1; }
export function ratioFrom(items: Array<CourseCLO & { status: Achieve }>) {
  const total = items.reduce((s, it) => s + weightOf(it.level), 0);
  const got = items.filter(it => it.status==='achieved').reduce((s, it) => s + weightOf(it.level), 0);
  const pct = total>0 ? Math.round((got/total)*100) : 0;
  return { total, got, pct };
}

/* ===== Reusable UI ===== */
export function ProgressRow(props: {
  code: string; title?: string; items: Array<CourseCLO & { status: Achieve }>; onClick?: () => void;
}) {
  const { pct, got, total } = useMemo(() => ratioFrom(props.items), [props.items]);
  return (
    <button onClick={props.onClick}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.99]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{props.code}</div>
        <div className="text-sm text-slate-600">{got}/{total} (≈ {pct}%)</div>
      </div>
      {props.title && <div className="text-xs text-slate-500 mt-0.5">{props.title}</div>}
      <div className="mt-3 h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

export function DetailModal(props: {
  kind: 'PI' | 'PLO'; open: boolean; onClose: () => void; title: string; desc: string;
  items: Array<CourseCLO & { status: Achieve }>;
}) {
  const [stateFilter, setStateFilter] = useState<'all'|'achieved'|'not_yet'>('all');
  const filtered = props.items.filter(it => stateFilter==='all' ? true : it.status===stateFilter);
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{props.kind} {props.title}</h3>
          <button onClick={props.onClose} className="text-sm text-slate-600 hover:underline">Đóng</button>
        </div>
        <p className="text-sm text-slate-700 mt-1">{props.desc}</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm">Lọc:</span>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value as any)}
                  className="border rounded-md px-2 py-1 text-sm">
            <option value="all">Tất cả</option>
            <option value="achieved">Đạt</option>
            <option value="not_yet">Chưa đạt</option>
          </select>
        </div>

        <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left border-b">Học phần</th>
                <th className="px-3 py-2 text-left border-b">CLO</th>
                <th className="px-3 py-2 text-left border-b">Level</th>
                <th className="px-3 py-2 text-left border-b">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, idx) => (
                <tr key={idx} className="odd:bg-slate-50">
                  <td className="px-3 py-2 border-b">{it.course_code}</td>
                  <td className="px-3 py-2 border-b">{it.clo_code}</td>
                  <td className="px-3 py-2 border-b">{it.level}</td>
                  <td className="px-3 py-2 border-b">{it.status==='achieved' ? 'Đạt' : 'Chưa đạt'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={4}>Không có mục phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== Skeletons ===== */
export function ProgressCardSkel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-4 w-20 rounded bg-slate-200" />
      </div>
      <div className="mt-2 h-3 w-40 rounded bg-slate-200" />
      <div className="mt-3 h-2.5 rounded-full bg-slate-200" />
    </div>
  );
}

export function SurveyCardSkel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
      <div className="h-4 w-2/3 bg-slate-200 rounded" />
      <div className="mt-2 h-3 w-1/3 bg-slate-200 rounded" />
      <div className="mt-2 h-3 w-1/2 bg-slate-200 rounded" />
    </div>
  );
}
