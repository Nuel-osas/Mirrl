import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMsg = { role: "user" | "assistant"; content: string; meta?: string };

export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const rows = await sql`
    SELECT id, title, messages, EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    FROM chat_sessions WHERE user_id = ${uid}
    ORDER BY updated_at DESC`;
  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      title: r.title,
      messages: (r.messages as ChatMsg[]) ?? [],
      updatedAt: Number(r.updated_ms),
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const { id, title, messages } = (await req.json()) as { id: string; title: string; messages: ChatMsg[] };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`
    INSERT INTO chat_sessions (id, user_id, title, messages, updated_at)
    VALUES (${id}, ${uid}, ${title || "New chat"}, ${JSON.stringify(messages ?? [])}::jsonb, now())
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title, messages = EXCLUDED.messages, updated_at = now()
      WHERE chat_sessions.user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`DELETE FROM chat_sessions WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
