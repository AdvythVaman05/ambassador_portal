import { PostgresRepository } from "./postgres-repository";
import { createPostgresClient } from "./postgres-client";
import { validatePlatformEnvironment, type PlatformEnvironment } from "./env";

export class PlatformConfigurationError extends Error {
  constructor() {
    super(
      "The authenticated platform is not configured. Set DATABASE_URL, SESSION_SECRET and APP_ORIGIN.",
    );
  }
}

export function platformRepositoryFromEnvironment(environment: Record<string, string | undefined>) {
  let parsed: PlatformEnvironment;
  try {
    parsed = validatePlatformEnvironment(environment);
  } catch {
    throw new PlatformConfigurationError();
  }
  return {
    repository: new PostgresRepository(createPostgresClient(parsed.DATABASE_URL)),
    environment: parsed,
  };
}
