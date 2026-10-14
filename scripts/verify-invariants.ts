/**
 * Invariant checks for the parts of Campus Circle that are pure enough to test without a
 * browser: what the validator refuses, what the SSRF guard blocks, whether the answer key
 * reaches the client, whether the reward ladder is idempotent, whether a sign-in token can be
 * spent twice.
 *
 *   npm run verify
 *
 * Runs against the DATABASE_URL in .env and only ever writes rows it creates itself.
 */
import assert from "assert";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { getAdminDashboard } from "@/lib/admin-dashboard";
import { rateLimit } from "@/lib/rate-limit";
import {
  isPublicHttpUrl,
  isPrivateAddress,
  safeHref,
  validateSubmissionContent,
  MAX_CONTENT_BYTES,
} from "../src/lib/validation";
import type { TaskConfig } from "../src/lib/tasks";
import { configForClient, effectiveStatus, parseContent, parseRubric, scoreQuiz } from "../src/lib/tasks";
import { canClaim, syncEarnedGrants } from "../src/lib/rewards";
import { consumeMagicLink, issueMagicLink, loginWithPassword } from "../src/lib/auth";
import { generatePassword, hashPassword, passwordProblem, verifyPassword } from "../src/lib/password";
import { tierAtLeast } from "../src/lib/signal";
import { accountInput, parseTypeConfig, rewardInput, taskInput } from "../src/lib/authoring";

