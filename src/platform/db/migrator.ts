import type { PostgresClient } from "../postgres-repository";

export type Migration = { id: string; sql: string };

/** Executes ordered, immutable migrations and records each successful migration atomically. */
export async function applyMigrations(client: PostgresClient, migrations: readonly Migration[]) {
  await client.query(
    "CREATE TABLE IF NOT EXISTS platform_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = await client.query<{ id: string }>("SELECT id FROM platform_migrations");
  const appliedIds = new Set(applied.rows.map((row) => row.id));
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    await client.transaction(async (transaction) => {
      await transaction.query(migration.sql);
      await transaction.query("INSERT INTO platform_migrations(id) VALUES($1)", [migration.id]);
    });
  }
}
