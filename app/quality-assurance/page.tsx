// app/quality-assurance/page.tsx
'use client';
import Link from 'next/link';

export default function QualityAssurancePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Đảm bảo chất lượng</h1>
      {/* (tuỳ bạn) link tới các tiểu trang: tạo form / duyệt đối tượng / tiến độ */}
      <div className="flex flex-wrap gap-3">
        <Link className="underline" href="/quality-assurance/builder">Tạo form khảo sát</Link>
        <Link className="underline" href="/quality-assurance/targeting">Duyệt đối tượng</Link>
        <Link className="underline" href="/quality-assurance/progress">Tiến độ khảo sát</Link>
      </div>
    </main>
  );
}
