import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ACCESS_COOKIE, ACCESS_MAX_AGE_SECONDS, accessAuthConfigured, createAccessSession } from "@/lib/accessAuth";

function passwordMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

export async function POST(request: Request) {
  if (!accessAuthConfigured()) return NextResponse.json({ error: "Access password is not configured." }, { status: 503 });
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.NODE_BANANA_ACCESS_PASSWORD!;
  if (!passwordMatches(password, expected)) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, await createAccessSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}
