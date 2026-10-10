import { z } from "zod";
import type { TaskConfig } from "@/lib/tasks";

// One place that decides what the database is allowed to contain. Every server action runs
// its input through here before Prisma sees it. Two rules shaped this file:
//   1. Bounds that live in the task (word minimums, max files, quiz answers) are enforced
//      against the stored task config server-side, never taken from the client.
//   2. Anything the browser later renders as a link is checked for scheme here, at write
//      time, so a `javascript:` URL cannot be parked in the database waiting for a reviewer.

export const MAX_CONTENT_BYTES = 200_000;
export const MAX_UPLOAD_BYTES = 1_750_000; // matches the 1.75 MB pre-encode cap in UploadForm
export const MAX_ROWS = 200;

const UPLOAD_MIME = new Map<string, string[]>([
  ["image/png", ["png"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/webp", ["webp"]],
  ["image/gif", ["gif"]],
  ["application/pdf", ["pdf"]],
]);

// Submitted URLs are fetched by us to snapshot them, so "http(s)" is not enough: an address
// that resolves to a private host turns the reviewer tool into a proxy into the internal
// network. Anything we merely *render* as a link (a profile pageUrl) only needs the scheme
// check, so it stays on isSafeExternalUrl.
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => isPublicHttpUrl(v), "Enter a public http(s) URL — we fetch this page to snapshot it.");

export const linkContent = z.object({
  url: httpUrl,
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const linkSetContent = z.object({
  rows: z.array(z.object({ key: z.string().trim().min(1).max(60), url: httpUrl })).min(0).max(20),
});

export const documentContent = z.object({
  body: z.string().max(40_000),
});

export const uploadContent = z.object({
  files: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        dataUrl: z.string().min(1).max(MAX_UPLOAD_BYTES + 1000),
        caption: z.string().trim().max(500).optional().or(z.literal("")),
      })
    )
    .min(0),
});

export const structuredContent = z.object({
  rows: z.array(z.record(z.string().trim().max(1000))).min(0).max(MAX_ROWS),
});

export const rosterContent = z.object({
  rows: z.array(z.record(z.string().trim().max(1000))).min(0).max(MAX_ROWS),
});

export const quizContent = z.object({
  answers: z.array(z.number().int().min(-1).max(25)).min(0).max(50),
  practicalText: z.string().max(20_000).optional().or(z.literal("")),
});

export type ValidatedContent = { ok: true; content: Record<string, unknown> } | { ok: false; error: string };

/**
 * Validates a submission payload against the *task's own* definition.
 * Returns normalised content: `undefined` keys dropped, derived fields (wordCount, score)
 * deliberately absent — those are filled in by the caller server-side.
 *
 * `lenient` is for drafts: shape, size and scheme are still enforced, but the brief's
 * completeness minimums are not, because a draft is by definition unfinished work.
 */
