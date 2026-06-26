import { jwtVerify, createRemoteJWKSet } from "jose";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentity = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

/** Verify a Google ID token (JWT) against Google's published JWKS. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set");

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const sub = String(payload.sub ?? "");
  const email = String(payload.email ?? "");
  if (!sub || !email) throw new Error("Google JWT missing sub or email");
  if (payload.email_verified !== true) throw new Error("Google email not verified");

  return {
    sub,
    email,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}
