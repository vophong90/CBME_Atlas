// app/api/teacher/feedback/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const PROXY_URL = process.env.PROXY_URL || 'https://gpt-api-19xu.onrender.com';
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

    // KHÔNG gửi model: để proxy tự quyết định (map qua env OPENAI_MODEL)
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      // Trả về 200 để UI hiển thị lý do và không bật nút Gửi
      return NextResponse.json({ ok: false, reason: `gateway ${res.status}` }, { status: 200 });
    }

    const data = await res.json().catch(() => null);

    // Proxy có thể forward nguyên mẫu OpenAI:
    // data.choices[0].message.content  HOẶC data.content HOẶC data.text
    const content: string | undefined =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.text;

    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ ok: false, reason: 'empty content' }, { status: 200 });
    }

    // Parse JSON GPT trả về
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Cố gắng trích khối {...}
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
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
    // Timeout / network error… vẫn trả 200 với ok=false để UI không bật nút Gửi
    return NextResponse.json({ ok: false, reason: e?.message ?? 'Server error' }, { status: 200 });
  }
}
