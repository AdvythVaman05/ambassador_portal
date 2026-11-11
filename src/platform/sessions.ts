const encoder = new TextEncoder();

export const sessionCookieName = "campus_scouts_session";
export const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

export function newSessionToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (part) => part.toString(16).padStart(2, "0")).join("");
}

/** Legacy SHA-256 hashes remain readable so rotating to keyed hashes does not revoke existing sessions. */
export async function hashSessionToken(token: string, secret?: string) {
  let digest: ArrayBuffer;
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    digest = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  } else {
    digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  }
  return hex(new Uint8Array(digest));
}

export function sessionExpiry(now = new Date()) {
  return new Date(now.getTime() + sessionLifetimeMs);
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean) {
  return `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()};${secure ? " Secure;" : ""}`;
}

export function clearSessionCookie(secure: boolean) {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${secure ? " Secure;" : ""}`;
}
