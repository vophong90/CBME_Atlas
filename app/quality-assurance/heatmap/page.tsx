'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

/** ================== Types ================== */
type Framework = { id: string; nien_khoa?: string | null; chuyen_nganh?: string | null; doi_tuong?: string | null };
type Student   = { id: string; mssv: string | null; full_name: string | null; framework_id?: string | null };
type CLODef    = { id: string; course_code: string; clo_code: string };
type LevelSel  = 'CLO' | 'PLO' | 'PI';

type HeatInput = {
  rows: string[];     // nhãn dòng (SV)
  cols: string[];     // nhãn cột (CLO key hoặc PLO/PI code)
  matrix: number[][]; // [rows x cols] giá trị [0,1]
};

/** ================== Page ================== */
export default function HeatmapPage() {
  const supabase = getSupabase();

  // UI state
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [fwId, setFwId]             = useState<string>('');
  const [level, setLevel]           = useState<LevelSel>('CLO');
  const [autoCluster, setAutoCluster] = useState(true);
  const [showAxes, setShowAxes]     = useState(false); // ép hiện nhãn trục
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState<{type:'success'|'error'|'info'; text:string} | null>(null);

  // Data for drawing
  const [infoText, setInfoText]     = useState<string>('');
  const canvasRef                   = useRef<HTMLCanvasElement | null>(null);

  // Viewport (zoom/pan)
  const [zoom, setZoom]             = useState(1);     // 0.5–4
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const isPanningRef                = useRef(false);
  const panStartRef                 = useRef<{x:number; y:number} | null>(null);

  // Store current heat to redraw on zoom/pan
  const heatRef                     = useRef<HeatInput | null>(null);
  const orderRef                    = useRef<number[]>([]);

  // Canvas size cố định (bạn có thể đổi nếu muốn)
  const CANVAS_W = 980;
  const CANVAS_H = 560;

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
    // reset view khi vẽ mới
    setZoom(1);
    setOffset({x:0,y:0});

    try {
      // 1) Lấy sinh viên theo framework
      const stRes = await supabase
        .from('students')
        .select('id,mssv,full_name,framework_id')
        .eq('framework_id', fwId);
      if (stRes.error && stRes.error.code !== '42P01') throw stRes.error;
      const students = (stRes.data ?? []) as Student[];
      if (!students.length) {
        drawEmpty(canvasRef.current, 'Chưa có sinh viên trong khung này.');
        setLoading(false);
        return;
      }
      // Nhãn SV
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
        if (String(r.status || '').toLowerCase() === 'achieved') achieved.get(ms)!.add(key); // 1/0 mapping
      }

      // 4) Mapping PLO/PI nếu cần
      // PLO
      const cloToPLO = new Map<string, Set<string>>();
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

      // PI
      const cloToPI = new Map<string, Set<string>>();
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

      // 5) Build matrix
      let cols: string[] = [];
      const mat: number[][] = [];
      const msByIndex = students.map(s => (s.mssv || '').trim());

      if (level === 'CLO') {
        const cloKeys = CLOs.length ? cloKeysFromStruct : Array.from(allCLOsFromUpload);
        cols = [...new Set(cloKeys)].sort();
        for (const s of students) {
          const ms = (s.mssv || '').trim();
          const got = achieved.get(ms) || new Set<string>();
          mat.push(cols.map(k => (got.has(k) ? 1 : 0)));
        }
      } else if (level === 'PLO') {
        cols = ploCodes;
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
            return hit / target.size;
          });
          mat.push(row);
        }
      } else {
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
            return hit / target.size;
          });
          mat.push(row);
        }
      }

      if (cols.length === 0) {
        drawEmpty(canvasRef.current, 'Chưa có cột để vẽ (CLO hoặc mapping PLO/PI).');
        setLoading(false);
        return;
      }

      // Chuẩn bị input
      const heat: HeatInput = {
        rows: rowLabels,
        cols: (level === 'CLO' ? cols.map(k => k.replace('#', '·')) : cols),
        matrix: mat,
      };

      // 6) Phân cụm (Gower) nếu bật
      let orderIdx = [...Array(heat.rows.length).keys()];
      let clusterK = 0;
      if (autoCluster && heat.rows.length >= 6 && heat.rows.length <= 300) {
        const norm = normalizeMatrix(heat.matrix); // scale từng cột về [0,1]
        const res = autoKMeansGower(norm);
        orderIdx = res.order;
        clusterK = res.k;
      }

      // Lưu & vẽ ban đầu
      heatRef.current = heat;
      orderRef.current = orderIdx;
      drawHeatmap(canvasRef.current, heat, {
        width: CANVAS_W,
        height: CANVAS_H,
        order: orderIdx,
        zoom,
        offset,
        showRows: showAxes || zoom >= 1.2,
        showCols: showAxes || zoom >= 1.6,
      });

      const sum = `SV: ${heat.rows.length} • Cột: ${heat.cols.length}` + (clusterK ? ` • Cụm tối ưu: k=${clusterK}` : '');
      setInfoText(sum);
      setToast({ type: 'success', text: 'Đã vẽ heatmap.' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không vẽ được heatmap' });
      drawEmpty(canvasRef.current, 'Lỗi khi dựng dữ liệu heatmap.');
    } finally {
      setLoading(false);
    }
  }

  /** ----- Redraw on zoom/pan/axes toggle ----- */
  useEffect(() => {
    if (!heatRef.current) return;
    drawHeatmap(canvasRef.current, heatRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      order: orderRef.current,
      zoom,
      offset,
      showRows: showAxes || zoom >= 1.2,
      showCols: showAxes || zoom >= 1.6,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offset, showAxes]);

  /** ----- Mouse pan (kéo để dịch) ----- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent) => {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    };
    const onUp = () => { isPanningRef.current = false; panStartRef.current = null; };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /** ================== Render ================== */
  const fwLabel = useMemo(() => {
    const fw = frameworks.find(f => f.id === fwId);
    if (!fw) return '';
    const parts = [fw.nien_khoa, fw.chuyen_nganh, fw.doi_tuong].filter(Boolean);
    return parts.join(' – ');
  }, [frameworks, fwId]);

  const gradientCSS = 'linear-gradient(90deg, #440154, #3B528B, #21918C, #5DC863, #FDE725)';

  return (
    <div className="max-w-[1100px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Heatmap — QAs</h1>
        <p className="text-sm text-slate-600">Phân tích hoàn thành CLO/PLO/PI theo khung CTĐT (màu viridis kiểu ggplot, zoom/pan).</p>
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
              <span>Tự động chọn số cụm (silhouette, Gower)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDraw}
            disabled={loading || !fwId}
            className={`px-3 py-2 rounded text-white ${loading || !fwId ? 'bg-gray-400' : 'bg-black'}`}
          >
            {loading ? 'Đang xử lý…' : 'Vẽ heatmap'}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Zoom:</span>
            <button
              onClick={()=>setZoom(z=>Math.max(0.5, +(z-0.1).toFixed(2)))}
              className="px-2 py-1 rounded border"
            >−</button>
            <input
              type="range" min={0.5} max={4} step={0.1}
              value={zoom}
              onChange={(e)=>setZoom(parseFloat(e.target.value))}
              className="w-40"
            />
            <button
              onClick={()=>setZoom(z=>Math.min(4, +(z+0.1).toFixed(2)))}
              className="px-2 py-1 rounded border"
            >+</button>
            <button
              onClick={()=>{ setZoom(1); setOffset({x:0,y:0}); }}
              className="px-2 py-1 rounded border"
            >Reset</button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showAxes} onChange={(e)=>setShowAxes(e.target.checked)} />
            Hiện nhãn trục (MSSV & CLO/PLO/PI)
          </label>

          {fwLabel && <span className="text-sm text-slate-600">Khung: {fwLabel}</span>}
        </div>

        {toast && <div className={`text-sm ${toast.type==='error' ? 'text-red-600' : toast.type==='success' ? 'text-green-600' : 'text-slate-600'}`}>{toast.text}</div>}
      </div>

      {/* Canvas cố định kích thước */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm text-slate-600 mb-2">
          Kích thước: {CANVAS_W}×{CANVAS_H}px — kéo chuột để pan, thanh trượt để zoom.
        </div>
        <div className="overflow-auto">
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="border rounded" />
        </div>

        {infoText && <div className="mt-3 text-sm text-slate-700">{infoText}</div>}

        {/* Chú giải màu (viridis) */}
        <div className="mt-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>Chú giải:</span>
            <div className="h-3 w-40 rounded" style={{ background: gradientCSS, border: '1px solid #ddd' }} />
            <span>0%</span>
            <span className="ml-auto">100%</span>
          </div>
          <div className="mt-1">CLO: 0/1 · PLO/PI: tỉ lệ hoàn thành (0–100%).</div>
        </div>
      </div>
    </div>
  );
}

