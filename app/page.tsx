// app/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

type AboutKey = 'mission' | 'vision' | 'values' | 'philosophy';

const ABOUT: Record<
  AboutKey,
  { title: string; text: string; colors: { from: string; to: string; border: string; accent: string; text: string } }
> = {
  mission: {
    title: 'Sứ mạng',
    text:
      'Đào tạo nguồn nhân lực Y học cổ truyền chất lượng cao; nghiên cứu khoa học, ứng dụng và chuyển giao các kỹ thuật trong lĩnh vực Y học cổ truyền kết hợp Y học hiện đại, đóng góp hiệu quả vào sự nghiệp bảo vệ, chăm sóc và nâng cao sức khỏe nhân dân.',
    colors: { from: '#EEF7FF', to: '#FFFFFF', border: '#BADBFF', accent: '#0E7BD0', text: '#0b253a' },
  },
  vision: {
    title: 'Tầm nhìn',
    text:
      'Phát triển thành trường chuyên ngành Y học cổ truyền hàng đầu Việt Nam, với chương trình giảng dạy và nghiên cứu khoa học về Y học cổ truyền kết hợp Y học hiện đại ngang tầm các đại học trong khu vực Châu Á – Thái Bình Dương.',
    colors: { from: '#EFFAF3', to: '#FFFFFF', border: '#B5E6C9', accent: '#228C5C', text: '#0c3326' },
  },
  values: {
    title: 'Giá trị cốt lõi',
    text: 'Chuyên nghiệp • Chất lượng • Năng động • Sáng tạo.',
    colors: { from: '#FFFAE8', to: '#FFFFFF', border: '#FFE58A', accent: '#F59F00', text: '#4a3000' },
  },
  philosophy: {
    title: 'Triết lý giáo dục',
    text:
      'Phát huy nội lực và tăng cường hợp tác quốc tế nhằm tối ưu môi trường dạy và học, lấy người học làm trung tâm, xây dựng đội ngũ cán bộ y tế toàn diện, có đức có tài, có trách nhiệm, sẵn sàng thích ứng và hội nhập.',
    colors: { from: '#EEF6FF', to: '#FFFFFF', border: '#8EC4FF', accent: '#0E7BD0', text: '#0a274b' },
  },
};

