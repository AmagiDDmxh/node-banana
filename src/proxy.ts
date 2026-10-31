import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessAuthConfigured, verifyAccessSession } from "@/lib/accessAuth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/") || path.startsWith("/_next/") || path.startsWith("/sample-images/") || path.startsWith("/template-thumbnails/") || path === "/favicon.ico" || path === "/icon.png") return NextResponse.next();
  if (process.env.NODE_ENV !== "production" && !accessAuthConfigured()) return NextResponse.next();
  if (await verifyAccessSession(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