/** ================== Helpers: Color (viridis-like) ================== */
function hexToRgb(h: string){ const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)!; return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] as [number,number,number]; }
function lerp(a:number,b:number,t:number){ return a + (b-a)*t; }
function lerpRgb(a:[number,number,number], b:[number,number,number], t:number){
  return [Math.round(lerp(a[0],b[0],t)), Math.round(lerp(a[1],b[1],t)), Math.round(lerp(a[2],b[2],t))] as [number,number,number];
}
// 5 điểm mốc viridis (gần giống ggplot/viridis)
const VIRIDIS_STOPS = [
  { p: 0.00, c: hexToRgb('#440154') },
  { p: 0.25, c: hexToRgb('#3B528B') },
  { p: 0.50, c: hexToRgb('#21918C') },
  { p: 0.75, c: hexToRgb('#5DC863') },
  { p: 1.00, c: hexToRgb('#FDE725') },
];
function viridisColor(v:number){
  const x = Math.max(0, Math.min(1, v));
  let i = 0;
  while (i < VIRIDIS_STOPS.length-1 && x > VIRIDIS_STOPS[i+1].p) i++;
  const a = VIRIDIS_STOPS[i], b = VIRIDIS_STOPS[Math.min(i+1, VIRIDIS_STOPS.length-1)];
  const t = (x - a.p) / Math.max(1e-6, (b.p - a.p));
  const [r,g,b2] = lerpRgb(a.c, b.c, t);
  return `rgb(${r},${g},${b2})`;
}

