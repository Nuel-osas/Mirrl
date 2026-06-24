# 🪞 Mirrl — the AI whose memory you own

**Mirrl is a personal AI whose entire memory lives on 0G.** Private inference, infinite
memory, yours forever — no company can read it, reset it, or take it away.

Built for **The Zero Cup** (0G's Global Vibe Coding Tournament). Runs end-to-end on the
**0G Galileo testnet** — free to try, nothing to install.

---

## Why this needs 0G (the "why decentralized" test)

Centralized AI is **amnesiac by economics** — giving a billion users permanent, private,
portable memory on AWS is ruinously expensive, so they cap it, silo it, and read it.
Mirrl flips that using 0G's two core stacks:

| Pillar | 0G primitive | What it unlocks |
| --- | --- | --- |
| **The brain** | **0G Compute** — TEE / TeeML inference | Every reply runs inside a hardware enclave, so the host *cannot* read your conversation. Verifiable, not "trust me." |
| **The memory** | **0G Storage** — infinite, ultra-low-cost | Lifelong memory for every user is finally *affordable* — the moat no centralized AI can match at scale. |
| **The model** | **Live 0G marketplace** | The model picker is populated **live** from the 0G Compute marketplace (`broker.inference.listService()`) — every available model, not a hardcoded one. |

> The chain is invisible. Users just get an AI that finally remembers them — and happens to be sovereign.

---

## What's built

- **Pixel-matched UI** — chat with `Ask` / `Remember` modes, live 0G model selector, account/network menu, dark + light themes.
- **`/api/models`** — fetches the **live** 0G Compute marketplace and lists every model (chatbot / image / speech), with TEE-verifiability flags. Falls back to a known catalog if the marketplace is unreachable.
- **`/api/chat`** — runs inference on **0G Compute**. Injects the user's stored memory into the system prompt so Mirrl *remembers*. Runs live when a funded testnet key is set; otherwise responds in demo mode so the UI is always usable.
- **Memory** — `Remember` mode persists facts (currently client-side; 0G Storage write path is the next wire-up before the Jul 8 lock).

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

### Go live on 0G Compute (optional)

By default Mirrl runs in **demo mode**. To hit the real 0G network:

1. Create a wallet and fund it with testnet 0G from the **[faucet](https://faucet.0g.ai)**.
2. Add a `.env.local`:
   ```bash
   OG_PRIVATE_KEY=0xyour_funded_testnet_private_key
   ```
   (The broker deposits a small ledger balance to pay providers per-call.)
3. Restart — `/api/chat` now routes through a live 0G Compute provider, and replies carry a
   `0G Compute · <model>` verifiability badge.

> **Network:** 0G Galileo Testnet · RPC `https://evmrpc-testnet.0g.ai` · Storage indexer `https://indexer-storage-testnet-turbo.0g.ai`

---

## Stack

Next.js 16 · React 19 · Tailwind v4 · `@0gfoundation/0g-compute-ts-sdk` · ethers v6 · lucide-react

## Roadmap to the final (Jul 8 lock)

- [ ] Wire `Remember` writes to **0G Storage** (root-hash per memory) + retrieval on sign-in
- [ ] "Export your AI" — your memory as a portable, ownable artifact
- [ ] Voice via 0G speech-to-text · image gen via the marketplace image model
- [ ] Live testnet deployment (public URL anyone can test)
