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
  autofunded: Set<string>;
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

// 0G deposited into a provider's inference sub-account on first use. Providers
// require a 1 0G minimum *reserve* that can't be spent, so funding exactly 1
// leaves zero headroom and the first settled fee drops it below the reserve.
// Fund above the reserve (reserve + usable buffer) so the model actually serves.
const SUBACCOUNT_FUND = process.env.OG_SUBACCOUNT_FUND ?? "2";
const FUND_TARGET = ethers.parseEther(SUBACCOUNT_FUND); // top-up destination (~2 0G)
// A sub-account below this is treated as under-funded → topped up before use. It
// sits above the provider's 1 0G reserve so a settled fee never drops us under it.
const FUND_FLOOR = ethers.parseEther("1.2");

type Live = { endpoint: string; headers: Record<string, string>; liveModel: string; providerAddress: string };
type ErrWithStatus = Error & { status?: number };

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
        live = { endpoint: r.endpoint, headers, liveModel: r.liveModel, providerAddress: r.providerAddress };
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

        let anyEmitted = false;
        const attempt = async (target: Live): Promise<void> => {
          const res = await fetch(`${target.endpoint}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...target.headers },
            body: JSON.stringify({ model: target.liveModel, messages: fullMessages, stream: true }),
          });
          if (!res.ok) {
            const errText = (await res.text().catch(() => "")).slice(0, 300);
            const e: ErrWithStatus = new Error(`provider returned ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ""}`);
            e.status = res.status;
            throw e;
          }
          const reader = res.body?.getReader();
          if (!reader) throw new Error("no stream body");
          const dec = new TextDecoder();
          let buf = "";
          let raw = "";
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
                  anyEmitted = true;
                }
              } catch {}
            }
          }
          // Some providers ignore stream:true and return one JSON body — recover it.
          if (!anyEmitted && raw.trim()) {
            try {
              const full = JSON.parse(raw)?.choices?.[0]?.message?.content;
              if (full) {
                send({ type: "delta", text: full });
                anyEmitted = true;
              }
            } catch {}
          }
          if (!anyEmitted) throw new Error("the model returned an empty response");
        };

        // Run the resolved provider. If it fails provider-side (5xx / attestation
        // crash) before any token, transparently fall back to another provider.
        const tried = new Set<string>();
        const failCount = new Map<string, number>();
        let target: Live | null = live;
        let announced: string | null = null;
        let lastErr: ErrWithStatus | null = null;
        for (let i = 0; i < 4 && target; i++) {
          if (announced !== target.liveModel) {
            send({ type: "meta", mode: "live", model: target.liveModel });
            announced = target.liveModel;
          }
          try {
            await attempt(target);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e as ErrWithStatus;
            const msg = lastErr.message || "";
            // Retry on a provider-side crash (5xx / attestation SIGSEGV) OR an
            // insufficient-balance rejection — never after output already streamed.
            const balanceIssue = /insufficient balance|minimum is|add more funds/i.test(msg);
            const retryable = ((!lastErr.status || lastErr.status >= 500) || balanceIssue) && !anyEmitted && !!user;
            if (!retryable) break;

            // 5xx crashes are transient (the worker restarts) — give the SAME
            // provider one retry after a backoff before excluding it. Balance
            // issues can't self-heal, so exclude that provider immediately.
            const prov = target.providerAddress;
            const fails = (failCount.get(prov) ?? 0) + 1;
            failCount.set(prov, fails);
            if (balanceIssue || fails >= 2) tried.add(prov);
            await sleep(700); // let a crashed attestation worker come back up

            try {
              // prefer a provider we haven't exhausted; if all are excluded, take
              // whatever's live (its worker may have recovered during the backoff)
              const r2 = await resolveProvider(user!, net, model, tried).catch(() =>
                resolveProvider(user!, net, model),
              );
              const h2 = (await r2.broker.inference.getRequestHeaders(r2.providerAddress, billingContent)) as unknown as Record<string, string>;
              target = { endpoint: r2.endpoint, headers: h2, liveModel: r2.liveModel, providerAddress: r2.providerAddress };
            } catch {
              target = null;
            }
          }
        }
        if (lastErr && !anyEmitted) {
          send({ type: "delta", text: `\n\n_${friendlyError(lastErr)}_` });
        }
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
    entry = { broker, wallet, ledgerReady: false, acked: new Set(), funded: new Set(), autofunded: new Set(), meta: new Map() };
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
async function resolveProvider(user: UserRow, net: Network, model?: string, exclude?: Set<string>): Promise<Resolved> {
  const cacheKey = `${net}:${user.wallet_address}`;
  let entry = brokerCache.get(cacheKey);
  if (!entry) {
    const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
    const broker = await createZGComputeNetworkBroker(wallet);
    entry = { broker, wallet, ledgerReady: false, acked: new Set(), funded: new Set(), autofunded: new Set(), meta: new Map() };
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
    (s) =>
      (String(s.serviceType || "").toLowerCase().includes("chat") || !s.serviceType) &&
      !exclude?.has(String(s.provider)),
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

  // Move balance-checking to a background timer. Without this the SDK runs an
  // inline on-chain check-and-fund inside getRequestHeaders on EVERY request
  // (~7s measured); with it, getRequestHeaders is pure signing (~0.35s).
  if (!entry.autofunded.has(providerAddress)) {
    entry.autofunded.add(providerAddress);
    await broker.inference
      .startAutoFunding(providerAddress, { interval: 60_000, bufferMultiplier: 2 })
      .catch(() => entry!.autofunded.delete(providerAddress));
  }

  return { endpoint: md.endpoint, providerAddress, liveModel: md.model, broker };
}

type Service = Awaited<ReturnType<Broker["inference"]["listService"]>>[number];

// Does this provider's sub-account hold enough to actually serve a request?
// Must be ABOVE the reserve floor — an account sitting at/just under the 1 0G
// reserve (e.g. 0.98) exists but the provider rejects it, so it's NOT funded.
async function isFunded(broker: Broker, providerAddress: string): Promise<boolean> {
  try {
    const a = (await broker.inference.getAccount(providerAddress)) as unknown as Record<string, unknown> & unknown[];
    const raw = a?.balance ?? a?.[2] ?? a?.[1] ?? "0";
    return BigInt(String(raw)) >= FUND_FLOOR;
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

// Ensure the provider's sub-account holds ~FUND_TARGET 0G — creating it if it
// doesn't exist, or TOPPING UP an existing one that has decayed toward/under the
// 1 0G reserve (which the provider would otherwise reject). The top-up is drawn
// from the ledger's available balance, refilled from the native wallet if short.
// Only fails (→ fallback) if the wallet itself can't cover it.
async function ensureSubAccount(broker: Broker, wallet: ethers.Wallet, providerAddress: string) {
  let current = BigInt(0);
  try {
    const a = (await broker.inference.getAccount(providerAddress)) as unknown as Record<string, unknown> & unknown[];
    current = BigInt(String(a?.balance ?? a?.[2] ?? a?.[1] ?? "0"));
    if (current >= FUND_FLOOR) return; // already comfortably above the reserve
  } catch {
    current = BigInt(0); // doesn't exist yet → create + fund below
  }

  // Transfer enough to reach the target from wherever it is now.
  const need = FUND_TARGET > current ? FUND_TARGET - current : FUND_TARGET;

  let available = BigInt(0);
  try {
    const led = (await broker.ledger.getLedger()) as unknown as unknown[];
    available = BigInt(String(led?.[1] ?? "0")); // [user, availableBalance, totalBalance, …]
  } catch {
    // fall through — let the deposit/transfer below surface a real error
  }

  // Refill the ledger from the native wallet when it can't cover the transfer.
  if (available < need) {
    const gasBuffer = ethers.parseEther("0.05");
    const nativeBal = await wallet.provider!.getBalance(wallet.address);
    const deficit = need - available;
    if (nativeBal < deficit + gasBuffer) {
      throw new Error(
        `Not enough 0G to enable this model — it needs ~${SUBACCOUNT_FUND} 0G. ` +
          `Deposit more 0G into your wallet (${wallet.address}) or claim test tokens.`,
      );
    }
    // deposit a touch over the deficit so available >= need after rounding
    const depositOg = Math.ceil((Number(ethers.formatEther(deficit)) + 0.05) * 100) / 100;
    await broker.ledger.depositFund(depositOg);
  }

  await broker.ledger.transferFund(providerAddress, "inference", need);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Turn raw provider/SDK errors into something a person can read (no JSON dumps).
function friendlyError(e: ErrWithStatus): string {
  const m = e.message || "";
  if (/attestation|SIGSEGV|worker exit/i.test(m))
    return "The 0G compute provider hit a snag (its secure worker restarted). Please send that again.";
  if (/insufficient balance|minimum is|add more funds/i.test(m))
    return "That model's balance ran low — top up in Wallet, or pick a model marked “ready.”";
  if (e.status && e.status >= 500)
    return "The 0G provider had a temporary error. Please try again in a moment.";
  return `Something went wrong: ${m.slice(0, 160)}`;
}

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
