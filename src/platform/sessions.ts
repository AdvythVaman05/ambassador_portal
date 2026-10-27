const encoder = new TextEncoder();

export const sessionCookieName = "campus_scouts_session";
export const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

export function newSessionToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
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