export default function HomePage() {
  const [active, setActive] = useState<AboutKey>('mission');
  const panel = ABOUT[active];

  return (
    <div className="bg-white text-gray-900">
      {/* NAV (đơn giản, dùng TopNav hiện có nếu bạn muốn thống nhất) */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-bold">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-600" />
            <span>Curriculum Matrices</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Các lối tắt phổ biến */}
            <Link href="/class" className="text-sm hover:text-brand-700">
              Heatmap lớp
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
            >
              Đăng nhập
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section
        className="relative"
        style={{
          background:
            'radial-gradient(1200px 600px at -10% -20%, rgba(14,123,208,.20), transparent 60%), radial-gradient(1200px 600px at 110% -10%, rgba(43,174,114,.18), transparent 60%), linear-gradient(180deg, #ffffff 0%, #edf2f7 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Trái */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {/* Đặt 2 logo vào public/assets/brand/ nếu bạn đã có sẵn; nếu chưa có sẽ hiển thị trống */}
                <div className="w-20 h-20 rounded-full bg-white border border-black/10 shadow-md grid place-items-center overflow-hidden">
                  <Image
                    src="/assets/brand/logo-ump.png"
                    alt="ĐẠI HỌC Y DƯỢC TPHCM"
                    width={72}
                    height={72}
                    className="object-contain"
                  />
                </div>
                <div className="w-20 h-20 rounded-full bg-white border border-black/10 shadow-md grid place-items-center overflow-hidden">
                  <Image
                    src="/assets/brand/logo-yhct.png"
                    alt="KHOA Y HỌC CỔ TRUYỀN"
                    width={72}
                    height={72}
                    className="object-contain"
                  />
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                KHOA Y HỌC CỔ TRUYỀN
                <br />
                <span className="text-brand-700 text-[0.9em] font-semibold tracking-tight">
                  ĐẠI HỌC Y DƯỢC THÀNH PHỐ HỒ CHÍ MINH
                </span>
              </h1>

              <p className="text-gray-800 md:text-lg">
                Nền tảng quản trị ma trận PLO – Course – CLO – PI & đánh giá năng lực theo CBME.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-bold gap-2 bg-brand-600 text-white hover:bg-brand-700 shadow ring-1 ring-black/5"
                  href="/class"
                >
                  Bắt đầu ngay
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-bold gap-2 border bg-white hover:bg-gray-50"
                  href="/docs"
                >
                  Hướng dẫn
                </Link>
              </div>
            </div>

            {/* Phải: 4 medallions + panel nội dung */}
            <div className="space-y-6">
              {/* Lưới vòng tròn */}
              <div className="grid grid-cols-2 gap-4 justify-items-center">
                {(['mission', 'vision', 'values', 'philosophy'] as AboutKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setActive(k)}
                    aria-pressed={active === k}
                    className={[
                      'w-40 h-40 md:w-44 md:h-44 rounded-full flex flex-col items-center justify-center text-center p-4 font-medium transition outline outline-2 outline-offset-4',
                      'shadow-[0_12px_28px_rgba(0,0,0,.12),_inset_0_1px_0_rgba(255,255,255,.35)]',
                      active === k ? 'translate-y-[-2px] scale-[1.03]' : 'hover:translate-y-[-2px] hover:scale-[1.02]',
                      k === 'mission'
                        ? 'text-[#073b78] bg-[radial-gradient(120px_90px_at_30%_30%,rgba(255,255,255,.9),rgba(238,247,255,.95))] from-[#BADBFF] to-[#2D8FE8] bg-[length:100%_100%] bg-no-repeat'
                        : '',
                      k === 'vision'
                        ? 'text-[#0e3a28] bg-[radial-gradient(120px_90px_at_30%_30%,rgba(255,255,255,.9),rgba(239,250,243,.95))]'
                        : '',
                      k === 'values'
                        ? 'text-[#5b3600] bg-[radial-gradient(120px_90px_at_30%_30%,rgba(255,255,255,.92),rgba(255,250,232,.96))]'
                        : '',
                      k === 'philosophy'
                        ? 'text-[#082e5e] bg-[radial-gradient(120px_90px_at_30%_30%,rgba(255,255,255,.9),rgba(237,246,255,.95))]'
                        : '',
                    ].join(' ')}
                    style={
                      k === 'mission'
                        ? { backgroundImage: 'radial-gradient(120px 90px at 30% 30%, rgba(255,255,255,.9), rgba(238,247,255,.95)), linear-gradient(135deg,#BADBFF 0%,#5AA9F7 60%,#2D8FE8 100%)' }
                        : k === 'vision'
                        ? { backgroundImage: 'radial-gradient(120px 90px at 30% 30%, rgba(255,255,255,.9), rgba(239,250,243,.95)), linear-gradient(135deg,#B5E6C9 0%, #53C48B 60%, #2BAE72 100%)' }
                        : k === 'values'
                        ? { backgroundImage: 'radial-gradient(120px 90px at 30% 30%, rgba(255,255,255,.92), rgba(255,250,232,.96)), linear-gradient(135deg,#FFE58A 0%, #FFC21E 60%, #FFB000 100%)' }
                        : { backgroundImage: 'radial-gradient(120px 90px at 30% 30%, rgba(255,255,255,.9), rgba(237,246,255,.95)), linear-gradient(135deg,#8EC4FF 0%, #2D8FE8 60%, #0E7BD0 100%)' }
                    }
                  >
                    <small className="block font-bold tracking-widest uppercase text-[0.7rem] opacity-90">
                      {ABOUT[k].title}
                    </small>
                    <span className="block font-semibold mt-1">
                      {k === 'mission' && 'Mission'}
                      {k === 'vision' && 'Vision'}
                      {k === 'values' && 'Core Values'}
                      {k === 'philosophy' && 'Philosophy'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Panel nội dung */}
              <article
                className="relative rounded-xl p-5 shadow-[0_18px_48px_rgba(14,123,208,.15)] overflow-hidden border"
                style={{
                  background: `linear-gradient(135deg, ${panel.colors.from}, ${panel.colors.to})`,
                  borderColor: panel.colors.border,
                  color: panel.colors.text,
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 opacity-90"
                  style={{ background: panel.colors.accent }}
                />
                <h3 className="text-sm uppercase tracking-wider font-extrabold">{panel.title}</h3>
                <p className="mt-2 leading-7 text-[.95rem]">{panel.text}</p>
                <div className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(400px 220px at -10% 0%, rgba(255,255,255,.55), transparent 40%)',
                  }}
                />
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK LINKS THEO ĐỐI TƯỢNG */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Chọn đối tượng</h2>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { href: '/student', title: 'Sinh viên', desc: 'Bảng tiến độ CLO/PLO, hồ sơ minh chứng, phản hồi 360°' },
              { href: '/faculty', title: 'Giảng viên', desc: 'Rubric, quan sát, minh chứng, thống kê lớp/học phần' },
              { href: '/department', title: 'Bộ môn', desc: 'Ma trận CLO–PLO, phân công, giám sát thực thi' },
              { href: '/academic-affairs', title: 'Quản lý đào tạo', desc: 'Khung chương trình, phân bổ học phần, lộ trình' },
              { href: '/qa', title: 'Đảm bảo chất lượng', desc: 'Chuẩn đầu ra, minh chứng, báo cáo CBME' },
              { href: '/admin', title: 'Quản trị', desc: 'Người dùng, vai trò, RLS, cấu hình hệ thống' },
              { href: '/360-eval', title: 'Đánh giá đa nguồn', desc: 'SV – GV – Đồng nghiệp – Người hướng dẫn – Tự đánh giá' },
              { href: '/login', title: 'Đăng nhập', desc: 'Truy cập đầy đủ các chức năng theo vai trò' },
            ].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="group rounded-xl border border-gray-200 bg-white shadow hover:shadow-lg transition"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{it.title}</h3>
                    <span className="rounded-full bg-brand-50 text-brand-700 text-xs px-2 py-1 border">
                      Đi tới
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{it.desc}</p>
                  <div className="mt-3 text-brand-700 text-sm opacity-0 group-hover:opacity-100 transition">
                    Mở ngay →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
