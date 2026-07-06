import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Memory-to-memory links for the Brain graph: pairs of memories whose meaning is
// close (cosine similarity above a threshold), computed over the pgvector column.
export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const rows = (await sql`
    SELECT a.id AS a, b.id AS b, round((1 - (a.embedding <=> b.embedding))::numeric, 3) AS sim
    FROM memories a
    JOIN memories b ON a.id < b.id
    WHERE a.user_id = ${uid} AND b.user_id = ${uid}
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND (1 - (a.embedding <=> b.embedding)) > 0.34
    ORDER BY sim DESC
    LIMIT 200`) as { a: string; b: string; sim: string }[];

  return NextResponse.json({
    links: rows.map((r) => ({ a: r.a, b: r.b, sim: Number(r.sim) })),
  });
}
