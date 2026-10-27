import { randomUUID } from "node:crypto";
import type {
  AnnouncementRecord,
  ApplicationRecord,
  MessageRecord,
  PlatformRole,
  PlatformUser,
  SubmissionRecord,
  ScoutProfile,
  TaskRecord,
} from "./types";
import type { PlatformRepository } from "./repository";

/** Test-only adapter. It is intentionally not imported by application routes. */
export class DevelopmentRepository implements PlatformRepository {
  users = new Map<string, PlatformUser>();
  credentials = new Map<string, string | null>();
  sessions = new Map<string, { userId: string; expiresAt: Date; revoked: boolean }>();
  invites = new Map<
    string,
    {
      id: string;
      email: string;
      role: PlatformRole;
      tokenHash: string;
      expiresAt: Date;
      acceptedAt?: Date;
    }
  >();
  applications = new Map<string, ApplicationRecord>();
  submissions = new Map<string, SubmissionRecord>();
  members = new Set<string>();
  ledger = new Set<string>();
  messages: MessageRecord[] = [];
  tasks = new Map<string, TaskRecord>();
  announcements: AnnouncementRecord[] = [];
  async transaction<T>(work: (repository: PlatformRepository) => Promise<T>): Promise<T> {
    return work(this);
  }
  async findUser(id: string) {
    return this.users.get(id);
  }
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }
  async findUserCredentials(email: string) {
    const user = await this.findUserByEmail(email);
    return user ? { ...user, passwordHash: this.credentials.get(user.id) ?? null } : undefined;
  }
  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.sessions.set(input.tokenHash, {
      userId: input.userId,
      expiresAt: input.expiresAt,
      revoked: false,
    });
  }
  async findSessionUser(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revoked || session.expiresAt <= new Date()) return undefined;
    return this.findUser(session.userId);
  }
  async revokeSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (session) session.revoked = true;
  }
  async createApplication(input: Omit<ApplicationRecord, "id" | "status" | "createdAt">) {
    const record: ApplicationRecord = {
      ...input,
      id: randomUUID(),
      status: "submitted",
      createdAt: new Date(),
    };
    this.applications.set(record.id, record);
    return record;
  }
  async findApplication(id: string) {
    return this.applications.get(id);
  }
  async updateApplication(application: ApplicationRecord) {
    this.applications.set(application.id, application);
  }
  async createInvite(email: string, role: PlatformRole) {
    const id = randomUUID();
    const rawToken = randomUUID();
    const tokenHash = await (await import("./sessions")).hashSessionToken(rawToken);
    this.invites.set(id, {
      id,
      email,
      role,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    return { id, rawToken };
  }
  async findInviteByTokenHash(tokenHash: string) {
    const invite = [...this.invites.values()].find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    return invite
      ? {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          ...(invite.acceptedAt ? { acceptedAt: invite.acceptedAt } : {}),
        }
      : undefined;
  }
  async acceptInvite(input: { inviteId: string; displayName: string; passwordHash: string }) {
    const invite = this.invites.get(input.inviteId);
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date())
      throw new Error("Invitation is not available");
    const user: PlatformUser = {
      id: randomUUID(),
      email: invite.email,
      displayName: input.displayName,
      roles: [invite.role],
    };
    this.users.set(user.id, user);
    this.credentials.set(user.id, input.passwordHash);
    invite.acceptedAt = new Date();
    return user;
  }
  async createSubmission(input: Omit<SubmissionRecord, "id" | "status">) {
    const record: SubmissionRecord = { ...input, id: randomUUID(), status: "submitted" };
    this.submissions.set(record.id, record);
    return record;
  }
  async findSubmission(id: string) {
    return this.submissions.get(id);
  }
  async updateSubmission(submission: SubmissionRecord) {
    this.submissions.set(submission.id, submission);
  }
  async addLedgerEntry(input: { submissionId: string }) {
    if (this.ledger.has(input.submissionId)) throw new Error("Duplicate ledger entry");
    this.ledger.add(input.submissionId);
  }
  async isConversationMember(conversationId: string, userId: string) {
    return this.members.has(`${conversationId}:${userId}`);
  }
  async createMessage(input: Omit<MessageRecord, "createdAt">) {
    const message: MessageRecord = { ...input, createdAt: new Date() };
    this.messages.push(message);
    return message;
  }
  async listApplications(status?: ApplicationRecord["status"]) {
    return [...this.applications.values()].filter((item) => !status || item.status === status);
  }
  async listScouts(): Promise<ScoutProfile[]> {
    return [...this.users.values()]
      .filter((user) => user.roles.includes("scout"))
      .map((user) => ({ user, signalTotal: 0 }));
  }
  async listTasks(_scoutId?: string) {
    return [...this.tasks.values()];
  }
  async listSubmissions(
    input: { taskId?: string; status?: SubmissionRecord["status"]; scoutId?: string } = {},
  ) {
    return [...this.submissions.values()].filter(
      (item) =>
        (!input.taskId || item.taskId === input.taskId) &&
        (!input.status || item.status === input.status) &&
        (!input.scoutId || item.scoutId === input.scoutId),
    );
  }
  async listAnnouncements() {
    return this.announcements;
  }
  async getSignalTotal(_scoutId: string) {
    return 0;
  }
  async createTask(input: {
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
    createdBy: string;
  }) {
    const task: TaskRecord = {
      id: randomUUID(),
      title: input.title,
      brief: input.brief,
      createdBy: input.createdBy,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.rubric ? { rubric: input.rubric } : {}),
    };
    this.tasks.set(task.id, task);
    return task;
  }
  async setTaskPublished(taskId: string, published: boolean) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    if (published) task.publishedAt = new Date();
    else delete task.publishedAt;
  }
  async updateTask(input: {
    id: string;
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
  }) {
    const task = this.tasks.get(input.id);
    if (!task) throw new Error("Task not found");
    task.title = input.title;
    task.brief = input.brief;
    if (input.dueAt) task.dueAt = input.dueAt;
    else delete task.dueAt;
    if (input.rubric) task.rubric = input.rubric;
    else delete task.rubric;
    return task;
  }
  async createAnnouncement(input: { title: string; body: string; createdBy: string }) {
    const item: AnnouncementRecord = { id: randomUUID(), title: input.title, body: input.body };
    this.announcements.push(item);
    return item;
  }
  async setAnnouncementPublished(id: string, published: boolean) {
    const item = this.announcements.find((entry) => entry.id === id);
    if (!item) throw new Error("Announcement not found");
    if (published) item.publishedAt = new Date();
    else delete item.publishedAt;
  }
}
