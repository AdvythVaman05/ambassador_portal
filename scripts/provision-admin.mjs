import postgres from "postgres";
const {
  MIGRATION_DATABASE_URL,
  DATABASE_URL,
  INITIAL_ADMIN_EMAIL: email,
  INITIAL_ADMIN_PASSWORD: password,
} = process.env;
const connectionUrl = MIGRATION_DATABASE_URL ?? DATABASE_URL;
if (!connectionUrl || !email || !password)
  throw new Error("DATABASE_URL, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required");
if (password.length < 12) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters");
const salt = crypto.getRandomValues(new Uint8Array(16));
const material = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const digest = new Uint8Array(
  await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 },
    material,
    256,
  ),
);
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const hash = `pbkdf2-sha256$310000$${b64(salt)}$${b64(digest)}`;
const sql = postgres(connectionUrl, { max: 1 });
try {
  await sql.begin(async (transaction) => {
    const users =
      await transaction`INSERT INTO users(email,display_name,password_hash) VALUES(${email.toLowerCase()},${"Platform administrator"},${hash}) ON CONFLICT(email) DO NOTHING RETURNING id`;
    if (!users[0]) throw new Error("Administrator already exists; refusing to replace credentials");
    await transaction`INSERT INTO role_assignments(user_id,role) VALUES(${users[0].id},'admin')`;
  });
  console.log("Administrator provisioned");
} finally {
  await sql.end();
}
