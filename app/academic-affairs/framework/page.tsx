// app/academic-affairs/framework/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

// ====== Types ======
type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

type UploadKind = 'plo' | 'pi' | 'courses' | 'plo_pi' | 'plo_clo' | 'pi_clo';
const KIND_META: Record<UploadKind, { title: string; helper: string }> = {
  plo:     { title: 'Tải PLO (CSV)',          helper: '2 cột (không header): code,description' },
  pi:      { title: 'Tải PI (CSV)',           helper: '2 cột (không header): code,description' },
  courses: { title: 'Tải Học phần (CSV)',     helper: '2-3 cột (không header): course_code,course_name,[credits]' },
  plo_pi:  { title: 'Liên kết PLO–PI (CSV)',  helper: '2 cột (không header): plo_code,pi_code' },
  plo_clo: { title: 'Liên kết PLO–CLO (CSV)', helper: '4 cột (không header): plo_code,course_code,clo_code,level' },
  pi_clo:  { title: 'Liên kết PI–CLO (CSV)',  helper: '4 cột (không header): pi_code,course_code,clo_code,level' },
};

type PLO = { code: string; description?: string | null };
type PI = { code: string; description?: string | null };
type Course = { course_code: string; course_name?: string | null; credits?: number | null };
type CLO = { course_code: string; clo_code: string; clo_text?: string | null };

