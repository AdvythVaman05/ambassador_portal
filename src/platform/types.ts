export type PlatformRole = "admin" | "reviewer" | "mentor" | "scout";
export type ApplicationStatus = "submitted" | "in_review" | "accepted" | "rejected" | "withdrawn";
export type SubmissionStatus =
  "draft" | "submitted" | "in_review" | "revision_requested" | "accepted" | "rejected";

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  roles: readonly PlatformRole[];
  suspendedAt?: Date;
}
export interface ApplicationRecord {
  id: string;
  fullName: string;
  email: string;
  institution: string;
  course: string;
  statement: string;
  status: ApplicationStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: Date;
}
export interface SubmissionRecord {
  id: string;
  taskId: string;
  scoutId: string;
  body: string;
  status: SubmissionStatus;
  lockedBy?: string;
  reviewedAt?: Date;
}
export interface MessageRecord {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}
export interface TaskRecord {
  id: string;
  title: string;
  brief: string;
  dueAt?: Date;
  publishedAt?: Date;
  createdBy: string;
  submissionFormat?: string;
  rubric?: string[];
}
export interface ScoutProfile {
  user: PlatformUser;
  cohortName?: string;
  course?: string;
  yearOfStudy?: string;
  signalTotal: number;
}
export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  publishedAt?: Date;
}
