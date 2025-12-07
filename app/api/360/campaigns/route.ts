// app/api/360/campaigns/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function createAuthedServerClient() {
  // ⬅️ cookies() giờ được gõ là Promise → cần await
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        cookieStore.set({ name, value, ...options });
      },
      remove: (name: string, options: any) => {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

type QAOk = { ok: true; userId: string };
type QAFail = {
  ok: false;
  status: 401 | 403;
  error: "UNAUTHORIZED" | "FORBIDDEN";
};
type QAResult = QAOk | QAFail;

// Đơn giản hóa type cho sb để khỏi dính ReturnType<...> của async fn
async function ensureQA(sb: any): Promise<QAResult> {
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const { data: rows } = await sb
    .from("user_roles")
    .select("roles:roles(code)")
    .eq("staff_user_id", user.id);

  const codes =
    (rows || [])
      .flatMap((r: any) =>
        Array.isArray(r?.roles)
          ? r.roles.map((x: any) => String(x?.code || ""))
          : []
      )
      .filter(Boolean) || [];

  if (codes.includes("qa") || codes.includes("admin")) {
    return { ok: true, userId: user.id };
  }
  return { ok: false, status: 403, error: "FORBIDDEN" };
}

/** GET: ?form_id=uuid → danh sách campaigns của form */
export async function GET(req: Request) {
  const sb = await createAuthedServerClient(); // ⬅️ thêm await
  const url = new URL(req.url);
  const formId = url.searchParams.get("form_id");

  if (!formId) {
    return NextResponse.json({ items: [] });
  }

  const { data: form, error: fErr } = await sb
    .from("eval360_forms")
    .select("id, rubric_id, framework_id, course_code")
    .eq("id", formId)
    .maybeSingle();

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 400 });
  if (!form) return NextResponse.json({ items: [] });

  const { data, error } = await sb
    .from("evaluation_campaigns")
    .select("id, name, start_at, end_at, rubric_id, framework_id, course_code")
    .eq("rubric_id", form.rubric_id)
    .order("start_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}

/** POST: tạo campaign từ form_id */
export async function POST(req: Request) {
  const sb = await createAuthedServerClient(); // ⬅️ thêm await
  const guard = await ensureQA(sb);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => ({} as any))) || {};
  const { form_id, name, start_at, end_at } = body;

  if (!form_id || !name || !start_at || !end_at) {
    return NextResponse.json(
      { error: "Thiếu trường bắt buộc" },
      { status: 400 }
    );
  }
  if (new Date(start_at) >= new Date(end_at)) {
    return NextResponse.json(
      { error: "start_at phải < end_at" },
      { status: 400 }
    );
  }

  const { data: form, error: fErr } = await sb
    .from("eval360_forms")
    .select("id, rubric_id, framework_id, course_code")
    .eq("id", form_id)
    .maybeSingle();

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 400 });
  if (!form)
    return NextResponse.json({ error: "Form không tồn tại" }, { status: 404 });

  const { data, error: iErr } = await sb
    .from("evaluation_campaigns")
    .insert({
      name: String(name),
      rubric_id: form.rubric_id,
      framework_id: form.framework_id ?? null,
      course_code: form.course_code ?? null,
      start_at: new Date(start_at).toISOString(),
      end_at: new Date(end_at).toISOString(),
      created_by: guard.userId,
    })
    .select("id, name, start_at, end_at, rubric_id, framework_id, course_code")
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}

/** PATCH: ?id=bigint { action: 'close_now' } → end_at = now */
export async function PATCH(req: Request) {
  const sb = await createAuthedServerClient(); // ⬅️ thêm await
  const guard = await ensureQA(sb);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = (await req.json().catch(() => ({} as any))) || {};
  const { action } = body;

  if (action === "close_now") {
    const { error } = await sb
      .from("evaluation_campaigns")
      .update({ end_at: new Date().toISOString() })
      .eq("id", id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Hành động không hỗ trợ" }, { status: 400 });
}
