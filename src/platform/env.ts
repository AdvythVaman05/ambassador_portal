import { z } from "zod";

const envSchema = z.object({
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be PostgreSQL",
    ),
  SESSION_SECRET: z.string().min(32),
});

export type PlatformEnvironment = z.infer<typeof envSchema>;

export function validatePlatformEnvironment(
  environment: Record<string, string | undefined>,
): PlatformEnvironment {
  return envSchema.parse(environment);
}
