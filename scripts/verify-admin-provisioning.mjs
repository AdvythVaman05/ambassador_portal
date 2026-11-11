import postgres from "postgres";

const { MIGRATION_DATABASE_URL: connectionUrl, INITIAL_ADMIN_EMAIL: email } = process.env;
if (!connectionUrl || !email) {
  throw new Error("MIGRATION_DATABASE_URL and INITIAL_ADMIN_EMAIL are required");
}

const sql = postgres(connectionUrl, { connect_timeout: 15, max: 1, ssl: "require" });
try {
  const rows = await sql`
    SELECT 1
    FROM users AS u
    INNER JOIN role_assignments AS r ON r.user_id = u.id
    WHERE lower(u.email) = lower(${email}) AND r.role = 'admin'
    LIMIT 1
  `;
  if (!rows.length) {
    throw new Error("Provisioned administrator account or role was not found");
  }
  console.log("Administrator account and role verified.");
} finally {
  await sql.end({ timeout: 5 });
}