// ====== Helper UI ======
function ChipMulti({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const all = selected.length === options.length && options.length > 0;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(all ? [] : [...options])}
          className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
        >
          {all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((x) => x !== opt) : [...selected, opt])
              }
              className={`px-2 py-1 rounded border text-xs hover:bg-gray-50 ${
                active ? 'bg-gray-900 text-white' : ''
              }`}
              title={opt}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimpleTable<T extends object>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: { key: keyof T; label: string; render?: (v: any, r: T) => ReactNode }[];
}) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium mb-2">
        {title} ({rows.length})
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              {columns.map((c) => (
                <th key={String(c.key)} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 align-top">
                    {c.render ? c.render((r as any)[c.key], r) : String((r as any)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====== Trang chính ======
export default function FrameworkPage() {
  const [loading, setLoading] = useState(false);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });

  const [pickedFiles, setPickedFiles] = useState<Partial<Record<UploadKind, File>>>({});
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  // Danh mục để filter + bảng
  const [ploList, setPloList] = useState<PLO[]>([]);
  const [piList, setPiList] = useState<PI[]>([]);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [cloList, setCloList] = useState<CLO[]>([]);

  // Bộ lọc (mặc định chọn tất cả sau khi load)
  const [selPLO, setSelPLO] = useState<string[]>([]);
  const [selPI, setSelPI] = useState<string[]>([]);
  const [selCourse, setSelCourse] = useState<string[]>([]);
  const [selCLO, setSelCLO] = useState<string[]>([]);

  // Cytoscape ref để Fit
  const cyRef = useRef<any>(null);

  // ====== Load dữ liệu khung ======
  async function loadFrameworks() {
    setLoading(true);
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(js.error || 'Lỗi tải danh sách');
      return;
    }
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.[0]?.id) setSelectedId(js.data[0].id);
  }
  useEffect(() => {
    loadFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createFramework() {
    setLoading(true);
    const res = await fetch('/api/academic-affairs/framework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const js = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(js.error || 'Tạo khung lỗi');
      return;
    }
    setForm({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });
    loadFrameworks();
  }

  async function deleteFramework() {
    if (!selectedId) return;
    setLoading(true);
    const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
    const js = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(js.error || 'Xoá lỗi');
      return;
    }
    setSelectedId('');
    loadFrameworks();
  }

  // ====== CHUẨN HOÁ graph payload + setGraph({nodes,edges})
  async function loadGraph() {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/graph?framework_id=${selectedId}`);
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Lỗi tải graph');
      return;
    }

    const raw = js.elements ?? js.data ?? js;

    let nodes: any[] = [];
    let edges: any[] = [];

    if (Array.isArray(raw)) {
      for (const el of raw) {
        if (el?.data?.source && el?.data?.target) edges.push(el);
        else nodes.push(el);
      }
    } else {
      nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
      edges = Array.isArray(raw?.edges) ? raw.edges : [];
    }

    nodes = nodes
      .filter((n) => n?.data?.id)
      .map((n) => ({ ...n, data: { ...n.data, label: n.data.label ?? n.data.id } }));
    edges = edges
      .filter((e) => e?.data?.source && e?.data?.target)
      .map((e) => ({ ...e, data: { ...e.data, kind: e.data.kind ?? '' } }));

    setGraph({ nodes, edges });
  }

  async function loadLists() {
    if (!selectedId) return;
    const q = (kind: string) =>
      fetch(`/api/academic-affairs/list?framework_id=${selectedId}&kind=${kind}`).then((r) => r.json());

    const [plo, pi, courses, clos] = await Promise.all([q('plo'), q('pi'), q('courses'), q('clos')]);

    if (plo?.data) setPloList(plo.data);
    if (pi?.data) setPiList(pi.data);
    if (courses?.data) setCourseList(courses.data);
    if (clos?.data) setCloList(clos.data);

    // chọn tất cả mặc định
    setSelPLO((plo?.data ?? []).map((x: PLO) => x.code));
    setSelPI((pi?.data ?? []).map((x: PI) => x.code));
    setSelCourse((courses?.data ?? []).map((x: Course) => x.course_code));
    setSelCLO((clos?.data ?? []).map((x: CLO) => `${x.course_code}:${x.clo_code}`));
  }

  useEffect(() => {
    if (selectedId) {
      loadGraph();
      loadLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(() => frameworks.find((f) => f.id === selectedId), [frameworks, selectedId]);

  function handlePickFile(kind: UploadKind, file: File | null) {
    setPickedFiles((s) => ({ ...s, [kind]: file || undefined }));
  }

  async function doUpload(kind: UploadKind) {
    const file = pickedFiles[kind];
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/upload', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Upload lỗi');
      return;
    }
    await Promise.all([loadGraph(), loadLists()]);
  }

  // ====== Lọc graph theo bộ lọc ======
  function nodeTypeAndKey(id: string) {
    if (!id) return { type: 'other', key: '' };
    if (id.startsWith('PLO:')) return { type: 'plo', key: id.slice(4) };
    if (id.startsWith('PI:')) return { type: 'pi', key: id.slice(3) };
    if (id.startsWith('COURSE:')) return { type: 'course', key: id.slice('COURSE:'.length) };
    if (id.startsWith('CLO:')) return { type: 'clo', key: id.slice(4) }; // format: course_code:clo_code
    return { type: 'other', key: id };
  }

  const filteredElements = useMemo(() => {
    if (!graph) return [];

    const noFilters =
      selPLO.length === 0 && selPI.length === 0 && selCourse.length === 0 && selCLO.length === 0;

    const sP = new Set(selPLO);
    const sI = new Set(selPI);
    const sC = new Set(selCourse);
    const sCL = new Set(selCLO);

    const nodes = (graph.nodes || [])
      .map((n: any) => {
        const id = n?.data?.id ?? '';
        const { type, key } = nodeTypeAndKey(id);
        const include = noFilters
          ? true
          : type === 'plo'
          ? sP.has(key)
          : type === 'pi'
          ? sI.has(key)
          : type === 'course'
          ? sC.has(key)
          : type === 'clo'
          ? sCL.has(key)
          : true;

        return include ? { ...n, classes: (n.classes ? n.classes + ' ' : '') + `type-${type}` } : null;
      })
      .filter(Boolean);

    const nodeIds = new Set(nodes.map((n: any) => n.data.id));
    const edges = (graph.edges || []).filter(
      (e: any) => nodeIds.has(e.data.source) && nodeIds.has(e.data.target)
    );

    return [...nodes, ...edges];
  }, [graph, selPLO, selPI, selCourse, selCLO]);

  const nodeCount = useMemo(
    () => filteredElements.filter((e: any) => e.data && !('source' in e.data)).length,
    [filteredElements]
  );
  const edgeCount = useMemo(
    () => filteredElements.filter((e: any) => e.data && 'source' in e.data).length,
    [filteredElements]
  );

  // ====== Actions cho ma trận ======
  async function handleRefreshMatrix() {
    await Promise.all([loadGraph(), loadLists()]);
  }
  function handleFit() {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.elements().removeClass('faded');
    cy.fit(undefined, 30);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Khung CTĐT & Ma trận</h1>

      {/* Khối nhập thông tin + chọn khung */}
      <section className="bg-white rounded-xl border p-4 space-y-4">
        <div className="grid md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-sm font-semibold mb-1">Đối tượng</label>
            <input
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
              placeholder="Ví dụ: Đại học / Sau đại học"
              value={form.doi_tuong}
              onChange={(e) => setForm({ ...form, doi_tuong: e.target.value })}
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-semibold mb-1">Chuyên ngành</label>
            <input
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
              placeholder="Ví dụ: YHCT / Dược cổ truyền"
              value={form.chuyen_nganh}
              onChange={(e) => setForm({ ...form, chuyen_nganh: e.target.value })}
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-semibold mb-1">Niên khoá</label>
            <input
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
              placeholder="Ví dụ: 2025-2031"
              value={form.nien_khoa}
              onChange={(e) => setForm({ ...form, nien_khoa: e.target.value })}
            />
          </div>

          <div className="md:col-span-8">
            <label className="block text-sm font-semibold mb-1">Chọn khung</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">-- Chọn --</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doi_tuong} · {f.chuyen_nganh} · {f.nien_khoa}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-slate-600 mt-1">
                Tạo lúc: {new Date(selected.created_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="md:col-span-4 flex gap-2 justify-end">
            <button
              onClick={createFramework}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
              disabled={loading}
            >
              Tạo khung
            </button>
            <button
              onClick={deleteFramework}
              disabled={!selectedId || loading}
              className={
                !selectedId || loading
                  ? 'px-4 py-2 rounded-lg border text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg border border-red-600 text-red-600 hover:bg-red-50'
              }
            >
              Xoá khung
            </button>
            {/* ĐÃ DỜI nút Làm mới xuống phần Ma trận kết nối */}
          </div>
        </div>
      </section>

      {/* Upload CSV: 3 cột mỗi hàng trên lg */}
      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Tải dữ liệu (CSV)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(KIND_META) as UploadKind[]).map((kind) => {
            const chosen = pickedFiles[kind];
            const meta = KIND_META[kind];
            return (
              <div key={kind} className="border rounded-lg p-3 space-y-2">
                <div className="font-medium text-sm">{meta.title}</div>
                <div className="text-xs text-slate-600">{meta.helper}</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="block w-full"
                    onChange={(e) => handlePickFile(kind, e.target.files?.[0] || null)}
                    disabled={!selectedId}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => doUpload(kind)}
                    disabled={!selectedId || !chosen}
                    className={
                      !selectedId || !chosen
                        ? 'px-3 py-1.5 rounded bg-gray-300 text-white text-sm cursor-not-allowed'
                        : 'px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700'
                    }
                  >
                    Tải lên
                  </button>
                  {chosen && (
                    <span className="text-xs text-slate-500 truncate" title={chosen.name}>
                      {chosen.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bộ lọc & Danh mục — hiển thị THEO THỨ TỰ TRÊN DƯỚI */}
      <section className="bg-white rounded-xl border p-4 space-y-4">
        <h2 className="font-semibold">Bộ lọc & Danh mục</h2>

        {/* PLO */}
        <div className="space-y-3">
          <ChipMulti label="PLO" options={ploList.map((x) => x.code)} selected={selPLO} onChange={setSelPLO} />
          <SimpleTable<PLO>
            title="Danh sách PLO"
            rows={ploList.filter((x) => !selPLO.length || selPLO.includes(x.code))}
            columns={[
              { key: 'code', label: 'Mã' },
              { key: 'description', label: 'Mô tả' },
            ]}
          />
        </div>

        {/* PI */}
        <div className="space-y-3">
          <ChipMulti label="PI" options={piList.map((x) => x.code)} selected={selPI} onChange={setSelPI} />
          <SimpleTable<PI>
            title="Danh sách PI"
            rows={piList.filter((x) => !selPI.length || selPI.includes(x.code))}
            columns={[
              { key: 'code', label: 'Mã' },
              { key: 'description', label: 'Mô tả' },
            ]}
          />
        </div>

        {/* Học phần */}
        <div className="space-y-3">
          <ChipMulti
            label="Học phần"
            options={courseList.map((x) => x.course_code)}
            selected={selCourse}
            onChange={setSelCourse}
          />
          <SimpleTable<Course>
            title="Danh sách Học phần"
            rows={courseList.filter((x) => !selCourse.length || selCourse.includes(x.course_code))}
            columns={[
              { key: 'course_code', label: 'Mã' },
              { key: 'course_name', label: 'Tên' },
              { key: 'credits', label: 'TC' },
            ]}
          />
        </div>

        {/* CLO */}
        <div className="space-y-3">
          <ChipMulti
            label="CLO"
            options={cloList.map((x) => `${x.course_code}:${x.clo_code}`)}
            selected={selCLO}
            onChange={setSelCLO}
          />
          <SimpleTable<CLO>
            title="Danh sách CLO"
            rows={cloList.filter((x) => !selCLO.length || selCLO.includes(`${x.course_code}:${x.clo_code}`))}
            columns={[
              { key: 'course_code', label: 'Học phần' },
              { key: 'clo_code', label: 'CLO' },
              { key: 'clo_text', label: 'Mô tả' },
            ]}
          />
        </div>
      </section>

      {/* Ma trận Cytoscape */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Ma trận kết nối</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Nodes: {nodeCount} · Edges: {edgeCount}</span>
            <button
              onClick={handleRefreshMatrix}
              disabled={!selectedId}
              className={
                !selectedId
                  ? 'px-3 py-1.5 rounded bg-gray-300 text-white cursor-not-allowed'
                  : 'px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700'
              }
              title="Tải lại dữ liệu ma trận & danh mục"
            >
              Làm mới
            </button>
            <button
              onClick={handleFit}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              title="Fit graph vào khung và canh giữa"
            >
              Fit
            </button>
          </div>
        </div>

        <div className="mt-3 h-[520px] border rounded overflow-hidden">
          {graph ? (
            // @ts-ignore
            <CytoscapeComponent
              key={selectedId + ':' + filteredElements.length}
              elements={filteredElements}
              style={{ width: '100%', height: '100%' }}
              layout={{ name: 'cose', nodeRepulsion: 5000, idealEdgeLength: 120, animate: true }}
              stylesheet={[
                {
                  selector: 'node',
                  style: {
                    label: 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': 12,
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 0.95,
                    'text-background-padding': 4,
                    'border-width': 2,
                    'border-color': '#111827',
                    shape: 'round-rectangle',
                  },
                },
                { selector: 'node.type-plo',    style: { 'background-color': '#1b9e77', shape: 'round-rectangle' } },
                { selector: 'node.type-pi',     style: { 'background-color': '#d95f02', shape: 'ellipse' } },
                { selector: 'node.type-course', style: { 'background-color': '#7570b3', shape: 'hexagon' } },
                { selector: 'node.type-clo',    style: { 'background-color': '#e7298a', shape: 'diamond' } },
                {
                  selector: 'edge',
                  style: {
                    'curve-style': 'bezier',
                    width: 2,
                    'line-color': '#9ca3af',
                    'target-arrow-color': '#9ca3af',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 1,
                    label: 'data(kind)',
                    'font-size': 8,
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 0.9,
                    'text-background-padding': 2,
                    color: '#334155',
                  },
                },
                {
                  selector: ':selected',
                  style: {
                    'border-color': '#10b981',
                    'border-width': 4,
                    'line-color': '#10b981',
                    'target-arrow-color': '#10b981',
                  },
                },
                { selector: '.faded', style: { opacity: 0.15 } },
              ]}
              cy={(cy: any) => {
                cyRef.current = cy;
                cy.fit(undefined, 30);
                cy.on('tap', 'node', (evt: any) => {
                  const n = evt.target;
                  cy.elements().removeClass('faded');
                  const neighborhood = n.closedNeighborhood();
                  cy.elements().difference(neighborhood).addClass('faded');
                });
                cy.on('tap', (evt: any) => {
                  if (evt.target === cy) cy.elements().removeClass('faded');
                });
              }}
            />
          ) : (
            <div className="h-full grid place-items-center text-sm text-gray-500">
              Chọn khung để xem ma trận
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
