import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub, walletFor } from "@/lib/server/users";
import { rpcFor, type Network } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// model name → "enabled" (funded sub-account), cached briefly per wallet+net.
const cache = new Map<string, { at: number; funded: string[] }>();
const TTL = 60_000;

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ funded: [] });
  const user = await findUserByGoogleSub(session.sub);
  if (!user) return NextResponse.json({ funded: [] });

  const url = new URL(req.url);
  const net: Network = url.searchParams.get("network") === "mainnet" ? "mainnet" : "testnet";
  const key = `${net}:${user.wallet_address}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ funded: hit.funded });

  try {
    const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
    const broker = await createZGComputeNetworkBroker(wallet);
    const services = await broker.inference.listService();
    const funded: string[] = [];
    for (const s of services) {
      try {
        const a = (await broker.inference.getAccount(String(s.provider))) as unknown as Record<string, unknown> & unknown[];
        const raw = a?.balance ?? a?.[2] ?? a?.[1] ?? "0";
        if (BigInt(String(raw)) >= ethers.parseEther("0.1")) funded.push(String(s.model));
      } catch {
        // no sub-account → not funded
      }
    }
    cache.set(key, { at: Date.now(), funded });
    return NextResponse.json({ funded });
  } catch {
    return NextResponse.json({ funded: [] });
  }
}
