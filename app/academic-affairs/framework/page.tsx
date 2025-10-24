// app/academic-affairs/framework/page.tsx
'use client';

import FrameworkForm from '@/components/framework/FrameworkForm';
import UploadCsvPanel from '@/components/framework/UploadCsvPanel';
import FiltersPanel from '@/components/framework/FiltersPanel';
import MatrixGraph from '@/components/framework/MatrixGraph';
import { useFrameworkData } from '@/lib/useFrameworkData';

export default function FrameworkPage() {
  const d = useFrameworkData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Khung CTĐT & Ma trận</h1>

      <FrameworkForm
        loading={d.loading}
        frameworks={d.frameworks}
        selectedId={d.selectedId}
        setSelectedId={d.setSelectedId}
        form={d.form}
        setForm={d.setForm}
        onCreate={d.createFramework}
        onDelete={d.deleteFramework}
      />

      <UploadCsvPanel
        selectedId={d.selectedId}
        pickedFiles={d.pickedFiles}
        onPick={d.handlePickFile}
        onUpload={d.doUpload}
      />

      <FiltersPanel
        ploList={d.ploList}
        piList={d.piList}
        courseList={d.courseList}
        cloList={d.cloList}
        selPLO={d.selPLO} setSelPLO={d.setSelPLO}
        selPI={d.selPI} setSelPI={d.setSelPI}
        selCourse={d.selCourse} setSelCourse={d.setSelCourse}
        selCLO={d.selCLO} setSelCLO={d.setSelCLO}
      />

      <MatrixGraph
        elements={d.filteredElements}
        nodeCount={d.nodeCount}
        edgeCount={d.edgeCount}
        onRefresh={d.refreshMatrix}
        refreshDisabled={!d.selectedId}
      />
    </div>
  );
}
