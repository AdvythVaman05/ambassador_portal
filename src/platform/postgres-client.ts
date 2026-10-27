import postgres from "postgres";
import type { PostgresClient } from "./postgres-repository";

/** Production PostgreSQL binding. SQL text is static in repositories and values stay parameterized. */
export function createPostgresClient(
  databaseUrl: string,
): PostgresClient & { close(): Promise<void> } {
  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return {
    async query<T>(statement: string, values: readonly unknown[] = []) {
      const rows = await sql.unsafe(statement, [...values] as never[]);
      return { rows: rows as unknown as T[] };
    },
    async transaction<T>(work: (transaction: PostgresClient) => Promise<T>) {
      return sql.begin(async (transaction) =>
        work({
          async query<T>(statement: string, values: readonly unknown[] = []) {
            const rows = await transaction.unsafe(statement, [...values] as never[]);
            return { rows: rows as unknown as T[] };
          },
          async transaction<U>(nested: (inner: PostgresClient) => Promise<U>): Promise<U> {
            return nested(this);
          },
        }),
      ) as Promise<T>;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
