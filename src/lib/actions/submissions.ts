"use server";

import { db, json } from "@/lib/db";
import { getActionUser, getActionReviewer } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  loadSubmittableTask,
  submissionWindowError,
  parseConfig,
  parseRubric,
  scoreQuiz,
} from "@/lib/tasks";
import { countWords, isPublicHttpUrl, isPrivateAddress, truncate, validateSubmissionContent } from "@/lib/validation";
import * as dns from "dns";
import { promisify } from "util";
import { Agent, request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import type { RequestOptions } from "https";

const lookupAsync = promisify(dns.lookup);
import { audit, revalidateConsoles } from "@/lib/audit";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { syncEarnedGrants } from "@/lib/rewards";

const MAX_ATTEMPTS = 3;
const SNAPSHOT_BYTES = 300_000;
const SNAPSHOT_TIMEOUT_MS = 4000;
const SNAPSHOT_MAX_HOPS = 4;
const SNAPSHOT_UA = "CampusCircleReviewer/1.0 (submission snapshot; https://campusscout.rothenhall.com)";

export type SubmissionOutcome = ActionResult<{ savedAt?: string }>;

// ── link snapshots ──────────────────────────────────────────────────────────

export type LinkSnapshot = {
  fetchedAt: string;
  ok: boolean;
  status?: number;
  title: string | null;
  description: string | null;
  finalUrl: string | null;
  blocked?: "private" | "hops" | "network";
};

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return truncate(await res.text(), SNAPSHOT_BYTES);
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (total < SNAPSHOT_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(Buffer.from(value));
      total += value.byteLength;
    }
  } catch {
    // a truncated body is still enough to read a title from
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).subarray(0, SNAPSHOT_BYTES).toString("utf8");
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function grab(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1] ? truncate(decodeEntities(m[1]), 280) : null;
}

/**
 * Fetches what a reviewer would see, so "it was live when I submitted" is evidence and not
 * a claim.
 *
 * SSRF protection uses a custom lookup method for native http/https request to ensure DNS rebinding
 * is prevented. We resolve the IP beforehand, verify it is not private, and then bind that
 * exact resolved IP when establishing the socket connection, avoiding TOCTOU vulnerability.
 */

async function safeFetch(urlStr: string): Promise<Response> {
  const url = new URL(urlStr);
  const isHttps = url.protocol === "https:";

  let resolvedIp: string;
  try {
    const { address } = await lookupAsync(url.hostname, { all: false });
    resolvedIp = address;
  } catch {
    throw new Error("DNS resolution failed");
  }

  if (isPrivateAddress(resolvedIp)) {
    throw new Error("Private IP detected");
  }

  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      method: "GET",
      headers: { "user-agent": SNAPSHOT_UA, accept: "text/html,*/*" },
      lookup: (hostname, options, callback) => {
        // Enforce the pre-resolved IP
        callback(null, resolvedIp, resolvedIp.includes(":") ? 6 : 4);
      }
    };

    const req = (isHttps ? httpsRequest : httpRequest)(url, options, (res) => {
      // Wrap the Node.js IncomingMessage into a standard Response-like interface
      // needed by our readCapped and subsequent logic.
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        if (Array.isArray(v)) {
          v.forEach(val => headers.append(k, val));
        } else if (v) {
          headers.append(k, v);
        }
      }

      // Convert Node stream to web stream for readCapped compatibility
      const readableStream = new ReadableStream({
        start(controller) {
          res.on("data", (chunk) => controller.enqueue(chunk));
          res.on("end", () => controller.close());
          res.on("error", (err) => controller.error(err));
        },
        cancel() {
          res.destroy();
        }
      });

      resolve(new Response(readableStream, {
        status: res.statusCode ?? 200,
        statusText: res.statusMessage,
        headers
      }));
    });

    req.on("error", reject);
    req.setTimeout(SNAPSHOT_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.end();
  });
}

