import { z } from "zod";
import type { PlatformRepository } from "./repository";
import { hashSessionToken, newSessionToken, sessionExpiry } from "./sessions";
import { verifyPassword } from "./passwords";

export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
  }
}

export class SessionService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly sessionSecret: string,
  ) {}

  async login(input: unknown) {
    const values = loginInputSchema.parse(input);
    const account = await this.repository.findUserCredentials(values.email.toLowerCase());
    if (
      !account ||
      account.suspendedAt ||
      !account.passwordHash ||
      !(await verifyPassword(values.password, account.passwordHash))
    ) {
      throw new InvalidCredentialsError();
    }
    const token = newSessionToken();
    const expiresAt = sessionExpiry();
    await this.repository.createSession({
      userId: account.id,
      tokenHash: await hashSessionToken(token, this.sessionSecret),
      expiresAt,
    });
    return {
      token,
      expiresAt,
      user: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        roles: account.roles,
      },
    };
  }

  async getUser(token: string | undefined) {
    if (!token) return undefined;
    const keyed = await hashSessionToken(token, this.sessionSecret);
    return (
      (await this.repository.findSessionUser(keyed)) ??
      this.repository.findSessionUser(await hashSessionToken(token))
    );
  }

  async logout(token: string | undefined) {
    if (!token) return;
    const keyed = await hashSessionToken(token, this.sessionSecret);
    await this.repository.revokeSession(keyed);
    // Revoke a pre-HMAC session too, allowing a rollout without leaving legacy sessions behind.
    await this.repository.revokeSession(await hashSessionToken(token));
  }
}
