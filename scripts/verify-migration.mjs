import { readdir } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const mode = process.argv[2];
if (mode !== "preflight" && mode !== "verify") {
  throw new Error("Usage: node scripts/verify-migration.mjs <preflight|verify>");
}

const connectionUrl = process.env.MIGRATION_DATABASE_URL;
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME;
if (!connectionUrl) throw new Error("MIGRATION_DATABASE_URL is required");
if (!expectedDatabase || !/^[A-Za-z0-9_-]+$/.test(expectedDatabase)) {
  throw new Error(
    "EXPECTED_DATABASE_NAME must contain only letters, numbers, underscores, or hyphens",
  );
}

const parsed = new URL(connectionUrl);
if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
  throw new Error("MIGRATION_DATABASE_URL must be a PostgreSQL URL");
}
if (!parsed.hostname.endsWith(".neon.tech")) {
  throw new Error("Migration target must use a Neon hostname");
}

// Resolve before connecting so DNS failures are distinct from PostgreSQL authentication failures.
await lookup(parsed.hostname, { all: true });
console.log("Neon hostname resolved.");

// Force TLS even if a manually supplied URL omits sslmode=require.
const sql = postgres(connectionUrl, { connect_timeout: 15, max: 1, ssl: "require" });
try {
  const [{ database }] = await sql`SELECT current_database() AS database`;
  if (database !== expectedDatabase) {
    throw new Error("Connected PostgreSQL database does not match EXPECTED_DATABASE_NAME");
  }
  console.log("PostgreSQL connectivity and intended database confirmed.");

  if (mode === "verify") {
    const migrationRoot = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "platform",
      "db",
      "migrations",
    );
    const expectedMigrations = (await readdir(migrationRoot))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const applied = new Set((await sql`SELECT id FROM platform_migrations`).map(({ id }) => id));
    const missingMigrations = expectedMigrations.filter((id) => !applied.has(id));
    if (missingMigrations.length) {
      throw new Error("Migration ledger is missing one or more repository migrations");
    }

    const requiredTables = [
      "platform_migrations",
      "users",
      "sessions",
      "applications",
      "tasks",
      "submissions",
      "reviews",
      "signal_ledger",
      "announcements",
      "conversations",
      "messages",
      "audit_events",
    ];
    const tables = new Set(
      (await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map(
        ({ tablename }) => tablename,
      ),
    );
    const missingTables = requiredTables.filter((table) => !tables.has(table));
    if (missingTables.length) {
      throw new Error("Expected platform tables are missing after migration");
    }
    console.log("Migration ledger and expected platform tables verified.");
  }
} finally {
  await sql.end({ timeout: 5 });
}
