import { db } from "@/lib/db";
import { configForClient, parseConfig, parseContent, parseRubric } from "@/lib/tasks";
import { hoursSince } from "@/lib/format";
import { currentWeek } from "@/lib/cohort";
import { safeHref } from "@/lib/validation";

// Caps on the operator console. It used to pull every user, submission, ledger entry, grant
// and application in one go on each page load, because the whole thing is one page. A cohort
// of ten is fine; a program that scales past a few hundred is not.

const REVIEW_QUEUE_CAP = 200;
const AMBASSADOR_CAP = 500;
const APPLICATION_CAP = 200;
const GRANT_CAP = 300;

export async function getAdminDashboard() {
  const cohort = await db.cohort.findFirst({ orderBy: { createdAt: "desc" } });
  // An empty database used to make this throw inside a server component, which rendered the
  // error page with no way back. The caller now shows an honest empty state instead.
  if (!cohort) return null;
  const { week } = currentWeek(cohort.startsAt, cohort.endsAt);

  const [
    pendingSubs,
    ambassadorsRaw,
    decisions,
    weekTasks,
    allTasks,
    applications,
    grants,
    announcements,
    libraryModules,
    reviewers,
    submissionCounts,
    campuses,
    cohorts,
    rewards,
    auditEvents,
  ] = await Promise.all([
    db.submission.findMany({
      where: { status: { in: ["submitted", "in_review"] }, task: { cohortId: cohort.id } },
      orderBy: { submittedAt: "asc" },
      take: REVIEW_QUEUE_CAP,
      include: {
        user: { include: { membership: { include: { campus: true } } } },
        task: true,
        assignedReviewer: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({
      where: { role: "ambassador", membership: { cohortId: cohort.id } },
      include: {
        membership: { include: { campus: true } },
        certificate: { select: { publicId: true, revokedAt: true, assessmentScore: true, issuedAt: true } },
        submissions: { orderBy: { createdAt: "desc" }, include: { task: true } },
        ledgerEntries: { orderBy: { createdAt: "desc" }, take: 60 },
        rewardGrants: { include: { reward: true } },
      },
      orderBy: { name: "asc" },
      take: AMBASSADOR_CAP,
    }),
    db.review.findMany({
      where: {
        reviewedAt: { gte: new Date(Date.now() - 30 * 86400000) },
        submission: { task: { cohortId: cohort.id } }
      },
      select: { decision: true }
    }),
    db.task.findMany({ where: { cohortId: cohort.id, week, published: true } }),
    db.task.findMany({ where: { cohortId: cohort.id }, orderBy: { week: "asc" } }),
    db.application.findMany({ orderBy: { createdAt: "desc" }, take: APPLICATION_CAP }),
    db.rewardGrant.findMany({
      where: { status: { in: ["claimed", "fulfilled"] } },
      include: { user: { select: { name: true, avatarColor: true } }, reward: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: GRANT_CAP,
    }),
    db.announcement.findMany({ where: { cohortId: cohort.id }, orderBy: { publishedAt: "desc" }, take: 20 }),
    db.libraryModule.findMany({ orderBy: { order: "asc" } }),
    db.user.findMany({ where: { role: { in: ["admin", "reviewer"] } }, select: { id: true, name: true, role: true, email: true } }),
    db.submission.groupBy({ by: ["taskId", "status"], _count: true }),
    db.campus.findMany({ where: { cohortId: cohort.id }, orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    db.cohort.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { members: true, tasks: true } } } }),
    db.reward.findMany({ orderBy: [{ signalGate: "asc" }, { name: "asc" }], include: { _count: { select: { grants: true } } } }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { actor: { select: { name: true, role: true } } } }),
  ]);

  const oldest = pendingSubs[0];
  const oldestHours = oldest ? hoursSince(oldest.submittedAt ?? oldest.createdAt) : 0;
  const accepted = decisions.filter((d) => d.decision === "accepted").length;
  const acceptRate = decisions.length ? Math.round((accepted / decisions.length) * 100) : null;
  const activeAmbassadors = ambassadorsRaw.filter((u) => u.status === "active");
  const invitedAmbassadors = ambassadorsRaw.filter((u) => u.status === "invited");
  const suspendedAmbassadors = ambassadorsRaw.filter((u) => u.status === "suspended");

  const now = Date.now();

  // A task is missed if there is no submission at all, or the latest submission
  // is draft, missed, or rejected, and the deadline has passed.
  const isSubmissionIncomplete = (status: string) => {
    return status === "draft" || status === "missed" || status === "rejected";
  };

  // At risk if lastSeenAt > 10 days ago (ignoring nulls) OR overdue assigned tasks without valid completion.
  const checkAtRisk = (u: { lane: string | null, lastSeenAt: Date | null, submissions: { taskId: string; status: string }[] }) => {
    let reason = null;
    if (u.lastSeenAt && hoursSince(u.lastSeenAt) > 240) {
      reason = "Inactive >10 days";
    } else {
      const applicableTasks = allTasks.filter(t => t.published && t.track === u.lane);
      const overdueTasks = applicableTasks.filter(t => t.dueAt.getTime() < now);

      // We only consider the latest attempt for each task based on how the query is structured
      // and we need to check if they have a valid submission.
      for (const t of overdueTasks) {
        const sub = u.submissions.find((s: { taskId: string; status: string }) => s.taskId === t.id);
        if (!sub || isSubmissionIncomplete(sub.status)) {
          reason = `Missed ${t.code}`;
          break;
        }
      }
    }
    return reason;
  };

  const activeAmbassadorsWithRisk = activeAmbassadors.map(u => ({ ...u, atRiskReason: checkAtRisk(u) }));
  const atRisk = activeAmbassadorsWithRisk.filter(u => u.atRiskReason).length;

  const weekTaskIds = weekTasks.map((t) => t.id);
  const weekSubs = weekTaskIds.length ? await db.submission.findMany({ where: { taskId: { in: weekTaskIds } } }) : [];
  const funnel = {
    opened: ambassadorsRaw.length * weekTasks.length,
    drafted: weekSubs.filter((s) => s.status === "draft").length,
    submitted: weekSubs.filter((s) => s.status !== "draft").length,
    reviewed: weekSubs.filter((s) => s.status === "accepted" || s.status === "changes_requested" || s.status === "rejected").length,
  };

  const countsByTask = new Map<string, Record<string, number>>();
  for (const c of submissionCounts) {
    const m = countsByTask.get(c.taskId) ?? {};
    m[c.status] = c._count;
    countsByTask.set(c.taskId, m);
  }

  return {
    cohort: { id: cohort.id, name: cohort.name, startsAt: cohort.startsAt.toISOString(), endsAt: cohort.endsAt.toISOString(), week },
    stats: {
      oldestHours,
      oldestLabel: oldest ? `${oldest.user.name}, ${oldest.task.code}` : null,
      activeCount: activeAmbassadors.length,
      invitedCount: invitedAmbassadors.length,
      suspendedCount: suspendedAmbassadors.length,
      pendingCount: pendingSubs.length,
      acceptRate,
      atRisk,
      funnel,
    },
    reviewQueue: pendingSubs.map((s) => ({
      id: s.id,
      attemptNo: s.attemptNo,
      status: s.status,
      ageHours: hoursSince(s.submittedAt ?? s.createdAt),
      claimedBy: s.assignedReviewer ? { id: s.assignedReviewer.id, name: s.assignedReviewer.name } : null,
      ambassador: {
        id: s.userId,
        name: s.user.name,
        color: s.user.avatarColor,
        campus: s.user.membership?.campus.name ?? "",
        lane: s.user.lane ?? "",
        pageUrl: safeHref(s.user.pageUrl),
      },
      task: {
        code: s.task.code,
        title: s.task.title,
        track: s.task.track,
        submissionType: s.task.submissionType,
        signalValue: s.task.signalValue,
        config: configForClient(s.task, true),
        rubric: parseRubric(s.task),
      },
      content: parseContent(s),
    })),
    ambassadors: ambassadorsRaw.map((u) => {
      const last = u.submissions[0];
      const riskReason = u.status === "active" ? checkAtRisk(u) : null;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        avatarColor: u.avatarColor,
        lane: u.lane,
        campusName: u.membership?.campus.name ?? "",
        tier: u.membership?.tier ?? "ambassador",
        signalTotal: u.membership?.signalTotal ?? 0,
        acceptedCount: u.submissions.filter((s) => s.status === "accepted").length,
        submittedCount: u.submissions.filter((s) => s.status !== "draft").length,
        lastActiveISO: last?.createdAt.toISOString() ?? null,
        atRiskReason: riskReason,
        submissions: u.submissions.map((s) => ({ id: s.id, code: s.task.code, title: s.task.title, status: s.status, attemptNo: s.attemptNo })),
        ledger: u.ledgerEntries.map((l) => ({ id: l.id, taskCode: l.taskCode, delta: l.delta })),
        grants: u.rewardGrants.map((g) => ({ id: g.id, rewardName: g.reward.name, status: g.status })),
        certificate: u.certificate
          ? { publicId: u.certificate.publicId, revoked: Boolean(u.certificate.revokedAt), score: u.certificate.assessmentScore, issuedISO: u.certificate.issuedAt.toISOString() }
          : null,
      };
    }),
    // Full task bodies are included because this console now edits them. Answer keys are in
    // there too, which is fine: /admin is admin-and-reviewer-only and the key is server data.
    tasks: allTasks.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      summary: t.summary,
      briefMd: t.briefMd,
      track: t.track,
      week: t.week,
      cohortId: t.cohortId,
      submissionType: t.submissionType,
      typeConfig: parseConfig(t),
      rubric: parseRubric(t),
      signalValue: t.signalValue,
      opensAtISO: t.opensAt.toISOString(),
      dueAtISO: t.dueAt.toISOString(),
      opensDate: t.opensAt.toISOString().slice(0, 10),
      dueDate: t.dueAt.toISOString().slice(0, 10),
      published: t.published,
      submissions: countsByTask.get(t.id) ? Object.values(countsByTask.get(t.id)!).reduce((a, b) => a + b, 0) : 0,
      accepted: countsByTask.get(t.id)?.accepted ?? 0,
      inReview: countsByTask.get(t.id)?.in_review ?? 0,
    })),
    applications: applications.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      campus: a.campus,
      city: a.city,
      field: a.field,
      answerText: a.answerText,
      status: a.status,
      createdAtISO: a.createdAt.toISOString(),
      decidedISO: a.decidedAt?.toISOString() ?? null,
      provisioned: Boolean(a.userId),
    })),
    rewardGrants: grants.map((g) => ({
      id: g.id,
      userName: g.user.name,
      userColor: g.user.avatarColor,
      rewardName: g.reward.name,
      rewardCode: g.reward.code,
      status: g.status,
      detail: g.detail,
      createdAtISO: g.createdAt.toISOString(),
    })),
    announcements: announcements.map((a) => ({ id: a.id, bodyMd: a.bodyMd, publishedAtISO: a.publishedAt.toISOString() })),
    libraryModules: libraryModules.map((m) => ({ id: m.id, code: m.code, title: m.title, summary: m.summary, bodyMd: m.bodyMd, order: m.order })),
    reviewers: reviewers.map((r) => ({ id: r.id, name: r.name, role: r.role, email: r.email })),
    campuses: campuses.map((c) => ({ id: c.id, name: c.name, city: c.city, country: c.country, members: c._count.members })),
    cohorts: cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      startsDate: c.startsAt.toISOString().slice(0, 10),
      endsDate: c.endsAt.toISOString().slice(0, 10),
      status: c.status,
      members: c._count.members,
      tasks: c._count.tasks,
    })),
    rewards: rewards.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      tierGate: r.tierGate,
      signalGate: r.signalGate,
      fulfilmentType: r.fulfilmentType,
      grants: r._count.grants,
    })),
    audit: auditEvents.map((e) => ({
      id: e.id,
      action: e.action,
      target: e.target,
      actor: e.actor ? { name: e.actor.name, role: e.actor.role } : null,
      meta: e.meta,
      createdAtISO: e.createdAt.toISOString(),
    })),
  };
}

export type AdminDashboardData = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>;
