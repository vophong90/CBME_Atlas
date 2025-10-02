# Năng Lực Y — Multipage Starter (Next.js 14 + Tailwind)

Giao diện hiện đại, đa trang (App Router). Sẵn sàng kết nối Supabase theo kiến trúc CBME đã thống nhất.

## Trang có sẵn
- `/` Trang chủ (hero + giới thiệu)
- `/dashboard` Dashboard sinh viên (PLO/PI — Total/Đạt/Chưa đạt/N/A + Attainment + Coverage)
- `/class` Báo cáo lớp/cohort (heatmap demo)
- `/rubrics` Quản lý rubric đa-CLO
- `/observations` Form chấm & minh chứng (demo)
- `/portfolio` e-Portfolio (demo)

## Cách chạy
```bash
pnpm i   # hoặc npm i / yarn
pnpm dev # http://localhost:3000
```

## Triển khai Vercel
- Push repo lên GitHub -> Import vào Vercel (Framework: Next.js)

## Tiếp theo (kết nối Supabase)
- Tạo view `student_clo_results`, `student_plo_rollup`, `student_pi_rollup` trên DB.
- Tạo API routes `/api/observations` để insert observation + RPC tính CLO + render PDF.
- Bật RLS tối giản (PII) theo spec.