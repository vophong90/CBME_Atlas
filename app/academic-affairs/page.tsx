// app/academic-affairs/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

// Cytoscape (render client-only)
const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

type Row = string[];

type UploadKind = 'plo' | 'pi' | 'plo_pi' | 'plo_clo' | 'pi_clo';

const KIND_META: Record<
  UploadKind,
  { title: string; helper: string; columns: string[] }
> = {
  plo: {
    title: 'Tải PLO (CSV)',
    helper: '2 cột: Mã PLO, Nội dung PLO',
    columns: ['Mã PLO', 'Nội dung PLO'],
  },
  pi: {
    title: 'Tải PI (CSV)',
    helper: '2 cột: Mã PI, Nội dung PI',
    columns: ['Mã PI', 'Nội dung PI'],
  },
  plo_pi: {
    title: 'Liên kết PLO–PI (CSV)',
    helper: '2 cột: Mã PLO, Mã PI',
    columns: ['Mã PLO', 'Mã PI'],
  },
  plo_clo: {
    title: 'Liên kết PLO–CLO (CSV)',
    helper: '4 cột: Mã PLO, Mã học phần, Mã CLO, Mức độ liên kết PLO-PLO',
    columns: ['Mã PLO', 'Mã học phần', 'Mã CLO', 'Mức độ'],
  },
  pi_clo: {
    title: 'Liên kết PI–CLO (CSV)',
    helper: '4 cột: Mã PI, Mã học phần, Mã CLO, Mức độ liên kết PI-CLO',
    columns: ['Mã PI', 'Mã học phần', 'Mã CLO', 'Mức độ'],
  },
};

function parseCsvLocal(text: string): Row[] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(',').map((c) => c.trim()));
}

