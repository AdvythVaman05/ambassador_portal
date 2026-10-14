"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { countWords, truncate } from "@/lib/validation";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { sendApplicationReceived } from "@/lib/notify";

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  campus: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  field: z.string().trim().min(2).max(120),
  answerText: z.string().trim().max(6000),
});

// Back-compatible shape: the form reads `error`, and `useActionState` needs a plain object.
export type ApplyState = { ok: boolean; error?: string; message?: string };

const MIN_WORDS = 40;

export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const key = await clientKey("apply");
  const limited = await rateLimit(key, LIMITS.apply.limit, LIMITS.apply.windowMs);
  if (!limited.ok) return { ok: false, error: `Too many applications from this connection. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.` };

  const parsed = applicationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    campus: String(formData.get("campus") ?? ""),
    city: String(formData.get("city") ?? ""),
    field: String(formData.get("field") ?? ""),
    answerText: String(formData.get("answerText") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are missing or too long." };
  }
  const input = parsed.data;

  const words = countWords(input.answerText);
  if (words < MIN_WORDS) {
    return { ok: false, error: `That answer reads short at ${words} words. Give us the real 150 — specifics beat length.` };
  }

  // One pending application per address. A duplicate gets the same reply as a first timer,
  // so this cannot be probed for "is this person already applied".
  const pending = await db.application.findFirst({ where: { email: input.email, status: "pending" }, select: { id: true } });
  if (!pending) {
    await db.application.create({
      data: {
        name: truncate(input.name, 120),
        email: input.email,
        campus: truncate(input.campus, 120),
        city: truncate(input.city ?? "", 80),
        field: truncate(input.field, 120),
        answerText: truncate(input.answerText, 6000),
      },
    });
    // Receipt email is best-effort: a provider outage must not bounce someone who just
    // spent twenty minutes writing an answer.
    sendApplicationReceived({ to: input.email, name: input.name }).catch(() => undefined);
  }

  return { ok: true, message: "Received. A person reads every application — expect a reply within a week." };
}
