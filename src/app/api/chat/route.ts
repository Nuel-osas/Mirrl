import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { rpcFor, type Network } from "@/lib/og";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub, walletFor, type UserRow } from "@/lib/server/users";
import { getUserId } from "@/lib/user";
import { buildMemoryContext } from "@/lib/server/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

// Per-user broker cache so the on-chain handshake runs ONCE per warm process.
type BrokerEntry = {
  broker: Broker;
  wallet: ethers.Wallet;
  ledgerReady: boolean;
  acked: Set<string>;
  funded: Set<string>;
  meta: Map<string, { endpoint: string; model: string }>;
};
const brokerCache = new Map<string, BrokerEntry>();
let serviceCache: { at: number; net: Network; services: Awaited<ReturnType<Broker["inference"]["listService"]>> } | null = null;
const SERVICE_TTL = 30_000;
const LEDGER_INIT = Number(process.env.OG_LEDGER_DEPOSIT ?? 3);

// Accurate platform context so the model answers about Mirrl from facts, not guesses.
const ABOUT_MIRRL = `About Mirrl (this platform — answer questions about it from THESE facts; never invent 0G products that aren't real):
- Mirrl is a personal AI whose memory the user *owns*, built on 0G. Tagline: "the AI whose memory you own."
- Inference runs on 0G Compute inside a TEE (TeeML) — verifiable and private; the host cannot read the conversation. Models come from the live 0G Compute marketplace (e.g. DeepSeek, GPT, GLM, Qwen, 0G's own 0GM).
- Memory pipeline: every message auto-extracts durable facts into a working cache; when a session ends, the cache is consolidated into a single memory.md, encrypted with a key derived from the user's own wallet, uploaded to 0G Storage (returning a content root hash), and ownership is recorded on 0G Chain via the MirrlMemory registry (wallet → root hash). Only the user can decrypt it — not even Mirrl can read it.
- Sign in with Google, which mints a private custodial 0G wallet; that wallet pays for inference and owns the memory.
- How it differs from other 0G products: 0G's stack is general-purpose (0G Storage = any data, 0G Compute = any inference, 0G Chain = settlement, 0G DA = data availability). Mirrl is purpose-built for ONE thing on top of that stack — private, user-owned, persistent AI memory. It stores distilled personal context, not raw datasets; the memory follows the user across sessions and (planned) across tools via MCP.
- Built for The Zero Cup (0G's hackathon).`;
// Compact identity used on most turns; the full ABOUT_MIRRL is only injected when
// the user actually asks about the platform — keeps the prompt (and prefill) small.
const MIRRL_ONELINE =
  "Mirrl (this app) is a personal AI whose memory the user owns, on 0G: private TEE inference via 0G Compute, memory encrypted on 0G Storage and owned on 0G Chain.";
const ABOUT_TRIGGER =
  /\bmirrl\b|\b0g\b|zero\s?g|this (app|platform|thing|product)|who are you|what are you|what can you|how (do|does) (you|this|it)|your memory|own (my|your)|about (you|this|mirrl)/i;
// Cap how many memories we inject so prefill stays bounded as memory grows.
const MEMORY_LIMIT = 14;

// 0G deposited into a provider's inference sub-account on first use (min ~1 0G).
const SUBACCOUNT_FUND = process.env.OG_SUBACCOUNT_FUND ?? "1";

type Live = { endpoint: string; headers: Record<string, string>; liveModel: string };

