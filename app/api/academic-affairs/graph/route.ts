// app/api/academic-affairs/graph/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// ==== DB row types khớp schema hiện tại ====
type PLO = { code: string; description?: string | null };
type PI  = { code: string; description?: string | null };
type Course = { course_code: string; course_name?: string | null; credits?: number | null };
type CLO = { course_code: string; clo_code: string; clo_text?: string | null };

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
  kind: string;
  label?: string;
  weight?: number;
};

function asLabel(code?: string | null, name?: string | null, mode: 'full' | 'code' = 'full') {
  const c = (code ?? '').trim();
  const n = (name ?? '').trim();
  if (mode === 'code' || !n) return c;
  return `${c} — ${n}`;
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient();

  try {
    const { searchParams } = req.nextUrl;
    const framework_id = searchParams.get('framework_id') ?? ''; // nếu truyền thì lọc theo khung
    const includeShortcuts = searchParams.get('shortcuts') === '1';
    const includePi        = searchParams.get('include_pi') === '1';
    const includePloPi     = searchParams.get('include_plopi') === '1';
    const labelMode: 'full' | 'code' =
      (searchParams.get('label_mode') as 'full' | 'code') || 'full';

    // Helper: select an toàn + filter framework_id nếu có
    async function safeSelect<T>(table: string, columns = '*'): Promise<T[]> {
      let q = supabase.from(table).select(columns as any);
      if (framework_id) q = q.eq('framework_id', framework_id);
      const res = await q;
      if (res.error) {
        // console.error(`[GRAPH] select ${table} error`, res.error);
        return [];
      }
      return (res.data ?? []) as T[];
    }

    // Nạp dữ liệu (đúng tên cột theo schema của bạn)
    const [plos, courses, clos, ploClo, pis, piClo, ploPi] = await Promise.all([
      safeSelect<PLO>('plos', 'code,description'),
      safeSelect<Course>('courses', 'course_code,course_name,credits'),
      safeSelect<CLO>('clos', 'course_code,clo_code,clo_text'),
      safeSelect<PloCloLink>('plo_clo_links', 'plo_code,course_code,clo_code,level'),
      includePi ? safeSelect<PI>('pis', 'code,description') : Promise.resolve([] as PI[]),
      includePi ? safeSelect<PiCloLink>('pi_clo_links', 'pi_code,course_code,clo_code,level') : Promise.resolve([] as PiCloLink[]),
      includePloPi ? safeSelect<PloPiLink>('plo_pi_links', 'plo_code,pi_code,level') : Promise.resolve([] as PloPiLink[]),
    ]);

    // ===== Build nodes =====
    const nodeMap = new Map<string, NodeData>();

    // PLO nodes
    for (const p of plos) {
      const id = `PLO:${p.code}`;
      nodeMap.set(id, {
        id,
        type: 'PLO',
        code: p.code,
        label: asLabel(p.code, p.description, labelMode),
      });
    }

    // COURSE nodes
    for (const c of courses) {
      const id = `COURSE:${c.course_code}`;
      nodeMap.set(id, {
        id,
        type: 'COURSE',
        code: c.course_code,
        label: asLabel(c.course_code, c.course_name, labelMode),
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
        label: c.clo_code, // có thể đổi: `${c.clo_code} — ${(c.clo_text ?? '').slice(0,60)}…`
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
          label: asLabel(p.code, p.description, labelMode),
        });
      }
    }

    // ===== Build edges =====
    const edges: EdgeData[] = [];

    // Helper: tạo node nếu thiếu (khi chỉ có link mà thiếu bảng master)
    function ensureNode(type: 'PLO' | 'PI' | 'COURSE' | 'CLO', parts: string[], label?: string) {
      const id = `${type}:${parts.join(':')}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          type,
          code: parts.at(-1),
          course_code: type === 'CLO' ? parts[0] : undefined,
          clo_code: type === 'CLO' ? parts[1] : undefined,
          label: label ?? parts.join(':'),
        });
      }
      return id;
    }

    // 1) COURSE -> CLO
    for (const c of clos) {
      const source = ensureNode('COURSE', [c.course_code], asLabel(c.course_code, (courses.find(x=>x.course_code===c.course_code)?.course_name)||'', labelMode));
      const target = ensureNode('CLO', [c.course_code, c.clo_code], c.clo_code);
      edges.push({
        id: `E:COURSECLO:${c.course_code}:${c.clo_code}`,
        source,
        target,
        kind: 'COURSE–CLO',
        label: 'COURSE–CLO',
      });
    }

    // 2) PLO -> COURSE (gộp theo (plo_code, course_code))
    type AggPC = { count: number; levels: Set<string> };
    const aggPloCourse = new Map<string, AggPC>();
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
      const target = ensureNode('COURSE', [course], asLabel(course, (courses.find(x=>x.course_code===course)?.course_name)||'', labelMode));
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

    // 3) (tuỳ chọn) PI -> COURSE
    if (includePi && piClo.length) {
      type AggIC = { count: number; levels: Set<string> };
      const aggPiCourse = new Map<string, AggIC>();
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
        const target = ensureNode('COURSE', [course], asLabel(course, (courses.find(x=>x.course_code===course)?.course_name)||'', labelMode));
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

    // 4) (tuỳ chọn) PLO ↔ PI
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

    // 5) (tuỳ chọn) đường tắt PLO/PI -> CLO
    if (includeShortcuts) {
      for (const e of ploClo) {
        const source = ensureNode('PLO', [e.plo_code]);
        const target = ensureNode('CLO', [e.course_code, e.clo_code], e.clo_code);
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
          const target = ensureNode('CLO', [e.course_code, e.clo_code], e.clo_code);
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
        options: { includeShortcuts, includePi, includePloPi, labelMode, framework_id },
      },
      nodes,
      edges,
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
