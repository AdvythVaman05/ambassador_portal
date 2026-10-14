import "server-only";
import crypto from "crypto";
import { db } from "./db";
import { parseContent, parseConfig, scoreQuiz } from "./tasks";

// Certificates.
//
// The row existed, the verify page existed, and the only code that ever created one was the
// seed file — so "a certificate that verifies publicly" was true for exactly one invented
// person. Issuance is now a real transition: it reads the accepted assessment attempt, scores
// it against the answer key stored on the task, and refuses when there is nothing to attest.

export type IssueResult = { ok: true; publicId: string } | { ok: false; error: string };

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** The single accepted assessment attempt, scored from the task's answer key. */
export async function assessmentFor(userId: string) {
  const attempts = await db.submission.findMany({
    where: { userId, status: "accepted", task: { submissionType: "quiz" } },
    include: { task: true },
    orderBy: { submittedAt: "desc" },
  });
  if (!attempts.length) return null;

  let best: { correct: number; total: number; submissionId: string; code: string } | null = null;
  for (const attempt of attempts) {
    const content = parseContent(attempt);
    const answers = Array.isArray(content.answers) ? (content.answers as unknown[]).map((n) => Number(n)) : [];
    const { correct, total } = scoreQuiz(parseConfig(attempt.task), answers);
    if (!total) continue;
    if (!best || correct / total > best.correct / best.total) {
      best = { correct, total, submissionId: attempt.id, code: attempt.task.code };
    }
  }
  return best;
}

export async function issueCertificate(userId: string): Promise<IssueResult> {
  const existing = await db.certificate.findUnique({ where: { userId } });
  if (existing && !existing.revokedAt) return { ok: true, publicId: existing.publicId };

  const membership = await db.membership.findUnique({ where: { userId }, include: { cohort: true } });
  if (!membership) return { ok: false, error: "That ambassador has no cohort membership." };

  const assessment = await assessmentFor(userId);
  if (!assessment) {
    return { ok: false, error: "No accepted assessment on file yet — the certificate needs a passed D-track assessment." };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "That account no longer exists." };

  const cohortNumber = /(\d+)/.exec(membership.cohort.name)?.[1]?.padStart(2, "0") ?? "00";
  const publicId = existing?.publicId ?? `cc${cohortNumber}-${slug(user.name)}-${crypto.randomBytes(3).toString("hex")}`;
  const assessmentScore = Math.round((assessment.correct / assessment.total) * 100);

  if (existing) {
    await db.certificate.update({
      where: { id: existing.id },
      data: { assessmentScore, revokedAt: null, revokedById: null, revokeReason: null, issuedAt: new Date(), publicId },
    });
  } else {
    await db.certificate.create({ data: { userId, publicId, assessmentScore } });
  }

  return { ok: true, publicId };
}

export async function revokeCertificate(opts: { certificateId: string; actorId: string; reason: string }): Promise<{ ok: boolean; error?: string }> {
  const cert = await db.certificate.findUnique({ where: { id: opts.certificateId } });
  if (!cert) return { ok: false, error: "No certificate on that account." };
  if (cert.revokedAt) return { ok: false, error: "Already revoked." };
  await db.certificate.update({
    where: { id: cert.id },
    data: { revokedAt: new Date(), revokedById: opts.actorId, revokeReason: opts.reason.slice(0, 300) },
  });
  return { ok: true };
}
