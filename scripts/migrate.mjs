import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// Use Neon’s direct URL for DDL when available; runtime queries use DATABASE_URL.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");
const sql = postgres(url, { max: 1 });
const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "platform",
  "db",
  "migrations",
);
try {
  await sql.unsafe(
    "CREATE TABLE IF NOT EXISTS platform_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set((await sql`SELECT id FROM platform_migrations`).map((row) => row.id));
  for (const id of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(id)) continue;
    const migration = await readFile(join(root, id), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`INSERT INTO platform_migrations(id) VALUES(${id})`;
    });
    console.log(`Applied ${id}`);
  }
} finally {
  await sql.end();
}
