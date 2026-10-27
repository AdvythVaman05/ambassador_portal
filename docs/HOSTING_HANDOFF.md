# Hosting handoff

Deploy the approved branch (or its merged PR) to a **Node.js-compatible** host. This application uses Nitro's `node-server` preset and a direct PostgreSQL client; do not deploy it as a static site or Cloudflare Worker.

Install and build with the existing package manager: `bun install --frozen-lockfile` then `bun run build`. Start the production bundle with `bun run start`. Confirm `GET /health` returns `{"status":"ok"}`.

Configure these hosting secrets: `APP_ORIGIN` (exact HTTPS URL), `DATABASE_URL` (TLS PostgreSQL URL), and `SESSION_SECRET` (unique 32+ character secret). Run `bun run migrate` against the dedicated database. To provision the initial administrator once, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in the host secret manager and run `bun run provision:admin`; it refuses to replace an existing account.

Provide the deployed URL and any access instructions to the application owner for their testing. Reuse the existing domain only when authorized; otherwise use the host's temporary staging URL. No domain, hosting provider, database provider, or credentials are specified here.
