import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { issueSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEV ONLY. Issues a session for the most-recent user without Google — used by the
// iOS simulator to run the full flow before an iOS OAuth client is configured.
// Refuses to run in production.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  await ensureSchema();
  // Prefer a user who has committed memory (a real, likely-funded account) so the
  // simulator demo is live end-to-end; otherwise fall back to the most recent.
  const rows = (await sql`
    SELECT u.google_sub, u.email, u.name, u.picture, u.wallet_address
    FROM users u
    LEFT JOIN memory_docs d ON d.user_id = lower(u.wallet_address)
    ORDER BY (d.user_id IS NOT NULL) DESC, u.last_login_at DESC
    LIMIT 1`) as Record<string, unknown>[];
  const u = rows[0];
  if (!u) return NextResponse.json({ error: "no users yet — sign in on the web once" }, { status: 404 });

  const token = await issueSession({
    sub: String(u.google_sub),
    email: String(u.email),
    wallet: String(u.wallet_address),
  });
  return NextResponse.json({
    address: u.wallet_address,
    email: u.email,
    name: u.name,
    picture: u.picture,
    isNew: false,
    token,
  });
}
