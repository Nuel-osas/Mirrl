import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Neon serverless HTTP client. All Mirrl persistence lives here — memories,
// chat sessions and per-user preferences. No localStorage anywhere.
//
// Created lazily: calling neon() needs DATABASE_URL, but `next build` imports
// every route module to collect page data — so a top-level neon() would crash
// the build whenever the env var isn't present (e.g. on a fresh Vercel deploy).
// The Proxy defers client creation until the first actual query at runtime.
let client: NeonQueryFunction<false, false> | null = null;
function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

export const sql = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply: (_t, _this, args: unknown[]) => (getClient() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop: string | symbol) => (getClient() as unknown as Record<string | symbol, unknown>)[prop],
}) as NeonQueryFunction<false, false>;

let schemaReady: Promise<void> | null = null;

// Lazily create the schema once per server process.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS memories (
          id         text PRIMARY KEY,
          user_id    text NOT NULL,
          text       text NOT NULL,
          tag        text NOT NULL DEFAULT 'everything',
          created_at timestamptz NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS memories_user_idx ON memories (user_id, created_at DESC)`;

      await sql`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id         text PRIMARY KEY,
          user_id    text NOT NULL,
          title      text NOT NULL,
          messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON chat_sessions (user_id, updated_at DESC)`;

      await sql`
        CREATE TABLE IF NOT EXISTS user_prefs (
          user_id        text PRIMARY KEY,
          theme          text NOT NULL DEFAULT 'dark',
          network        text NOT NULL DEFAULT 'mainnet',
          model          text NOT NULL DEFAULT '',
          signed_in      boolean NOT NULL DEFAULT false,
          active_session text,
          updated_at     timestamptz NOT NULL DEFAULT now()
        )`;

      // Long-term memory: the consolidated memory.md committed to 0G Storage.
      // `content` is a fast-read cache; `root_hash` is the owned 0G blob pointer.
      await sql`
        CREATE TABLE IF NOT EXISTS memory_docs (
          user_id    text PRIMARY KEY,
          content    text NOT NULL DEFAULT '',
          root_hash  text,
          live       boolean NOT NULL DEFAULT false,
          version    integer NOT NULL DEFAULT 0,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;

      // Google-authenticated users with a custodial 0G wallet (key encrypted at rest).
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id             SERIAL PRIMARY KEY,
          google_sub     VARCHAR(255) UNIQUE NOT NULL,
          email          VARCHAR(320) NOT NULL,
          name           VARCHAR(255),
          picture        VARCHAR(2048),
          wallet_address VARCHAR(66) UNIQUE NOT NULL,
          encrypted_priv BYTEA NOT NULL,
          iv             BYTEA NOT NULL,
          auth_tag       BYTEA NOT NULL,
          key_version    INTEGER NOT NULL DEFAULT 1,
          exported_at    TIMESTAMPTZ,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_login_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      // one test-token claim per user
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS faucet_claimed_at TIMESTAMPTZ`;

      // Elastic-brain strength model: memories promote when re-confirmed and
      // decay with disuse, so durable facts surface first and weak ones fade.
      await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS strength REAL NOT NULL DEFAULT 0.5`;
      await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS uses INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ`;

      // Semantic layer: a 384-dim embedding per memory (pgvector) powers
      // meaning-based recall and memory-to-memory linking in the Brain.
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS embedding vector(384)`;
      await sql`CREATE INDEX IF NOT EXISTS memories_embed_idx ON memories USING hnsw (embedding vector_cosine_ops)`;

      // Agents: tasks worked by persona agents, grounded in the owned memory.
      await sql`
        CREATE TABLE IF NOT EXISTS agent_tasks (
          id           text PRIMARY KEY,
          user_id      text NOT NULL,
          goal         text NOT NULL,
          assigned     text NOT NULL DEFAULT 'agent_researcher',
          status       text NOT NULL DEFAULT 'open',
          observations jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at   timestamptz NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS agent_tasks_user_idx ON agent_tasks (user_id, updated_at DESC)`;
    })().catch((e) => {
      schemaReady = null; // allow retry on a later request
      throw e;
    });
  }
  return schemaReady;
}

// On sign-in, migrate anything owned by the anonymous cookie id onto the wallet
// key, so memory/sessions built before signing in follow the user. Runs once per
// sign-in; wallet-owned rows win over the anon copy (prefs, committed doc).
export async function linkAnonToWallet(fromUid: string, walletAddress: string): Promise<void> {
  const to = walletAddress.toLowerCase();
  if (!fromUid || fromUid === to) return;
  await ensureSchema();
  // id-keyed tables → safe to relabel the owner
  await sql`UPDATE memories SET user_id = ${to} WHERE user_id = ${fromUid}`;
  await sql`UPDATE chat_sessions SET user_id = ${to} WHERE user_id = ${fromUid}`;
  // user_id-PK tables → adopt the anon row only if the wallet has none yet
  await sql`UPDATE user_prefs SET user_id = ${to} WHERE user_id = ${fromUid} AND NOT EXISTS (SELECT 1 FROM user_prefs WHERE user_id = ${to})`;
  await sql`DELETE FROM user_prefs WHERE user_id = ${fromUid}`;
  await sql`UPDATE memory_docs SET user_id = ${to} WHERE user_id = ${fromUid} AND NOT EXISTS (SELECT 1 FROM memory_docs WHERE user_id = ${to})`;
  await sql`DELETE FROM memory_docs WHERE user_id = ${fromUid}`;
}
