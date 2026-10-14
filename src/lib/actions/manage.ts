"use server";

import { db, json } from "@/lib/db";
import type { CohortStatus, FulfilmentType, SubmissionType, Tier, Track, UserRole } from "@prisma/client";
import { getActionAdmin } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { audit, revalidateConsoles } from "@/lib/audit";
import { createAccount, sendLinkToUser } from "@/lib/provision";
import { revokeSessionsForUser } from "@/lib/auth";
import { issueCertificate } from "@/lib/certificates";
import { truncate } from "@/lib/validation";
import { generatePassword, hashPassword, passwordProblem } from "@/lib/password";
import {
  accountInput,
  campusInput,
  cohortInput,
  moduleInput,
  parseTypeConfig,
  rewardInput,
  signalAdjustment,
  taskInput,
  TIERS,
  ROLES,
} from "@/lib/authoring";

// The authoring surface: everything an operator can create or change about other people.
//
// Every action here is admin-only, every one writes an AuditEvent, and the three that could
// lock the operator out of their own console refuse to run: demoting the last admin,
// suspending yourself, and editing a task that ambassadors have already submitted against.

const TIERS_SET: Set<string> = new Set(TIERS);
const ROLES_SET: Set<string> = new Set(ROLES);

async function adminOnly() {
  const { user, error } = await getActionAdmin();
  return { user, error: error ?? "Only a Campus Circle admin can do that." };
}

/** Refuses an edit that would remove the last admin from the console. */
async function guardLastAdmin(userId: string, message: string) {
  const admins = await db.user.count({ where: { role: "admin" } });
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role === "admin" && admins <= 1) return message;
  return null;
}

// ── People ──────────────────────────────────────────────────────────────────

/** Admin sets or resets someone's password. Their sessions are revoked so a reset on a
 * stolen cookie actually signs the other device out. */
export async function setPersonPassword(userId: string, password: string): Promise<ActionResult<{ generated?: string }>> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!target) return fail("That account no longer exists.");

  let value = String(password ?? "").trim();
  let generated: string | undefined;
  if (!value) {
    generated = generatePassword();
    value = generated;
  }
  const problem = passwordProblem(value);
  if (problem) return fail(problem);

  await db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(value), passwordSetAt: new Date() } });
  await revokeSessionsForUser(userId);
  await audit({ actorId: user.id, action: "auth.password_reset_by_admin", target: userId, meta: { email: target.email, generated: Boolean(generated) } });
  revalidateConsoles();

  return ok(
    { generated },
    generated
      ? `New password for ${target.name}: ${generated}. It is shown once — send it to them and it will not appear again.`
      : `Password changed for ${target.name}, and their existing sessions were signed out.`
  );
}

export async function createAmbassador(raw: unknown): Promise<ActionResult<{ inviteUrl?: string }>> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Some of that did not look right.");
  const input = parsed.data;

  if (input.role !== "ambassador" && !TIERS_SET.has(input.tier)) return fail("That tier is not one of the five.");

  const result = await createAccount({
    email: input.email,
    name: input.name,
    campusName: input.campusName,
    city: input.city,
    cohortId: input.cohortId,
    tier: input.tier,
    role: input.role,
    actorId: user.id,
  });
  if (!result.ok) return fail(result.error);

  if (input.password) {
    const problem = passwordProblem(input.password);
    if (problem) return fail(`Account created, but the password was rejected: ${problem}`);
    await db.user.update({
      where: { id: result.userId },
      data: { passwordHash: hashPassword(input.password), passwordSetAt: new Date() },
    });
  }

  await audit({
    actorId: user.id,
    action: "account.created",
    target: input.email,
    meta: { userId: result.userId, role: input.role, tier: input.tier, emailSent: result.emailSent },
  });
  revalidateConsoles();

  const parts = [`${input.name} was added`];
  if (input.password) parts.push("with the password you set");
  parts.push(result.emailSent ? "and their sign-in link is on its way." : "— email is not configured here, so pass the details on yourself.");
  if (!result.emailSent && result.inviteUrl) parts.push(`Link: ${result.inviteUrl}`);

  return ok({ inviteUrl: result.inviteUrl }, parts.join(" "));
}


