import { describe, expect, it } from "vitest";
import { DevelopmentRepository } from "../platform/dev-repository";
import { InvalidCredentialsError, SessionService } from "../platform/identity";
import { hashPassword } from "../platform/passwords";
import { hashSessionToken } from "../platform/sessions";
import { activateInvitation } from "../platform/onboarding";

describe("SessionService", () => {
  const sessionSecret = "test-session-secret-that-is-long-enough-for-validation";
  it("creates an opaque session and revokes it on logout", async () => {
    const repo = new DevelopmentRepository();
    repo.users.set("scout", {
      id: "scout",
      email: "scout@example.test",
      displayName: "Scout",
      roles: ["scout"],
    });
    repo.credentials.set("scout", await hashPassword("long-enough-password"));
    const service = new SessionService(repo, sessionSecret);
    const login = await service.login({
      email: "scout@example.test",
      password: "long-enough-password",
    });
    expect(login.token).not.toContain("scout");
    expect(await service.getUser(login.token)).toMatchObject({ id: "scout" });
    await service.logout(login.token);
    expect(await service.getUser(login.token)).toBeUndefined();
    expect(repo.sessions.get(await hashSessionToken(login.token, sessionSecret))?.revoked).toBe(
      true,
    );
  });

  it("rejects bad credentials without creating a session", async () => {
    const repo = new DevelopmentRepository();
    repo.users.set("admin", {
      id: "admin",
      email: "admin@example.test",
      displayName: "Admin",
      roles: ["admin"],
    });
    repo.credentials.set("admin", await hashPassword("long-enough-password"));
    await expect(
      new SessionService(repo, sessionSecret).login({
        email: "admin@example.test",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(repo.sessions.size).toBe(0);
  });

  it("continues to recognise and revoke legacy SHA-256 sessions", async () => {
    const repo = new DevelopmentRepository();
    repo.users.set("admin", {
      id: "admin",
      email: "admin@example.test",
      displayName: "Admin",
      roles: ["admin"],
    });
    const legacyToken = "legacy-session-token";
    await repo.createSession({
      userId: "admin",
      tokenHash: await hashSessionToken(legacyToken),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const service = new SessionService(repo, sessionSecret);
    expect(await service.getUser(legacyToken)).toMatchObject({ id: "admin" });
    await service.logout(legacyToken);
    expect(await service.getUser(legacyToken)).toBeUndefined();
  });

  it("activates an invitation exactly once", async () => {
    const repo = new DevelopmentRepository();
    const invite = await repo.createInvite("invited@example.test", "scout");
    const account = await activateInvitation(repo, {
      token: invite.rawToken,
      displayName: "Invited Scout",
      password: "long-enough-password",
    });
    expect(account.roles).toContain("scout");
    await expect(
      activateInvitation(repo, {
        token: invite.rawToken,
        displayName: "Again",
        password: "long-enough-password",
      }),
    ).rejects.toThrow("invalid or expired");
  });
});
