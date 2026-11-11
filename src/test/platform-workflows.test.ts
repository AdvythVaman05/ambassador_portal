import { describe, expect, it } from "vitest";
import { DevelopmentRepository } from "@/platform/dev-repository";
import type { PlatformRepository } from "@/platform/repository";
import {
  acceptApplication,
  postMessage,
  reviewSubmission,
  submitApplication,
  submitWork,
  rejectApplication,
} from "@/platform/workflows";

const admin = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.test",
  displayName: "Admin",
  roles: ["admin"] as const,
};
const scout = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "scout@example.test",
  displayName: "Scout",
  roles: ["scout"] as const,
};
const applicationInput = {
  fullName: "Demo Scout",
  email: "demo@example.test",
  institution: "Demo U",
  course: "CS",
  statement: "I want to research answer engines and write useful work.",
  interests: ["research", "design"],
  skills: ["writing", "analysis"],
  portfolioUrl: "https://example.test/portfolio",
  previousWork: "A small published research note.",
  areas: ["Research", "Create"],
  consentAcknowledged: true,
  unpaidAcknowledged: true,
};

describe("platform workflows", () => {
  it("accepts an application and provisions an invitation", async () => {
    const repo = new DevelopmentRepository();
    const application = await submitApplication(repo, applicationInput);
    const invite = await acceptApplication(repo, admin, application.id);
    expect(invite.rawToken).toBeTruthy();
    expect((await repo.findApplication(application.id))?.status).toBe("accepted");
  });
  it("restricts rejection to administrators", async () => {
    const repo = new DevelopmentRepository();
    const application = await submitApplication(repo, {
      ...applicationInput,
      email: "reject@example.test",
    });
    await expect(rejectApplication(repo, scout, application.id, "Not selected")).rejects.toThrow();
    await rejectApplication(repo, admin, application.id, "Not selected");
    expect((await repo.findApplication(application.id))?.status).toBe("rejected");
  });
  it("writes an accepted review and one ledger entry", async () => {
    const repo = new DevelopmentRepository();
    const submission = await submitWork(repo, scout, {
      taskId: "00000000-0000-4000-8000-000000000010",
      body: "A documented research submission.",
    });
    const reviewed = await reviewSubmission(
      repo,
      admin,
      submission.id,
      "accepted",
      "Clear method.",
      10,
    );
    expect(reviewed.status).toBe("accepted");
    await expect(
      reviewSubmission(repo, admin, submission.id, "accepted", "Again", 10),
    ).rejects.toThrow("not available");
  });
  it("requires conversation membership", async () => {
    const repo = new DevelopmentRepository();
    await expect(
      postMessage(repo, scout, {
        conversationId: "00000000-0000-4000-8000-000000000020",
        body: "Hello",
      }),
    ).rejects.toThrow("membership");
  });

  it("persists every public application field and acknowledgement", async () => {
    const repo = new DevelopmentRepository();
    const application = await submitApplication(repo, applicationInput);
    expect(application).toMatchObject({
      interests: ["research", "design"],
      skills: ["writing", "analysis"],
      portfolioUrl: "https://example.test/portfolio",
      previousWork: "A small published research note.",
      areas: ["Research", "Create"],
      consentAcknowledged: true,
      unpaidAcknowledged: true,
    });
    expect(application.consentAcknowledgedAt).toBeInstanceOf(Date);
    expect(application.unpaidAcknowledgedAt).toBeInstanceOf(Date);
  });

  it("rejects missing acknowledgements and invalid field types", async () => {
    const repo = new DevelopmentRepository();
    await expect(
      submitApplication(repo, { ...applicationInput, consentAcknowledged: false }),
    ).rejects.toThrow();
    await expect(
      submitApplication(repo, { ...applicationInput, interests: "research" }),
    ).rejects.toThrow();
  });

  it("does not report a submission when the repository insert fails", async () => {
    const failingRepository = {
      createApplication: async () => {
        throw new Error("connection failed");
      },
    } as unknown as PlatformRepository;
    await expect(submitApplication(failingRepository, applicationInput)).rejects.toThrow(
      "connection failed",
    );
  });
});
