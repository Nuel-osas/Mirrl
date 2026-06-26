import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secret(): Uint8Array {
  const b64 = process.env.SESSION_SECRET;
  if (!b64) throw new Error("SESSION_SECRET not set");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.mirrl.app/mcp";

// Issue a per-user MCP access token scoped to their namespace, for pasting into
// Claude / Cursor / any MCP client. Requires a signed-in (Google) session.
export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const token = await new SignJWT({ sub: session.sub, wallet: session.wallet, scope: "mcp" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  return NextResponse.json({ token, mcpUrl: MCP_URL, wallet: session.wallet });
}
