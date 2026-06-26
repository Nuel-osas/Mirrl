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
    })().catch((e) => {
      schemaReady = null; // allow retry on a later request
      throw e;
    });
  }
  return schemaReady;
}
