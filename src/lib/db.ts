import { neon } from "@neondatabase/serverless";

// Neon serverless HTTP client. All Mirrl persistence lives here — memories,
// chat sessions and per-user preferences. No localStorage anywhere.
export const sql = neon(process.env.DATABASE_URL!);

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
    })().catch((e) => {
      schemaReady = null; // allow retry on a later request
      throw e;
    });
  }
  return schemaReady;
}
