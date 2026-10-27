import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { loginInputSchema, SessionService } from "@/platform/identity";
import { platformRepositoryFromEnvironment } from "@/platform/service";
import { sessionCookieName } from "@/platform/sessions";

export const loginServer = createServerFn({ method: "POST" })
  .validator(loginInputSchema)
  .handler(async ({ data }) => {
    const configured = platformRepositoryFromEnvironment(process.env);
    const session = await new SessionService(configured.repository).login(data);
    setCookie(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(configured.environment.APP_ORIGIN).protocol === "https:",
      expires: session.expiresAt,
    });
    return { roles: session.user.roles };
  });

export const currentSessionServer = createServerFn({ method: "GET" }).handler(async () => {
  const configured = platformRepositoryFromEnvironment(process.env);
  return new SessionService(configured.repository).getUser(getCookie(sessionCookieName));
});

export const logoutServer = createServerFn({ method: "POST" }).handler(async () => {
  const configured = platformRepositoryFromEnvironment(process.env);
  await new SessionService(configured.repository).logout(getCookie(sessionCookieName));
  deleteCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(configured.environment.APP_ORIGIN).protocol === "https:",
  });
  return { ok: true };
});
