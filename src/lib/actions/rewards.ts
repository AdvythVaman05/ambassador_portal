"use server";

import { db } from "@/lib/db";
import { getActionUser, getActionAdmin } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { canClaim, syncEarnedGrants } from "@/lib/rewards";
import { tierLabel } from "@/lib/signal";
import { issueCertificate } from "@/lib/certificates";
import { audit, revalidateConsoles } from "@/lib/audit";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { truncate } from "@/lib/validation";

export async function claimReward(rewardId: string, detail?: string): Promise<ActionResult> {
  const key = await clientKey("claim");
  const limited = await rateLimit(key, LIMITS.claim.limit, LIMITS.claim.windowMs);
  if (!limited.ok) {
    return fail("You are claiming very quickly. Try again in a few minutes.");
  }

  const { user, error } = await getActionUser();
  if (!user) return fail(error ?? "Sign in first.");

  const reward = await db.reward.findUnique({ where: { id: rewardId } });
  if (!reward) return fail("That reward no longer exists.");

  const membership = user.membership!;
  // The gates used to live only in the panel's render. Post straight at the action and they
  // were never applied, so any ambassador could file a claim for anything.
  const blocked = canClaim({
    tier: membership.tier,
    signalTotal: membership.signalTotal,
    tierGate: reward.tierGate,
    signalGate: reward.signalGate,
  });
  if (blocked === "not_your_tier") return fail(`This unlocks at ${tierLabel(reward.tierGate)} tier.`);
  if (blocked === "below_signal") return fail(`This needs ${reward.signalGate - membership.signalTotal} more Signal.`);

  await syncEarnedGrants(user.id);
  const grant = await db.rewardGrant.findUnique({ where: { userId_rewardId: { userId: user.id, rewardId } } });
  if (!grant || grant.status === "locked") return fail("This reward is not marked earned yet. Reload and try again.");
  if (grant.status === "claimed" || grant.status === "fulfilled") return fail("You have already claimed this.");

  let detailToStore: string | null = null;
  if (reward.fulfilmentType === "shipped") {
    const address = String(detail ?? "").trim();
    if (address.length < 10) return fail("Give a full shipping address, not a short note.");
    detailToStore = truncate(address, 600);
  } else if (reward.fulfilmentType === "scheduled") {
    detailToStore = detail ? truncate(String(detail).trim(), 600) : null;
  }
  // digital / none: nothing free-text is accepted, so a claim cannot smuggle a payload in.

  const flipped = await db.rewardGrant.updateMany({
    where: { id: grant.id, status: "earned" },
    data: { status: "claimed", detail: detailToStore, claimedAt: new Date() },
  });
  if (flipped.count === 0) return fail("That reward was just claimed elsewhere. Reload the panel.");

  await audit({ actorId: user.id, action: "reward.claimed", target: `${reward.code}:${grant.id}` });
  revalidateConsoles();
  return ok(undefined, `Claimed. A ${reward.fulfilmentType === "shipped" ? "delivery date will follow" : "reviewer will follow up"}.`);
}

export async function fulfillGrant(grantId: string): Promise<ActionResult> {
  const { user, error } = await getActionAdmin();
  if (!user) return fail(error ?? "Only an admin can fulfil rewards.");

  const grant = await db.rewardGrant.findUnique({ where: { id: grantId }, include: { reward: true, user: { select: { name: true } } } });
  if (!grant) return fail("That grant no longer exists.");
  if (grant.status === "fulfilled") return fail("Already fulfilled.");
  if (grant.status !== "claimed") return fail("The ambassador has not claimed this yet.");

  // The certificate is the one reward whose fulfilment has to create a record, because the
  // public verify page reads a Certificate row. Issuing first means a failed issuance cannot
  // be hidden behind a "fulfilled" tick.
  if (grant.reward.code === "certificate") {
    const issued = await issueCertificate(grant.userId);
    if (!issued.ok) return fail(issued.error);
  }

  await db.rewardGrant.update({ where: { id: grant.id }, data: { status: "fulfilled", fulfilledAt: new Date() } });
  await audit({ actorId: user.id, action: "reward.fulfilled", target: `${grant.reward.code}:${grant.id}`, meta: { ambassadorId: grant.userId } });
  revalidateConsoles();
  return ok(undefined, `Marked fulfilled for ${grant.user.name}.`);
}

export async function revokeCertificateAction(userId: string, reason: string): Promise<ActionResult> {
  const { user, error } = await getActionAdmin();
  if (!user) return fail(error ?? "Only an admin can revoke a certificate.");

  const certificate = await db.certificate.findUnique({ where: { userId } });
  if (!certificate) return fail("That account has no certificate to revoke.");
  if (certificate.revokedAt) return fail("That certificate is already revoked.");

  const trimmed = truncate(String(reason ?? "").trim(), 300);
  if (trimmed.length < 10) return fail("Give a reason a verifier could read.");

  await db.certificate.update({
    where: { id: certificate.id },
    data: { revokedAt: new Date(), revokedById: user.id, revokeReason: trimmed },
  });
  await audit({ actorId: user.id, action: "certificate.revoked", target: certificate.publicId, meta: { reason: trimmed } });
  revalidateConsoles();
  return ok(undefined, "Certificate revoked. The public verify page now says so.");
}
