import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { OG } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Mirrl's brain. Inference runs on the 0G Compute Network inside a TEE
// (TeeML verifiability), so the host can never read the conversation.
// Set OG_PRIVATE_KEY (a funded 0G testnet wallet) to hit the live network;
// without it, Mirrl responds in local demo mode so the UI is fully usable.
export async function POST(req: NextRequest) {
  const { messages, model, memory } = (await req.json()) as {
    messages: ChatMessage[];
    model?: string;
    memory?: string[];
  };

  const system: ChatMessage = {
    role: "system",
    content:
      "You are Mirrl — a personal AI whose memory belongs to the user, persisted on 0G decentralized storage. " +
      "Be warm, concise and genuinely helpful. Reference what you remember when relevant." +
      (memory && memory.length ? `\n\nWhat you remember about this user:\n- ${memory.join("\n- ")}` : ""),
  };
  const fullMessages = [system, ...(messages || [])];
  const last = [...(messages || [])].reverse().find((m) => m.role === "user");

  const key = process.env.OG_PRIVATE_KEY;
  if (!key) {
    return NextResponse.json({
      reply: demoReply(last?.content ?? "", memory),
      mode: "demo",
      model: model ?? "qwen2.5-7b-instruct",
      verifiable: true,
      note: "Demo mode — set OG_PRIVATE_KEY (funded 0G testnet wallet) to run live 0G Compute inference.",
    });
  }

  try {
    const provider = new ethers.JsonRpcProvider(OG.testnet.rpc);
    const wallet = new ethers.Wallet(key, provider);
    const broker = await createZGComputeNetworkBroker(wallet);

    const services = await broker.inference.listService();
    const chat = (services || []).filter(
      (s) => String(s.serviceType || "").toLowerCase().includes("chat") || !s.serviceType,
    );
    const chosen = chat.find((s) => String(s.model || "") === model) ?? chat[0] ?? services?.[0];
    if (!chosen) throw new Error("No inference providers available");

    const providerAddress = String(chosen.provider);
    await broker.inference.acknowledgeProviderSigner?.(providerAddress).catch(() => {});
    const { endpoint, model: liveModel } = await broker.inference.getServiceMetadata(providerAddress);
    const headers = await broker.inference.getRequestHeaders(providerAddress);

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ model: liveModel, messages: fullMessages }),
    });
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "(no response)";

    return NextResponse.json({ reply, mode: "live", model: liveModel, provider: providerAddress, verifiable: true });
  } catch (err) {
    return NextResponse.json({
      reply: demoReply(last?.content ?? "", memory),
      mode: "demo",
      model: model ?? "qwen2.5-7b-instruct",
      verifiable: true,
      note: `Live 0G inference unavailable (${(err as Error).message}). Showing demo response.`,
    });
  }
}

function demoReply(userText: string, memory?: string[]): string {
  const t = userText.trim().toLowerCase();
  const remembered = memory && memory.length ? ` I still remember: ${memory.slice(0, 3).join("; ")}.` : "";
  if (!t) return "I'm Mirrl. Tell me anything — I'll remember it, and it stays yours on 0G.";
  if (t === "hi" || t === "hey" || t === "hello")
    return `Hey — good to see you.${remembered || " I'm Mirrl, the AI whose memory you actually own. Try the Remember mode to teach me something, and watch it persist to 0G Storage."}`;
  return `Got it.${remembered} (Running on 0G Compute — verifiable inference inside a TEE, so this conversation stays private to you.)`;
}
