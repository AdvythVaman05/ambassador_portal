import { describe, expect, it } from "vitest";
import { applyMigrations } from "../platform/db/migrator";
import type { PostgresClient } from "../platform/postgres-repository";

describe("applyMigrations", () => {
  it("runs each unapplied migration once", async () => {
    const statements: string[] = [];
    const applied = new Set<string>();
    const client: PostgresClient = {
      async query<T>(sql: string, values?: readonly unknown[]): Promise<{ rows: T[] }> {
        statements.push(sql);
        if (sql.startsWith("SELECT id")) return { rows: [...applied].map((id) => ({ id })) as T[] };
        if (sql.startsWith("INSERT INTO platform_migrations")) applied.add(String(values?.[0]));
        return { rows: [] };
      },
      async transaction(work) {
        return work(this);
      },
    };
    await applyMigrations(client, [{ id: "001", sql: "CREATE TABLE test" }]);
    await applyMigrations(client, [{ id: "001", sql: "CREATE TABLE test" }]);
    expect(statements.filter((statement) => statement === "CREATE TABLE test")).toHaveLength(1);
  });
});
