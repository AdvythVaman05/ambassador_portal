import { PostgresRepository } from "./postgres-repository";
import { createPostgresClient } from "./postgres-client";
import { validatePlatformEnvironment } from "./env";

export class PlatformConfigurationError extends Error {
  constructor() {
    super(
      "The authenticated platform is not configured. Set DATABASE_URL, SESSION_SECRET and APP_ORIGIN.",
    );
  }
}

export function platformRepositoryFromEnvironment(environment: Record<string, string | undefined>) {
  const parsed = validatePlatformEnvironment(environment);
  return {
    repository: new PostgresRepository(createPostgresClient(parsed.DATABASE_URL)),
    environment: parsed,
  };
}
