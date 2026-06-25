import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Prefs = {
  theme: "dark" | "light";
  network: "testnet" | "mainnet";
  model: string;
  signedIn: boolean;
  activeSession: string | null;
};

function toPrefs(r: Record<string, unknown>): Prefs {
  return {
    theme: r.theme === "light" ? "light" : "dark",
    network: r.network === "testnet" ? "testnet" : "mainnet",
    model: String(r.model ?? ""),
    signedIn: Boolean(r.signed_in),
    activeSession: (r.active_session as string | null) ?? null,
  };
}

export async function GET() {
  await ensureSchema();
  const uid = await getUserId();
  const rows = await sql`
    INSERT INTO user_prefs (user_id) VALUES (${uid})
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING theme, network, model, signed_in, active_session`;
  return NextResponse.json({ prefs: toPrefs(rows[0]) });
}

export async function PUT(req: NextRequest) {
  await ensureSchema();
  const uid = await getUserId();
  const p = (await req.json()) as Partial<Prefs>;
  // distinguish "not provided" (keep existing) from "provided as null" (clear)
  const touchActive = Object.prototype.hasOwnProperty.call(p, "activeSession");
  const activeValue = p.activeSession ?? null;
  const rows = await sql`
    INSERT INTO user_prefs (user_id, theme, network, model, signed_in, active_session, updated_at)
    VALUES (
      ${uid},
      ${p.theme ?? "dark"},
      ${p.network ?? "mainnet"},
      ${p.model ?? ""},
      ${p.signedIn ?? false},
      ${touchActive ? activeValue : null},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      theme          = COALESCE(${p.theme ?? null}, user_prefs.theme),
      network        = COALESCE(${p.network ?? null}, user_prefs.network),
      model          = COALESCE(${p.model ?? null}, user_prefs.model),
      signed_in      = COALESCE(${p.signedIn ?? null}, user_prefs.signed_in),
      active_session = CASE WHEN ${touchActive} THEN ${activeValue} ELSE user_prefs.active_session END,
      updated_at     = now()
    RETURNING theme, network, model, signed_in, active_session`;
  return NextResponse.json({ prefs: toPrefs(rows[0]) });
}
