import { randomUUID } from "node:crypto";
import type { PlatformRepository } from "./repository";
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

/** Minimal parameterised PostgreSQL client contract. Bind this to the deployment driver; never interpolate values into SQL. */
export interface PostgresClient {
  query<T>(sql: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(work: (transaction: PostgresClient) => Promise<T>): Promise<T>;
}
type UserRow = {
  id: string;
  email: string;
  display_name: string;
  roles: PlatformRole[];
  suspended_at: Date | null;
};
type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  institution: string;
  course: string;
  statement: string;
  status: ApplicationRecord["status"];
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: Date;
};
const application = (row: ApplicationRow): ApplicationRecord => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  institution: row.institution,
  course: row.course,
  statement: row.statement,
  status: row.status,
  ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
  ...(row.review_notes ? { reviewNotes: row.review_notes } : {}),
  createdAt: row.created_at,
});

export class PostgresRepository implements PlatformRepository {
  constructor(private readonly db: PostgresClient) {}
  transaction<T>(work: (repository: PlatformRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((transaction): Promise<T> =>
      work(new PostgresRepository(transaction)),
    );
  }
  async findUser(id: string) {
    const { rows } = await this.db.query<UserRow>(
      "SELECT u.id, u.email, u.display_name, u.suspended_at, COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles FROM users u LEFT JOIN role_assignments r ON r.user_id=u.id WHERE u.id=$1 GROUP BY u.id",
      [id],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          roles: row.roles,
          ...(row.suspended_at ? { suspendedAt: row.suspended_at } : {}),
        }
      : undefined;
  }
  async findUserByEmail(email: string) {
    const { rows } = await this.db.query<UserRow>(
      "SELECT u.id, u.email, u.display_name, u.suspended_at, COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles FROM users u LEFT JOIN role_assignments r ON r.user_id=u.id WHERE u.email=$1 GROUP BY u.id",
      [email],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          roles: row.roles,
          ...(row.suspended_at ? { suspendedAt: row.suspended_at } : {}),
        }
      : undefined;
  }
  async findUserCredentials(email: string) {
    const { rows } = await this.db.query<UserRow & { password_hash: string | null }>(
      "SELECT u.id, u.email, u.display_name, u.suspended_at, u.password_hash, COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles FROM users u LEFT JOIN role_assignments r ON r.user_id=u.id WHERE u.email=$1 GROUP BY u.id",
      [email],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          roles: row.roles,
          passwordHash: row.password_hash,
          ...(row.suspended_at ? { suspendedAt: row.suspended_at } : {}),
        }
      : undefined;
  }
  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)", [
      input.userId,
      input.tokenHash,
      input.expiresAt,
    ]);
  }
  async findSessionUser(tokenHash: string) {
    const { rows } = await this.db.query<UserRow>(
      "SELECT u.id, u.email, u.display_name, u.suspended_at, COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN role_assignments r ON r.user_id=u.id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() GROUP BY u.id",
      [tokenHash],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          roles: row.roles,
          ...(row.suspended_at ? { suspendedAt: row.suspended_at } : {}),
        }
      : undefined;
  }
  async revokeSession(tokenHash: string) {
    await this.db.query(
      "UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",
      [tokenHash],
    );
  }
  async createApplication(input: Omit<ApplicationRecord, "id" | "status" | "createdAt">) {
    const { rows } = await this.db.query<ApplicationRow>(
      "INSERT INTO applications(full_name,email,institution,course,statement) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [input.fullName, input.email, input.institution, input.course, input.statement],
    );
    return application(rows[0]!);
  }
  async findApplication(id: string) {
    const { rows } = await this.db.query<ApplicationRow>("SELECT * FROM applications WHERE id=$1", [
      id,
    ]);
    return rows[0] ? application(rows[0]) : undefined;
  }
  async updateApplication(record: ApplicationRecord) {
    await this.db.query(
      "UPDATE applications SET status=$2, reviewed_by=$3, review_notes=$4, updated_at=now() WHERE id=$1",
      [record.id, record.status, record.reviewedBy ?? null, record.reviewNotes ?? null],
    );
  }
  async createInvite(email: string, role: PlatformRole) {
    const id = randomUUID(),
      rawToken = randomUUID();
    const tokenHash = await hashToken(rawToken);
    await this.db.query(
      "INSERT INTO invitations(id,email,role,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')",
      [id, email, role, tokenHash],
    );
    return { id, rawToken };
  }
  async findInviteByTokenHash(tokenHash: string) {
    const { rows } = await this.db.query<{
      id: string;
      email: string;
      role: PlatformRole;
      expires_at: Date;
      accepted_at: Date | null;
    }>(
      "SELECT id,email,role,expires_at,accepted_at FROM invitations WHERE token_hash=$1 FOR UPDATE",
      [tokenHash],
    );
    const invite = rows[0];
    return invite
      ? {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expires_at,
          ...(invite.accepted_at ? { acceptedAt: invite.accepted_at } : {}),
        }
      : undefined;
  }
  async acceptInvite(input: { inviteId: string; displayName: string; passwordHash: string }) {
    const { rows } = await this.db.query<{ id: string; email: string; role: PlatformRole }>(
      "SELECT id,email,role FROM invitations WHERE id=$1 AND accepted_at IS NULL AND expires_at > now() FOR UPDATE",
      [input.inviteId],
    );
    const invite = rows[0];
    if (!invite) throw new Error("Invitation is not available");
    const userResult = await this.db.query<{ id: string; email: string; display_name: string }>(
      "INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id,email,display_name",
      [invite.email, input.displayName, input.passwordHash],
    );
    const user = userResult.rows[0]!;
    await this.db.query("INSERT INTO role_assignments(user_id,role) VALUES($1,$2)", [
      user.id,
      invite.role,
    ]);
    if (invite.role === "scout")
      await this.db.query("INSERT INTO scouts(user_id) VALUES($1)", [user.id]);
    await this.db.query("UPDATE invitations SET accepted_at=now() WHERE id=$1", [invite.id]);
    return { id: user.id, email: user.email, displayName: user.display_name, roles: [invite.role] };
  }
  async createSubmission(input: Omit<SubmissionRecord, "id" | "status">) {
    const { rows } = await this.db.query<SubmissionRecord>(
      'INSERT INTO submissions(task_id,scout_id,body,status,submitted_at) VALUES($1,$2,$3,\'submitted\',now()) RETURNING id, task_id AS "taskId", scout_id AS "scoutId", body, status',
      [input.taskId, input.scoutId, input.body],
    );
    return rows[0]!;
  }
  async findSubmission(id: string) {
    const { rows } = await this.db.query<SubmissionRecord>(
      'SELECT id, task_id AS "taskId", scout_id AS "scoutId", body, status, locked_by AS "lockedBy", updated_at AS "reviewedAt" FROM submissions WHERE id=$1 FOR UPDATE',
      [id],
    );
    return rows[0];
  }
  async updateSubmission(record: SubmissionRecord) {
    await this.db.query(
      "UPDATE submissions SET status=$2, locked_by=$3, updated_at=now() WHERE id=$1",
      [record.id, record.status, record.lockedBy ?? null],
    );
  }
  async addLedgerEntry(input: {
    scoutId: string;
    submissionId: string;
    delta: number;
    reason: string;
    actorId: string;
  }) {
    await this.db.query(
      "INSERT INTO signal_ledger(scout_id,submission_id,delta,reason,created_by) VALUES($1,$2,$3,$4,$5)",
      [input.scoutId, input.submissionId, input.delta, input.reason, input.actorId],
    );
  }
  async isConversationMember(conversationId: string, userId: string) {
    const { rows } = await this.db.query<{ yes: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2) AS yes",
      [conversationId, userId],
    );
    return rows[0]?.yes === true;
  }
  async createMessage(input: Omit<MessageRecord, "createdAt">) {
    const { rows } = await this.db.query<MessageRecord>(
      'INSERT INTO messages(id,conversation_id,author_id,body) VALUES($1,$2,$3,$4) RETURNING id, conversation_id AS "conversationId", author_id AS "authorId", body, created_at AS "createdAt"',
      [input.id, input.conversationId, input.authorId, input.body],
    );
    return rows[0]!;
  }
  async listApplications(status?: ApplicationRecord["status"]) {
    const { rows } = await this.db.query<ApplicationRow>(
      `SELECT * FROM applications ${status ? "WHERE status=$1" : ""} ORDER BY created_at DESC`,
      status ? [status] : [],
    );
    return rows.map(application);
  }
  async listScouts(): Promise<ScoutProfile[]> {
    const { rows } = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      roles: PlatformRole[];
      cohort_name: string | null;
      course: string | null;
      year_of_study: string | null;
      signal_total: number;
    }>(
      "SELECT u.id,u.email,u.display_name,COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL),'{}') roles,c.name cohort_name,s.course,s.year_of_study,COALESCE(SUM(l.delta),0)::int signal_total FROM scouts s JOIN users u ON u.id=s.user_id LEFT JOIN role_assignments r ON r.user_id=u.id LEFT JOIN cohorts c ON c.id=s.cohort_id LEFT JOIN signal_ledger l ON l.scout_id=u.id GROUP BY u.id,c.name,s.course,s.year_of_study ORDER BY u.display_name",
    );
    return rows.map((row) => ({
      user: { id: row.id, email: row.email, displayName: row.display_name, roles: row.roles },
      ...(row.cohort_name ? { cohortName: row.cohort_name } : {}),
      ...(row.course ? { course: row.course } : {}),
      ...(row.year_of_study ? { yearOfStudy: row.year_of_study } : {}),
      signalTotal: row.signal_total,
    }));
  }
  async listTasks(scoutId?: string): Promise<TaskRecord[]> {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      brief: string;
      due_at: Date | null;
      published_at: Date | null;
      created_by: string;
    }>(
      `SELECT t.id,t.title,t.brief,t.due_at,t.published_at,t.created_by FROM tasks t ${scoutId ? "JOIN task_assignments a ON a.task_id=t.id WHERE a.scout_id=$1" : ""} ORDER BY t.due_at NULLS LAST,t.created_at DESC`,
      scoutId ? [scoutId] : [],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      brief: row.brief,
      createdBy: row.created_by,
      ...(row.due_at ? { dueAt: row.due_at } : {}),
      ...(row.published_at ? { publishedAt: row.published_at } : {}),
    }));
  }
  async listSubmissions(
    input: { taskId?: string; status?: SubmissionRecord["status"]; scoutId?: string } = {},
  ) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of [
      ["task_id", input.taskId],
      ["status", input.status],
      ["scout_id", input.scoutId],
    ] as const)
      if (value) {
        values.push(value);
        clauses.push(`${column}=$${values.length}`);
      }
    const { rows } = await this.db.query<SubmissionRecord>(
      `SELECT id,task_id AS "taskId",scout_id AS "scoutId",body,status,locked_by AS "lockedBy",updated_at AS "reviewedAt" FROM submissions ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY submitted_at DESC`,
      values,
    );
    return rows;
  }
  async listAnnouncements(): Promise<AnnouncementRecord[]> {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      body: string;
      published_at: Date | null;
    }>(
      "SELECT id,title,body,published_at FROM announcements WHERE published_at IS NOT NULL ORDER BY published_at DESC",
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      ...(row.published_at ? { publishedAt: row.published_at } : {}),
    }));
  }
  async getSignalTotal(scoutId: string) {
    const { rows } = await this.db.query<{ total: number }>(
      "SELECT COALESCE(SUM(delta),0)::int total FROM signal_ledger WHERE scout_id=$1",
      [scoutId],
    );
    return rows[0]?.total ?? 0;
  }
  async createTask(input: {
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
    createdBy: string;
  }) {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      brief: string;
      due_at: Date | null;
      created_by: string;
      rubric: string[];
    }>(
      "INSERT INTO tasks(title,brief,due_at,rubric,created_by) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id,title,brief,due_at,created_by,rubric",
      [
        input.title,
        input.brief,
        input.dueAt ?? null,
        JSON.stringify(input.rubric ?? []),
        input.createdBy,
      ],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      title: row.title,
      brief: row.brief,
      createdBy: row.created_by,
      rubric: row.rubric,
      ...(row.due_at ? { dueAt: row.due_at } : {}),
    };
  }
  async setTaskPublished(taskId: string, published: boolean) {
    await this.db.query("UPDATE tasks SET published_at=$2 WHERE id=$1", [
      taskId,
      published ? new Date() : null,
    ]);
  }
  async updateTask(input: {
    id: string;
    title: string;
    brief: string;
    dueAt?: Date;
    rubric?: string[];
  }) {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      brief: string;
      due_at: Date | null;
      published_at: Date | null;
      created_by: string;
      rubric: string[];
    }>(
      "UPDATE tasks SET title=$2,brief=$3,due_at=$4,rubric=$5::jsonb WHERE id=$1 RETURNING id,title,brief,due_at,published_at,created_by,rubric",
      [input.id, input.title, input.brief, input.dueAt ?? null, JSON.stringify(input.rubric ?? [])],
    );
    const row = rows[0];
    if (!row) throw new Error("Task not found");
    return {
      id: row.id,
      title: row.title,
      brief: row.brief,
      createdBy: row.created_by,
      rubric: row.rubric,
      ...(row.due_at ? { dueAt: row.due_at } : {}),
      ...(row.published_at ? { publishedAt: row.published_at } : {}),
    };
  }
  async createAnnouncement(input: { title: string; body: string; createdBy: string }) {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      body: string;
      published_at: Date | null;
    }>(
      "INSERT INTO announcements(title,body,created_by) VALUES($1,$2,$3) RETURNING id,title,body,published_at",
      [input.title, input.body, input.createdBy],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      ...(row.published_at ? { publishedAt: row.published_at } : {}),
    };
  }
  async setAnnouncementPublished(id: string, published: boolean) {
    await this.db.query("UPDATE announcements SET published_at=$2 WHERE id=$1", [
      id,
      published ? new Date() : null,
    ]);
  }
}
async function hashToken(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}