export function validateSubmissionContent(
  submissionType: string,
  config: TaskConfig,
  raw: unknown,
  opts: { lenient?: boolean } = {}
): ValidatedContent {
  const lenient = Boolean(opts.lenient);
  const size = safeJsonSize(raw);
  if (size === null) return fail("Submission could not be read.");
  if (size > MAX_CONTENT_BYTES) return fail(`Submission is too large (${Math.round(size / 1024)} KB, limit 200 KB).`);

  switch (submissionType) {
    case "link": {
      const rawObj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const url = typeof rawObj.url === "string" ? rawObj.url.trim() : "";
      const note = typeof rawObj.note === "string" ? truncate(rawObj.note.trim(), 2000) : "";
      if (!url) return lenient ? ok({ url: "", note }) : fail("Paste the URL you want us to look at.");
      if (!isPublicHttpUrl(url)) return fail("Enter a public http(s) URL — we fetch this page to snapshot it.");
      return ok({ url, note });
    }

    case "link_set": {
      const rawObj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const incoming = Array.isArray(rawObj.rows) ? rawObj.rows : [];
      const rows = incoming
        .map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            key: String(row.key ?? "").trim().slice(0, 60),
            url: String(row.url ?? "").trim(),
          };
        })
        // A draft with an empty row left open is normal; a submission is not.
        .filter((row) => row.url.length > 0);
      const expected = (config.link_set?.rows ?? []).map((x) => x.key);
      const unknown = rows.filter((row) => !expected.includes(row.key));
      if (unknown.length) return fail("Link set contains fields this task did not ask for.");
      const r = linkSetContent.safeParse({ rows });
      if (!r.success) return fail(firstIssue(r.error));
      const given = r.data.rows.map((x) => x.key);
      const missing = expected.filter((e) => !given.includes(e));
      if (missing.length && !lenient) return fail(`Still missing: ${missing.join(", ")}`);
      return ok({ rows: r.data.rows });
    }

    case "document": {
      const r = documentContent.safeParse(raw);
      if (!r.success) return fail(firstIssue(r.error));
      const body = r.data.body.trim();
      const words = countWords(body);
      const min = config.document?.minWords ?? 0;
      const max = config.document?.maxWords ?? 8000;
      if (words > max) return fail(`That is ${words} words. This brief caps at ${max}.`);
      if (words < min && !lenient) return fail(`That is ${words} words. This brief asks for at least ${min}.`);
      return ok({ body });
    }

    case "upload": {
      const r = uploadContent.safeParse(raw);
      if (!r.success) return fail(firstIssue(r.error));
      const max = config.upload?.maxFiles ?? 5;
      if (!r.data.files.length && !lenient) return fail("Attach at least one file.");
      if (r.data.files.length > max) return fail(`This brief takes ${max} file${max === 1 ? "" : "s"}, not ${r.data.files.length}.`);
      for (const f of r.data.files) {
        const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(f.dataUrl);
        if (!m || !m[3]) return fail(`"${f.name}" is not a readable data URL.`);
        const mime = m[1].toLowerCase();
        const allowedExt = UPLOAD_MIME.get(mime);
        if (!allowedExt) return fail(`"${f.name}" is a ${mime} file. Uploads accept PNG, JPEG, WebP, GIF or PDF.`);
        if (Buffer.byteLength(m[3], "utf8") * 0.75 > MAX_UPLOAD_BYTES) {
          return fail(`"${f.name}" is over the 1.75 MB limit.`);
        }
        const ext = f.name.toLowerCase().split(".").pop() ?? "";
        if (!allowedExt.includes(ext)) {
          return fail(`"${f.name}" claims to be ${mime} but the extension says otherwise.`);
        }
      }
      return ok({ files: r.data.files.map((f) => ({ name: f.name, dataUrl: f.dataUrl, caption: f.caption ?? "" })) });
    }

    case "structured":
    case "roster": {
      const schema = submissionType === "structured" ? structuredContent : rosterContent;
      const r = schema.safeParse(raw);
      if (!r.success) return fail(firstIssue(r.error));
      const columns =
        submissionType === "structured"
          ? (config.structured?.columns ?? []).map((c) => c.key)
          : (config.roster?.fields ?? []).map((f) => f.key);
      const minRows = (config.structured?.minRows ?? config.roster?.minRows) ?? 1;
      const filled = r.data.rows.filter((row) =>
        columns.some((c) => String(row[c] ?? "").trim().length > 0)
      );
      if (filled.length < minRows && !lenient) return fail(`This brief needs at least ${minRows} row${minRows === 1 ? "" : "s"}.`);
      for (const row of filled) {
        for (const key of Object.keys(row)) {
          if (!columns.includes(key)) return fail(`"${key}" is not a field on this brief.`);
        }
      }
      return ok({ rows: filled });
    }

    case "quiz": {
      const r = quizContent.safeParse(raw);
      if (!r.success) return fail(firstIssue(r.error));
      const questions = config.quiz?.questions ?? [];
      if (!questions.length) return fail("This assessment has no questions configured.");
      if (r.data.answers.length !== questions.length) {
        return lenient ? ok({ answers: normaliseDraftAnswers(r.data.answers, questions.length) }) : fail("Answer every question before submitting.");
      }
      const unanswered = r.data.answers.some((a) => a < 0);
      if (unanswered && !lenient) return fail("Answer every question before submitting.");
      if (r.data.answers.some((a, i) => a >= (questions[i]?.options?.length ?? 0))) {
        return fail("An answer does not match the options on this assessment.");
      }
      const practical = truncate((r.data.practicalText ?? "").trim(), 20_000);
      if (config.quiz?.practicalPrompt) {
        if (practical.length < 60 && !lenient) return fail("The written part needs at least 60 characters.");
        return ok({ answers: r.data.answers, practicalText: practical });
      }
      return ok({ answers: r.data.answers });
    }

    default:
      return fail("This task's submission type is not recognised.");
  }
}

