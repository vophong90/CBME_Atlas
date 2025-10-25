// app/api/academic-affairs/graph/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type PLO = { code: string; name?: string | null; description?: string | null };
type PI  = { code: string; name?: string | null; description?: string | null };
type Course = { code: string; name?: string | null; credits?: number | null };
type CLO = { course_code: string; clo_code: string; text?: string | null };

type PloCloLink = { plo_code: string; course_code: string; clo_code: string; level?: string | null };
type PiCloLink  = { pi_code:  string; course_code: string; clo_code: string; level?: string | null };
type PloPiLink  = { plo_code: string; pi_code: string; level?: string | null };

type NodeData = {
  id: string;
  type: 'PLO' | 'PI' | 'COURSE' | 'CLO';
  code?: string;
  course_code?: string;
  clo_code?: string;
  label: string;
};
type EdgeData = {
  id: string;
  source: string;
  target: string;
  kind: string;     // dùng để hiển thị/lọc bên client
  label?: string;   // nhãn hiển thị trên cạnh (nếu muốn)
  weight?: number;  // số lượng CLO/level gộp
};

function asLabelCodeName(
  code?: string | null,
  name?: string | null,
  mode: 'full' | 'code' = 'full'
) {
  const c = (code ?? '').trim();
  const n = (name ?? '').trim();
  if (mode === 'code' || !n) return c;
  return n ? `${c} — ${n}` : c;
}

