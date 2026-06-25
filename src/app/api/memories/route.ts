import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const rows = await sql`
    SELECT id, text, tag, EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
    FROM memories WHERE user_id = ${uid}
    ORDER BY created_at DESC`;
  return NextResponse.json({
    memories: rows.map((r) => ({ id: r.id, text: r.text, tag: r.tag, createdAt: Number(r.created_ms) })),
  });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const { id, text, tag } = (await req.json()) as { id: string; text: string; tag?: string };
  if (!id || !text?.trim()) return NextResponse.json({ error: "missing text" }, { status: 400 });
  await sql`
    INSERT INTO memories (id, user_id, text, tag)
    VALUES (${id}, ${uid}, ${text.trim()}, ${tag || "everything"})
    ON CONFLICT (id) DO NOTHING`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`DELETE FROM memories WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
