// Runs in both the proxy and route handlers, so it sticks to Web Crypto.

export const SESSION_COOKIE = "daybook_session";
export const SESSION_DAYS = 180;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function equalStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, now: number = Date.now()): Promise<string> {
  const issued = String(Math.floor(now / 1000));
  return `${issued}.${await hmac(secret, `daybook:v1:${issued}`)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [issued, signature] = token.split(".");
  if (!issued || !signature || !/^\d+$/.test(issued)) return false;
  const ageSeconds = now / 1000 - Number(issued);
  if (ageSeconds < 0 || ageSeconds > SESSION_DAYS * 86_400) return false;
  return equalStrings(signature, await hmac(secret, `daybook:v1:${issued}`));
}

/** Compares through HMAC so the comparison time does not depend on where the strings differ. */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const salt = "daybook:compare";
  return equalStrings(await hmac(salt, provided), await hmac(salt, expected));
}

export function bearerToken(header: string | null): string | null {
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  return match ? match[1].trim() : null;
}