export async function GET(req: Request) {
  const supabase = createServiceClient();

  try {
    const url = new URL(req.url);
    const includeShortcuts = url.searchParams.get('shortcuts') === '1';
    const includePi        = url.searchParams.get('include_pi') === '1';
    const includePloPi     = url.searchParams.get('include_plopi') === '1';
    const labelMode: 'full' | 'code' =
      (url.searchParams.get('label_mode') as 'full' | 'code') || 'full';

    // Helper: select bảng, nếu bảng không tồn tại hoặc lỗi → trả [] để không vỡ API
    async function safeSelect<T>(table: string, columns = '*'): Promise<T[]> {
      const res = await supabase.from(table).select(columns as any);
      if (res.error) {
        // Nếu bảng không tồn tại / lỗi schema, trả rỗng để vẫn render được phần còn lại
        // Bạn có thể log res.error ở server
        return [];
      }
      return (res.data ?? []) as T[];
    }

    // Nạp song song dữ liệu
    const [
      plos, courses, clos, ploClo, pis, piClo, ploPi
    ] = await Promise.all([
      safeSelect<PLO>('plos', 'code,name,description'),
      safeSelect<Course>('courses', 'code,name,credits'),
      safeSelect<CLO>('clos', 'course_code,clo_code,text'),
      safeSelect<PloCloLink>('plo_clo_links', 'plo_code,course_code,clo_code,level'),
      includePi ? safeSelect<PI>('pis', 'code,name,description') : Promise.resolve([] as PI[]),
      includePi ? safeSelect<PiCloLink>('pi_clo_links', 'pi_code,course_code,clo_code,level') : Promise.resolve([] as PiCloLink[]),
      includePloPi ? safeSelect<PloPiLink>('plo_pi_links', 'plo_code,pi_code,level') : Promise.resolve([] as PloPiLink[]),
    ]);

    // ===== Build nodes (unique) =====
    const nodeMap = new Map<string, NodeData>();

    // PLO nodes
    for (const p of plos) {
      const id = `PLO:${p.code}`;
      nodeMap.set(id, {
        id,
        type: 'PLO',
        code: p.code,
        label: asLabelCodeName(p.code, p.name, labelMode),
      });
    }

    // COURSE nodes
    for (const c of courses) {
      const id = `COURSE:${c.code}`;
      nodeMap.set(id, {
        id,
        type: 'COURSE',
        code: c.code,
        label: asLabelCodeName(c.code, c.name, labelMode),
      });
    }

    // CLO nodes (unique per (course_code, clo_code))
    for (const c of clos) {
      const id = `CLO:${c.course_code}:${c.clo_code}`;
      nodeMap.set(id, {
        id,
        type: 'CLO',
        code: c.clo_code,
        course_code: c.course_code,
        clo_code: c.clo_code,
        label: `${c.clo_code}`, // có thể đổi thành `${c.clo_code} — ${(c.text ?? '').slice(0,60)}…`
      });
    }

    // PI nodes (tuỳ chọn)
    if (includePi) {
      for (const p of pis) {
        const id = `PI:${p.code}`;
        nodeMap.set(id, {
          id,
          type: 'PI',
          code: p.code,
          label: asLabelCodeName(p.code, p.name, labelMode),
        });
      }
    }

    // ===== Build edges =====
    const edges: EdgeData[] = [];

    // Helper: bảo đảm node tồn tại (trong trường hợp bảng code rời không có)
    function ensureNode(type: 'PLO' | 'PI' | 'COURSE' | 'CLO', parts: string[], label?: string) {
      const id = `${type}:${parts.join(':')}`;
      if (!nodeMap.has(id)) {
        const code = parts[0];
        nodeMap.set(id, {
          id,
          type,
          code,
          course_code: type === 'CLO' ? parts[0] : undefined,
          clo_code: type === 'CLO' ? parts[1] : undefined,
          label: label ?? parts.join(':'),
        });
      }
      return id;
    }

    // 1) COURSE -> CLO (từ bảng `clos`)
    for (const c of clos) {
      const source = ensureNode('COURSE', [c.course_code]);
      const target = ensureNode('CLO', [c.course_code, c.clo_code]);
      edges.push({
        id: `E:COURSECLO:${c.course_code}:${c.clo_code}`,
        source,
        target,
        kind: 'COURSE–CLO',
        label: 'COURSE–CLO',
      });
    }

    // 2) PLO -> COURSE (gộp từ bảng `plo_clo_links`)
    //    - group theo (plo_code, course_code)
    //    - aggregate: levels set + count clo
    type AggPC = { count: number; levels: Set<string> };
    const aggPloCourse = new Map<string, AggPC>(); // key `${plo}|${course}`
    for (const e of ploClo) {
      const key = `${e.plo_code}|${e.course_code}`;
      if (!aggPloCourse.has(key)) aggPloCourse.set(key, { count: 0, levels: new Set() });
      const a = aggPloCourse.get(key)!;
      a.count += 1;
      if (e.level && String(e.level).trim()) a.levels.add(String(e.level).trim());
    }

    for (const [key, a] of aggPloCourse.entries()) {
      const [plo, course] = key.split('|');
      const source = ensureNode('PLO', [plo]);
      const target = ensureNode('COURSE', [course]);
      const levelsStr = a.levels.size ? Array.from(a.levels).join('/') : '';
      const label = levelsStr ? `PLO–COURSE (${levelsStr})` : 'PLO–COURSE';
      edges.push({
        id: `E:PLOCOURSE:${plo}->${course}`,
        source,
        target,
        kind: label,
        label,
        weight: a.count,
      });
    }

    // 3) (Tuỳ chọn) PI -> COURSE (gộp từ `pi_clo_links`)
    if (includePi && piClo.length) {
      type AggIC = { count: number; levels: Set<string> };
      const aggPiCourse = new Map<string, AggIC>(); // key `${pi}|${course}`
      for (const e of piClo) {
        const key = `${e.pi_code}|${e.course_code}`;
        if (!aggPiCourse.has(key)) aggPiCourse.set(key, { count: 0, levels: new Set() });
        const a = aggPiCourse.get(key)!;
        a.count += 1;
        if (e.level && String(e.level).trim()) a.levels.add(String(e.level).trim());
      }
      for (const [key, a] of aggPiCourse.entries()) {
        const [pi, course] = key.split('|');
        const source = ensureNode('PI', [pi]);
        const target = ensureNode('COURSE', [course]);
        const levelsStr = a.levels.size ? Array.from(a.levels).join('/') : '';
        const label = levelsStr ? `PI–COURSE (${levelsStr})` : 'PI–COURSE';
        edges.push({
          id: `E:PICOURSE:${pi}->${course}`,
          source,
          target,
          kind: label,
          label,
          weight: a.count,
        });
      }
    }

    // 4) (Tuỳ chọn) PLO ↔ PI (nếu có bảng `plo_pi_links`)
    if (includePloPi && (ploPi?.length ?? 0) > 0) {
      for (const e of ploPi) {
        const source = ensureNode('PLO', [e.plo_code]);
        const target = ensureNode('PI', [e.pi_code]);
        const label = e.level ? `PLO–PI (${String(e.level)})` : 'PLO–PI';
        edges.push({
          id: `E:PLOPI:${e.plo_code}<->${e.pi_code}`,
          source,
          target,
          kind: label,
          label,
        });
      }
    }

    // 5) (Tuỳ chọn) SHORTCUTS: PLO -> CLO và PI -> CLO
    if (includeShortcuts) {
      for (const e of ploClo) {
        const source = ensureNode('PLO', [e.plo_code]);
        const target = ensureNode('CLO', [e.course_code, e.clo_code]);
        const label = e.level ? `PLO–CLO (${String(e.level)})` : 'PLO–CLO';
        edges.push({
          id: `E:PLOCLO:${e.plo_code}->${e.course_code}:${e.clo_code}`,
          source,
          target,
          kind: label,
          label,
        });
      }
      if (includePi) {
        for (const e of piClo) {
          const source = ensureNode('PI', [e.pi_code]);
          const target = ensureNode('CLO', [e.course_code, e.clo_code]);
          const label = e.level ? `PI–CLO (${String(e.level)})` : 'PI–CLO';
          edges.push({
            id: `E:PICLO:${e.pi_code}->${e.course_code}:${e.clo_code}`,
            source,
            target,
            kind: label,
            label,
          });
        }
      }
    }

    // Kết quả cuối cùng
    const nodes = Array.from(nodeMap.values());

    return NextResponse.json({
      ok: true,
      summary: {
        counts: {
          plos: plos.length,
          courses: courses.length,
          clos: clos.length,
          pis: pis.length,
          links_plo_clo: ploClo.length,
          links_pi_clo: piClo.length,
          links_plo_pi: ploPi.length,
          nodes: nodes.length,
          edges: edges.length,
        },
        options: {
          includeShortcuts,
          includePi,
          includePloPi,
          labelMode,
        },
      },
      nodes,
      edges,
      // Nếu client của bạn dùng Cytoscape `elements`, có thể trả kèm:
      elements: [
        ...nodes.map((n) => ({ data: n })),
        ...edges.map((e) => ({ data: e })),
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || String(err) },
      { status: 400 },
    );
  }
}
