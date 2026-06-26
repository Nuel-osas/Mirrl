# Mirrl — Architecture

> The AI whose memory you own. Private inference on 0G Compute, memory you
> own on 0G Storage, identity in your wallet.

**Status legend:** ✅ built · 🟡 partial · 🔭 planned

---

## 1. Thesis

Centralized AI is **amnesiac by economics** — giving a billion users permanent,
private, portable memory is ruinously expensive, so providers cap it, silo it,
and read it. Mirrl inverts this:

- **Inference** runs on **0G Compute** inside a TEE → the host can't read it, and
  every response is verifiable.
- **Memory** is versioned on **0G Storage** (immutable, content-addressed) →
  cheap, permanent, provable.
- **Ownership** is a wallet-signed pointer on **0G Chain** → no company can read,
  alter, or revoke your memory.

The chain is invisible to the user; they just get an AI that finally remembers
them and that they actually own.

---

## 2. System overview

```
┌──────────────────────────── Client (Next.js / React) ────────────────────────────┐
│  TopNav · Home (chat) · Integrations · [Memories/Brain/Agents/Knowledge/Studio]   │
│  MirrlProvider (store)        RainbowKit / wagmi (wallet)                          │
└───────────────┬───────────────────────────────────────┬───────────────────────────┘
                │ fetch /api/*                            │ wallet connect
                ▼                                         ▼
┌──────────────────────────── Next.js Route Handlers ───────────────────────────────┐
│  /api/chat        → 0G Compute inference (TEE)                                      │
│  /api/models      → 0G Compute marketplace (live model list)                       │
│  /api/memories    → working-memory cache (CRUD)                                     │
│  /api/sessions    → chat sessions (CRUD)                                            │
│  /api/prefs       → user preferences                                               │
│  /api/memory/commit 🔭 → consolidate cache → 0G Storage → move pointer             │
└───────┬───────────────────────────┬───────────────────────────┬────────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
   Postgres (Neon)            0G Compute Network           0G Storage + 0G Chain
   working memory,            inference (TEE/TeeML),        long-term memory (md),
   sessions, prefs            curated model catalog         wallet-owned pointer
   ✅                          ✅                            🔭
```

---

## 3. Frontend

- **Next.js 16 (App Router), React 19, Tailwind v4, TypeScript.** ✅
- **`MirrlProvider`** (`src/lib/store.tsx`) — single client store: theme, network,
  wallet/signedIn, model, memories, chat sessions. Hydrates from the API on mount;
  every mutation is optimistic + write-through to the DB. **No `localStorage`.** ✅
- **Routing** — `/` (chat), `/integrations` live; `/memories`, `/brain`, `/agents`,
  `/knowledge`, `/studio` gated as **Coming soon** in the nav. ✅
- **Model picker** (`ModelSelect`) — pulls the live 0G marketplace per network and
  promotes a curated "Top models" set. ✅

---

## 4. Identity & auth

| Concern | Mechanism | Status |
| --- | --- | --- |
| Anonymous identity | `mirrl_uid` httpOnly cookie set by `middleware.ts`; resolved server-side by `getUserId()` | ✅ |
| Wallet sign-in | RainbowKit + wagmi (`Web3Providers`), 0G chains (mainnet 16661, Galileo testnet 16602) | ✅ |
| Wallet → app state | `WalletSync` bridges `useAccount()` into the store (`signedIn`, `address`) | ✅ |
| Wallet **as** the user id | `user_id = wallet address` (replacing the cookie); migrate cookie data on first connect | 🔭 |

Today data is keyed to the anonymous cookie. Moving `user_id` to the wallet
address is what turns "signed in" into "owns their data."

---

## 5. Inference (0G Compute) ✅

- `@0gfoundation/0g-compute-ts-sdk` via `/api/chat`.
- Models are TEE-verifiable (TeeML) — private + attestable.
- **Network-aware:** testnet (2 free Qwen models) ↔ mainnet (15 frontier models),
  toggled in the account menu and persisted in prefs.
- **Curated catalog** (`src/lib/og.ts`): default `deepseek-v4-pro`, plus
  `gpt-5.4-mini`, `qwen3.7-max`, `glm-5.1`, and the 0G-native `0GM-1.0-35B`,
  promoted above the live list.
- **Demo fallback:** without a funded `OG_PRIVATE_KEY`, `/api/chat` returns a local
  response so the UI is always usable; with a funded key it routes through a live
  0G Compute provider.

---

## 6. Memory architecture (two-tier)

The core design. Memory is **never mutated in place** — it is **versioned**.