async function snapshotLink(rawUrl: string): Promise<LinkSnapshot> {
  const fetchedAt = new Date().toISOString();
  let current = rawUrl;

  for (let hop = 0; hop < SNAPSHOT_MAX_HOPS; hop++) {
    if (!isPublicHttpUrl(current)) return { fetchedAt, ok: false, title: null, description: null, finalUrl: null, blocked: "private" };

    try {
      const res = await safeFetch(current);

      const status = res.status;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = res.headers.get("location");
        if (!location) break;
        try {
          current = new URL(location, current).toString();
        } catch {
          return { fetchedAt, ok: false, status, title: null, description: null, finalUrl: current, blocked: "hops" };
        }
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html") && !contentType.includes("text")) {
        return { fetchedAt, ok: status < 400, status, title: null, description: null, finalUrl: current };
      }

      const html = await readCapped(res);
      return {
        fetchedAt,
        ok: status < 400,
        status,
        title: grab(html, /<title[^>]*>([^<]{1,400})<\/title>/i) ?? grab(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']{1,400})/i),
        description:
          grab(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']{1,400})/i) ??
          grab(html, /<meta[^>]+content=["']([^"']{1,400})["'][^>]*name=["']description["']/i) ??
          grab(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']{1,400})/i),
        finalUrl: current,
      };
    } catch {
      return { fetchedAt, ok: false, title: null, description: null, finalUrl: current, blocked: "network" };
    }
  }

  return { fetchedAt, ok: false, title: null, description: null, finalUrl: current, blocked: "hops" };
}

// ── shared guard ────────────────────────────────────────────────────────────

async function guardTaskAccess(taskId: string) {
  const { user, error } = await getActionUser();
  if (!user) return { user: null, task: null, error };
  const access = await loadSubmittableTask(taskId, user.membership!.cohortId);
  if (!access.task) return { user: null, task: null, error: access.error };
  return { user, task: access.task, error: null };
}

/** Derived, server-owned fields added to quiz and document content at write time. */
function decorate(task: { submissionType: string; typeConfig: unknown }, content: Record<string, unknown>) {
  if (task.submissionType === "document" && typeof content.body === "string") {
    return { ...content, wordCount: countWords(content.body) };
  }
  if (task.submissionType === "quiz" && Array.isArray(content.answers)) {
    const { correct, total } = scoreQuiz(parseConfig(task), content.answers as number[]);
    return { ...content, score: correct, total };
  }
  return content;
}

// ── actions ─────────────────────────────────────────────────────────────────

export async function saveDraft(taskId: string, raw: unknown): Promise<SubmissionOutcome> {
  const key = await clientKey("draft");
  const limited = await rateLimit(key, LIMITS.submission.limit, LIMITS.submission.windowMs);
  if (!limited.ok) {
    return fail("You are saving drafts very quickly. Try again in a few minutes.");
  }

  const { user, task, error } = await guardTaskAccess(taskId);
  if (!user || !task) return fail(error ?? "Could not save that draft.");

  const validated = validateSubmissionContent(task.submissionType, parseConfig(task), raw, { lenient: true });
  if (!validated.ok) return fail(validated.error);
  const content = decorate(task, validated.content);

  const latest = await db.submission.findFirst({
    where: { taskId, userId: user.id },
    orderBy: { attemptNo: "desc" },
  });

  if (latest && (latest.status === "draft" || latest.status === "changes_requested")) {
    await db.submission.update({ where: { id: latest.id }, data: { content: json(content) } });
  } else if (!latest) {
    await db.submission.create({ data: { taskId, userId: user.id, status: "draft", content: json(content) } });
  } else {
    return fail("This attempt is with a reviewer now, so it can no longer be edited.");
  }

  revalidateConsoles();
  return ok({ savedAt: new Date().toISOString() });
}

export async function submitTask(taskId: string, raw: unknown): Promise<SubmissionOutcome> {
  const key = await clientKey("submit");
  const limited = await rateLimit(key, LIMITS.submission.limit, LIMITS.submission.windowMs);
  if (!limited.ok) {
    return fail("You are submitting very quickly. Try again in a few minutes.");
  }

  const { user, task, error } = await guardTaskAccess(taskId);
  if (!user || !task) return fail(error ?? "Could not submit that.");

  const config = parseConfig(task);
  const validated = validateSubmissionContent(task.submissionType, config, raw);
  if (!validated.ok) return fail(validated.error);
  const content = decorate(task, validated.content);

  const latest = await db.submission.findFirst({
    where: { taskId, userId: user.id },
    orderBy: { attemptNo: "desc" },
  });

  // Only your own unfinished work is submittable: a draft, or the one attempt a reviewer sent
  // back. Anything else means the attempt is already graded or already in the queue.
  if (latest && !["draft", "changes_requested"].includes(latest.status)) {
    return fail("This task is already with a reviewer or already graded.");
  }
  const resubmit = latest?.status === "changes_requested";
  if (resubmit && latest && latest.attemptNo >= MAX_ATTEMPTS) {
    return fail(`This task allows ${MAX_ATTEMPTS} attempts and you have used them all.`);
  }
  const windowError = submissionWindowError(task, resubmit);
  if (windowError) return fail(windowError);

  let snapshot: LinkSnapshot | null = null;
  if (task.submissionType === "link" && typeof content.url === "string" && content.url) {
    snapshot = await snapshotLink(content.url);
    content.snapshot = snapshot;
  }

  const writing =
    !latest || resubmit
      ? { kind: "create" as const, attemptNo: (latest?.attemptNo ?? 0) + 1 }
      : { kind: "promote" as const, id: latest.id };

  const created = await db.$transaction(async (tx) => {
    if (writing.kind === "promote") {
      return tx.submission.update({
        where: { id: writing.id },
        data: { status: "submitted", content: json(content), submittedAt: new Date(), snapshotUrl: snapshot?.finalUrl ?? null },
      });
    }
    return tx.submission.create({
      data: {
        taskId,
        userId: user.id,
        status: "submitted",
        attemptNo: writing.attemptNo,
        content: json(content),
        submittedAt: new Date(),
        snapshotUrl: snapshot?.finalUrl ?? null,
      },
    });
  });

  await audit({
    actorId: user.id,
    action: resubmit ? "submission.resubmitted" : "submission.submitted",
    target: `${task.code}:${created.id}`,
    meta: { attemptNo: created.attemptNo },
  });

  revalidateConsoles();
  return ok(undefined, snapshot && !snapshot.ok ? "Submitted. We could not read that page just now — the reviewer sees your note." : undefined);
}

/**
 * Takes an attempt out of the shared queue and onto one reviewer's desk. The updateMany
 * guard is the point: two reviewers clicking at once, one wins.
 */
export async function claimForReview(submissionId: string): Promise<ActionResult<{ claimedBy: string }>> {
  const { user, error } = await getActionReviewer();
  if (!user) return fail(error ?? "Sign in to review.");

  const result = await db.submission.updateMany({
    where: { id: submissionId, status: "submitted" },
    data: { status: "in_review", assignedReviewerId: user.id, assignedAt: new Date() },
  });
  if (result.count === 0) {
    const existing = await db.submission.findUnique({ where: { id: submissionId }, select: { status: true, assignedReviewerId: true } });
    if (!existing) return fail("That submission is no longer in the queue.");
    if (existing.status !== "in_review") return fail(`That attempt is already ${existing.status.replace("_", " ")}.`);
    if (existing.assignedReviewerId && existing.assignedReviewerId !== user.id) {
      const holder = await db.user.findUnique({ where: { id: existing.assignedReviewerId }, select: { name: true } });
      return fail(`Already opened by ${holder?.name ?? "another reviewer"}.`);
    }
    return fail("Could not open that submission.");
  }

  revalidateConsoles();
  return ok({ claimedBy: user.id });
}

export async function releaseFromReview(submissionId: string): Promise<ActionResult<unknown>> {
  return putBackToQueue(submissionId);
}

async function putBackToQueue(submissionId: string) {
  const { user, error } = await getActionReviewer();
  if (!user) return fail(error ?? "Sign in to review.");
  await db.submission.updateMany({
    where: { id: submissionId, status: "in_review", assignedReviewerId: user.id },
    data: { status: "submitted", assignedReviewerId: null, assignedAt: null },
  });
  revalidateConsoles();
  return ok();
}

const DECISIONS = new Set(["accepted", "changes_requested", "rejected"]);

export async function reviewSubmission(
  submissionId: string,
  decision: string,
  rubricResults: unknown,
  feedbackMd: unknown
): Promise<ActionResult> {
  const { user, error } = await getActionReviewer();
  if (!user) return fail(error ?? "Sign in to review.");
  if (!DECISIONS.has(decision)) return fail("That decision is not one of the three the rubric offers.");

  const feedback = truncate(String(feedbackMd ?? "").trim(), 4000);
  if (decision !== "accepted" && feedback.length < 10) {
    return fail("Say what to change. The ambassador reads this line and nothing else.");
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { task: true, user: { select: { id: true, name: true, membership: { select: { cohortId: true } } } } },
  });
  if (!submission) return fail("That submission no longer exists.");

  // A reviewer who belongs to a cohort may only grade inside it. Admins see everything.
  if (user.role !== "admin" && user.membership && submission.user.membership?.cohortId !== user.membership.cohortId) {
    return fail("That ambassador is outside your cohort.");
  }
  if (submission.assignedReviewerId && submission.assignedReviewerId !== user.id) {
    const holder = await db.user.findUnique({ where: { id: submission.assignedReviewerId }, select: { name: true } });
    return fail(`Grading is locked to ${holder?.name ?? "another reviewer"}. Ask them to hand it back.`);
  }
  if (!["submitted", "in_review"].includes(submission.status)) {
    return fail(`That attempt is already ${submission.status.replace("_", " ")}.`);
  }

  const rubric = parseRubric(submission.task);
  const results = Array.isArray(rubricResults) ? rubricResults.map((x) => x === true) : [];
  if (results.length !== rubric.length) return fail("Every rubric line needs a yes or a no.");
  if (decision === "accepted" && results.some((r) => !r)) {
    return fail("A rubric line is unmet. Accept only when every line is met, or ask for changes.");
  }

  const newStatus = decision === "accepted" ? "accepted" : decision === "rejected" ? "rejected" : "changes_requested";

  try {
    await db.$transaction(async (tx) => {
      // The guard is the whole point: read-then-write on the same row is how an attempt
      // used to get accepted twice and mint Signal twice.
      const flipped = await tx.submission.updateMany({
        where: { id: submission.id, status: { in: ["submitted", "in_review"] } },
        data: {
          status: newStatus,
          assignedReviewerId: user.id,
          assignedAt: submission.assignedAt ?? new Date(),
        },
      });
      if (flipped.count === 0) throw new Error("RACE");

      await tx.review.create({
        data: {
          submissionId: submission.id,
          reviewerId: user.id,
          decision: decision as "accepted" | "changes_requested" | "rejected",
          rubricResults: json(results),
          feedbackMd: feedback || null,
        },
      });

      if (decision === "accepted") {
        await tx.signalLedger.create({
          data: {
            userId: submission.userId,
            submissionId: submission.id,
            taskCode: submission.task.code,
            taskTitle: submission.task.title,
            delta: submission.task.signalValue,
            reason: "Submission accepted",
          },
        });
        // Increment, never read-modify-write: two reviewers accepting in the same second
        // used to compute the same total and lose one of the two.
        await tx.membership.update({
          where: { userId: submission.userId },
          data: { signalTotal: { increment: submission.task.signalValue } },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RACE") return fail("Someone else just graded this attempt. Reload the queue.");
    throw e;
  }

  if (decision === "accepted") {
    // Materialise the reward ladder immediately, so the console does not show a stale
    // ladder until the next full load.
    await syncEarnedGrants(submission.userId).catch(() => undefined);
  }

  await audit({
    actorId: user.id,
    action: `review.${decision}`,
    target: `${submission.task.code}:${submission.id}`,
    meta: { ambassadorId: submission.userId, signal: decision === "accepted" ? submission.task.signalValue : 0 },
  });

  revalidateConsoles();
  return ok(undefined, `Logged for ${submission.task.code}.`);
}
