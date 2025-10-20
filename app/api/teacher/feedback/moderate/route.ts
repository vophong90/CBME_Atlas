import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FALLBACK_BLOCKLIST = [
  /đồ ngu|đồ điên|đồ khùng|mày|tao|đồ rác|vô học|đồ mất dạy/i,
  /tự sát|tự tử|kết liễu|giết/i,
  /kiện tụng|tố cáo (mày|bạn|thằng)/i
];

export async function POST(req: Request) {
  const body = await req.json();
  const { message } = body as { message: string };
  if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });

  const proxy = process.env.PROXY_URL;
  if (proxy) {
    try {
      const r = await fetch(proxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'moderate_teacher_feedback_vi',
          text: message,
          rules: [
            'Động viên, xây dựng, cụ thể hoá cách cải thiện',
            'Không miệt thị, không kích động, không công kích cá nhân',
            'Không đe doạ, không ngôn từ bạo lực, không gợi ý hành vi tự hại',
            'Không gây lo âu cực độ hay trầm cảm; giữ thái độ tôn trọng, hướng dẫn'
          ]
        })
      });
      const data = await r.json();
      // Kỳ vọng { ok: true|false, reasons?: string[] }
      if (data?.ok) return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: false, reason: data?.reasons?.join('; ') || 'rejected' });
    } catch (e: any) {
      // fall through to local check
    }
  }

  // Fallback local rule
  const bad = FALLBACK_BLOCKLIST.some(rx => rx.test(message));
  return NextResponse.json({ ok: !bad, reason: bad ? 'contains banned phrases' : undefined });
}