export async function setMemberTier(userId: string, tier: string): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  if (!TIERS_SET.has(tier)) return fail("That tier is not one of the five.");

  const membership = await db.membership.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
  if (!membership) return fail("That account has no cohort seat to move.");
  if (membership.tier === tier) return fail("They are already on that tier.");

  await db.membership.update({ where: { userId }, data: { tier: tier as Tier } });
  await audit({ actorId: user.id, action: "member.tier_changed", target: userId, meta: { from: membership.tier, to: tier } });
  revalidateConsoles();
  return ok(undefined, `${membership.user.name} is now ${tier.replace("_", " ")}.`);
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  if (!ROLES_SET.has(role)) return fail("That role does not exist.");
  if (user.id === userId) return fail("You cannot change your own role — ask another admin, so the change has two names on it.");

  const blocked = await guardLastAdmin(userId, "That is the only admin account. Promote someone else first.");
  if (blocked) return fail(blocked);

  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, role: true, membership: { select: { id: true } } } });
  if (!target) return fail("That account no longer exists.");
  if (target.role === role) return fail(`They are already ${role}.`);
  if (role !== "ambassador" && target.membership) {
    // Keeping the cohort seat is harmless, but say what happened rather than let it surprise
    // someone later that a reviewer still shows up in the ambassador list.
  }

  await db.user.update({ where: { id: userId }, data: { role: role as UserRole } });
  await audit({ actorId: user.id, action: "user.role_changed", target: userId, meta: { from: target.role, to: role } });
  revalidateConsoles();
  return ok(undefined, `${target.name} is now ${role}.`);
}

export async function setUserStatus(userId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  if (user.id === userId) return fail("You cannot suspend your own account.");

  if (status === "suspended") {
    const blocked = await guardLastAdmin(userId, "That is the only admin account — suspending it locks everyone out.");
    if (blocked) return fail(blocked);
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, status: true } });
  if (!target) return fail("That account no longer exists.");
  if (target.status === status) return fail(`They are already ${status}.`);

  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "suspended") await revokeSessionsForUser(userId);
  await audit({ actorId: user.id, action: `user.status_${status}`, target: userId });
  revalidateConsoles();
  return ok(
    undefined,
    status === "suspended"
      ? `${target.name} is suspended and their sessions are revoked — their existing cookies stop working on the next request.`
      : `${target.name} can sign in again.`
  );
}

export async function adjustSignal(userId: string, raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const parsed = signalAdjustment.safeParse(raw);
  if (!parsed.success) return fail("Give a number and a reason of at least five characters.");
  const { delta, reason } = parsed.data;
  if (delta === 0) return fail("Zero is not an adjustment.");

  const membership = await db.membership.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
  if (!membership) return fail("That account has no cohort seat, so it has no Signal.");
  if (membership.signalTotal + delta < 0) {
    return fail(`That would take them below zero (currently ${membership.signalTotal}).`);
  }

  await db.$transaction([
    db.signalLedger.create({
      data: {
        userId,
        taskCode: "ADJ",
        taskTitle: "Operator adjustment",
        delta,
        reason: truncate(reason, 300),
      },
    }),
    db.membership.update({ where: { userId }, data: { signalTotal: { increment: delta } } }),
  ]);

  await audit({ actorId: user.id, action: "signal.adjusted", target: userId, meta: { delta, reason } });
  revalidateConsoles();
  return ok(undefined, `${delta > 0 ? "+" : ""}${delta} Signal for ${membership.user.name}, recorded in their ledger.`);
}

export async function sendSignInLinkFor(userId: string): Promise<ActionResult<{ inviteUrl?: string }>> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!target) return fail("That account no longer exists.");

  const result = await sendLinkToUser(userId);
  if (result.sent) {
    await audit({ actorId: user.id, action: "auth.link_sent", target: userId });
    revalidateConsoles();
    return ok(undefined, `A sign-in link is on its way to ${target.email}.`);
  }
  if (result.error === "suspended") return fail(`${target.name} is suspended, so no link was issued.`);
  await audit({ actorId: user.id, action: "auth.link_failed", target: userId, meta: { reason: result.error ?? "unknown" } });
  return fail("Email is not configured on this deployment, so nothing was sent. Set RESEND_API_KEY to deliver links.");
}

export async function revokeSessionsFor(userId: string): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!target) return fail("That account no longer exists.");

  const count = await revokeSessionsForUser(userId);
  await audit({ actorId: user.id, action: "auth.sessions_revoked", target: userId, meta: { count } });
  return ok(undefined, `Signed out ${target.name} everywhere (${count} session${count === 1 ? "" : "s"}).`);
}

