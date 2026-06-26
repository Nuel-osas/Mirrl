import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { sql, ensureSchema } from "@/lib/db";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub } from "@/lib/server/users";
import { OG } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AMOUNT = process.env.NEXT_PUBLIC_FAUCET_AMOUNT || "5";

// GET — claim status for the signed-in user.
export async function GET() {
  await ensureSchema();
  const session = await readSession();
  const user = session ? await findUserByGoogleSub(session.sub) : null;
  if (!user) return NextResponse.json({ signedIn: false, claimed: false, amount: AMOUNT });
  const rows = (await sql`SELECT faucet_claimed_at FROM users WHERE google_sub = ${session!.sub}`) as { faucet_claimed_at: Date | null }[];
  const enabled = !!process.env.POOL_PRIVATE_KEY;
  return NextResponse.json({ signedIn: true, claimed: !!rows[0]?.faucet_claimed_at, amount: AMOUNT, enabled });
}

// POST — send AMOUNT 0G from the pool to the user's custodial wallet, once.
export async function POST() {
  await ensureSchema();
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const user = await findUserByGoogleSub(session.sub);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const key = process.env.POOL_PRIVATE_KEY;
  if (!key) return NextResponse.json({ error: "faucet not configured" }, { status: 503 });

  // atomically claim the slot so a double-click can't double-spend
  const won = (await sql`
    UPDATE users SET faucet_claimed_at = now()
    WHERE google_sub = ${session.sub} AND faucet_claimed_at IS NULL
    RETURNING id`) as { id: number }[];
  if (won.length === 0) return NextResponse.json({ error: "already claimed", claimed: true }, { status: 409 });

  try {
    const provider = new ethers.JsonRpcProvider(OG.mainnet.rpc);
    const pool = new ethers.Wallet(key, provider);
    const value = ethers.parseEther(AMOUNT);

    const bal = await provider.getBalance(pool.address);
    if (bal < value) throw new Error("pool is empty — top it up");

    const tx = await pool.sendTransaction({ to: user.wallet_address, value });
    await tx.wait();
    return NextResponse.json({ ok: true, txHash: tx.hash, amount: AMOUNT, to: user.wallet_address });
  } catch (e) {
    // roll back the claim so the user can retry
    await sql`UPDATE users SET faucet_claimed_at = NULL WHERE google_sub = ${session.sub}`;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
