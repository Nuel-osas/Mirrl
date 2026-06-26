import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub } from "@/lib/server/users";
import { fundingState, reclaimAll } from "@/lib/server/compute";
import type { Network } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function netFrom(req: NextRequest): Network {
  return req.nextUrl.searchParams.get("net") === "testnet" ? "testnet" : "mainnet";
}

// GET — the signed-in user's funding picture (native + ledger + per-model sub-accounts).
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await readSession();
  const user = session ? await findUserByGoogleSub(session.sub) : null;
  if (!user) return NextResponse.json({ signedIn: false });
  try {
    const state = await fundingState(user, netFrom(req));
    return NextResponse.json({ signedIn: true, ...state });
  } catch (e) {
    return NextResponse.json({ signedIn: true, error: (e as Error).message }, { status: 500 });
  }
}

// POST — reclaim all 0G from model sub-accounts back to the main ledger balance.
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await readSession();
  const user = session ? await findUserByGoogleSub(session.sub) : null;
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  try {
    await reclaimAll(user, netFrom(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