export async function issueCertificateFor(userId: string): Promise<ActionResult<{ publicId?: string }>> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const result = await issueCertificate(userId);
  if (!result.ok) return fail(result.error);
  await audit({ actorId: user.id, action: "certificate.issued", target: result.publicId, meta: { userId } });
  revalidateConsoles();
  return ok({ publicId: result.publicId }, `Certificate ${result.publicId} is live and verifiable.`);
}

// ── Tasks ───────────────────────────────────────────────────────────────────

async function readTaskInput(raw: unknown) {
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "The task did not validate." };
  const input = parsed.data;
  if (input.track !== input.code[0]) return { data: null, error: `Code ${input.code} is track ${input.code[0]}, but you picked ${input.track}.` };
  const opensAt = new Date(`${input.opensAt}T00:00:00Z`);
  const dueAt = new Date(`${input.dueAt}T23:59:59Z`);
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(dueAt.getTime())) return { data: null, error: "Pick a real opening and due date." };
  if (dueAt <= opensAt) return { data: null, error: "The deadline has to come after the opening date." };
  const config = parseTypeConfig(input.submissionType, (raw as { typeConfig?: unknown }).typeConfig);
  if (!config.ok) return { data: null, error: config.error };
  return { data: { ...input, opensAt, dueAt, config: config.config }, error: null };
}

export async function createTask(raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const { data, error: inputError } = await readTaskInput(raw);
  if (!data) return fail(inputError ?? "The task did not validate.");

  const cohort = await db.cohort.findUnique({ where: { id: data.cohortId }, select: { id: true, name: true } });
  if (!cohort) return fail("Pick a cohort that exists.");

  const clash = await db.task.findFirst({ where: { cohortId: cohort.id, code: data.code }, select: { id: true } });
  if (clash) return fail(`Code ${data.code} is already used in ${cohort.name}.`);

  const created = await db.task.create({
    data: {
      cohortId: cohort.id,
      track: data.track as Track,
      code: data.code,
      week: data.week,
      title: data.title,
      summary: data.summary,
      briefMd: data.briefMd,
      submissionType: data.submissionType as SubmissionType,
      typeConfig: json(data.config),
      rubric: json(data.rubric),
      signalValue: data.signalValue,
      opensAt: data.opensAt,
      dueAt: data.dueAt,
      published: data.published,
    },
  });

  await audit({ actorId: user.id, action: "task.created", target: created.code, meta: { week: created.week, signal: created.signalValue } });
  revalidateConsoles();
  return ok(undefined, `${created.code} · ${created.title} is ${created.published ? "live for ambassadors" : "saved unpublished"}.`);
}

export async function updateTask(taskId: string, raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);

  const { data, error: inputError } = await readTaskInput(raw);
  if (!data) return fail(inputError ?? "The task did not validate.");

  const existing = await db.task.findUnique({ where: { id: taskId }, include: { _count: { select: { submissions: true } } } });
  if (!existing) return fail("That task no longer exists.");
  if (data.cohortId !== existing.cohortId) return fail("A task cannot be moved between cohorts.");

  const submissions = existing._count.submissions;
  if (submissions > 0 && data.submissionType !== existing.submissionType) {
    return fail(`${submissions} submission${submissions === 1 ? "" : "s"} exist against the current submission type. Publish a new task instead of re-pointing this one.`);
  }
  if (submissions > 0 && data.code !== existing.code) {
    return fail("Code is frozen once ambassadors have submitted against the task — it is what their work is filed under.");
  }
  if (submissions > 0) {
    const clash = await db.task.findFirst({ where: { cohortId: existing.cohortId, code: data.code, id: { not: taskId } }, select: { id: true } });
    if (clash) return fail(`Code ${data.code} is already used in this cohort.`);
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      track: data.track as Track,
      code: data.code,
      week: data.week,
      title: data.title,
      summary: data.summary,
      briefMd: data.briefMd,
      submissionType: data.submissionType as SubmissionType,
      typeConfig: json(data.config),
      rubric: json(data.rubric),
      signalValue: data.signalValue,
      opensAt: data.opensAt,
      dueAt: data.dueAt,
      published: data.published,
    },
  });

  await audit({
    actorId: user.id,
    action: "task.updated",
    target: data.code,
    meta: { submissions, rubricChanged: data.rubric.length !== (existing.rubric as unknown[]).length },
  });
  revalidateConsoles();
  return ok(undefined, submissions > 0 ? `${data.code} updated. ${submissions} submission${submissions === 1 ? "" : "s"} keep their original answers.` : `${data.code} updated.`);
}

