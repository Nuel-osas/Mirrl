import { NextRequest, NextResponse } from "next/server";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";
import {
  rpcFor, fallbackFor, prettyModel, classifyService, curatedInfo, sortModels,
  type OgModel, type Network,
} from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists every model on the 0G Compute marketplace for the requested network,
// with the curated "best of 0G" promoted to the top.
export async function GET(req: NextRequest) {
  const network: Network = req.nextUrl.searchParams.get("network") === "mainnet" ? "mainnet" : "testnet";

  try {
    const broker = await createZGComputeNetworkReadOnlyBroker(rpcFor(network));
    const services = await broker.inference.listService();

    const models: OgModel[] = (services || []).map((s) => {
      const model = String(s.model || "unknown");
      const { rank, note } = curatedInfo(model);
      return {
        provider: String(s.provider || ""),
        model,
        label: prettyModel(model),
        type: classifyService(s.serviceType),
        verifiable: Boolean(s.verifiability),
        live: true,
        rank,
        note,
      };
    });

    if (models.length === 0) {
      return NextResponse.json({ source: "fallback", network, models: sortModels(fallbackFor(network)) });
    }
    return NextResponse.json({ source: "live", network, models: sortModels(models) });
  } catch {
    return NextResponse.json({ source: "fallback", network, models: sortModels(fallbackFor(network)) });
  }
}
