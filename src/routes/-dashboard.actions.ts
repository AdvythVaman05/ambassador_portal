import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { requireRole } from "@/platform/auth";
import { SessionService } from "@/platform/identity";
import { platformRepositoryFromEnvironment } from "@/platform/service";
import { sessionCookieName } from "@/platform/sessions";
import {
  acceptApplication,
  rejectApplication,
  reviewSubmission,
  submitWork,
} from "@/platform/workflows";
import { submissionInputSchema } from "@/platform/validation";
import { taskInputSchema } from "@/platform/validation";
import { announcementInputSchema } from "@/platform/validation";

async function access() {
  const configured = platformRepositoryFromEnvironment(process.env);
  const user = await new SessionService(configured.repository).getUser(
    getCookie(sessionCookieName),
  );
  return { repository: configured.repository, user };
}
export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { repository, user } = await access();
  requireRole(user, ["admin"]);
  const [applications, scouts, tasks, submissions, announcements] = await Promise.all([
    repository.listApplications(),
    repository.listScouts(),
    repository.listTasks(),
    repository.listSubmissions(),
    repository.listAnnouncements(),
  ]);
  return { applications, scouts, tasks, submissions, announcements };
});
export const scoutDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { repository, user } = await access();
  const scout = requireRole(user, ["scout"]);
  const [tasks, submissions, announcements, signalTotal] = await Promise.all([
    repository.listTasks(scout.id),
    repository.listSubmissions({ scoutId: scout.id }),
    repository.listAnnouncements(),
    repository.getSignalTotal(scout.id),
  ]);
  return { profile: scout, tasks, submissions, announcements, signalTotal };
});
export const submitWorkServer = createServerFn({ method: "POST" })
  .validator(submissionInputSchema)
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    return submitWork(repository, user, data);
  });
export const reviewSubmissionServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const value = input as {
      submissionId: string;
      decision: "accepted" | "rejected" | "revision_requested";
      feedback: string;
      signalDelta?: number;
    };
    if (!value.submissionId || !value.feedback?.trim())
      throw new Error("Submission and feedback are required");
    return value;
  })
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    return reviewSubmission(
      repository,
      user,
      data.submissionId,
      data.decision,
      data.feedback.trim(),
      data.signalDelta ?? 0,
    );
  });
export const reviewerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { repository, user } = await access();
  requireRole(user, ["admin", "reviewer"]);
  return { submissions: await repository.listSubmissions({ status: "submitted" }) };
});
export const createTaskServer = createServerFn({ method: "POST" })
  .validator(taskInputSchema)
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    const admin = requireRole(user, ["admin"]);
    return repository.createTask({
      title: data.title,
      brief: data.brief,
      createdBy: admin.id,
      ...(data.dueAt ? { dueAt: new Date(data.dueAt) } : {}),
      rubric: data.rubric,
    });
  });
export const publishTaskServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const value = input as { taskId: string; published: boolean };
    if (!value.taskId) throw new Error("Task is required");
    return value;
  })
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    requireRole(user, ["admin"]);
    await repository.setTaskPublished(data.taskId, data.published);
    return { ok: true };
  });
export const updateTaskServer = createServerFn({ method: "POST" })
  .validator(taskInputSchema.extend({ id: taskInputSchema.shape.title }))
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    requireRole(user, ["admin"]);
    return repository.updateTask({
      id: data.id,
      title: data.title,
      brief: data.brief,
      rubric: data.rubric,
      ...(data.dueAt ? { dueAt: new Date(data.dueAt) } : {}),
    });
  });
export const createAnnouncementServer = createServerFn({ method: "POST" })
  .validator(announcementInputSchema)
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    const admin = requireRole(user, ["admin"]);
    return repository.createAnnouncement({ ...data, createdBy: admin.id });
  });
export const publishAnnouncementServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as { id: string; published: boolean };
    if (!data.id) throw new Error("Announcement is required");
    return data;
  })
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    requireRole(user, ["admin"]);
    await repository.setAnnouncementPublished(data.id, data.published);
    return { ok: true };
  });
export const acceptApplicationServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const value = input as { applicationId: string; notes?: string };
    if (!value.applicationId) throw new Error("Application is required");
    return value;
  })
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    return acceptApplication(repository, user, data.applicationId, data.notes);
  });
export const rejectApplicationServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const value = input as { applicationId: string; notes: string };
    if (!value.applicationId || !value.notes?.trim())
      throw new Error("Application and note are required");
    return value;
  })
  .handler(async ({ data }) => {
    const { repository, user } = await access();
    return rejectApplication(repository, user, data.applicationId, data.notes);
  });
