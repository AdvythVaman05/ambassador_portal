import { randomUUID } from "node:crypto";
import { canAdmin, canReview, requireRole } from "./auth";
import type { PlatformRepository } from "./repository";
import type { PlatformUser } from "./types";
import { applicationInputSchema, messageInputSchema, submissionInputSchema } from "./validation";

export async function submitApplication(repo: PlatformRepository, input: unknown) {
  const data = applicationInputSchema.parse(input);
  return repo.createApplication({
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    institution: data.institution,
    course: data.course,
    statement: data.statement,
  });
}
export async function acceptApplication(
  repo: PlatformRepository,
  actor: PlatformUser | undefined,
  applicationId: string,
  notes?: string,
) {
  canAdmin(actor);
  return repo.transaction(async (transaction) => {
    const application = await transaction.findApplication(applicationId);
    if (!application || application.status !== "submitted")
      throw new Error("Application is not available for acceptance");
    application.status = "accepted";
    application.reviewedBy = actor!.id;
    if (notes !== undefined) application.reviewNotes = notes;
    await transaction.updateApplication(application);
    return transaction.createInvite(application.email, "scout");
  });
}
export async function submitWork(
  repo: PlatformRepository,
  actor: PlatformUser | undefined,
  input: unknown,
) {
  const scout = requireRole(actor, ["scout"]);
  const data = submissionInputSchema.parse(input);
  return repo.createSubmission({ taskId: data.taskId, scoutId: scout.id, body: data.body });
}
export async function rejectApplication(
  repo: PlatformRepository,
  actor: PlatformUser | undefined,
  applicationId: string,
  notes: string,
) {
  const admin = canAdmin(actor);
  if (!notes.trim()) throw new Error("A rejection note is required");
  return repo.transaction(async (transaction) => {
    const application = await transaction.findApplication(applicationId);
    if (!application || application.status !== "submitted")
      throw new Error("Application is not available for review");
    application.status = "rejected";
    application.reviewedBy = admin.id;
    application.reviewNotes = notes.trim();
    await transaction.updateApplication(application);
    return application;
  });
}
export async function reviewSubmission(
  repo: PlatformRepository,
  actor: PlatformUser | undefined,
  submissionId: string,
  decision: "accepted" | "rejected" | "revision_requested",
  feedback: string,
  signalDelta = 0,
) {
  const reviewer = canReview(actor);
  return repo.transaction(async (transaction) => {
    const submission = await transaction.findSubmission(submissionId);
    if (!submission || submission.status !== "submitted")
      throw new Error("Submission is not available for review");
    submission.status = decision;
    submission.lockedBy = reviewer.id;
    submission.reviewedAt = new Date();
    await transaction.updateSubmission(submission);
    if (decision === "accepted" && signalDelta !== 0)
      await transaction.addLedgerEntry({
        scoutId: submission.scoutId,
        submissionId: submission.id,
        delta: signalDelta,
        reason: "Accepted submission",
        actorId: reviewer.id,
      });
    return submission;
  });
}
export async function postMessage(
  repo: PlatformRepository,
  actor: PlatformUser | undefined,
  input: unknown,
) {
  const user = requireRole(actor, ["admin", "reviewer", "mentor", "scout"]);
  const data = messageInputSchema.parse(input);
  if (!(await repo.isConversationMember(data.conversationId, user.id)))
    throw new Error("Conversation membership is required");
  return repo.createMessage({
    id: randomUUID(),
    conversationId: data.conversationId,
    authorId: user.id,
    body: data.body,
  });
}
