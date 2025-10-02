import Image from 'next/image'

export default function Page() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute -z-10 inset-0 bg-gradient-to-br from-[var(--brand-primary)]/10 via-transparent to-[var(--brand-secondary)]/10" />
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Theo dõi <span className="text-[var(--brand-primary)]">Chuẩn Năng Lực</span> cho sinh viên Y khoa
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                PLO–PI–CLO–EPA trên một nền tảng. Minh chứng trực quan, báo cáo realtime, hỗ trợ phát hiện sớm sinh viên cần giúp đỡ.
              </p>
              <div className="mt-6 flex gap-3">
                <a className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white" href="/dashboard">Vào dashboard</a>
                <a className="px-4 py-2 rounded-lg border" href="/rubrics">Quản lý rubric</a>
              </div>
            </div>
            <div className="relative">
              <div className="card">
                <div className="flex items-center gap-3">
                  <Image src="/assets/brand/logo.png" alt="Logo Khoa YHCT" width={72} height={72} className="rounded-xl"/>
                  <div>
                    <div className="font-semibold">Khoa Y học Cổ truyền</div>
                    <div className="text-sm text-slate-500">Đại học Y Dược TP.HCM</div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
                  <div className="stat">
                    <div className="text-xs text-slate-500">PLO đã đạt</div>
                    <div className="mt-1 text-2xl font-semibold">12</div>
                  </div>
                  <div className="stat">
                    <div className="text-xs text-slate-500">PI đã đạt</div>
                    <div className="mt-1 text-2xl font-semibold">22</div>
                  </div>
                  <div className="stat">
                    <div className="text-xs text-slate-500">CLO đã đạt</div>
                    <div className="mt-1 text-2xl font-semibold">86</div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-sm text-slate-500">Coverage chương trình</div>
                  <div className="w-full h-3 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-[var(--brand-primary)]" style={{width:'64%'}} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}