export default function AcademicAffairsPage() {
  const [loading, setLoading] = useState(false);

  // Frameworks
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });

  // Upload preview/files
  const [pickPreview, setPickPreview] = useState<{ kind: UploadKind; rows: Row[] } | null>(null);
  const [pickedFiles, setPickedFiles] = useState<Partial<Record<UploadKind, File>>>({});

  // View existing data
  const [viewData, setViewData] = useState<{ kind: UploadKind; rows: any[]; count: number } | null>(null);

  // Students CSV preview (separate)
  const [studentPreview, setStudentPreview] = useState<Row[] | null>(null);
  const [graph, setGraph] = useState<any | null>(null);

  async function fetchFrameworks() {
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.length) setSelectedId(js.data[0].id);
  }

  useEffect(() => {
    fetchFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createFramework() {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/framework', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tạo khung');
      setForm({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });
      await fetchFrameworks();
    } catch (e: any) {
      alert(e?.message || 'Lỗi tạo khung');
    } finally {
      setLoading(false);
    }
  }

  async function deleteFramework() {
    if (!selectedId) return;
    if (!confirm('Xoá khung này? Toàn bộ PLO/PI/Liên kết/Sinh viên liên quan cũng sẽ bị xoá.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi xoá khung');
      setSelectedId('');
      await fetchFrameworks();
      setGraph(null);
      setViewData(null);
    } catch (e: any) {
      alert(e?.message || 'Lỗi xoá khung');
    } finally {
      setLoading(false);
    }
  }

  // Pick CSV (preview-only)
  async function handlePickFile(kind: UploadKind, file: File | null) {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvLocal(text);
    setPickedFiles((p) => ({ ...p, [kind]: file }));
    setPickPreview({ kind, rows: rows.slice(0, 20) });
  }

  // Upload picked file
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
    } else {
      alert('Tải lên thành công!');
      // Refresh graph if mapping uploaded
      if (kind === 'plo_pi' || kind === 'plo_clo' || kind === 'pi_clo') {
        await loadGraph();
      }
    }
  }

  // List existing
  async function fetchExisting(kind: UploadKind) {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/list?framework_id=${selectedId}&kind=${kind}`);
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Lỗi tải dữ liệu');
      return;
    }
    setViewData({ kind, rows: js.data || [], count: js.count || 0 });
  }

  // Create one student
  async function createStudentOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      framework_id: selectedId,
      mssv: String(fd.get('mssv') || ''),
      full_name: String(fd.get('full_name') || ''),
      dob: String(fd.get('dob') || ''), // YYYY-MM-DD
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || 'Password123!'),
    };
    const res = await fetch('/api/academic-affairs/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const js = await res.json();
    if (!res.ok) alert(js.error || 'Lỗi tạo tài khoản');
    else alert('Đã tạo tài khoản sinh viên!');
    (e.target as HTMLFormElement).reset();
  }

  // Student CSV pick preview
  async function handlePickStudentCsv(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvLocal(text);
    setStudentPreview(rows.slice(0, 20));
  }

  // Student CSV upload
  async function uploadStudentsCSV(file: File | null) {
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/students', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Upload lỗi');
      return;
    }
    alert('Kết quả tạo tài khoản: ' + JSON.stringify(js.results, null, 2));
  }

  // Graph
  async function loadGraph() {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/graph?framework_id=${selectedId}`);
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Lỗi tải graph');
      return;
    }
    setGraph(js.elements);
  }
  useEffect(() => {
    if (selectedId) loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(() => frameworks.find((f) => f.id === selectedId), [frameworks, selectedId]);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
      <h1 className="text-2xl font-bold">Quản lý đào tạo</h1>

      {/* Khung hiện hành */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1">Khung chương trình hiện hành</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Chưa chọn —</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doi_tuong} • {f.chuyen_nganh} • {f.nien_khoa}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-gray-600 mt-1">
                Tạo lúc: {new Date(selected.created_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={deleteFramework}
              disabled={!selectedId || loading}
              className={
                !selectedId || loading
                  ? 'px-4 py-2 rounded-lg border text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
              }
            >
              Xoá khung
            </button>
          </div>
        </div>
      </section>

      {/* 1) Tạo Khung CTĐT */}
      <section className="rounded-xl border bg-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold">1) Tạo Khung chương trình đào tạo</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Đối tượng</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: Đại học / Sau đại học"
              value={form.doi_tuong}
              onChange={(e) => setForm({ ...form, doi_tuong: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Chuyên ngành</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: Bác sĩ Y học cổ truyền"
              value={form.chuyen_nganh}
              onChange={(e) => setForm({ ...form, chuyen_nganh: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Niên khoá</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: 2025-2031"
              value={form.nien_khoa}
              onChange={(e) => setForm({ ...form, nien_khoa: e.target.value })}
            />
          </div>
        </div>

        <div>
          <button
            onClick={createFramework}
            disabled={loading || !form.doi_tuong || !form.chuyen_nganh || !form.nien_khoa}
            className={
              loading || !form.doi_tuong || !form.chuyen_nganh || !form.nien_khoa
                ? 'px-4 py-2 rounded-lg font-semibold bg-gray-300 text-white cursor-not-allowed'
                : 'px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700'
            }
          >
            Tạo khung
          </button>
        </div>

        {/* Uploads */}
        <div className="grid lg:grid-cols-3 gap-6 pt-2">
          {(Object.keys(KIND_META) as UploadKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const chosen = pickedFiles[kind];
            const isPreview = pickPreview?.kind === kind;
            return (
              <div key={kind} className="rounded-lg border p-4">
                <h3 className="font-semibold">{meta.title}</h3>
                <p className="text-xs text-gray-600">{meta.helper}</p>

                {/* Pick file */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="block w-full"
                    onChange={(e) => handlePickFile(kind, e.target.files?.[0] || null)}
                    disabled={!selectedId}
                  />
                </div>

                {/* Preview rows */}
                {isPreview && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">Xem trước (tối đa 20 dòng):</div>
                    <div className="overflow-auto border rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {meta.columns.map((c) => (
                              <th key={c} className="px-2 py-1 text-left border-b">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pickPreview?.rows.map((r, i) => (
                            <tr key={i} className="odd:bg-gray-50">
                              {r.map((c, j) => (
                                <td key={j} className="px-2 py-1 border-b">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex gap-2">
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

                      <button
                        onClick={() => fetchExisting(kind)}
                        className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
                        disabled={!selectedId}
                      >
                        Xem dữ liệu đã có
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2) Tạo tài khoản sinh viên */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <h2 className="text-lg font-semibold">2) Tạo tài khoản sinh viên</h2>

        <div className="grid lg:grid-cols-2 gap-6 mt-4">
          {/* Đơn lẻ */}
          <form onSubmit={createStudentOne} className="rounded-lg border p-4">
            <h3 className="font-semibold">Tạo đơn lẻ</h3>
            <p className="text-xs text-gray-600 mb-3">Gắn với khung đang chọn</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">MSSV</label>
                <input name="mssv" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Họ tên</label>
                <input name="full_name" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ngày sinh (YYYY-MM-DD)</label>
                <input name="dob" className="w-full border rounded-lg px-3 py-2" placeholder="2003-08-15" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input name="email" type="email" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Mật khẩu mặc định</label>
                <input name="password" className="w-full border rounded-lg px-3 py-2" placeholder="Password123!" />
              </div>
            </div>
            <button
              disabled={!selectedId}
              className={
                !selectedId
                  ? 'mt-3 px-4 py-2 rounded-lg font-semibold bg-gray-300 text-white cursor-not-allowed'
                  : 'mt-3 px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700'
              }
            >
              Tạo tài khoản
            </button>
          </form>

          {/* CSV batch */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Tải CSV danh sách sinh viên</h3>
            <p className="text-xs text-gray-600">
              Cột: <strong>MSSV,Họ tên,Ngày sinh(YYYY-MM-DD),Email,Mật khẩu</strong>
            </p>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                className="block w-full"
                onChange={(e) => handlePickStudentCsv(e.target.files?.[0] || null)}
                disabled={!selectedId}
              />
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="upload-students"
                onChange={(e) => uploadStudentsCSV(e.target.files?.[0] || null)}
                disabled={!selectedId}
              />
            </div>

            {studentPreview && (
              <>
                <div className="mt-3 text-xs text-gray-600">Xem trước (tối đa 20 dòng):</div>
                <div className="overflow-auto border rounded mt-1">
                  <table className="min-w-full text-xs">
                    <tbody>
                      {studentPreview.map((r, i) => (
                        <tr key={i} className="odd:bg-gray-50">
                          {r.map((c, j) => (
                            <td key={j} className="px-2 py-1 border-r">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2">
                  <label
                    htmlFor="upload-students"
                    className={
                      !selectedId
                        ? 'px-3 py-1.5 rounded bg-gray-300 text-white text-sm cursor-not-allowed'
                        : 'px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700 cursor-pointer'
                    }
                  >
                    Tải lên & tạo tài khoản
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Dữ liệu đã có (list) */}
      {viewData && (
        <section className="rounded-xl border bg-white p-5 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Dữ liệu: {viewData.kind.toUpperCase()} — {viewData.count} dòng
            </h3>
            <button onClick={() => setViewData(null)} className="text-sm text-gray-600 hover:underline">
              Đóng
            </button>
          </div>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(viewData.rows[0] || { col1: '', col2: '' }).map((k) => (
                    <th key={k} className="px-3 py-2 text-left border-b">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewData.rows.map((r, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-3 py-1.5 border-b">
                        {String(v ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ma trận kết nối (Cytoscape) */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ma trận kết nối (Cytoscape)</h2>
          <button
            onClick={loadGraph}
            className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700"
            disabled={!selectedId}
          >
            Làm mới
          </button>
        </div>

        <div className="mt-3 h-[520px] border rounded overflow-hidden">
          {graph ? (
            <CytoscapeComponent
              elements={[...(graph.nodes || []), ...(graph.edges || [])]}
              style={{ width: '100%', height: '100%' }}
              layout={{ name: 'cose', animate: false }}
              stylesheet={[
                {
                  selector: 'node',
                  style: {
                    'background-color': '#0E7BD0',
                    label: 'data(label)',
                    color: '#fff',
                    'font-size': 10,
                    'text-valign': 'center',
                    'text-halign': 'center',
                  },
                },
                { selector: 'node[group="PLO"]', style: { 'background-color': '#0E7BD0' } },
                { selector: 'node[group="PI"]', style: { 'background-color': '#2BAE72' } },
                { selector: 'node[group="COURSE"]', style: { 'background-color': '#888' } },
                { selector: 'node[group="CLO"]', style: { 'background-color': '#555' } },
                {
                  selector: 'edge',
                  style: {
                    width: 2,
                    'line-color': '#bbb',
                    'target-arrow-color': '#bbb',
                    'target-arrow-shape': 'triangle',
                    label: 'data(kind)',
                    'font-size': 8,
                    color: '#333',
                    'curve-style': 'bezier',
                  },
                },
              ]}
            />
          ) : (
            <div className="h-full grid place-items-center text-sm text-gray-500">Chọn khung để xem ma trận</div>
          )}
        </div>
      </section>
    </main>
  );
}