// Mirrl's brain. Streams the answer token-by-token as NDJSON events:
//   {type:"meta",mode,model,note?}  {type:"delta",text}  ...  {type:"done"}
export async function POST(req: NextRequest) {
  const { messages, model, network } = (await req.json()) as {
    messages: ChatMessage[];
    model?: string;
    network?: Network;
  };
  const net: Network = network === "mainnet" ? "mainnet" : "testnet";

  const session = await readSession();
  // Identity: the Google user (pays for inference) and the cookie uid (keys
  // memory) are independent lookups — resolve them together.
  const [user, uid] = await Promise.all([
    session ? findUserByGoogleSub(session.sub) : Promise.resolve(null),
    getUserId(),
  ]);

  // Kick off the memory load (DB) and provider resolution (0G broker RPCs)
  // concurrently — neither depends on the other, so we overlap the wait.
  const memsPromise = buildMemoryContext(uid);
  const resolvedPromise = user
    ? resolveProvider(user, net, model).catch((e: unknown) => ({ error: (e as Error).message }))
    : null;

  const last = [...(messages || [])].reverse().find((m) => m.role === "user");
  const mems = (await memsPromise).slice(-MEMORY_LIMIT);

  // Number memories so the model can cite them inline as [1], [2], … Only pull in
  // the full platform context when the user asks about it, to keep the prompt lean.
  const system: ChatMessage = {
    role: "system",
    content:
      "You are Mirrl — a personal AI whose memory the user truly owns. Be warm, concise and genuinely helpful. " +
      "Format answers in Markdown. When you use something you remember, cite it inline with its number in brackets, e.g. [1].\n\n" +
      (ABOUT_TRIGGER.test(last?.content ?? "") ? ABOUT_MIRRL : MIRRL_ONELINE) +
      (mems.length ? `\n\nWhat you remember about this user (cite by number):\n${mems.map((m, i) => `[${i + 1}] ${m}`).join("\n")}` : ""),
  };
  const fullMessages = [system, ...(messages || [])];
  // 0G bills the request over its content and signs the headers against it,
  // so this must match what we actually POST below.
  const billingContent = fullMessages.map((m) => m.content).join("\n");

  // Finish resolving the live target: sign the billing headers over the content.
  let live: Live | null = null;
  let note: string | undefined;
  if (!user) {
    note = "Sign in to run live inference on your own 0G wallet.";
  } else if (resolvedPromise) {
    const r = await resolvedPromise;
    if ("error" in r) {
      note = `Live inference unavailable (${r.error}). Deposit 0G into your wallet ${user.wallet_address} to enable it.`;
    } else {
      try {
        const headers = (await r.broker.inference.getRequestHeaders(r.providerAddress, billingContent)) as unknown as Record<string, string>;
        live = { endpoint: r.endpoint, headers, liveModel: r.liveModel };
      } catch (err) {
        note = `Live inference unavailable (${(err as Error).message}). Deposit 0G into your wallet ${user.wallet_address} to enable it.`;
      }
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        if (!live) {
          send({ type: "meta", mode: "demo", model: model ?? "qwen2.5-omni-7b", note });
          for (const chunk of wordChunks(demoReply(last?.content ?? "", mems))) {
            send({ type: "delta", text: chunk });
            await sleep(18);
          }
          send({ type: "done" });
          return;
        }

        send({ type: "meta", mode: "live", model: live.liveModel });
        const res = await fetch(`${live.endpoint}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...live.headers },
          body: JSON.stringify({ model: live.liveModel, messages: fullMessages, stream: true }),
        });
        if (!res.ok) {
          const errText = (await res.text().catch(() => "")).slice(0, 300);
          throw new Error(`provider returned ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ""}`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no stream body");
        const dec = new TextDecoder();
        let buf = "";
        let raw = "";
        let emitted = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          raw += chunk;
          buf += chunk;
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const d = JSON.parse(data)?.choices?.[0]?.delta?.content;
              if (d) {
                send({ type: "delta", text: d });
                emitted = true;
              }
            } catch {}
          }
        }
        // Some providers ignore stream:true and return one JSON body — recover it.
        if (!emitted && raw.trim()) {
          try {
            const full = JSON.parse(raw)?.choices?.[0]?.message?.content;
            if (full) {
              send({ type: "delta", text: full });
              emitted = true;
            }
          } catch {}
        }
        if (!emitted) throw new Error("the model returned an empty response — try again or pick another model");
        send({ type: "done" });
      } catch (err) {
        send({ type: "delta", text: `\n\n_(stream error: ${(err as Error).message})_` });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

// GET — prime the broker/ledger/service caches so the first chat isn't cold.
// Safe: it never funds anything (no addLedger / no sub-account transfer).
export async function GET(req: NextRequest) {
  const net: Network = req.nextUrl.searchParams.get("net") === "testnet" ? "testnet" : "mainnet";
  const session = await readSession();
  const user = session ? await findUserByGoogleSub(session.sub) : null;
  if (!user) return Response.json({ warm: false });
  try {
    await warmProvider(user, net);
    return Response.json({ warm: true });
  } catch {
    return Response.json({ warm: false });
  }
}

// Create + cache the broker and prime the service list without spending any 0G.
async function warmProvider(user: UserRow, net: Network) {
  const cacheKey = `${net}:${user.wallet_address}`;
  let entry = brokerCache.get(cacheKey);
  if (!entry) {
    const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
    const broker = await createZGComputeNetworkBroker(wallet);
    entry = { broker, wallet, ledgerReady: false, acked: new Set(), funded: new Set(), meta: new Map() };
    brokerCache.set(cacheKey, entry);
  }
  // read-only ledger check — only marks ready if it already exists (never creates it)
  if (!entry.ledgerReady) {
    try {
      await entry.broker.ledger.getLedger();
      entry.ledgerReady = true;
    } catch {}
  }
  // prime the shared marketplace list
  if (!(serviceCache && serviceCache.net === net && Date.now() - serviceCache.at < SERVICE_TTL)) {
    try {
      const services = await entry.broker.inference.listService();
      serviceCache = { at: Date.now(), net, services };
    } catch {}
  }
}

type Resolved = { endpoint: string; providerAddress: string; liveModel: string; broker: Broker };

// Resolve the funded provider to run on (broker + ledger + provider metadata).
// Deliberately omits getRequestHeaders so this can run in parallel with the
// memory load; the billing headers are signed over the content afterwards.
async function resolveProvider(user: UserRow, net: Network, model?: string): Promise<Resolved> {
  const cacheKey = `${net}:${user.wallet_address}`;
  let entry = brokerCache.get(cacheKey);
  if (!entry) {
    const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
    const broker = await createZGComputeNetworkBroker(wallet);
    entry = { broker, wallet, ledgerReady: false, acked: new Set(), funded: new Set(), meta: new Map() };
    brokerCache.set(cacheKey, entry);
  }
  const broker = entry.broker;

  if (!entry.ledgerReady) {
    await ensureLedger(broker);
    entry.ledgerReady = true;
  }

  let services = serviceCache && serviceCache.net === net && Date.now() - serviceCache.at < SERVICE_TTL ? serviceCache.services : null;
  if (!services) {
    services = await broker.inference.listService();
    serviceCache = { at: Date.now(), net, services };
  }

  const chat = (services || []).filter(
    (s) => String(s.serviceType || "").toLowerCase().includes("chat") || !s.serviceType,
  );
  if (chat.length === 0) throw new Error("No inference providers available");

  // Prefer the selected model; else enable it; else fall back to a funded model.
  const chosen = await pickProvider(broker, entry, chat, model);
  const providerAddress = String(chosen.provider);
  if (!entry.acked.has(providerAddress)) {
    await broker.inference.acknowledgeProviderSigner?.(providerAddress).catch(() => {});
    entry.acked.add(providerAddress);
  }

  let md = entry.meta.get(providerAddress);
  if (!md) {
    const m = await broker.inference.getServiceMetadata(providerAddress);
    md = { endpoint: m.endpoint, model: m.model };
    entry.meta.set(providerAddress, md);
  }
  return { endpoint: md.endpoint, providerAddress, liveModel: md.model, broker };
}

type Service = Awaited<ReturnType<Broker["inference"]["listService"]>>[number];

// Does this provider's inference sub-account hold enough to serve a request?
async function isFunded(broker: Broker, providerAddress: string): Promise<boolean> {
  try {
    const a = (await broker.inference.getAccount(providerAddress)) as unknown as Record<string, unknown> & unknown[];
    const raw = a?.balance ?? a?.[2] ?? a?.[1] ?? "0";
    return BigInt(String(raw)) >= ethers.parseEther("0.1");
  } catch {
    return false;
  }
}

// Choose the provider to run on, in priority order:
//   1. the selected model, if its sub-account is funded
//   2. the selected model, if we can enable it (ledger has 1 0G available)
//   3. ANY already-funded model (auto-fallback — the real model is shown in meta)
async function pickProvider(broker: Broker, entry: BrokerEntry, chat: Service[], model?: string): Promise<Service> {
  const selected = chat.find((s) => String(s.model || "") === model) ?? null;

  if (selected) {
    const prov = String(selected.provider);
    if (entry.funded.has(prov) || (await isFunded(broker, prov))) {
      entry.funded.add(prov);
      return selected;
    }
    try {
      await ensureSubAccount(broker, entry.wallet, prov); // enable it, topping up from the wallet if needed
      entry.funded.add(prov);
      return selected;
    } catch {
      // genuinely can't enable the selected model (e.g. wallet empty) → fall back
    }
  }

  // a model we already know is funded (cached → no RPC)
  for (const s of chat) if (entry.funded.has(String(s.provider))) return s;
  // otherwise scan for any funded sub-account
  for (const s of chat) {
    if (await isFunded(broker, String(s.provider))) {
      entry.funded.add(String(s.provider));
      return s;
    }
  }
  throw new Error("No enabled model and not enough 0G to enable one. Deposit 0G into your wallet to enable a model.");
}

async function ensureLedger(broker: Broker) {
  try {
    await broker.ledger.getLedger();
  } catch {
    await broker.ledger.addLedger(LEDGER_INIT);
  }
}

// Create the provider's inference sub-account if it doesn't exist yet.
// 0G requires a ~1 0G minimum PER provider sub-account, drawn from the ledger's
// *available* balance. Earlier models lock their 0G in their own sub-accounts,
// so switching to a NEW model usually finds the ledger's available balance too
// low. Rather than silently falling back to an already-funded model, we top the
// ledger up from the user's native wallet, then fund the new sub-account. We
// only fail (→ fallback) if the wallet itself can't cover it.
async function ensureSubAccount(broker: Broker, wallet: ethers.Wallet, providerAddress: string) {
  try {
    await broker.inference.getAccount(providerAddress);
    return; // already funded — requests auto-top-up from the ledger
  } catch {
    // not found → must create it (min ~1 0G from the ledger's available balance)
  }

  const need = ethers.parseEther(SUBACCOUNT_FUND);
  let available = BigInt(0);
  try {
    const led = (await broker.ledger.getLedger()) as unknown as unknown[];
    available = BigInt(String(led?.[1] ?? "0")); // [user, availableBalance, totalBalance, …]
  } catch {
    // fall through — let the deposit/transfer below surface a real error
  }

  // Top up the ledger from the native wallet when it can't cover this sub-account.
  if (available < need) {
    const gasBuffer = ethers.parseEther("0.05");
    const nativeBal = await wallet.provider!.getBalance(wallet.address);
    if (nativeBal < need + gasBuffer) {
      throw new Error(
        `Not enough 0G to enable this model — it needs ~${SUBACCOUNT_FUND} 0G. ` +
          `Deposit more 0G into your wallet (${wallet.address}) or claim test tokens.`,
      );
    }
    // deposit a full sub-account's worth so available >= need with room to spare
    await broker.ledger.depositFund(Number(SUBACCOUNT_FUND));
  }

  await broker.ledger.transferFund(providerAddress, "inference", need);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Split text into word-ish chunks so demo mode "streams" like a real model.
function* wordChunks(text: string): Generator<string> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const p of parts) yield p;
}

function demoReply(_userText: string, _memory: string[]): string {
  // Demo mode = no funded model behind this, so we DON'T fake an answer. We tell
  // the user how to get a real one. (Never echo memories — that reads as broken.)
  return (
    "_I'm in **demo mode** — I'm not running on a real model yet, so I won't pretend to answer._\n\n" +
    "To get genuine answers (live, private, TEE-verified on 0G Compute):\n\n" +
    "1. **Sign in with Google** (top-right) — this gives you a private 0G wallet.\n" +
    "2. Open the account menu and click **“Claim 5 0G to test live.”**\n" +
    "3. Ask again — you'll get a real model answer, and I'll remember what matters about you."
  );
}
