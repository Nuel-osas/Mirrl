import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyGoogleIdToken } from "@/lib/server/google-auth";
import { findUserByGoogleSub, createUserWithWallet, touchLogin } from "@/lib/server/users";
import { issueSession } from "@/lib/server/session";
import { linkAnonToWallet } from "@/lib/db";
import { UID_COOKIE } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/auth/google  { idToken }
 * Verifies a Google ID token, mints a custodial 0G wallet on first sign-in
 * (private key AES-encrypted at rest), and issues a session cookie.
 */
export async function POST(req: Request) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.idToken) return NextResponse.json({ error: "idToken required" }, { status: 400 });

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.idToken);
  } catch (e) {
    return NextResponse.json(
      { error: `invalid Google token: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 401 },
    );
  }

  let user = await findUserByGoogleSub(identity.sub);
  let isNew = false;
  if (!user) {
    user = await createUserWithWallet({
      googleSub: identity.sub,
      email: identity.email,
      name: identity.name ?? null,
      picture: identity.picture ?? null,
    });
    isNew = true;
  } else {
    await touchLogin(identity.sub);
  }

  // Carry any memory built anonymously (under the cookie id) onto the wallet key.
  const anonUid = (await cookies()).get(UID_COOKIE)?.value;
  if (anonUid) {
    try {
      await linkAnonToWallet(anonUid, user.wallet_address);
    } catch {
      // non-fatal — sign-in still succeeds even if migration hiccups
    }
  }

  await issueSession({ sub: identity.sub, email: user.email, wallet: user.wallet_address });

  return NextResponse.json({
    address: user.wallet_address,
    email: user.email,
    name: user.name,
    picture: user.picture,
    isNew,
  });
}
