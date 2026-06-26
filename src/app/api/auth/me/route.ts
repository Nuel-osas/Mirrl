import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";
import { findUserByGoogleSub } from "@/lib/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/me — current custodial user, or 401. */
export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const user = await findUserByGoogleSub(session.sub);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  return NextResponse.json({
    address: user.wallet_address,
    email: user.email,
    name: user.name,
    picture: user.picture,
    isExported: !!user.exported_at,
  });
}
