import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Observation = { agent: string; text: string; at: number };

export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const rows = await sql`
    SELECT id, goal, assigned, status, observations, EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    FROM agent_tasks WHERE user_id = ${uid} ORDER BY updated_at DESC`;
  return NextResponse.json({
    tasks: rows.map((r) => ({
      id: r.id,
      goal: r.goal,
      assigned: r.assigned,
      status: r.status,
      observations: (r.observations as Observation[]) ?? [],
      updatedAt: Number(r.updated_ms),
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const { id, goal, assigned, status, observations } = (await req.json()) as {
    id: string; goal: string; assigned: string; status: string; observations: Observation[];
  };
  if (!id || !goal?.trim()) return NextResponse.json({ error: "missing goal" }, { status: 400 });
  await sql`
    INSERT INTO agent_tasks (id, user_id, goal, assigned, status, observations, updated_at)
    VALUES (${id}, ${uid}, ${goal.trim()}, ${assigned || "agent_researcher"}, ${status || "open"},
            ${JSON.stringify(observations ?? [])}::jsonb, now())
    ON CONFLICT (id) DO UPDATE
      SET goal = EXCLUDED.goal, assigned = EXCLUDED.assigned, status = EXCLUDED.status,
          observations = EXCLUDED.observations, updated_at = now()
      WHERE agent_tasks.user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`DELETE FROM agent_tasks WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