/** ================== Helpers: draw ================== */
function drawEmpty(canvas: HTMLCanvasElement | null, msg: string) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const { width: W, height: H } = canvas;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#999';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(msg, 18, 30);
}

function drawHeatmap(
  canvas: HTMLCanvasElement | null,
  heat: HeatInput,
  opts: {
    width: number; height: number;
    order: number[];
    zoom: number;
    offset: {x:number;y:number};
    showRows: boolean;
    showCols: boolean;
  }
){
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const W = opts.width, H = opts.height;

  // Padding + vùng nhãn trục
  const pad = { l: 8, t: 8, r: 6, b: 6 };
  const baseFont = '11px system-ui, sans-serif';

  // Ước lượng độ rộng/h cao nhất cho nhãn (font cố định để dễ nhìn)
  ctx.font = baseFont;
  let leftAxisW = 0, topAxisH = 0;

  if (opts.showRows) {
    let maxW = 0;
    for (const s of heat.rows) {
      const w = ctx.measureText(s).width;
      if (w > maxW) maxW = w;
    }
    leftAxisW = Math.min(240, Math.ceil(maxW) + 8);
  }
  if (opts.showCols) {
    // giả sử vẽ xoay -60° cần cao ~ chiều dài text * sin(60)
    let maxW = 0;
    for (const s of heat.cols) {
      const w = ctx.measureText(s).width;
      if (w > maxW) maxW = w;
    }
    topAxisH = Math.min(120, Math.ceil(maxW * 0.7) + 8);
  }

  const innerX = pad.l + leftAxisW;
  const innerY = pad.t + topAxisH;
  const innerW = W - innerX - pad.r;
  const innerH = H - innerY - pad.b;

  const R = heat.rows.length, C = heat.cols.length;
  if (R === 0 || C === 0) {
    drawEmpty(canvas, 'Không có dữ liệu để vẽ.');
    return;
  }

  // Kích thước ô (co theo zoom)
  const cellW = (innerW / C) * opts.zoom;
  const cellH = (innerH / R) * opts.zoom;

  // Nền
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,W,H);

  // Vẽ nhãn trục trước (để dưới lưới)
  ctx.save();
  ctx.font = baseFont;
  ctx.fillStyle = '#475569';

  if (opts.showRows) {
    // Nhãn dòng tại vùng [pad.l, innerY .. innerY+innerH]
    // Vẽ đều theo thứ tự hiển thị (sau sắp xếp)
    for (let r = 0; r < R; r++) {
      const rr = opts.order?.[r] ?? r;
      const y = innerY + r * (innerH / R) + (innerH / R) * 0.5;
      const label = heat.rows[rr];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pad.l + leftAxisW - 6, y + opts.offset.y);
    }
  }

  if (opts.showCols) {
    // Nhãn cột ở trên, xoay -60°
    ctx.translate(innerX + opts.offset.x, innerY + opts.offset.y);
    for (let c = 0; c < C; c++) {
      const x = c * (innerW / C) + (innerW / C) * 0.5;
      ctx.save();
      ctx.translate(x, -6);
      ctx.rotate(-Math.PI / 3); // -60 độ
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(heat.cols[c], 0, 0);
      ctx.restore();
    }
    ctx.setTransform(1,0,0,1,0,0); // reset transform
  }
  ctx.restore();

  // Vẽ heatmap (clip trong inner rect) + pan/zoom
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  // Biến đổi theo pan/zoom
  ctx.translate(innerX + opts.offset.x, innerY + opts.offset.y);
  // Vẽ ô theo thứ tự hàng đã sắp xếp (order)
  for (let r = 0; r < R; r++) {
    const rr = opts.order?.[r] ?? r;
    const row = heat.matrix[rr];
    for (let c = 0; c < C; c++) {
      const v = row[c]; // 0..1
      const x = c * cellW;
      const y = r * cellH;
      ctx.fillStyle = viridisColor(v);
      ctx.fillRect(x, y, Math.ceil(cellW)+0.5, Math.ceil(cellH)+0.5);
    }
  }
  // Khung
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, C*cellW, R*cellH);

  ctx.restore();

  // Viền ngoài
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(innerX - 0.5, innerY - 0.5, innerW + 1, innerH + 1);
}