### 6.1 Tier 1 — Working memory (Postgres, hot & mutable) ✅ / 🟡

- **Every prompt** drops a raw cache row (`pending`) — instant, no LLM cost.
- **Explicit `Remember`** entries land here too.
- Fast, cheap, editable staging buffer.

### 6.2 Tier 2 — Long-term memory (0G Storage + on-chain pointer) 🔭

- The canonical memory is a single **`memory.md`** document.
- It lives on **0G Storage**, which is **immutable & content-addressed** (Log Layer):
  you cannot edit a file in place — each version is a new **root hash**; old versions
  persist (a tamper-evident history).
- A **pointer** records "the current version." Mutability lives entirely in the
  pointer, not the file (git analogy: blobs are immutable, `HEAD` moves).

### 6.3 Commit flow (cache → 0G)

Triggered on **session end / periodic**: New chat, page unload (`sendBeacon`), and
an idle flush when anything is pending.

```
COMMIT:
  1. load previous memory.md  (download by current root hash, or cache)
  2. consolidate previous ⊕ pending cache  →  new memory.md   (one 0G Compute pass)
  3. upload new memory.md to 0G Storage      →  newRootHash
  4. move pointer to newRootHash             (DB now → 0G Chain later)
  5. mark cache rows committed / clear them
```

The AI is never blocked by commits: it remembers the pending cache immediately
because inference context is composed live (§6.4). Commits only "seal" memory.

### 6.4 Inference context composition

```
context = committed memory.md (from 0G)  +  pending cache (from Postgres)
```

So memory feels instant and editable, while the sealed layer stays immutable.

### 6.5 Pointer ownership

| Pointer location | Ownership | Status |
| --- | --- | --- |
| Postgres `memory_commits.root_hash` | centralized index | 🟡 (interim) |
| 0G Chain registry: `wallet → latest hash` | **fully owned**, wallet-signed | 🔭 |

The honest "owned" definition = **immutable content on 0G Storage + a
wallet-signed pointer on 0G Chain**. Until the pointer is on-chain, "latest" is
still controlled by us.

---

## 7. Data model (Postgres / Neon)

```sql
-- working memory (Tier 1) — current `memories` table, used as the pending buffer
memory_cache(
  id text PK, user_id text, text text, tag text,
  source_prompt text,            -- 🔭 which prompt produced it
  status text DEFAULT 'pending', -- pending | committed   🔭
  created_at timestamptz
)

-- long-term memory pointer history (Tier 2)   🔭
memory_commits(
  user_id text, version int, root_hash text, committed_at timestamptz
)

-- chat sessions ✅
chat_sessions(id text PK, user_id text, title text, messages jsonb, updated_at timestamptz)

-- preferences ✅
user_prefs(user_id text PK, theme, network, model, signed_in, active_session, updated_at)
```

> Today the `memories` table is the working cache. `memory_commits` and the
> `status`/`source_prompt` columns are the 🔭 additions that complete Tier 2.

---

## 8. 0G Storage mutability (why versioned, not mutated)

0G Storage has two layers:

- **Log Layer (immutable):** append-only, content-addressed by root hash. A plain
  `memory.md` here cannot be edited in place — updating = new upload = new hash.
- **KV Layer (mutable):** supports in-place updates / collaborative documents, at
  the cost of running the KV runtime.

Mirrl uses **Pattern A: immutable file + movable pointer.** Each "update" is a new
immutable snapshot + a pointer move. This is *more* ownable than a DB row, not
less: every version is permanent and provable.

---

## 9. Environment

```bash
DATABASE_URL=postgres://…            # Neon — required
OG_PRIVATE_KEY=0x…                   # funded 0G wallet — enables live inference + 0G Storage
NEXT_PUBLIC_WC_PROJECT_ID=…          # WalletConnect Cloud id (injected wallets work without it)
```

---

## 10. Build status summary

| Area | Status |
| --- | --- |
| Multi-page UI, store, routing, theming | ✅ |
| Postgres persistence (memories, sessions, prefs), anon-cookie identity | ✅ |
| 0G Compute inference (TEE), curated models, testnet/mainnet toggle | ✅ |
| RainbowKit wallet sign-in on 0G chains | ✅ |
| Two-tier memory: cache → commit → 0G Storage | 🔭 (designed; commit job + storage writes next) |
| Wallet-keyed identity (`user_id = address`) | 🔭 |
| On-chain ownership pointer (0G Chain registry) | 🔭 |
| Client-side encryption of memory blobs | 🔭 |
```
