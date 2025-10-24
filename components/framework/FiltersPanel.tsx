// components/framework/FiltersPanel.tsx
'use client';

import DropdownMulti from './DropdownMulti';
import SimpleTable from './SimpleTable';
import type { PLO, PI, Course, CLO } from '@/lib/framework-types';

export default function FiltersPanel({
  ploList, piList, courseList, cloList,
  selPLO, setSelPLO, selPI, setSelPI, selCourse, setSelCourse, selCLO, setSelCLO,
}: {
  ploList: PLO[]; piList: PI[]; courseList: Course[]; cloList: CLO[];
  selPLO: string[]; setSelPLO: (v: string[]) => void;
  selPI: string[]; setSelPI: (v: string[]) => void;
  selCourse: string[]; setSelCourse: (v: string[]) => void;
  selCLO: string[]; setSelCLO: (v: string[]) => void;
}) {
  return (
    <section className="bg-white rounded-xl border p-4 space-y-5">
      <h2 className="font-semibold">Bộ lọc & Danh mục</h2>

      <DropdownMulti label="PLO" options={ploList.map((x) => x.code)} selected={selPLO} onChange={setSelPLO} />
      <SimpleTable<PLO>
        title="Danh sách PLO"
        rows={ploList.filter((x) => !selPLO.length || selPLO.includes(x.code))}
        columns={[{ key: 'code', label: 'Mã' }, { key: 'description', label: 'Mô tả' }]}
      />

      <DropdownMulti label="PI" options={piList.map((x) => x.code)} selected={selPI} onChange={setSelPI} />
      <SimpleTable<PI>
        title="Danh sách PI"
        rows={piList.filter((x) => !selPI.length || selPI.includes(x.code))}
        columns={[{ key: 'code', label: 'Mã' }, { key: 'description', label: 'Mô tả' }]}
      />

      <DropdownMulti
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

      <DropdownMulti
        label="CLO"
        options={cloList.map((x) => `${x.course_code}:${x.clo_code}`)}
        selected={selCLO}
        onChange={setSelCLO}
        display={(s) => s.split(':')[1] ?? s}
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
    </section>
  );
}
