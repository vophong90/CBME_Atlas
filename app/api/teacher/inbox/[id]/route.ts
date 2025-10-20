// app/api/teacher/inbox/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer'; // ĐỔI path này cho khớp helper của bạn

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await getSupabase();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const { status, tags, is_flagged } = body as {
    status?: 'unread' | 'read' | 'archived';
    tags?: string[];
    is_flagged?: boolean;
  };

  const payload: Record<string, any> = {};
  if (status) payload.status = status;
  if (Array.isArray(tags)) payload.tags = tags;
  if (typeof is_flagged === 'boolean') payload.is_flagged = is_flagged;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('teacher_inbox')
    .update(payload)
    .eq('id', id)
    .eq('teacher_id', user.id) // bảo đảm chỉ update hộp thư của chính mình
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
