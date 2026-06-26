import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UID_COOKIE = "mirrl_uid";

// Ensure every visitor has a stable anonymous id before any client API call runs,
// so memories / sessions / prefs all resolve to the same user.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(UID_COOKIE)) {
    res.cookies.set(UID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"],
};
