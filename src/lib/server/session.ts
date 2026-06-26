import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "mirrl_session";
const ALG = "HS256";
const SESSION_TTL = "7d";

function secret(): Uint8Array {
  const b64 = process.env.SESSION_SECRET;
  if (!b64) throw new Error("SESSION_SECRET not set");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export type SessionClaims = {
  sub: string; // google_sub
  email: string;
  wallet: string; // custodial 0G address
  iat?: number;
  exp?: number;
};

export async function issueSession(claims: Omit<SessionClaims, "iat" | "exp">) {
  const jwt = await new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const c = jar.get(COOKIE_NAME);
  if (!c?.value) return null;
  try {
    const { payload } = await jwtVerify(c.value, secret(), { algorithms: [ALG] });
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
