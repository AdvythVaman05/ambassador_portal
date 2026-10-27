import { createServerFn } from "@tanstack/react-start";
import { applicationInputSchema } from "@/platform/validation";

export const submitApplicationServer = createServerFn({ method: "POST" })
  .validator(applicationInputSchema)
  .handler(async ({ data }) => {
    const { platformRepositoryFromEnvironment } = await import("@/platform/service");
    const { submitApplication } = await import("@/platform/workflows");
    const configured = platformRepositoryFromEnvironment(process.env);
    const application = await submitApplication(configured.repository, data);
    return { applicationId: application.id };
  });
