import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

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

// Issues the session JWT. Sets it as an httpOnly cookie (web) AND returns it, so
// native clients (iOS) can store it and send it as a Bearer token instead.
export async function issueSession(claims: Omit<SessionClaims, "iat" | "exp">): Promise<string> {
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
  return jwt;
}

// Reads the session from the cookie (web) or an `Authorization: Bearer <jwt>`
// header (native app). Same signed JWT either way.
export async function readSession(): Promise<SessionClaims | null> {
  let token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    const auth = (await headers()).get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  }
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