function normaliseDraftAnswers(answers: number[], length: number): number[] {
  const out = answers.slice(0, length);
  while (out.length < length) out.push(-1);
  return out;
}

// ── URLs ────────────────────────────────────────────────────────────────────

/** Scheme-only check, for anything we render as an href. */
export function isSafeExternalUrl(value: string): boolean {
  if (!value) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

/** Safe to render, or null. Use at read time too: rows written before this existed may hold junk. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return isSafeExternalUrl(value) ? value : null;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "0.0.0.0",
]);

/**
 * True for a public web URL, false for anything that would make our server a proxy into
 * the private network. We resolve by hostname only — this blocks the obvious literal-IP
 * and internal-DNS cases; it does not defeat DNS rebinding, which needs a resolver-aware
 * fetch. Snapshots also follow redirects manually and re-check each hop.
 */
export function isPublicHttpUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "");
  if (!host) return false;
  if (BLOCKED_HOSTS.has(host)) return false;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) return false;
  if (/^[a-z0-9-]+\.localdomain$/i.test(host)) return false;
  if (!host.includes(".") && !/^\d/.test(host)) return false; // bare hostname = intranet by convention
  return !isPrivateAddress(host);
}

export function isPrivateAddress(host: string): boolean {
  // IPv4-mapped IPv6 translation
  if (host.startsWith('::ffff:')) {
    host = host.substring(7);
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [, a, b, c, d] = v4.map((x) => Number(x));
    if (a === 127 || a === 10 || a === 0) return true; // Loopback, Private, Current network
    if (a === 172 && b >= 16 && b <= 31) return true; // Private
    if (a === 192 && b === 168) return true; // Private
    if (a === 169 && b === 254) return true; // link-local, includes 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
    if (a === 192 && (b === 0 && (c === 0 || c === 2))) return true; // IETF Protocol / TEST-NET-1
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224 && a <= 239) return true; // Multicast
    if (a >= 240 && a <= 255) return true; // Reserved / Broadcast
    return false;
  }

  // Expand compressed IPv6 for easier matching
  const h = host.toLowerCase();

  if (h === "::1" || h === "::") return true; // Loopback or Unspecified
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}:/.test(h)) return true; // Multicast
  if (/^2001:db8:/.test(h)) return true; // Documentation
  return false;
}

// ── small helpers ───────────────────────────────────────────────────────────

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function safeJsonSize(value: unknown): number | null {
  try {
    const s = JSON.stringify(value);
    if (typeof s !== "string") return null;
    return Buffer.byteLength(s, "utf8");
  } catch {
    return null; // cycles, BigInt, etc
  }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const fail = (error: string) => ({ ok: false as const, error });
const ok = (content: Record<string, unknown>) => ({ ok: true as const, content });

function firstIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "That did not pass validation.";
  const msg = first.message;
  return msg === "Required" || msg === "Expected string, received number" || msg.startsWith("Invalid")
    ? "Some fields are missing or the wrong shape. Check the brief and try again."
    : msg;
}

// ── Other validated inputs ──────────────────────────────────────────────────

export const profileInput = z.object({
  pageUrl: z.string().trim().max(2048).optional().or(z.literal("")).refine(
    (v) => !v || isSafeExternalUrl(v),
    "Your page must be a full http(s) URL."
  ),
  lane: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
});

export const emailInput = z.string().trim().toLowerCase().email().max(254);

export const announcementInput = z.string().trim().min(1).max(2000);

export const feedbackInput = z.string().trim().max(4000);
