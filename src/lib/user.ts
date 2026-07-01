import { cookies } from "next/headers";
import { readSession } from "@/lib/server/session";

export const UID_COOKIE = "mirrl_uid";

// Resolves the id that owns memory / sessions / prefs.
//
// Signed in → the custodial WALLET address (lowercased). This is the same key the
// on-chain MirrlMemory registry uses, so DB and chain agree, and memory follows
// the user across devices. The wallet rides in the session JWT — no DB call.
//
// Signed out → the anonymous cookie id (set by middleware / minted here).
export async function getUserId(): Promise<string> {
  const session = await readSession();
  if (session?.wallet) return session.wallet.toLowerCase();

  const jar = await cookies();
  let id = jar.get(UID_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    try {
      jar.set(UID_COOKIE, id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    } catch {
      // cookies() is read-only in some contexts; the middleware will set it.
    }
  }
  return id;
}
