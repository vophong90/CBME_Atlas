'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

/** ================== Types ================== */
type Framework = { id: string; nien_khoa?: string | null; chuyen_nganh?: string | null; doi_tuong?: string | null };
type Student   = { id: string; mssv: string | null; full_name: string | null; framework_id?: string | null };
type CLODef    = { id: string; course_code: string; clo_code: string };
type LevelSel  = 'CLO' | 'PLO' | 'PI';

type HeatInput = {
  rows: string[];    // display row labels (SV)
  cols: string[];    // display col labels (CLO key or PLO/PI code)
  matrix: number[][]; // [rows x cols] values in [0,1] (CLO: 0/1; PLO/PI: 0..1)
};

/** ================== Page ================== */
export default function HeatmapPage() {
  const supabase = getSupabase();

  // UI state
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [fwId, setFwId]             = useState<string>('');
  const [level, setLevel]           = useState<LevelSel>('CLO');
  const [autoCluster, setAutoCluster] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState<{type:'success'|'error'|'info'; text:string} | null>(null);

  // Data for drawing
  const [infoText, setInfoText]     = useState<string>('');
  const canvasRef                   = useRef<HTMLCanvasElement | null>(null);
  const CANVAS_W = 980; // kích thước cố định
  const CANVAS_H = 520;

  /** ----- Load frameworks once ----- */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('curriculum_frameworks')
          .select('id, nien_khoa, chuyen_nganh, doi_tuong')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const arr = (data ?? []) as Framework[];
        setFrameworks(arr);
        if (arr.length && !fwId) setFwId(arr[0].id);
      } catch (e: any) {
        setToast({ type: 'error', text: e.message ?? 'Không tải được khung CTĐT' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ================== Core: Build matrix & draw on demand ================== */

  async function handleDraw() {
    if (!fwId) { setToast({ type:'error', text:'Chưa chọn Khung CTĐT' }); return; }
    setLoading(true);
    setToast(null);
    setInfoText('');

    try {
      // 1) Lấy sinh viên theo framework
      const stRes = await supabase
        .from('students')
        .select('id,mssv,full_name,framework_id')
        .eq('framework_id', fwId);
      if (stRes.error && stRes.error.code !== '42P01') throw stRes.error;
      const students = (stRes.data ?? []) as Student[];
      if (!students.length) {
        drawEmpty('Chưa có sinh viên trong khung này.');
        setLoading(false);
        return;
      }
      // Chuẩn hoá nhãn SV
      const rowLabels = students
        .map(s => (s.mssv ? `${s.mssv} — ${s.full_name ?? ''}`.trim() : (s.full_name ?? '')))
        .map(s => s || '(không tên)');

      // 2) Lấy cấu trúc CLO của framework
      const closRes = await supabase
        .from('clos')
        .select('id,course_code,clo_code')
        .eq('framework_id', fwId);
      if (closRes.error && closRes.error.code !== '42P01') throw closRes.error;
      const CLOs = (closRes.data ?? []) as CLODef[];
      // set khóa gộp cho CLO
      const cloKeysFromStruct = Array.from(new Set(CLOs.map(c => `${c.course_code}#${c.clo_code}`)));

      // 3) Lấy kết quả CLO upload
      const upRes = await supabase
        .from('student_clo_results_uploads')
        .select('mssv,course_code,clo_code,status')
        .eq('framework_id', fwId);
      if (upRes.error && upRes.error.code !== '42P01') throw upRes.error;
      const up = (upRes.data ?? []) as {mssv:string|null,course_code:string|null,clo_code:string|null,status:string|null}[];

      // map: mssv -> set<course#clo> đạt
      const achieved = new Map<string, Set<string>>();
      const allCLOsFromUpload = new Set<string>();
      for (const r of up) {
        const ms = (r.mssv || '').trim();
        const cc = (r.course_code || '').trim();
        const cl = (r.clo_code || '').trim();
        if (!ms || !cc || !cl) continue;
        const key = `${cc}#${cl}`;
        allCLOsFromUpload.add(key);
        if (!achieved.has(ms)) achieved.set(ms, new Set());
        if (String(r.status || '').toLowerCase() === 'achieved') achieved.get(ms)!.add(key);
      }

      // 4) Lấy mapping PLO/PI nếu cần
      // PLO links
      const cloToPLO = new Map<string, Set<string>>(); // (course#clo) -> set<plo_code>
      let ploCodesSet = new Set<string>();
      if (level !== 'CLO') {
        const mres = await supabase
          .from('plo_clo_links')
          .select('plo_code,course_code,clo_code')
          .eq('framework_id', fwId);
        if (mres.error && mres.error.code !== '42P01') throw mres.error;
        for (const m of (mres.data ?? []) as any[]) {
          const key = `${m.course_code}#${m.clo_code}`;
          if (!cloToPLO.has(key)) cloToPLO.set(key, new Set());
          cloToPLO.get(key)!.add(m.plo_code);
          ploCodesSet.add(m.plo_code);
        }
      }
      const ploCodes = Array.from(ploCodesSet).sort();

      // PI links
      const cloToPI = new Map<string, Set<string>>(); // (course#clo) -> set<pi_code>
      let piCodesSet = new Set<string>();
      if (level === 'PI') {
        const mi = await supabase
          .from('pi_clo_links')
          .select('pi_code,course_code,clo_code')
          .eq('framework_id', fwId);
        if (mi.error && mi.error.code !== '42P01') throw mi.error;
        for (const m of (mi.data ?? []) as any[]) {
          const key = `${m.course_code}#${m.clo_code}`;
          if (!cloToPI.has(key)) cloToPI.set(key, new Set());
          cloToPI.get(key)!.add(m.pi_code);
          piCodesSet.add(m.pi_code);
        }
      }
      const piCodes = Array.from(piCodesSet).sort();

      // 5) Build matrix theo level
      let cols: string[] = [];
      const mat: number[][] = [];
      const msByIndex = students.map(s => (s.mssv || '').trim());

      if (level === 'CLO') {
        // cột là CLO keys (từ struct nếu có; không thì từ upload)
        const cloKeys = CLOs.length ? cloKeysFromStruct : Array.from(allCLOsFromUpload);
        cols = [...new Set(cloKeys)].sort();
        for (const s of students) {
          const ms = (s.mssv || '').trim();
          const got = achieved.get(ms) || new Set<string>();
          mat.push(cols.map(k => (got.has(k) ? 1 : 0))); // 0/1
        }
      } else if (level === 'PLO') {
        // cột là PLO codes
        cols = ploCodes;
        // map: PLO -> set<CLOkey>
        const cloSetByPLO = new Map<string, Set<string>>();
        for (const [cloKey, setP] of cloToPLO.entries()) {
          for (const p of setP) {
            if (!cloSetByPLO.has(p)) cloSetByPLO.set(p, new Set());
            cloSetByPLO.get(p)!.add(cloKey);
          }
        }
        for (const s of students) {
          const ms = (s.mssv || '').trim();
          const got = achieved.get(ms) || new Set<string>();
          const row = cols.map(p => {
            const target = cloSetByPLO.get(p);
            if (!target || target.size === 0) return 0;
            let hit = 0;
            for (const k of target) if (got.has(k)) hit++;
            return hit / target.size; // 0..1
          });
          mat.push(row);
        }
      } else {
        // PI
        cols = piCodes;
        const cloSetByPI = new Map<string, Set<string>>();
        for (const [cloKey, setP] of cloToPI.entries()) {
          for (const p of setP) {
            if (!cloSetByPI.has(p)) cloSetByPI.set(p, new Set());
            cloSetByPI.get(p)!.add(cloKey);
          }
        }
        for (const s of students) {
          const ms = (s.mssv || '').trim();
          const got = achieved.get(ms) || new Set<string>();
          const row = cols.map(p => {
            const target = cloSetByPI.get(p);
            if (!target || target.size === 0) return 0;
            let hit = 0;
            for (const k of target) if (got.has(k)) hit++;
            return hit / target.size; // 0..1
          });
          mat.push(row);
        }
      }

      // Nếu không có cột (không có CLO / mapping), vẽ trống
      if (cols.length === 0) {
        drawEmpty('Chưa có cột để vẽ (CLO hoặc mapping PLO/PI).');
        setLoading(false);
        return;
      }

      // Chuẩn bị input
      const heat: HeatInput = {
        rows: rowLabels,
        cols: (level === 'CLO' ? cols.map(k => k.replace('#', '·')) : cols),
        matrix: mat, // 0..1
      };

      // 6) Phân cụm nếu bật và số SV không quá lớn
      let orderIdx = [...Array(heat.rows.length).keys()];
      let clusterK = 0;
      if (autoCluster && heat.rows.length >= 6 && heat.rows.length <= 300) {
        const norm = normalizeMatrix(heat.matrix); // 0..1 per feature
        const res = autoKMeans(norm);
        orderIdx = res.order;
        clusterK = res.k;
      }

      // 7) Vẽ
      drawHeatmap(canvasRef.current, heat, { width: CANVAS_W, height: CANVAS_H, order: orderIdx });

      // 8) Ghi thông tin
      const sum = `SV: ${heat.rows.length} • Cột: ${heat.cols.length}` + (clusterK ? ` • Cụm tối ưu: k=${clusterK}` : '');
      setInfoText(sum);
      setToast({ type: 'success', text: 'Đã vẽ heatmap.' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không vẽ được heatmap' });
      drawEmpty('Lỗi khi dựng dữ liệu heatmap.');
    } finally {
      setLoading(false);
    }
  }

  /** ================== Render ================== */
  const fwLabel = useMemo(() => {
    const fw = frameworks.find(f => f.id === fwId);
    if (!fw) return '';
    const parts = [fw.nien_khoa, fw.chuyen_nganh, fw.doi_tuong].filter(Boolean);
    return parts.join(' – ');
  }, [frameworks, fwId]);

  return (
    <div className="max-w-[1100px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Heatmap — QAs</h1>
        <p className="text-sm text-slate-600">Phân tích hoàn thành CLO/PLO/PI theo khung CTĐT.</p>
      </div>

      {/* Bộ lọc */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Khung CTĐT</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={fwId}
              onChange={(e) => setFwId(e.target.value)}
            >
              {frameworks.map(f => (
                <option key={f.id} value={f.id}>
                  {(f.nien_khoa || '—') + ' · ' + (f.chuyen_nganh || '—') + ' · ' + (f.doi_tuong || '—')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm">Cấp độ</label>
            <div className="flex gap-2">
              {(['CLO','PLO','PI'] as LevelSel[]).map(l => (
                <label key={l} className="inline-flex items-center gap-2 rounded border px-2 py-1.5">
                  <input type="radio" name="lvl" checked={level===l} onChange={() => setLevel(l)} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm">Phân cụm</label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={autoCluster} onChange={(e)=>setAutoCluster(e.target.checked)} />
              <span>Tự động chọn số cụm (silhouette)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDraw}
            disabled={loading || !fwId}
            className={`px-3 py-2 rounded text-white ${loading || !fwId ? 'bg-gray-400' : 'bg-black'}`}
          >
            {loading ? 'Đang xử lý…' : 'Vẽ heatmap'}
          </button>
          {fwLabel && <span className="text-sm text-slate-600">Khung: {fwLabel}</span>}
        </div>
        {toast && <div className={`text-sm ${toast.type==='error' ? 'text-red-600' : toast.type==='success' ? 'text-green-600' : 'text-slate-600'}`}>{toast.text}</div>}
      </div>

      {/* Canvas cố định kích thước */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm text-slate-600 mb-2">Kích thước: {CANVAS_W}×{CANVAS_H}px (co nội dung bên trong để vừa khung)</div>
        <div className="overflow-auto">
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="border rounded" />
        </div>
        {infoText && <div className="mt-3 text-sm text-slate-700">{infoText}</div>}

        {/* Chú giải màu */}
        <div className="mt-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>Chú giải:</span>
            <span className="inline-block h-3 w-8" style={{background: '#f2f2f2', border:'1px solid #ddd'}} />
            <span>0%</span>
            <span className="inline-block h-3 w-8" style={{background: '#bdbdbd'}} />
            <span>50%</span>
            <span className="inline-block h-3 w-8" style={{background: '#5a5a5a'}} />
            <span>100%</span>
          </div>
          <div className="mt-1">CLO: 0/1. — PLO/PI: tỉ lệ hoàn thành (0–100%).</div>
        </div>
      </div>
    </div>
  );
}

/** ================== Helpers: draw ================== */
function drawEmpty(msg: string) {
  const el = document.querySelector<HTMLCanvasElement>('canvas');
  if (!el) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0,0,el.width, el.height);
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0,0,el.width, el.height);
  ctx.fillStyle = '#999';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(msg, 18, 30);
}

function drawHeatmap(
  canvas: HTMLCanvasElement | null,
  heat: HeatInput,
  opts: { width: number; height: number; order: number[] }
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = opts.width, H = opts.height;
  ctx.clearRect(0,0,W,H);
  // padding nhỏ để giữ khoảng trống
  const padLeft = 6, padTop = 6, padRight = 6, padBottom = 6;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const R = heat.rows.length;
  const C = heat.cols.length;
  if (R === 0 || C === 0) {
    ctx.fillStyle = '#eee'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#999'; ctx.font = '14px system-ui';
    ctx.fillText('Không có dữ liệu để vẽ.', 18, 28);
    return;
  }

  const cellW = innerW / C;
  const cellH = innerH / R;

  // nền
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,W,H);

  // vẽ từng ô (co nội dung để fit khung)
  for (let r = 0; r < R; r++) {
    const rr = opts.order?.[r] ?? r; // thứ tự sau phân cụm
    const row = heat.matrix[rr];
    for (let c = 0; c < C; c++) {
      const v = row[c]; // 0..1
      const x = padLeft + c * cellW;
      const y = padTop  + r * cellH;
      // ánh xạ v -> màu xám (0: rất nhạt, 1: rất đậm)
      const gray = Math.round(245 - 200 * v); // 245 -> 45
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  // đường viền nhẹ
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.strokeRect(padLeft - 0.5, padTop - 0.5, innerW + 1, innerH + 1);
}

/** ================== Helpers: clustering (k-means + silhouette) ================== */
// Chuẩn hoá từng cột về [0,1] để ổn định khoảng cách
function normalizeMatrix(M: number[][]): number[][] {
  const R = M.length, C = M[0]?.length ?? 0;
  if (R === 0 || C === 0) return M.slice();
  const min = new Array(C).fill(+Infinity);
  const max = new Array(C).fill(-Infinity);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const v = M[r][c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  const out: number[][] = [];
  for (let r = 0; r < R; r++) {
    const row: number[] = new Array(C);
    for (let c = 0; c < C; c++) {
      const range = (max[c] - min[c]) || 1;
      row[c] = (M[r][c] - min[c]) / range;
    }
    out.push(row);
  }
  return out;
}

// Euclid distance
function d2(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const t = a[i] - b[i];
    s += t * t;
  }
  return Math.sqrt(s);
}

function kmeans(data: number[][], k: number, iters=10) {
  const n = data.length, d = data[0]?.length ?? 0;
  if (n === 0 || d === 0) return { labels: new Array(n).fill(0), centers: [] as number[][] };

  // init: chọn k điểm đầu (đơn giản)
  const centers: number[][] = [];
  for (let i = 0; i < k; i++) centers.push([...data[Math.floor((i * n)/k)]]);

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < iters; iter++) {
    // assign
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const dist = d2(data[i], centers[c]);
        if (dist < bestD) { bestD = dist; best = c; }
      }
      labels[i] = best;
    }
    // update
    const sums: number[][] = Array.from({length:k}, () => new Array(d).fill(0));
    const cnt: number[] = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const lab = labels[i];
      cnt[lab]++;
      for (let j = 0; j < d; j++) sums[lab][j] += data[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (cnt[c] === 0) continue;
      for (let j = 0; j < d; j++) centers[c][j] = sums[c][j] / cnt[c];
    }
  }
  return { labels, centers };
}

function silhouetteScore(data: number[][], labels: number[]) {
  const n = data.length;
  if (n === 0) return 0;
  // tiền tính khoảng cách để nhanh hơn
  const D: number[][] = Array.from({length:n}, ()=> new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    const v = d2(data[i], data[j]);
    D[i][j] = v; D[j][i] = v;
  }
  let sSum = 0;
  for (let i = 0; i < n; i++) {
    const li = labels[i];
    // a(i): khoảng cách tb đến cùng cụm
    let a = 0, ac = 0;
    // b(i): nhỏ nhất trong các khoảng cách tb đến cụm khác
    let b = Number.POSITIVE_INFINITY;
    const sameIdx: number[] = [], otherByLabel: Map<number, number[]> = new Map();
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const lj = labels[j];
      if (lj === li) sameIdx.push(j);
      else {
        if (!otherByLabel.has(lj)) otherByLabel.set(lj, []);
        otherByLabel.get(lj)!.push(j);
      }
    }
    if (sameIdx.length > 0) {
      let sum = 0;
      for (const j of sameIdx) sum += D[i][j];
      a = sum / sameIdx.length;
    }
    for (const [lab, arr] of otherByLabel.entries()) {
      let sum = 0;
      for (const j of arr) sum += D[i][j];
      const avg = sum / arr.length;
      if (avg < b) b = avg;
    }
    if (!isFinite(b)) b = a; // nếu chỉ có 1 cụm
    const s = (b - a) / Math.max(a, b || 1);
    sSum += s;
  }
  return sSum / n;
}

function autoKMeans(data: number[][]) {
  const n = data.length;
  const kMin = 2, kMax = Math.min(6, Math.max(2, Math.floor(Math.sqrt(n))));
  let bestK = 0, bestS = -1, bestLabels: number[] = new Array(n).fill(0);

  for (let k = kMin; k <= kMax; k++) {
    const { labels } = kmeans(data, k, 10);
    const s = silhouetteScore(data, labels);
    if (s > bestS) { bestS = s; bestK = k; bestLabels = labels; }
  }

  // order rows theo nhãn cụm rồi theo khoảng cách tâm (đơn giản)
  const order = [...Array(n).keys()].sort((a,b) => bestLabels[a] - bestLabels[b]);
  return { k: bestK, labels: bestLabels, score: bestS, order };
}
