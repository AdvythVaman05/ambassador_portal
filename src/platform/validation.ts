import { z } from "zod";

export const applicationInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  institution: z.string().trim().min(2).max(200),
  course: z.string().trim().min(2).max(160),
  statement: z.string().trim().min(20).max(5000),
  interests: z.array(z.string().trim().max(80)).max(12).default([]),
  skills: z.array(z.string().trim().max(80)).max(20).default([]),
  portfolioUrl: z.string().url().max(2048).optional(),
});
export const submissionInputSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1).max(20_000),
});
export const taskInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  brief: z.string().trim().min(10).max(10_000),
  dueAt: z.string().datetime().optional(),
  rubric: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});
export const announcementInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(10_000),
});
export const messageInputSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().uuid().optional(),
});
