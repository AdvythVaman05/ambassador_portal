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

export interface PlatformRepository {
  transaction<T>(work: (repository: PlatformRepository) => Promise<T>): Promise<T>;
  findUser(id: string): Promise<PlatformUser | undefined>;
  findUserByEmail(email: string): Promise<PlatformUser | undefined>;
  findUserCredentials(
    email: string,
  ): Promise<(PlatformUser & { passwordHash: string | null }) | undefined>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findSessionUser(tokenHash: string): Promise<PlatformUser | undefined>;
  revokeSession(tokenHash: string): Promise<void>;
  createApplication(
    input: Omit<ApplicationRecord, "id" | "status" | "createdAt">,
  ): Promise<ApplicationRecord>;
  findApplication(id: string): Promise<ApplicationRecord | undefined>;
  updateApplication(application: ApplicationRecord): Promise<void>;
  createInvite(email: string, role: PlatformRole): Promise<{ id: string; rawToken: string }>;
  findInviteByTokenHash(
    tokenHash: string,
  ): Promise<
    | { id: string; email: string; role: PlatformRole; expiresAt: Date; acceptedAt?: Date }
    | undefined
  >;
  acceptInvite(input: {
    inviteId: string;
    displayName: string;
    passwordHash: string;
  }): Promise<PlatformUser>;
  createSubmission(input: Omit<SubmissionRecord, "id" | "status">): Promise<SubmissionRecord>;
  findSubmission(id: string): Promise<SubmissionRecord | undefined>;
  updateSubmission(submission: SubmissionRecord): Promise<void>;
  addLedgerEntry(input: {
    scoutId: string;
    submissionId: string;
    delta: number;
    reason: string;
    actorId: string;
  }): Promise<void>;
  isConversationMember(conversationId: string, userId: string): Promise<boolean>;
  createMessage(input: Omit<MessageRecord, "createdAt">): Promise<MessageRecord>;
  listApplications(status?: ApplicationRecord["status"]): Promise<ApplicationRecord[]>;
  listScouts(): Promise<ScoutProfile[]>;
  listTasks(scoutId?: string): Promise<TaskRecord[]>;
  listSubmissions(input?: {
    taskId?: string;
    status?: SubmissionRecord["status"];
    scoutId?: string;
  }): Promise<SubmissionRecord[]>;
  listAnnouncements(): Promise<AnnouncementRecord[]>;
  getSignalTotal(scoutId: string): Promise<number>;
  createTask(input: {
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
    createdBy: string;
  }): Promise<TaskRecord>;
  setTaskPublished(taskId: string, published: boolean): Promise<void>;
  updateTask(input: {
    id: string;
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
  }): Promise<TaskRecord>;
  createAnnouncement(input: {
    title: string;
    body: string;
    createdBy: string;
  }): Promise<AnnouncementRecord>;
  setAnnouncementPublished(id: string, published: boolean): Promise<void>;
}
