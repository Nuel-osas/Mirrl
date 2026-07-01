import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { getMemoryDoc } from "@/lib/server/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Memory ownership snapshot: how much is in the working cache, and the committed
// memory.md's version + 0G Storage root + whether the blob is live on 0G.
export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const [doc, rows] = await Promise.all([
    getMemoryDoc(uid),
    sql`SELECT count(*)::int AS n FROM memories WHERE user_id = ${uid}`,
  ]);
  return NextResponse.json({
    cached: (rows[0] as { n: number }).n,
    version: doc.version,
    rootHash: doc.rootHash,
    live: doc.live,
  });
}
