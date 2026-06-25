import { cookies } from "next/headers";

export const UID_COOKIE = "mirrl_uid";

// Resolves the anonymous user id from the cookie (set by middleware on page load).
// Falls back to minting one here for direct API hits.
export async function getUserId(): Promise<string> {
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
