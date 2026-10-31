export const ACCESS_COOKIE = "node_banana_session";
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string | null {
  return process.env.NODE_BANANA_AUTH_SECRET?.trim() || null;
}

export function accessAuthConfigured(): boolean {
  return Boolean(process.env.NODE_BANANA_ACCESS_PASSWORD?.trim() && secret());
}

function encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function signature(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function createAccessSession(now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000).toString();
  return `${issuedAt}.${await signature(issuedAt)}`;
}

export async function verifyAccessSession(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!accessAuthConfigured() || !value) return false;
  const [issuedAt, provided] = value.split(".");
  const timestamp = Number(issuedAt);
  if (!/^\d+$/.test(issuedAt) || !provided || !Number.isSafeInteger(timestamp)) return false;
  const age = Math.floor(now / 1000) - timestamp;
  if (age < 0 || age > ACCESS_MAX_AGE_SECONDS) return false;
  return sameString(provided, await signature(issuedAt));
}
