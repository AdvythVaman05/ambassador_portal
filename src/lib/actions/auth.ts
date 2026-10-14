"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, devSignInEnabled, loginWithPassword } from "@/lib/auth";
import { sendSignInLink } from "@/lib/provision";
import { emailInput } from "@/lib/validation";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export type SignInState = { ok: boolean; error?: string; message?: string };

const GENERIC = "If that address has an account, a sign-in link is on its way. It works once and expires in 15 minutes.";

/**
 * Requests a magic link.
 *
 * The reply is deliberately the same whether the address exists, is suspended, or was never
 * heard of: this form is public, and three different messages is a membership list.
 */
export async function requestSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const key = await clientKey("magiclink");
  const limited = await rateLimit(key, LIMITS.magicLink.limit, LIMITS.magicLink.windowMs);
  if (!limited.ok) {
    return { ok: false, error: `Too many link requests from this connection. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.` };
  }

  const parsed = emailInput.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return { ok: true, message: GENERIC };

  const result = await sendSignInLink(parsed.data);
  if (!result.sent && !result.skipped) {
    // A delivery failure is the one case worth saying out loud — otherwise someone waits
    // for an email that was never attempted.
    return { ok: false, error: "We could not send the link just now. Try again in a minute." };
  }
  return { ok: true, message: GENERIC };
}

/**
 * Email and password. Same session machinery as the magic link — a revocable row — so
 * signing in one way does not leave a second, weaker kind of cookie behind.
 */
export async function passwordSignIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const key = await clientKey("password:" + email.slice(0, 60));
  const limited = await rateLimit(key, LIMITS.passwordLogin.limit, LIMITS.passwordLogin.windowMs);
  if (!limited.ok) {
    return { ok: false, error: `Too many attempts for that address. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes, or email yourself a link.` };
  }

  const result = await loginWithPassword(email, password);
  if ("error" in result) {
    await audit({ actorId: null, action: result.error === "suspended" ? "auth.login_suspended" : "auth.login_failed", target: email });
    return {
      ok: false,
      error:
        result.error === "suspended"
          ? "That account is suspended. Ask your campus lead to reinstate it."
          : "Email or password is wrong.",
    };
  }

  await createSession(result.user.id, "password");
  await audit({ actorId: result.user.id, action: "auth.login_password", target: result.email });
  redirect(result.user.role === "admin" || result.user.role === "reviewer" ? "/admin" : result.user.membership ? "/home" : "/apply");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

/**
 * Preview-only. Hands a session to whoever is named on the sign-in page, with no credential
 * at all, so it is refused outright outside a local dev server even if the flag is left on.
 */
export async function devSignInAs(userId: string): Promise<void> {
  // Dev-only skeleton key. Guarded server-side, not just by hiding the picker.
  if (!devSignInEnabled()) redirect("/");
  const user = await db.user.findUnique({ where: { id: String(userId ?? "") }, select: { id: true, role: true } });
  if (!user) redirect("/");

  await createSession(user.id, "dev-picker");
  await audit({ actorId: user.id, action: "auth.dev_signin", target: user.id });
  redirect(user.role === "admin" || user.role === "reviewer" ? "/admin" : "/home");
}
