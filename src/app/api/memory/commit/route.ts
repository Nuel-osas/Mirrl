import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub } from "@/lib/server/users";
import { getUserId } from "@/lib/user";
import { commitMemory } from "@/lib/server/memory";
import type { Network } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Seal the working-memory cache into the consolidated memory.md on 0G Storage,
// then clear the cache. Requires a signed-in (custodial wallet) user to pay/own.
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const user = await findUserByGoogleSub(session.sub);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { network } = (await req.json().catch(() => ({}))) as { network?: Network };
  const net: Network = network === "mainnet" ? "mainnet" : "testnet";
  const uid = await getUserId();

  try {
    const result = await commitMemory(uid, user, net);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ committed: false, error: (e as Error).message }, { status: 500 });
  }
}
