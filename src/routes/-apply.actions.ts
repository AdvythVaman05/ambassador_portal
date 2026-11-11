import { createServerFn } from "@tanstack/react-start";
import { applicationInputSchema } from "@/platform/validation";

export const submitApplicationServer = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const parsed = applicationInputSchema.safeParse(data);
    if (!parsed.success) return { ok: false as const, reason: "validation" as const };
    const { PlatformConfigurationError, platformRepositoryFromEnvironment } =
      await import("@/platform/service");
    const { submitApplication } = await import("@/platform/workflows");
    try {
      const configured = platformRepositoryFromEnvironment(process.env);
      const application = await submitApplication(configured.repository, parsed.data);
      return { ok: true as const, applicationId: application.id };
    } catch (error) {
      if (error instanceof PlatformConfigurationError)
        return { ok: false as const, reason: "not_configured" as const };
      // Keep connection and SQL details out of the public response and logs.
      console.error("Application submission failed");
      return { ok: false as const, reason: "unavailable" as const };
    }
  });
