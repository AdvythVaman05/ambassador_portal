import { z } from "zod";
import type { PlatformRepository } from "./repository";
import { hashPassword } from "./passwords";
import { hashSessionToken } from "./sessions";

const activationSchema = z.object({
  token: z.string().min(32),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(256),
});

/** Consumes an invitation exactly once inside the caller's transaction. */
export async function activateInvitation(repository: PlatformRepository, input: unknown) {
  const data = activationSchema.parse(input);
  return repository.transaction(async (transaction) => {
    const invite = await transaction.findInviteByTokenHash(await hashSessionToken(data.token));
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date())
      throw new Error("Invitation is invalid or expired");
    return transaction.acceptInvite({
      inviteId: invite.id,
      displayName: data.displayName,
      passwordHash: await hashPassword(data.password),
    });
  });
}
