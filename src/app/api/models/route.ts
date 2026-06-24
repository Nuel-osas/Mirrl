import { NextResponse } from "next/server";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { OG, FALLBACK_MODELS, prettyModel, classifyService, type OgModel } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns every model currently served on the 0G Compute marketplace.
// "Use all 0G models" — the dropdown is populated live, not hardcoded.
export async function GET() {
  try {
    const broker = await createZGComputeNetworkReadOnlyBroker(OG.testnet.rpc);
    const services = await broker.inference.listService();

    const models: OgModel[] = (services || []).map((s) => {
      const model = String(s.model || "unknown");
      const type = classifyService(s.serviceType);
      return {
        provider: String(s.provider || ""),
        model,
        label: prettyModel(model),
        type,
        verifiable: Boolean(s.verifiability),
        live: true,
      };
    });

    if (models.length === 0) {
      return NextResponse.json({ source: "fallback", models: FALLBACK_MODELS });
    }
    return NextResponse.json({ source: "live", models });
  } catch {
    // Marketplace unreachable from this environment — serve the known catalog.
    return NextResponse.json({ source: "fallback", models: FALLBACK_MODELS });
  }
}