/** ================== Helpers: clustering (Gower + silhouette) ================== */
// Chuẩn hoá từng cột về [0,1]
function normalizeMatrix(M: number[][]): number[][] {
  const R = M.length, C = M[0]?.length ?? 0;
  if (R === 0 || C === 0) return M.slice();
  const min = new Array(C).fill(+Infinity);
  const max = new Array(C).fill(-Infinity);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const v = M[r][c]; if (v < min[c]) min[c] = v; if (v > max[c]) max[c] = v;
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

// Gower cho dữ liệu số đã chuẩn hoá: khoảng cách = mean(|a-b|)
function d_gower(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / (a.length || 1);
}

function kmeans_gower(data: number[][], k: number, iters=10) {
  const n = data.length, d = data[0]?.length ?? 0;
  if (n === 0 || d === 0) return { labels: new Array(n).fill(0), centers: [] as number[][] };

  // init: chọn k điểm cách đều theo index
  const centers: number[][] = [];
  for (let i = 0; i < k; i++) centers.push([...data[Math.floor((i * n)/k)]]);

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < iters; iter++) {
    // assign
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const dist = d_gower(data[i], centers[c]);
        if (dist < bestD) { bestD = dist; best = c; }
      }
      labels[i] = best;
    }
    // update (median-like bằng mean ở đây)
    const sums: number[][] = Array.from({length:k}, () => new Array(d).fill(0));
    const cnt: number[] = new Array(k).fill(0);
    for (let i = 0; i < n; i++) { const lab = labels[i]; cnt[lab]++; for (let j = 0; j < d; j++) sums[lab][j] += data[i][j]; }
    for (let c = 0; c < k; c++) {
      if (cnt[c] === 0) continue;
      for (let j = 0; j < d; j++) centers[c][j] = sums[c][j] / cnt[c];
    }
  }
  return { labels, centers };
}

function silhouetteScoreGower(data: number[][], labels: number[]) {
  const n = data.length; if (n === 0) return 0;
  const D: number[][] = Array.from({length:n}, ()=> new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    const v = d_gower(data[i], data[j]);
    D[i][j] = v; D[j][i] = v;
  }
  let sSum = 0;
  for (let i = 0; i < n; i++) {
    const li = labels[i];
    const same: number[] = [], others: Map<number, number[]> = new Map();
    for (let j = 0; j < n; j++) if (i !== j) {
      const lj = labels[j];
      if (lj === li) same.push(j);
      else {
        if (!others.has(lj)) others.set(lj, []);
        others.get(lj)!.push(j);
      }
    }
    let a = 0; if (same.length) a = same.reduce((s,j)=>s+D[i][j],0) / same.length;
    let b = Number.POSITIVE_INFINITY;
    for (const arr of others.values()) {
      const avg = arr.reduce((s,j)=>s+D[i][j],0) / arr.length;
      if (avg < b) b = avg;
    }
    if (!isFinite(b)) b = a; // nếu chỉ 1 cụm
    const s = (b - a) / Math.max(a, b || 1);
    sSum += s;
  }
  return sSum / n;
}

function autoKMeansGower(data: number[][]) {
  const n = data.length;
  const kMin = 2, kMax = Math.min(6, Math.max(2, Math.floor(Math.sqrt(n))));
  let bestK = 0, bestS = -1, bestLabels: number[] = new Array(n).fill(0);

  for (let k = kMin; k <= kMax; k++) {
    const { labels } = kmeans_gower(data, k, 12);
    const s = silhouetteScoreGower(data, labels);
    if (s > bestS) { bestS = s; bestK = k; bestLabels = labels; }
  }

  const order = [...Array(n).keys()].sort((a,b) => bestLabels[a] - bestLabels[b]);
  return { k: bestK, labels: bestLabels, score: bestS, order };
}
