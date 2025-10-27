// app/api/teacher/feedback/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const PROXY_URL = 'https://gpt-api-19xu.onrender.com'; // theo yêu cầu
const TIMEOUT_MS = 15000;

function buildPrompt(message: string) {
  return `
Bạn là bộ lọc kiểm duyệt góp ý sinh viên (tiếng Việt) gửi cho giảng viên.
Chỉ chấp nhận nội dung mang tính xây dựng:
- Không tục tĩu, xúc phạm, bôi nhọ, lăng mạ, phân biệt đối xử, đe doạ.
- Không kích động tự hại hay bạo lực.
- Không đưa thông tin nhận diện cá nhân (số điện thoại, email, link, địa chỉ...).
- Khuyến khích góp ý lịch sự, tôn trọng, có gợi ý cải thiện cụ thể.

CHỈ TRẢ LỜI BẰNG JSON HỢP LỆ:
{"ok": true|false, "reason": "Giải thích ngắn gọn bằng tiếng Việt"}

Nội dung cần xét:
"""${message}"""
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const message = String(body?.message ?? '').trim();
    if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const prompt = buildPrompt(message);
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // YÊU CẦU: model 5
      body: JSON.stringify({ prompt}),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: `gateway ${res.status}` }, { status: 200 });
    }

    const data = await res.json().catch(() => null);
    const content: string | undefined =
      data?.choices?.[0]?.message?.content ?? data?.content ?? data?.text;

    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ ok: false, reason: 'empty content' }, { status: 200 });
    }

    // Parse JSON do GPT trả
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }

    if (parsed && typeof parsed.ok === 'boolean') {
      const reason = typeof parsed.reason === 'string'
        ? parsed.reason
        : parsed.ok ? 'OK' : 'Nội dung chưa phù hợp';
      return NextResponse.json({ ok: parsed.ok, reason }, { status: 200 });
    }

    return NextResponse.json({ ok: false, reason: 'invalid JSON' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message ?? 'Server error' }, { status: 200 });
  }
}
