import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { consolidate, idsToRemove, type MemRow } from "@/lib/server/consolidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { apply?: boolean }
// Runs a consolidation sweep — fold duplicates, promote re-confirmed facts, decay
// with disuse, prune noise + faded-stale. Dry-run by default → returns the diff
// to review. apply:true → removes dropped rows and persists the new strengths.
export async function POST(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const apply = (await req.json().catch(() => ({})))?.apply === true;

  const rows = (await sql`
    SELECT id, text, tag,
           EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
           strength, uses, verified,
           EXTRACT(EPOCH FROM last_used) * 1000 AS last_used_ms
    FROM memories WHERE user_id = ${uid}`) as Record<string, unknown>[];

  const mems: MemRow[] = rows.map((r) => ({
    id: String(r.id),
    text: String(r.text),
    tag: String(r.tag),
    createdAt: Number(r.created_ms),
    strength: r.strength == null ? 0.5 : Number(r.strength),
    uses: Number(r.uses ?? 0),
    verified: Boolean(r.verified),
    lastUsed: r.last_used_ms == null ? null : Number(r.last_used_ms),
  }));

  const diff = consolidate(mems, Date.now());
  const remove = idsToRemove(diff);

  if (apply) {
    if (remove.length) {
      await sql`DELETE FROM memories WHERE user_id = ${uid} AND id = ANY(${remove})`;
    }
    // persist promoted / decayed strengths for survivors
    for (const u of diff.updates) {
      if (remove.includes(u.id)) continue;
      await sql`UPDATE memories SET strength = ${u.strength}, uses = ${u.uses}, verified = ${u.verified}
                WHERE user_id = ${uid} AND id = ${u.id}`;
    }
  }

  return NextResponse.json({
    applied: apply,
    before: mems.length,
    after: diff.keep.length,
    foldedGroups: diff.folded.length,
    foldedAway: diff.folded.reduce((n, g) => n + g.drop.length, 0),
    pruned: diff.pruned.length,
    promoted: diff.promoted,
    faded: diff.faded,
    folds: diff.folded.slice(0, 12).map((g) => ({ keep: g.keep.text, drop: g.drop.map((d) => d.text) })),
    prunes: diff.pruned.slice(0, 12).map((p) => p.text),
  });
}