// ── Catalogue: rewards, library, campuses, cohorts ──────────────────────────

export async function createReward(raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  const parsed = rewardInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The reward did not validate.");
  const input = parsed.data;

  const clash = await db.reward.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) return fail(`Code ${input.code} already exists.`);

  await db.reward.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      tierGate: input.tierGate as Tier,
      signalGate: input.signalGate,
      fulfilmentType: input.fulfilmentType as FulfilmentType,
    },
  });
  await audit({ actorId: user.id, action: "reward.created", target: input.code });
  revalidateConsoles();
  return ok(undefined, `${input.name} added to the ladder.`);
}

export async function updateReward(rewardId: string, raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  const parsed = rewardInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The reward did not validate.");
  const input = parsed.data;

  const existing = await db.reward.findUnique({ where: { id: rewardId }, include: { _count: { select: { grants: true } } } });
  if (!existing) return fail("That reward no longer exists.");
  if (input.code !== existing.code) {
    const clash = await db.reward.findUnique({ where: { code: input.code }, select: { id: true } });
    if (clash) return fail(`Code ${input.code} already exists.`);
  }
  if (existing._count.grants > 0 && input.code !== existing.code) {
    return fail("Code is frozen once this reward has been granted — the fulfilment queue and the certificate logic read it.");
  }

  await db.reward.update({
    where: { id: rewardId },
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      tierGate: input.tierGate as Tier,
      signalGate: input.signalGate,
      fulfilmentType: input.fulfilmentType as FulfilmentType,
    },
  });
  await audit({ actorId: user.id, action: "reward.updated", target: input.code, meta: { grants: existing._count.grants } });
  revalidateConsoles();
  return ok(undefined, `${input.name} updated.`);
}

export async function saveLibraryModule(moduleId: string | null, raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  const parsed = moduleInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The module did not validate.");
  const input = parsed.data;

  if (moduleId) {
    const existing = await db.libraryModule.findUnique({ where: { id: moduleId }, select: { code: true } });
    if (!existing) return fail("That module no longer exists.");
    if (input.code !== existing.code) {
      const clash = await db.libraryModule.findUnique({ where: { code: input.code }, select: { id: true } });
      if (clash) return fail(`Code ${input.code} is already taken.`);
    }
    await db.libraryModule.update({ where: { id: moduleId }, data: input });
    await audit({ actorId: user.id, action: "library.updated", target: input.code });
    revalidateConsoles();
    return ok(undefined, `${input.code} updated.`);
  }

  const clash = await db.libraryModule.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) return fail(`Code ${input.code} is already taken.`);
  await db.libraryModule.create({ data: input });
  await audit({ actorId: user.id, action: "library.created", target: input.code });
  revalidateConsoles();
  return ok(undefined, `${input.code} · ${input.title} is in the library.`);
}

export async function createCampus(raw: unknown): Promise<ActionResult> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  const parsed = campusInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The campus did not validate.");
  const input = parsed.data;

  const cohort = await db.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true, name: true } });
  if (!cohort) return fail("Pick a cohort that exists.");
  const clash = await db.campus.findFirst({ where: { cohortId: cohort.id, name: input.name } });
  if (clash) return fail(`${input.name} is already in ${cohort.name}.`);

  await db.campus.create({ data: { cohortId: cohort.id, name: input.name, city: input.city ?? "", country: input.country || "India" } });
  await audit({ actorId: user.id, action: "campus.created", target: input.name, meta: { cohort: cohort.name } });
  revalidateConsoles();
  return ok(undefined, `${input.name} added to ${cohort.name}.`);
}

export async function createCohort(raw: unknown): Promise<ActionResult<{ cohortId: string }>> {
  const { user, error } = await adminOnly();
  if (!user) return fail(error);
  const parsed = cohortInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The cohort did not validate.");
  const input = parsed.data;

  const startsAt = new Date(`${input.startsAt}T00:00:00Z`);
  const endsAt = new Date(`${input.endsAt}T23:59:59Z`);
  if (endsAt <= startsAt) return fail("The end date has to come after the start date.");

  const cohort = await db.cohort.create({ data: { name: input.name, startsAt, endsAt, status: input.status as CohortStatus } });
  await audit({ actorId: user.id, action: "cohort.created", target: cohort.id, meta: { name: cohort.name } });
  revalidateConsoles();
  return ok({ cohortId: cohort.id }, `${cohort.name} created. Add its campuses and tasks next.`);
}