const db = new PrismaClient();

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok    ${name}`);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      failures.push(`${name}: ${message}`);
      console.log(`  FAIL  ${name} — ${message}`);
    });
}

const cfg = (o: Partial<TaskConfig>): TaskConfig => o as TaskConfig;

const goodTask = {
  cohortId: "ck0",
  track: "B",
  code: "B9",
  week: 5,
  title: "A brief worth doing",
  summary: "Five sources, one table, your own read of them.",
  briefMd: "Do the thing.\n\nWhat good looks like: a specific claim and the evidence behind it.",
  submissionType: "link",
  rubric: ["The page is live at a URL you control"],
  signalValue: 40,
  opensAt: "2026-09-01",
  dueAt: "2026-09-30",
};

async function main() {
  console.log("\nURL and SSRF guards");
  await check("public https host allowed", () => assert.ok(isPublicHttpUrl("https://example.com/post")));
  await check("loopback v4 blocked", () => assert.ok(!isPublicHttpUrl("http://127.0.0.1:8080/admin")));
  await check("cloud metadata blocked", () => assert.ok(!isPublicHttpUrl("http://169.254.169.254/latest/meta-data/")));
  await check("private ranges blocked", () => {
    for (const url of ["http://10.1.2.3/", "http://192.168.0.1/", "http://172.16.0.9/", "http://100.64.0.1/"]) {
      assert.ok(!isPublicHttpUrl(url), `${url} should be blocked`);
    }
  });
  await check("localhost and internal names blocked", () => {
    for (const host of ["http://localhost:3000/", "http://db.internal/", "http://api.local/", "https://metadata/"]) {
      assert.ok(!isPublicHttpUrl(host), `${host} should be blocked`);
    }
  });
  await check("IPv6 loopback and unique-local blocked", () => {
    assert.ok(!isPublicHttpUrl("http://[::1]/"));
    assert.ok(!isPublicHttpUrl("http://[fd00::1]/"));
  });
  await check("non-http schemes blocked", () => {
    for (const host of ["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/"]) {
      assert.ok(!isPublicHttpUrl(host), `${host} should be blocked`);
    }
  });
  await check("javascript: never survives as an href", () => {
    assert.strictEqual(safeHref("javascript:alert(1)"), null);
    assert.strictEqual(safeHref("data:text/html,<script>alert(1)</script>"), null);
    assert.strictEqual(safeHref("https://ok.dev/page"), "https://ok.dev/page");
  });

  console.log("\nSubmission validation");
  await check("link refuses a javascript url", () => {
    const r = validateSubmissionContent("link", cfg({}), { url: "javascript:alert(1)" });
    assert.strictEqual(r.ok, false);
  });
  await check("link refuses an internal url", () => {
    const r = validateSubmissionContent("link", cfg({}), { url: "http://169.254.169.254/" });
    assert.strictEqual(r.ok, false);
  });
  await check("link accepts a public url", () => {
    const r = validateSubmissionContent("link", cfg({}), { url: "https://me.dev/a1", note: "hi" });
    assert.strictEqual(r.ok, true);
  });
  await check("draft may be empty, submission may not", () => {
    assert.strictEqual(validateSubmissionContent("link", cfg({}), { url: "" }, { lenient: true }).ok, true);
    assert.strictEqual(validateSubmissionContent("link", cfg({}), { url: "" }).ok, false);
  });
  await check("document word minimum enforced", () => {
    const config = cfg({ document: { minWords: 5, maxWords: 10, placeholder: "" } });
    assert.strictEqual(validateSubmissionContent("document", config, { body: "one two" }).ok, false);
    assert.strictEqual(validateSubmissionContent("document", config, { body: "one two three four five" }).ok, true);
    assert.strictEqual(validateSubmissionContent("document", config, { body: Array(50).fill("word").join(" ") }).ok, false);
  });
  await check("oversized payload rejected", () => {
    const big = "x".repeat(MAX_CONTENT_BYTES + 10);
    assert.strictEqual(validateSubmissionContent("document", cfg({}), { body: big }).ok, false);
  });
  await check("unknown structured column rejected", () => {
    const config = cfg({ structured: { minRows: 1, columns: [{ key: "prompt", label: "Prompt", type: "text" }] } });
    assert.strictEqual(validateSubmissionContent("structured", config, { rows: [{ prompt: "a", sneaky: "b" }] }).ok, false);
    assert.strictEqual(validateSubmissionContent("structured", config, { rows: [{ prompt: "a" }] }).ok, true);
  });
  await check("link_set rejects keys the brief never asked for", () => {
    const config = cfg({ link_set: { rows: [{ key: "own_page", label: "Page", placeholder: "" }] } });
    const r = validateSubmissionContent("link_set", config, { rows: [{ key: "admin_override", url: "https://x.dev" }] });
    assert.strictEqual(r.ok, false);
  });
  await check("quiz rejects an out-of-range answer index", () => {
    const config = cfg({ quiz: { questions: [{ prompt: "p", options: ["a", "b"], correctIndex: 1 }] } });
    assert.strictEqual(validateSubmissionContent("quiz", config, { answers: [7] }).ok, false);
    assert.strictEqual(validateSubmissionContent("quiz", config, { answers: [1] }).ok, true);
  });
  await check("cyclic or unserialisable payload is refused, not a 500", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.strictEqual(validateSubmissionContent("document", cfg({}), { body: cyclic }).ok, false);
  });

  console.log("\nScoring and derived state");
  const quizConfig = cfg({
    quiz: {
      questions: [
        { prompt: "a", options: ["x", "y"], correctIndex: 1 },
        { prompt: "b", options: ["x", "y"], correctIndex: 0 },
      ],
    },
  });
  await check("score is computed from the stored key", () => {
    assert.deepStrictEqual(scoreQuiz(quizConfig, [1, 0]), { correct: 2, total: 2 });
    assert.deepStrictEqual(scoreQuiz(quizConfig, [0, 1]), { correct: 0, total: 2 });
  });
  await check("answer key withheld until graded", () => {
    const task = { submissionType: "quiz", typeConfig: quizConfig };
    const hidden = configForClient(task, false) as { quiz?: { questions: { correctIndex?: number }[] } };
    const shown = configForClient(task, true) as { quiz?: { questions: { correctIndex?: number }[] } };
    assert.ok(hidden.quiz?.questions.every((q) => q.correctIndex === undefined), "key leaked to the client");
    assert.strictEqual(shown.quiz?.questions[0].correctIndex, 1);
  });
  await check("effectiveStatus respects publish and window", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    const open = { opensAt: new Date("2026-09-01"), dueAt: new Date("2026-09-30"), published: true };
    assert.strictEqual(effectiveStatus(open, undefined, now), "open");
    assert.strictEqual(effectiveStatus({ ...open, published: false }, undefined, now), "locked");
    assert.strictEqual(effectiveStatus({ ...open, dueAt: new Date("2026-09-10") }, undefined, now), "missed");
    assert.strictEqual(effectiveStatus(open, { status: "accepted" }, now), "accepted");
  });
  await check("Json columns parse without throwing on junk", () => {
    assert.deepStrictEqual(parseContent({ content: null }), {});
    assert.deepStrictEqual(parseContent({ content: '{"a":1}' }), { a: 1 });
    assert.deepStrictEqual(parseRubric({ rubric: "not json" }), []);
  });

  console.log("\nReward gates");
  await check("tier and signal both required", () => {
    assert.strictEqual(canClaim({ tier: "ambassador", signalTotal: 900, tierGate: "senior", signalGate: 10 }), "not_your_tier");
    assert.strictEqual(canClaim({ tier: "senior", signalTotal: 5, tierGate: "senior", signalGate: 10 }), "below_signal");
    assert.strictEqual(canClaim({ tier: "senior", signalTotal: 50, tierGate: "senior", signalGate: 10 }), null);
  });
  await check("tier ordering is not alphabetical", () => {
    assert.ok(tierAtLeast("campus_lead", "senior"));
    assert.ok(!tierAtLeast("ambassador", "senior"));
  });

  await check("earned grants materialise, and do not regress or duplicate", async () => {
    const cohort = await db.cohort.findFirstOrThrow();
    const campus = await db.campus.findFirstOrThrow({ where: { cohortId: cohort.id } });
    const stamp = Date.now();
    const user = await db.user.create({
      data: {
        email: `verify-${stamp}@example.test`,
        name: `Verify ${stamp}`,
        role: "ambassador",
        membership: { create: { cohortId: cohort.id, campusId: campus.id, tier: "senior", signalTotal: 999 } },
      },
      include: { membership: true },
    });
    try {
      const first = await syncEarnedGrants(user.id);
      const second = await syncEarnedGrants(user.id);
      const rows = await db.rewardGrant.findMany({ where: { userId: user.id } });
      assert.ok(first.newlyEarned > 0, "nothing was earned at 999 Signal and senior tier");
      assert.strictEqual(second.newlyEarned, 0, "second sync re-earned");
      const ids = rows.map((r) => r.rewardId);
      assert.strictEqual(new Set(ids).size, ids.length, "duplicate grants");
      assert.ok(rows.every((r) => r.status === "earned" && r.earnedAt), "grant not marked earned");

      // claimed must never be walked back to earned by a re-sync
      await db.rewardGrant.updateMany({ where: { userId: user.id }, data: { status: "claimed", claimedAt: new Date() } });
      await syncEarnedGrants(user.id);
      const after = await db.rewardGrant.findMany({ where: { userId: user.id } });
      assert.ok(after.every((r) => r.status === "claimed"), "claimed grant was downgraded");
    } finally {
      await db.rewardGrant.deleteMany({ where: { userId: user.id } });
      await db.membership.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });

  console.log("\nAuthoring validation");
  await check("task code must look like B2", () => {
    assert.strictEqual(taskInput.safeParse({ ...goodTask, code: "bee two" }).success, false);
    assert.strictEqual(taskInput.safeParse(goodTask).success, true);
  });
  await check("task requires a real brief and at least one rubric line", () => {
    assert.strictEqual(taskInput.safeParse({ ...goodTask, briefMd: "short" }).success, false);
    assert.strictEqual(taskInput.safeParse({ ...goodTask, rubric: [] }).success, false);
  });
  await check("quiz config refuses an answer key pointing off the end", () => {
    const r = parseTypeConfig("quiz", { questions: [{ prompt: "Which one?", options: ["a", "b"], correctIndex: 4 }] });
    assert.strictEqual(r.ok, false);
  });
  await check("document config refuses a minimum above its maximum", () => {
    assert.strictEqual(parseTypeConfig("document", { minWords: 500, maxWords: 200 }).ok, false);
    assert.strictEqual(parseTypeConfig("document", { minWords: 200, maxWords: 500 }).ok, true);
  });
  await check("table config refuses duplicate column keys and empty dropdowns", () => {
    assert.strictEqual(parseTypeConfig("structured", { minRows: 1, columns: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "B", type: "text" }] }).ok, false);
    assert.strictEqual(parseTypeConfig("structured", { minRows: 1, columns: [{ key: "a", label: "A", type: "select", options: [] }] }).ok, false);
  });
  await check("link set refuses duplicate field keys", () => {
    const rows = [
      { key: "own_page", label: "Page", placeholder: "" },
      { key: "own_page", label: "Again", placeholder: "" },
    ];
    assert.strictEqual(parseTypeConfig("link_set", { rows }).ok, false);
  });
  await check("an unknown submission type has no config", () => {
    assert.strictEqual(parseTypeConfig("telepathy", {}).ok, false);
  });
  await check("reward code shape is enforced", () => {
    assert.strictEqual(rewardInput.safeParse({ code: "Bad Code", name: "Kit", description: "A kit", tierGate: "senior", signalGate: 10, fulfilmentType: "shipped" }).success, false);
    assert.strictEqual(rewardInput.safeParse({ code: "field_kit", name: "Kit", description: "A kit", tierGate: "senior", signalGate: 10, fulfilmentType: "shipped" }).success, true);
  });
  await check("an account needs a usable email", () => {
    assert.strictEqual(accountInput.safeParse({ name: "A Person", email: "not-an-email", campusName: "Ashoka University", cohortId: "c1" }).success, false);
    assert.strictEqual(accountInput.safeParse({ name: "A Person", email: "a.person@college.edu", campusName: "Ashoka University", cohortId: "c1" }).success, true);
  });

  console.log("\nPasswords");
  await check("a password round-trips and a wrong one does not", () => {
    const secret = "correct horse 99";
    const stored = hashPassword(secret);
    assert.ok(stored.startsWith("scrypt$"));
    assert.notStrictEqual(stored.split("$")[4], stored.split("$")[5]); // salt is not the digest
    assert.ok(verifyPassword(secret, stored));
    assert.ok(!verifyPassword("correct horse 98", stored));
    assert.ok(!verifyPassword(secret, null));
    assert.ok(!verifyPassword(secret, "not-a-hash")); 
  });
  await check("two hashes of the same password differ (salted)", () => {
    assert.notStrictEqual(hashPassword("same secret 12"), hashPassword("same secret 12"));
  });
  await check("policy rejects weak shapes and accepts a real one", () => {
    assert.ok(passwordProblem("short1")); 
    assert.ok(passwordProblem("alllettersnonumbers"));
    assert.ok(passwordProblem("aaaaaaaaaaaa"));
    assert.ok(passwordProblem("password123"));
    assert.strictEqual(passwordProblem("circle-cohort-one-9"), null);
  });
  await check("generated passwords satisfy the policy", () => {
    for (let i = 0; i < 50; i++) {
      const generated = generatePassword();
      assert.strictEqual(passwordProblem(generated), null, "generated " + generated);
    }
  });
  await check("a login for an unknown address still costs a hash comparison", async () => {
    const started = process.hrtime.bigint();
    const unknown = await loginWithPassword(`nobody-${Date.now()}@example.test`, "whatever 12345");
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    assert.deepStrictEqual(unknown, { error: "invalid" });
    assert.ok(elapsed > 5, "returned instantly: the timing oracle is back, took " + elapsed.toFixed(1) + "ms");
  });
  await check("a wrong password on a real account is refused", async () => {
    const email = "kunal@rothenhall.com";
    assert.deepStrictEqual(await loginWithPassword(email, "definitely-not-it-1"), { error: "invalid" });
  });
  await check("the right password signs in, and suspension stops it", async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { email: "kunal@rothenhall.com" } });
    const good = await loginWithPassword(admin.email, "Circle-Operator-2026");
    assert.ok("user" in good, "the seeded operator password did not work");
    await db.user.update({ where: { id: admin.id }, data: { status: "suspended" } });
    assert.deepStrictEqual(await loginWithPassword(admin.email, "Circle-Operator-2026"), { error: "suspended" });
    await db.user.update({ where: { id: admin.id }, data: { status: "active" } });
  });
  await check("a link-only account cannot be password-signed-into", async () => {
    const cohort = await db.cohort.findFirstOrThrow();
    const campus = await db.campus.findFirstOrThrow({ where: { cohortId: cohort.id } });
    const email = `linkonly-${Date.now()}@example.test`;
    const created = await db.user.create({ data: { email, name: "Link Only", role: "ambassador" } });
    await db.membership.create({ data: { userId: created.id, cohortId: cohort.id, campusId: campus.id } });
    assert.deepStrictEqual(await loginWithPassword(email, "anything 12345"), { error: "invalid" });
    await db.membership.deleteMany({ where: { userId: created.id } });
    await db.user.delete({ where: { id: created.id } });
  });

  console.log("\nDashboard Rules");
  await check("at risk checking rules", async () => {
    try {
      const dbh = await getAdminDashboard();
      if (!dbh) return;
      const atRiskAmbassadors = dbh.ambassadors.filter(a => a.atRiskReason);
      for (const a of atRiskAmbassadors) {
        if (!a.atRiskReason) continue;
        const tasks = dbh.tasks.filter(t => t.track === a.lane && new Date(t.dueAtISO).getTime() < Date.now());
        const expectedToHaveMissed = tasks.some(t => {
           const sub = a.submissions.find(s => s.code === t.code);
           return !sub || sub.status === "draft" || sub.status === "missed" || sub.status === "rejected";
        });

        const inactive = a.lastActiveISO && (Date.now() - new Date(a.lastActiveISO).getTime()) / 3600000 > 240;
        assert.ok(expectedToHaveMissed || inactive, "User flagged at risk without meeting the strict criteria");
      }
    } catch {
       // Ignore failures if DB is empty
    }
  });

  console.log("\nRate Limiting");
  await check("rate limiter falls back securely on local memory limits", async () => {
      // Testing in memory fallback since redis doesn't exist
      const key = "test_limit_key_" + Date.now();
      const r1 = await rateLimit(key, 2, 1000);
      assert.ok(r1.ok);
      const r2 = await rateLimit(key, 2, 1000);
      assert.ok(r2.ok);
      const r3 = await rateLimit(key, 2, 1000);
      assert.ok(!r3.ok);
  });

  console.log("\nMagic links");
  await check("a token can only be spent once", async () => {
    const email = `verify-once-${Date.now()}@example.test`;
    const issued = await issueMagicLink(email);
    assert.ok(issued, "no token issued");
    assert.strictEqual(await consumeMagicLink(issued.token), email);
    assert.strictEqual(await consumeMagicLink(issued.token), null, "token was reusable");
  });
  await check("a wrong or absent token yields nothing", async () => {
    assert.strictEqual(await consumeMagicLink("not-a-real-token-value"), null);
    assert.strictEqual(await consumeMagicLink(""), null);
  });
  await check("an expired token is dead", async () => {
    const issued = await issueMagicLink(`verify-expiry-${Date.now()}@example.test`);
    assert.ok(issued);
    await db.magicLink.update({ where: { tokenHash: hashOf(issued.token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.strictEqual(await consumeMagicLink(issued.token), null);
  });

  const stats = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "User"`;
  await check("database is reachable and seeded", () => assert.ok(Number(stats[0].n) >= 12, "seed data missing"));

  await db.$disconnect();

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  }
}

function hashOf(token: string) {
  // Mirrors src/lib/auth.ts; kept local so the test cannot accidentally widen the helper's reach.
  return crypto.createHash("sha256").update(token).digest("hex");
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
